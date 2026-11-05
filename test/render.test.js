'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function site(page, components) {
    const files = { 'pages/page.alo': `<template>${page}</template>` };
    for (const [name, source] of Object.entries(components)) files[`components/${name}.alo`] = source;
    const result = compile({ reader: createMemoryReader(files) });
    const html = result.files[0].contents;
    return { body: html.slice(html.indexOf('<body>\n') + 7, html.indexOf('\n</body>')), warnings: result.warnings };
}

function siteError(page, components) {
    try {
        site(page, components);
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

const SHOW = { Show: '<template>{{ JSON.stringify(props) }}</template>' };

function propsOf(attrs) {
    return JSON.parse(site(`<Show ${attrs} />`, SHOW).body.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}

test('প্রপস: স্ট্রিং, অংশ-মানে স্ট্রিং, পুরো-মানে আসল মান, boolean, kebab থেকে camel', () => {
    assert.deepEqual(
        propsOf(`title="হ্যালো" subtitle="পোস্ট: {{ 'ক' + 1 }}" post="{{ ({ slug: 'a' }) }}" count="{{ 5 }}" raw="5" featured off="{{ false }}" post-date="আজ"`),
        { title: 'হ্যালো', subtitle: 'পোস্ট: ক1', post: { slug: 'a' }, count: 5, raw: '5', featured: true, off: false, postDate: 'আজ' },
    );
});

test('প্রপের স্ট্রিংয়ে entity একবারই decode হয়, আর কম্পোনেন্টে আবার escape হয়', () => {
    const { body } = site(`<Title text="A &amp; B &lt;3 &#2438;" />`, { Title: '<template><h1>{{ text }}</h1></template>' });
    assert.equal(body, '<h1>A &amp; B &lt;3 আ</h1>');
});

test('অংশ-মানের প্রপ escape হয় না, কম্পোনেন্টে একবার escape হয়', () => {
    const { body } = site(`<Title text="x {{ '<b>' }}" />`, { Title: '<template><h1>{{ text }}</h1></template>' });
    assert.equal(body, '<h1>x &lt;b&gt;</h1>');
});

test('প্রপ পড়া যায় নাম ধরে আর props থেকে; class পড়তে হয় props.class দিয়ে', () => {
    const { body } = site(`<Card class="mt-4" title="ক" />`, {
        Card: '<template><div class="card {{ props.class }}">{{ title }}|{{ props.title }}</div></template>',
    });
    assert.equal(body, '<div class="card mt-4">ক|ক</div>');
});

test('class আর id নিজে থেকে রুটে বসে না; না পাঠানো প্রপ undefined', () => {
    const { body } = site(`<Card class="x" id="y" />`, { Card: '<template><div>{{ title ?? "শিরোনাম নেই" }}</div></template>' });
    assert.equal(body, '<div>শিরোনাম নেই</div>');
});

test('কম্পোনেন্ট data, route আর base দেখে, item দেখে না', () => {
    const { body } = site(`<Info />`, { Info: '<template>{{ route.path }}|{{ base }}|{{ typeof data }}</template>' });
    assert.equal(body, '/|/|object');
    assert.match(siteError(`<Info />`, { Info: '<template>{{ item }}</template>' }).message, /`item` নামে কোনো ভেরিয়েবল নেই/);
});

test('না পাঠানো প্রপ undefined, অব্যবহৃত গ্লোবাল আগের মতোই কাজ করে', () => {
    const { body } = site('<Card />', { Card: '<template>{{ typeof title }}|{{ Math.max(1, 2) }}|{{ JSON.stringify([1]) }}</template>' });
    assert.equal(body, 'undefined|2|[1]');
});

test('সংরক্ষিত নামে প্রপ পাঠালে এরর', () => {
    for (const name of ['data', 'route', 'base', 'props', 'item']) {
        const err = siteError(`<Card ${name}="x" />`, { Card: '<template>{{ props }}</template>' });
        assert.match(err.message, new RegExp(`\`${name}\` নামে প্রপ পাঠানো যায় না`));
    }
});

test('অ্যাট্রিবিউটে {{{ }}} প্রপেও এরর', () => {
    assert.match(siteError(`<Card t="{{{ 'x' }}}" />`, { Card: '<template>{{ t }}</template>' }).message, /`\{\{\{ \}\}\}` চলে না/);
});

test('স্লট: কনটেন্ট বসে, প্যারেন্টের স্কোপে রেন্ডার হয়', () => {
    const { body } = site(`<template for="name in ['ক']"><Card title="T"><b>{{ name }}</b></Card></template>`, {
        Card: '<template><div><h2>{{ title }}</h2><slot /></div></template>',
    });
    assert.equal(body, '<div><h2>T</h2><b>ক</b></div>');
});

test('স্লটের ভেতরের ভেরিয়েবল কম্পোনেন্টের প্রপ দেখে না', () => {
    const err = siteError(`<Card title="T">{{ title }}</Card>`, { Card: '<template><slot /></template>' });
    assert.match(err.message, /`title` নামে কোনো ভেরিয়েবল নেই/);
    assert.equal(err.file, 'pages/page.alo');
});

test('ফলব্যাক কনটেন্ট: কিছু না দিলে বা শুধু ফাঁকা দিলে', () => {
    const components = { Box: '<template><div><slot>{{ "খালি" }}</slot></div></template>' };
    assert.equal(site('<Box />', components).body, '<div>খালি</div>');
    assert.equal(site('<Box>\n  <!-- c -->\n</Box>', components).body, '<div>খালি</div>');
    assert.equal(site('<Box>পূর্ণ</Box>', components).body, '<div>পূর্ণ</div>');
});

test('<slot /> না থাকলে কনটেন্ট দিলে সতর্কবার্তা', () => {
    const { body, warnings } = site('<Card>লেখা</Card>', { Card: '<template><div></div></template>' });
    assert.equal(body, '<div></div>');
    assert.match(warnings[0].message, /`<Card>`-এ `<slot \/>` নেই/);
});

test('কম্পোনেন্টে একাধিক বা নামযুক্ত slot থাকলে এরর', () => {
    assert.match(siteError('<Card />', { Card: '<template><slot /><slot /></template>' }).message, /একটার বেশি `<slot>`/);
    assert.match(siteError('<Card />', { Card: '<template><slot name="a" /></template>' }).message, /`<slot>`-এ অ্যাট্রিবিউট চলে না/);
});

test('সাধারণ HTML template-এর ভেতরের slot ছোঁয়া হয় না', () => {
    const { body } = site('<Wc>x</Wc>', { Wc: '<template><template id="t"><slot name="a"></slot></template><slot /></template>' });
    assert.equal(body, '<template id="t"><slot name="a"></slot></template>x');
});

test('নেস্টেড কম্পোনেন্ট আর স্লট দিয়ে স্লট পাঠানো', () => {
    const { body } = site('<Outer>ভেতর</Outer>', {
        Outer: '<template><section><Inner><slot /></Inner></section></template>',
        Inner: '<template><div><slot /></div></template>',
    });
    assert.equal(body, '<section><div>ভেতর</div></section>');
});

test('কম্পোনেন্টের আউটপুটের চারপাশের ফাঁকা জায়গা বাদ যায়', () => {
    const { body } = site('<p>[<Badge />]</p>', { Badge: '<template>\n    <span>নতুন</span>\n</template>' });
    assert.equal(body, '<p>[<span>নতুন</span>]</p>');
});

test('সার্কুলার ডিপেন্ডেন্সিতে পুরো চেইনসহ এরর', () => {
    const err = siteError('<A />', {
        A: '<template><B /></template>',
        B: '<template><C /></template>',
        C: '<template>\n  <A />\n</template>',
    });
    assert.match(err.message, /<A> → <B> → <C> → <A>/);
    assert.deepEqual([err.file, err.line], ['components/C.alo', 2]);
});

test('কম্পোনেন্টের ভেতরের এররে ডাকার জায়গা থাকে', () => {
    const err = siteError('\n\n<Blog.PostCard />', {
        'blog/PostCard': '<template>\n  <a href="/blog/{{ post.slug }}/">x</a>\n</template>',
    });
    assert.equal(err.file, 'components/blog/PostCard.alo');
    assert.equal(err.line, 2);
    assert.equal(err.message, '`post` হলো `undefined`, তাই `.slug` পড়া যায় না।');
    assert.deepEqual(err.calledFrom, { file: 'pages/page.alo', line: 3, column: 1 });
});

test('নেস্টেড কম্পোনেন্টের এররে সবচেয়ে কাছের ডাকার জায়গা', () => {
    const err = siteError('<Outer />', {
        Outer: '<template>\n<Inner />\n</template>',
        Inner: '<template>{{ nope.x }}</template>',
    });
    assert.equal(err.file, 'components/Inner.alo');
    assert.equal(err.message, '`nope` হলো `undefined`, তাই `.x` পড়া যায় না।');
    assert.deepEqual(err.calledFrom, { file: 'components/Outer.alo', line: 2, column: 1 });
});

test('প্রপের টাইপোতে সতর্কবার্তা আর পরামর্শ', () => {
    const { warnings } = site('<Card titel="x" class="c" id="i" />', { Card: '<template><h2>{{ title }}</h2></template>' });
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].message, '`<Card>`-এ `titel` কোথাও ব্যবহার হয়নি।');
    assert.equal(warnings[0].hint, 'তুমি কি `title` বোঝাতে চেয়েছিলে?');
    assert.equal(warnings[0].file, 'pages/page.alo');
});

test('props.x বা লুপে ব্যবহার করা প্রপে সতর্কবার্তা নেই; props[x] থাকলে যাচাই বন্ধ', () => {
    const used = site('<Card subtitle="a" tags="{{ [1] }}" />', {
        Card: '<template>{{ props.subtitle }}<template for="t in tags">{{ t }}</template></template>',
    });
    assert.equal(used.warnings.length, 0);

    const dynamic = site('<Card anything="a" />', { Card: '<template>{{ props["x"] }}</template>' });
    assert.equal(dynamic.warnings.length, 0);
});

test('অব্যবহৃত প্রপের কাছাকাছি নাম না থাকলে ব্যবহারের ইঙ্গিত', () => {
    const { warnings } = site('<Card color="red" />', { Card: '<template><p>{{ title }}</p></template>' });
    assert.match(warnings[0].hint, /components\/Card\.alo-এ `\{\{ color \}\}` লিখে ব্যবহার করো/);
});
