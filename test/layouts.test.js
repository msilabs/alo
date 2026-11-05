'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function build(files) {
    const result = compile({ reader: createMemoryReader(files) });
    const pages = {};
    for (const file of result.files) {
        const html = file.contents;
        pages[file.path] = {
            head: html.slice(html.indexOf('<head>\n') + 7, html.indexOf('\n</head>')),
            body: html.includes('<body>\n</body>') ? '' : html.slice(html.indexOf('<body>\n') + 7, html.indexOf('\n</body>')),
        };
    }
    return { pages, warnings: result.warnings };
}

function buildError(files) {
    try {
        build(files);
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

const SITE = {
    'pages/(site)/layout.alo': '<template><header>সাইট</header><main><slot /></main></template>',
    'pages/(site)/page.alo': '<template><h1>হোম</h1></template>',
    'pages/(site)/blog/layout.alo': '<template><section class="blog"><slot /></section></template>',
    'pages/(site)/blog/page.alo': '<template><h1>ব্লগ</h1></template>',
    'pages/(bare)/launch/page.alo': '<template><h1>লঞ্চ</h1></template>',
};

test('পেইজ কাছের লেআউটে বসে, তারপর উপরেরটায়', () => {
    const { pages } = build(SITE);
    assert.equal(pages['index.html'].body, '<header>সাইট</header><main><h1>হোম</h1></main>');
    assert.equal(pages['blog/index.html'].body, '<header>সাইট</header><main><section class="blog"><h1>ব্লগ</h1></section></main>');
});

test('অন্য রাউট গ্রুপের পেইজ লেআউট পায় না', () => {
    assert.equal(build(SITE).pages['launch/index.html'].body, '<h1>লঞ্চ</h1>');
});

test('লেআউট route.path দেখে আর স্লটের ফলব্যাক উপেক্ষা হয়', () => {
    const { pages } = build({
        'pages/layout.alo': '<template><nav>{{ route.path }}</nav><slot>ফলব্যাক</slot></template>',
        'pages/about/page.alo': '<template>আমরা</template>',
        'pages/empty/page.alo': '',
    });
    assert.equal(pages['about/index.html'].body, '<nav>/about/</nav>আমরা');
    assert.equal(pages['empty/index.html'].body, '<nav>/empty/</nav>');
});

test('লেআউটে কম্পোনেন্ট চলে, আর সেটা ব্যবহৃত ধরা হয়', () => {
    const { pages, warnings } = build({
        'pages/layout.alo': '<template><Header /><slot /></template>',
        'pages/page.alo': '<template>হোম</template>',
        'components/Header.alo': '<template><header>শিরোনাম</header></template>',
    });
    assert.equal(pages['index.html'].body, '<header>শিরোনাম</header>হোম');
    assert.equal(warnings.length, 0);
});

test('head মার্জ: রুট লেআউট → ভেতরের লেআউট → পেইজ', () => {
    const { pages } = build({
        'pages/layout.alo': '<head><title>সাইট</title><meta name="description" content="সাইট"><link rel="icon" href="/f.ico"></head><template><slot /></template>',
        'pages/blog/layout.alo': '<head><meta name="description" content="ব্লগ"></head><template><slot /></template>',
        'pages/blog/page.alo': '<head><title>প্রথম লেখা</title><link rel="icon" href="/f.ico"></head><template>x</template>',
    });
    assert.equal(
        pages['blog/index.html'].head,
        [
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>প্রথম লেখা</title>',
            '<link rel="icon" href="/f.ico">',
            '<meta name="description" content="ব্লগ">',
        ].join('\n'),
    );
});

test('head-এ এক্সপ্রেশন আর template লজিক লেআউটেও চলে', () => {
    const { pages } = build({
        'pages/layout.alo': '<head><template if="route.path === \'/\'"><meta name="home" content="yes"></template></head><template><slot /></template>',
        'pages/page.alo': '',
        'pages/about/page.alo': '',
    });
    assert.match(pages['index.html'].head, /<meta name="home" content="yes">/);
    assert.doesNotMatch(pages['about/index.html'].head, /home/);
});

test('not-found থেকে 404.html, শুধু pages/layout.alo দিয়ে মোড়ানো', () => {
    const { pages } = build({
        'pages/layout.alo': '<template><div class="shell"><slot /></div></template>',
        'pages/blog/layout.alo': '<template><section><slot /></section></template>',
        'pages/blog/page.alo': '',
        'pages/not-found.alo': '<head><title>পাওয়া যায়নি</title></head><template><h1>404</h1><p>{{ route.path }}</p></template>',
    });
    assert.equal(pages['404.html'].body, '<div class="shell"><h1>404</h1><p>/404.html</p></div>');
    assert.match(pages['404.html'].head, /<title>পাওয়া যায়নি<\/title>/);
});

test('লেআউটের ভেতরের এররে লেআউটের ফাইল আর লাইন', () => {
    const err = buildError({
        'pages/layout.alo': '<template>\n  {{ nope }}\n  <slot />\n</template>',
        'pages/page.alo': '',
    });
    assert.deepEqual([err.file, err.line], ['pages/layout.alo', 2]);
});

test('লেআউটে slot না থাকলে এরর', () => {
    const err = buildError({ 'pages/layout.alo': '<template><main></main></template>', 'pages/page.alo': '' });
    assert.equal(err.file, 'pages/layout.alo');
    assert.match(err.message, /`<slot \/>` নেই/);
});
