'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBase, applyBase } = require('../core/base-path.js');
const { minifyCss } = require('../core/css-minify.js');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function build(files, options = {}) {
    const result = compile({ reader: createMemoryReader(files), mode: 'build', ...options });
    const out = {};
    for (const file of result.files) out[file.path] = file.contents;
    return { out, paths: Object.keys(out).sort(), warnings: result.warnings };
}

test('base-এর মান স্বাভাবিক করা হয়', () => {
    assert.equal(normalizeBase(), '/');
    assert.equal(normalizeBase('/'), '/');
    assert.equal(normalizeBase('my-repo'), '/my-repo/');
    assert.equal(normalizeBase('/my-repo'), '/my-repo/');
    assert.equal(normalizeBase('my-repo/'), '/my-repo/');
    assert.equal(normalizeBase('//a//b.c_d~//'), '/a/b.c_d~/');
});

test('base-এ অবৈধ অক্ষরে এরর', () => {
    for (const value of ['my repo', 'a?b', 'https://x.com/', 'আলো']) {
        assert.throws(() => normalizeBase(value), (err) => err instanceof AloError && /`--base`/.test(err.message), value);
    }
});

test('base সব URL অ্যাট্রিবিউটে বসে', () => {
    const html = applyBase(
        '<a href="/a/"></a><img src="/i.png"><form action="/f" ><button formaction=\'/b\'></button></form><video poster=/p.jpg></video>' +
            '<object data="/o.svg"></object><div data="/not-object"></div><svg><use xlink:href="/s.svg#x"></use></svg>' +
            '<link rel="preload" imagesrcset="/x.png 1x, /y.png 2x">',
        '/r/',
    );
    assert.equal(
        html,
        '<a href="/r/a/"></a><img src="/r/i.png"><form action="/r/f" ><button formaction=\'/r/b\'></button></form><video poster=/r/p.jpg></video>' +
            '<object data="/r/o.svg"></object><div data="/not-object"></div><svg><use xlink:href="/r/s.svg#x"></use></svg>' +
            '<link rel="preload" imagesrcset="/r/x.png 1x, /r/y.png 2x">',
    );
});

test('srcset-এর প্রতিটা URL, meta refresh আর inline style-এর url()', () => {
    assert.equal(applyBase('<img srcset="/a.png 1x,/b.png 2x, https://c/d.png 3x">', '/r/'), '<img srcset="/r/a.png 1x,/r/b.png 2x, https://c/d.png 3x">');
    assert.equal(applyBase('<meta http-equiv="refresh" content="0; url=/new/">', '/r/'), '<meta http-equiv="refresh" content="0; url=/r/new/">');
    assert.equal(applyBase('<meta name="x" content="/not-a-url">', '/r/'), '<meta name="x" content="/not-a-url">');
    assert.equal(applyBase(`<div style="background: url('/bg.png'), url(//cdn/x.png)"></div>`, '/r/'), `<div style="background: url('/r/bg.png'), url(//cdn/x.png)"></div>`);
});

test('//cdn, https://, #, আপেক্ষিক পাথ, স্ক্রিপ্টের লেখা আর কমেন্ট অক্ষত', () => {
    const html = '<a href="//cdn.x/a"></a><a href="https://x/"></a><a href="#top"></a><a href="about/"></a><a href="mailto:a@b"></a><script>const u = "<a href=\'/x\'>";</script><!-- <a href="/c"> -->';
    assert.equal(applyBase(html, '/r/'), html);
});

test('base "/" হলে HTML হুবহু থাকে', () => {
    const html = '<a href="/a/">x</a>';
    assert.equal(applyBase(html, '/'), html);
});

test('কম্পাইলে base: লিংক, asset, CSS url(), data-base; route.path-এ base নেই', () => {
    const { out } = build({
        'pages/page.alo': `<template><a href="/about/">{{ route.path }}</a><img src="/logo.svg"></template><style>.a { background: url("/bg.png") }</style><script>go()</script>`,
        'pages/about/page.alo': '',
    }, { base: 'docs' });
    const home = out['index.html'];
    assert.match(home, /<html lang="bn" data-base="\/docs\/">/);
    assert.match(home, /<a href="\/docs\/about\/"[^>]*>\/<\/a>/);
    assert.match(home, /<img src="\/docs\/logo\.svg"/);
    assert.match(home, /<link rel="stylesheet" href="\/docs\/assets\/style\.[0-9a-f]{8}\.css">/);
    assert.match(home, /<script src="\/docs\/assets\/pages\/index\.[0-9a-f]{8}\.js"><\/script>/);
    const css = Object.entries(out).find(([p]) => p.startsWith('assets/style.'))[1];
    assert.match(css, /url\("\/docs\/bg\.png"\)/);
    assert.doesNotMatch(out['about/index.html'], /data-base="\/"/);
});

test('হ্যাশ: শুধু build-এ, কনটেন্ট বদলালে বদলায়', () => {
    const files = { 'pages/page.alo': '<template><p>a</p></template><style>p { color: red }</style>' };
    const first = build(files).paths.find((p) => p.startsWith('assets/'));
    const same = build(files).paths.find((p) => p.startsWith('assets/'));
    const changed = build({ 'pages/page.alo': '<template><p>a</p></template><style>p { color: blue }</style>' }).paths.find((p) => p.startsWith('assets/'));
    assert.match(first, /^assets\/style\.[0-9a-f]{8}\.css$/);
    assert.equal(first, same);
    assert.notEqual(first, changed);

    const dev = compile({ reader: createMemoryReader(files), mode: 'dev' }).files.map((f) => f.path);
    assert.ok(dev.includes('assets/style.css'));
    assert.ok(!dev.includes('robots.txt'), 'dev-এ robots.txt তৈরি হয় না');
});

test('CSS মিনিফাই: কমেন্ট যায়, /*! থাকে, স্ট্রিং, url() আর কাস্টম প্রপার্টি হুবহু', () => {
    const css = `/*! লাইসেন্স */
/* সাধারণ */
:root {
    --space:   1px   2px ;
    color : red;
}
.card h2 , a > b {
    margin: 1px /* মাঝে */ 2px;
    content: "a   b ; }";
    background: url( "x y.png" );
    width: calc(100% - 2 * 3px);
}
@media (max-width: 600px) {
    .a :hover { x: y; }
}`;
    const min = minifyCss(css);
    assert.match(min, /^\/\*! লাইসেন্স \*\//);
    assert.doesNotMatch(min, /সাধারণ|মাঝে/);
    assert.match(min, /--space:1px {3}2px;/);
    assert.match(min, /content:"a {3}b ; \}"/);
    assert.match(min, /url\( "x y\.png" \)/);
    assert.match(min, /margin:1px 2px;/);
    assert.match(min, /calc\(100% - 2 \* 3px\)/);
    assert.match(min, /\.a :hover\{x:y\}/);
    assert.doesNotMatch(min, /;\}/);
    assert.doesNotMatch(min, /\n/);
});

test('sitemap: site.url থাকলে; 404 আর noindex বাদ; base-সহ absolute URL', () => {
    const { out } = build({
        'data/site.json': '{ "url": "https://example.com" }',
        'pages/page.alo': '',
        'pages/about/page.alo': '',
        'pages/secret/page.alo': '<head><meta name="robots" content="noindex, nofollow"></head>',
        'pages/not-found.alo': '',
    }, { base: '/repo/' });
    assert.equal(
        out['sitemap.xml'],
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            '  <url><loc>https://example.com/repo/</loc></url>',
            '  <url><loc>https://example.com/repo/about/</loc></url>',
            '</urlset>',
            '',
        ].join('\n'),
    );
    assert.equal(out['robots.txt'], 'User-agent: *\nAllow: /\nSitemap: https://example.com/repo/sitemap.xml\n');
});

test('site.url না থাকলে sitemap নেই, সতর্কবার্তা; robots.txt তবুও তৈরি হয়', () => {
    const { out, warnings } = build({ 'pages/page.alo': '' });
    assert.equal(out['sitemap.xml'], undefined);
    assert.equal(out['robots.txt'], 'User-agent: *\nAllow: /\n');
    assert.match(warnings[0].message, /`url` দিলে sitemap\.xml তৈরি হবে/);
});

test('public/-এ robots.txt বা sitemap.xml থাকলে সেগুলো তৈরি হয় না', () => {
    const { out, warnings } = build({
        'data/site.json': '{ "url": "https://example.com" }',
        'pages/page.alo': '',
        'public/robots.txt': 'User-agent: *\nDisallow: /',
        'public/sitemap.xml': '<urlset/>',
    });
    assert.equal(out['robots.txt'], undefined);
    assert.equal(out['sitemap.xml'], undefined);
    assert.equal(warnings.length, 0);

    const onlyRobots = build({ 'data/site.json': '{ "url": "https://example.com" }', 'pages/page.alo': '', 'public/sitemap.xml': '<urlset/>' });
    assert.equal(onlyRobots.out['robots.txt'], 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n');
});
