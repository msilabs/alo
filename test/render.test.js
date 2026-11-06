'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function site(page, components) {
    const files = { 'pages/page.alo': `<template>${page}</template>` };
    for (const [name, source] of Object.entries(components)) files[`components/${name}.alo`] = source;
    const result = compile({ reader: createMemoryReader(files), mode: 'dev' });
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
    assert.fail('expected an error');
}

const SHOW = { Show: '<template>{{ JSON.stringify(props) }}</template>' };

function propsOf(attrs) {
    return JSON.parse(site(`<Show ${attrs} />`, SHOW).body.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}

test('props: strings, partial values as strings, whole values as real values, booleans, kebab to camel', () => {
    assert.deepEqual(
        propsOf(`title="হ্যালো" subtitle="পোস্ট: {{ 'ক' + 1 }}" post="{{ ({ slug: 'a' }) }}" count="{{ 5 }}" raw="5" featured off="{{ false }}" post-date="আজ"`),
        { title: 'হ্যালো', subtitle: 'পোস্ট: ক1', post: { slug: 'a' }, count: 5, raw: '5', featured: true, off: false, postDate: 'আজ' },
    );
});

test('entities in prop strings are decoded once and escaped again in the component', () => {
    const { body } = site(`<Title text="A &amp; B &lt;3 &#2438;" />`, { Title: '<template><h1>{{ props.text }}</h1></template>' });
    assert.equal(body, '<h1>A &amp; B &lt;3 আ</h1>');
});

test('a partial-value prop is not escaped until the component prints it', () => {
    const { body } = site(`<Title text="x {{ '<b>' }}" />`, { Title: '<template><h1>{{ props.text }}</h1></template>' });
    assert.equal(body, '<h1>x &lt;b&gt;</h1>');
});

test('props are read only through props, class included', () => {
    const { body } = site(`<Card class="mt-4" title="ক" />`, {
        Card: '<template><div class="card {{ props.class }}">{{ props.title }}</div></template>',
    });
    assert.equal(body, '<div class="card mt-4">ক</div>');
});

test('prop names do not become variables', () => {
    const err = siteError(`<Card title="ক" />`, { Card: '<template>{{ title }}</template>' });
    assert.match(err.message, /`title` is not defined/);
    assert.match(err.hint, /`props`/);
});

test('class and id are not added to the root; a missing prop is undefined', () => {
    const { body } = site(`<Card class="x" id="y" />`, { Card: '<template><div>{{ props.title ?? "শিরোনাম নেই" }}</div></template>' });
    assert.equal(body, '<div>শিরোনাম নেই</div>');
});

test('components see data, route and base but not item', () => {
    const { body } = site(`<Info />`, { Info: '<template>{{ route.path }}|{{ base }}|{{ typeof data }}</template>' });
    assert.equal(body, '/|/|object');
    assert.match(siteError(`<Info />`, { Info: '<template>{{ item }}</template>' }).message, /`item` is not defined/);
});

test('a missing prop is undefined even when its name matches a global', () => {
    const { body } = site('<Card />', { Card: '<template>{{ typeof props.navigator }}|{{ Math.max(1, 2) }}|{{ JSON.stringify([1]) }}</template>' });
    assert.equal(body, 'undefined|2|[1]');
});

test('props named data, item or props are ordinary and do not hide scope variables', () => {
    const { body } = site(`<Card data="ক" item="খ" props="গ" />`, {
        Card: '<template>{{ props.data }}{{ props.item }}{{ props.props }}|{{ typeof data }}</template>',
    });
    assert.equal(body, 'কখগ|object');
});

test('{{{ }}} in a prop fails', () => {
    assert.match(siteError(`<Card t="{{{ 'x' }}}" />`, { Card: '<template>{{ props.t }}</template>' }).message, /`\{\{\{ \}\}\}` cannot be used in an attribute/);
});

test('slot: content goes in and renders in the parent scope', () => {
    const { body } = site(`<template for="name in ['ক']"><Card title="T"><b>{{ name }}</b></Card></template>`, {
        Card: '<template><div><h2>{{ props.title }}</h2><slot /></div></template>',
    });
    assert.equal(body, '<div><h2>T</h2><b>ক</b></div>');
});

test('slot content does not see the component props', () => {
    const err = siteError(`<Card title="T">{{ title }}</Card>`, { Card: '<template><slot /></template>' });
    assert.match(err.message, /`title` is not defined/);
    assert.equal(err.file, 'pages/page.alo');
});

test('fallback content shows when nothing or only whitespace is passed', () => {
    const components = { Box: '<template><div><slot>{{ "খালি" }}</slot></div></template>' };
    assert.equal(site('<Box />', components).body, '<div>খালি</div>');
    assert.equal(site('<Box>\n  <!-- c -->\n</Box>', components).body, '<div>খালি</div>');
    assert.equal(site('<Box>পূর্ণ</Box>', components).body, '<div>পূর্ণ</div>');
});

test('passing content to a component without <slot /> warns', () => {
    const { body, warnings } = site('<Card>লেখা</Card>', { Card: '<template><div></div></template>' });
    assert.equal(body, '<div></div>');
    assert.match(warnings[0].message, /`<Card>` has no `<slot \/>`/);
});

test('several or named slots in a component fail', () => {
    assert.match(siteError('<Card />', { Card: '<template><slot /><slot /></template>' }).message, /More than one `<slot>`/);
    assert.match(siteError('<Card />', { Card: '<template><slot name="a" /></template>' }).message, /`<slot>` cannot have attributes/);
});

test('slots inside a plain HTML template are left alone', () => {
    const { body } = site('<Wc>x</Wc>', { Wc: '<template><template id="t"><slot name="a"></slot></template><slot /></template>' });
    assert.equal(body, '<template id="t"><slot name="a"></slot></template>x');
});

test('nested components can pass a slot on', () => {
    const { body } = site('<Outer>ভেতর</Outer>', {
        Outer: '<template><section><Inner><slot /></Inner></section></template>',
        Inner: '<template><div><slot /></div></template>',
    });
    assert.equal(body, '<section><div>ভেতর</div></section>');
});

test('whitespace around component output is trimmed', () => {
    const { body } = site('<p>[<Badge />]</p>', { Badge: '<template>\n    <span>নতুন</span>\n</template>' });
    assert.equal(body, '<p>[<span>নতুন</span>]</p>');
});

test('a circular dependency fails with the whole chain', () => {
    const err = siteError('<A />', {
        A: '<template><B /></template>',
        B: '<template><C /></template>',
        C: '<template>\n  <A />\n</template>',
    });
    assert.match(err.message, /<A> → <B> → <C> → <A>/);
    assert.deepEqual([err.file, err.line], ['components/C.alo', 2]);
});

test('errors inside a component include where it was called', () => {
    const err = siteError('\n\n<Blog.PostCard />', {
        'blog/PostCard': '<template>\n  <a href="/blog/{{ props.post.slug }}/">x</a>\n</template>',
    });
    assert.equal(err.file, 'components/blog/PostCard.alo');
    assert.equal(err.line, 2);
    assert.equal(err.message, '`props.post` is `undefined`, so `.slug` cannot be read.');
    assert.deepEqual(err.calledFrom, { file: 'pages/page.alo', line: 3, column: 1 });
});

test('nested component errors point at the closest caller', () => {
    const err = siteError('<Outer />', {
        Outer: '<template>\n<Inner />\n</template>',
        Inner: '<template>{{ props.nope.x }}</template>',
    });
    assert.equal(err.file, 'components/Inner.alo');
    assert.equal(err.message, '`props.nope` is `undefined`, so `.x` cannot be read.');
    assert.deepEqual(err.calledFrom, { file: 'components/Outer.alo', line: 2, column: 1 });
});

test('a prop typo warns with a suggestion', () => {
    const { warnings } = site('<Card titel="x" class="c" id="i" />', { Card: '<template><h2>{{ props.title }}</h2></template>' });
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].message, '`<Card>` never uses `titel`.');
    assert.equal(warnings[0].hint, 'Did you mean `title`?');
    assert.equal(warnings[0].file, 'pages/page.alo');
});

test('props read as props.x do not warn; props[x] turns the check off', () => {
    const used = site('<Card subtitle="a" tags="{{ [1] }}" />', {
        Card: '<template>{{ props.subtitle }}<template for="t in props.tags">{{ t }}</template></template>',
    });
    assert.equal(used.warnings.length, 0);

    const dynamic = site('<Card anything="a" />', { Card: '<template>{{ props["x"] }}</template>' });
    assert.equal(dynamic.warnings.length, 0);
});

test('an unused prop without a close name gets a usage hint', () => {
    const { warnings } = site('<Card color="red" />', { Card: '<template><p>{{ props.title }}</p></template>' });
    assert.match(warnings[0].hint, /Use it in components\/Card\.alo as `\{\{ props\.color \}\}`/);
});
