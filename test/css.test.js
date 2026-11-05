'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCss } = require('../core/css-parser.js');
const { scopeSelector, scopeCss, scopeAttribute } = require('../core/css-scope.js');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

const A = 'data-a-a1b2c3';

function build(files) {
    const result = compile({ reader: createMemoryReader(files) });
    const out = {};
    for (const file of result.files) out[file.path] = file.contents;
    const body = (path) => out[path].slice(out[path].indexOf('<body>\n') + 7, out[path].indexOf('\n</body>'));
    return { out, body, warnings: result.warnings };
}

function cssError(css) {
    try {
        scopeCss(css, A, { file: 'components/Card.alo', line: 10 });
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

test('স্পেকের অংশ ১২-এর সিলেক্টর উদাহরণ', () => {
    assert.equal(scopeSelector('.card h2', A), `.card h2[${A}]`);
    assert.equal(scopeSelector('.btn:hover', A), `.btn[${A}]:hover`);
    assert.equal(scopeSelector('.card::before', A), `.card[${A}]::before`);
    assert.equal(scopeSelector('a, b', A), `a[${A}], b[${A}]`);
});

test('কম্বিনেটর, অ্যাট্রিবিউট সিলেক্টর আর আর্গুমেন্টওয়ালা pseudo-class', () => {
    assert.equal(scopeSelector('ul > li + li ~ p', A), `ul > li + li ~ p[${A}]`);
    assert.equal(scopeSelector('input[type="a b"]:focus', A), `input[type="a b"][${A}]:focus`);
    assert.equal(scopeSelector('.a:not(.b > .c)', A), `.a[${A}]:not(.b > .c)`);
    assert.equal(scopeSelector('a:is(.x, .y) span::after', A), `a:is(.x, .y) span[${A}]::after`);
    assert.equal(scopeSelector(':hover', A), `[${A}]:hover`);
    assert.equal(scopeSelector('*', A), `*[${A}]`);
    assert.equal(scopeSelector('.a\\:b', A), `.a\\:b[${A}]`);
});

test('@media, @supports, @container, @layer-এর ভেতরে রিকার্সিভ; @keyframes, @font-face, @import, @charset অপরিবর্তিত', () => {
    const css = [
        '@charset "utf-8";',
        '@import url("x.css");',
        '.a { color: red; }',
        '@media (max-width: 600px) { @supports (display: grid) { .b { x: y } } }',
        '@container card (min-width: 1px) { .c { x: y } }',
        '@layer base { .d { x: y } }',
        '@layer one, two;',
        '@keyframes spin { from { rotate: 0 } to { rotate: 1turn } }',
        '@font-face { font-family: X; src: url(x.woff2); }',
    ].join('\n');
    const out = scopeCss(css, A);
    assert.match(out, /@charset "utf-8";/);
    assert.match(out, /@import url\("x\.css"\);/);
    assert.match(out, new RegExp(`\\.a\\[${A}\\] \\{ color: red; \\}`));
    assert.match(out, new RegExp(`@media \\(max-width: 600px\\) \\{\\n    @supports \\(display: grid\\) \\{\\n        \\.b\\[${A}\\] \\{ x: y \\}`));
    assert.match(out, new RegExp(`\\.c\\[${A}\\]`));
    assert.match(out, new RegExp(`\\.d\\[${A}\\]`));
    assert.match(out, /@layer one, two;/);
    assert.match(out, /@keyframes spin \{ from \{ rotate: 0 \} to \{ rotate: 1turn \} \}/);
    assert.match(out, /@font-face \{ font-family: X; src: url\(x\.woff2\); \}/);
});

test('কমেন্ট আর স্ট্রিংয়ের ভেতরের { } গোনা হয় না', () => {
    const items = parseCss('/* { */ .a::after { content: "}"; } .b { content: \'{\' }');
    assert.deepEqual(
        items.map((item) => item.type + ':' + (item.selector ?? item.text)),
        ['comment:/* { */', 'rule:.a::after', 'rule:.b'],
    );
    assert.equal(scopeCss('.a{content:"a, b"}', A), `.a[${A}] {content:"a, b"}`);
});

test('ভাঙা CSS-এ .alo ফাইলের লাইনসহ এরর', () => {
    const unclosed = cssError('\n.a {\n  color: red;\n');
    assert.match(unclosed.message, /`\{` বন্ধ হয়নি/);
    assert.deepEqual([unclosed.file, unclosed.line], ['components/Card.alo', 11]);
    assert.match(cssError('.a { x: y }\n}').message, /বাড়তি `\}`/);
    assert.match(cssError('/* খোলা').message, /কমেন্ট বন্ধ হয়নি/);
    assert.equal(cssError('.a {}\n\n@media x {\n .b {').line, 12);
});

test('স্কোপ আইডি পাথের SHA-1-এর প্রথম ৬ অক্ষর', () => {
    assert.match(scopeAttribute('components/Card.alo'), /^data-a-[0-9a-f]{6}$/);
    assert.equal(scopeAttribute('components/Card.alo'), scopeAttribute('components/Card.alo'));
    assert.notEqual(scopeAttribute('components/Card.alo'), scopeAttribute('components/Badge.alo'));
});

test('স্কোপড style থাকলে ফাইলের প্রতিটা এলিমেন্টে অ্যাট্রিবিউট, head-এ নয়', () => {
    const page = scopeAttribute('pages/page.alo');
    const { body, out } = build({
        'pages/page.alo': '<head><meta name="x" content="y"></head><template><div><p>a</p><template id="t"><b>x</b></template></div></template><style>p { color: red }</style>',
    });
    assert.equal(body('index.html'), `<div ${page}><p ${page}>a</p><template id="t" ${page}><b ${page}>x</b></template></div>`);
    assert.match(out['index.html'], /<meta name="x" content="y">\n/);
});

test('style না থাকলে অ্যাট্রিবিউট বসে না', () => {
    assert.equal(build({ 'pages/page.alo': '<template><p>a</p></template><style> </style>' }).body('index.html'), '<p>a</p>');
});

test('স্লট কনটেন্ট প্যারেন্টের অ্যাট্রিবিউট পায়; চাইল্ডের রুট শুধু নিজেরটা', () => {
    const page = scopeAttribute('pages/page.alo');
    const card = scopeAttribute('components/Card.alo');
    const { body } = build({
        'pages/page.alo': '<template><section><Card class="x"><em>ভেতর</em></Card></section></template><style>em { x: y }</style>',
        'components/Card.alo': '<template><article class="card {{ props.class }}"><slot /></article></template><style>.card { x: y }</style>',
    });
    assert.equal(body('index.html'), `<section ${page}><article class="card x" ${card}><em ${page}>ভেতর</em></article></section>`);
});

test('style.css: global/ আগে পূর্ণ পাথ ক্রমে, তারপর ব্যবহৃত .alo ফাইল; অব্যবহৃতটা বাদ', () => {
    const { out } = build({
        'global/theme.css': ':root { --c: red; }',
        'global/base/01-reset.css': '* { margin: 0 }',
        'global/a.css': 'a {}',
        'global/a/x.css': 'x {}',
        'pages/page.alo': '<template><Card /></template><style>.p { x: y }</style>',
        'components/Card.alo': '<template><div></div></template><style>.c { x: y }</style><style global>body { m: 0 }</style>',
        'components/Unused.alo': '<template><div></div></template><style>.u { x: y }</style>',
    });
    const css = out['assets/style.css'];
    const order = [...css.matchAll(/^\/\* (.+?) \*\//gm)].map((m) => m[1]);
    assert.deepEqual(order, [
        'global/a.css',
        'global/a/x.css',
        'global/base/01-reset.css',
        'global/theme.css',
        'components/Card.alo',
        'components/Card.alo (global)',
        'pages/page.alo',
    ]);
    assert.match(css, /body \{ m: 0 \}/);
    assert.doesNotMatch(css, /\.u/);
    assert.match(css, new RegExp(`\\.c\\[${scopeAttribute('components/Card.alo')}\\]`));
});

test('CSS থাকলে প্রতিটা পেইজে <link>, না থাকলে নেই', () => {
    const withCss = build({ 'pages/page.alo': '', 'pages/about/page.alo': '', 'global/x.css': 'a {}' }).out;
    assert.match(withCss['index.html'], /<link rel="stylesheet" href="\/assets\/style\.css">\n<\/head>/);
    assert.match(withCss['about/index.html'], /<link rel="stylesheet" href="\/assets\/style\.css">/);

    const none = build({ 'pages/page.alo': '' }).out;
    assert.doesNotMatch(none['index.html'], /stylesheet/);
    assert.equal(none['assets/style.css'], undefined);
});

test('global/-এ অন্য ফাইলে সতর্কবার্তা, ডটফাইল চুপচাপ বাদ', () => {
    const { warnings } = build({ 'pages/page.alo': '', 'global/x.css': '', 'global/menu.json': '{}', 'global/.DS_Store': '' });
    assert.deepEqual(warnings.map((w) => w.file), ['global/menu.json']);
    assert.match(warnings[0].hint, /JSON ডেটা `data\/`-এ রাখো/);
});

test('কম্পোনেন্টের ভাঙা CSS-এ .alo ফাইলের আসল লাইন', () => {
    try {
        build({ 'pages/page.alo': '<template><Card /></template>', 'components/Card.alo': '<template><div></div></template>\n\n<style>\n.a {\n  x: y;\n</style>' });
        assert.fail('এরর আশা করা হয়েছিল');
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        assert.deepEqual([err.file, err.line], ['components/Card.alo', 4]);
    }
});
