'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function build(files, options = {}) {
    return compile({ reader: createMemoryReader(files), mode: 'dev', ...options });
}

function output(result, path) {
    const file = result.files.find((f) => f.path === path);
    assert.ok(file, `${path} তৈরি হয়নি`);
    return file.contents;
}

function compileError(files) {
    try {
        build(files);
    } catch (err) {
        assert.ok(err instanceof AloError);
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

test('pages/page.alo থেকে index.html, ফোল্ডার থেকে পরিষ্কার URL', () => {
    const result = build({
        'pages/page.alo': '<template><h1>হোম</h1></template>',
        'pages/about/page.alo': '<template><h1>{{ route.path }}</h1></template>',
    });
    assert.deepEqual(result.files.map((f) => f.path), ['about/index.html', 'index.html']);
    assert.match(output(result, 'about/index.html'), /<h1>\/about\/<\/h1>/);
});

test('HTML শেল: doctype, lang, charset, viewport, ডিফল্ট title', () => {
    const html = output(build({ 'pages/page.alo': '<template><p>a</p></template>' }), 'index.html');
    assert.equal(
        html,
        [
            '<!DOCTYPE html>',
            '<html lang="bn">',
            '<head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>Alo</title>',
            '</head>',
            '<body>',
            '<p>a</p>',
            '</body>',
            '</html>',
            '',
        ].join('\n'),
    );
});

test('পেইজের <head> বসে, আর নিজের title থাকলে ডিফল্টটা বসে না', () => {
    const html = output(
        build({ 'pages/page.alo': '<head><title>{{ "আমার" + " সাইট" }}</title></head><template></template>' }),
        'index.html',
    );
    assert.match(html, /<title>আমার সাইট<\/title>/);
    assert.doesNotMatch(html, /<title>Alo<\/title>/);
});

test('{{ }} escape করে, {{{ }}} করে না, null আর undefined খালি', () => {
    const html = output(
        build({ 'pages/page.alo': `<template><p>{{ '<b>&"\\'' }}|{{{ '<b>x</b>' }}}|{{ null }}{{ undefined }}|{{ 0 }}|{{ false }}</p></template>` }),
        'index.html',
    );
    assert.match(html, /<p>&lt;b&gt;&amp;&quot;&#39;\|<b>x<\/b>\|\|0\|false<\/p>/);
});

test('অ্যাট্রিবিউটে {{ }} বসে; স্ট্যাটিক আর অচেনা অ্যাট্রিবিউট হুবহু থাকে', () => {
    const html = output(
        build({
            'pages/page.alo': `<template><a href="/x/{{ 1 + 1 }}/" title='{{ "a\\"b" }}' x-data="{ open: false }" @click='open = !open' hidden>x</a></template>`,
        }),
        'index.html',
    );
    assert.match(html, /<a href="\/x\/2\/" title='a&quot;b' x-data="\{ open: false \}" @click='open = !open' hidden>x<\/a>/);
});

test('অ্যাট্রিবিউটের \\{{ আউটপুটে আক্ষরিক {{ হয়', () => {
    const html = output(build({ 'pages/page.alo': '<template><code title="\\{{ x }}">a</code></template>' }), 'index.html');
    assert.match(html, /<code title="\{\{ x \}\}">a<\/code>/);
});

test('void আর self-closing HTML এলিমেন্ট', () => {
    const html = output(build({ 'pages/page.alo': '<template><br><div /><img src="a.png" /></template>' }), 'index.html');
    assert.match(html, /<br><div><\/div><img src="a.png">/);
});

test('script আর style-এর ভেতরে {{ }} প্রসেস হয় না', () => {
    const html = output(
        build({ 'pages/page.alo': '<template><script>const a = "{{ x }}";</script><style>a::after { content: "{{" }</style></template>' }),
        'index.html',
    );
    assert.match(html, /const a = "\{\{ x \}\}";/);
    assert.match(html, /content: "\{\{"/);
});

test('অজানা ভেরিয়েবলে লাইন, কলাম আর উপলব্ধ ভেরিয়েবলসহ এরর', () => {
    const err = compileError({ 'pages/about/page.alo': '<template>\n  <h1>{{ titel }}</h1>\n</template>' });
    assert.equal(err.file, 'pages/about/page.alo');
    assert.deepEqual([err.line, err.column], [2, 7]);
    assert.match(err.message, /`titel` নামে কোনো ভেরিয়েবল নেই/);
    assert.match(err.hint, /`data`, `route`, `base`/);
    assert.ok(err.source.includes('titel'), 'কোড ফ্রেমের জন্য source থাকা দরকার');
});

test('ভুল এক্সপ্রেশন আর রানটাইম এরর বাংলায়', () => {
    assert.match(compileError({ 'pages/page.alo': '<template>{{ a b }}</template>' }).message, /বোঝা যাচ্ছে না/);
    const missing = compileError({ 'pages/page.alo': '<template>{{ data.missing.title }}</template>' });
    assert.equal(missing.message, '`data.missing` হলো `undefined`, তাই `.title` পড়া যায় না।');
    assert.match(missing.hint, /`data\.missing\?\.title`/);
    const runtime = compileError({ 'pages/page.alo': '<template>{{ (1).toFixed(200) }}</template>' });
    assert.match(runtime.message, /এক্সপ্রেশন চালাতে গিয়ে এরর/);
});

test('অ্যাট্রিবিউটে {{{ }}} থাকলে এরর', () => {
    assert.match(compileError({ 'pages/page.alo': '<template><a title="{{{ x }}}"></a></template>' }).message, /অ্যাট্রিবিউটে `\{\{\{ \}\}\}` চলে না/);
});

test('pages/ না থাকলে স্পেকের এরর', () => {
    const err = compileError({ 'components/Card.alo': '' });
    assert.match(err.message, /`pages\/` ফোল্ডার নেই/);
    assert.match(err.hint, /npx @msilabs\/alo init/);
});

test('রাউটগুলো কোড-পয়েন্ট ক্রমে আসে', () => {
    const result = build({
        'pages/b/page.alo': '',
        'pages/a-b/page.alo': '',
        'pages/a/page.alo': '',
        'pages/1/page.alo': '',
    });
    assert.deepEqual(result.files.map((f) => f.path), ['1/index.html', 'a/index.html', 'a-b/index.html', 'b/index.html']);
});
