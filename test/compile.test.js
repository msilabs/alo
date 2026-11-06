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
    assert.ok(file, `${path} was not created`);
    return file.contents;
}

function compileError(files) {
    try {
        build(files);
    } catch (err) {
        assert.ok(err instanceof AloError);
        return err;
    }
    assert.fail('expected an error');
}

test('pages/page.alo becomes index.html and folders become clean URLs', () => {
    const result = build({
        'pages/page.alo': '<template><h1>হোম</h1></template>',
        'pages/about/page.alo': '<template><h1>{{ route.path }}</h1></template>',
    });
    assert.deepEqual(result.files.map((f) => f.path), ['about/index.html', 'index.html']);
    assert.match(output(result, 'about/index.html'), /<h1>\/about\/<\/h1>/);
});

test('HTML shell: doctype, lang, charset, viewport, default title', () => {
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

test('the page head is used, and its own title replaces the default', () => {
    const html = output(
        build({ 'pages/page.alo': '<head><title>{{ "আমার" + " সাইট" }}</title></head><template></template>' }),
        'index.html',
    );
    assert.match(html, /<title>আমার সাইট<\/title>/);
    assert.doesNotMatch(html, /<title>Alo<\/title>/);
});

test('{{ }} escapes, {{{ }}} does not, null and undefined are empty', () => {
    const html = output(
        build({ 'pages/page.alo': `<template><p>{{ '<b>&"\\'' }}|{{{ '<b>x</b>' }}}|{{ null }}{{ undefined }}|{{ 0 }}|{{ false }}</p></template>` }),
        'index.html',
    );
    assert.match(html, /<p>&lt;b&gt;&amp;&quot;&#39;\|<b>x<\/b>\|\|0\|false<\/p>/);
});

test('{{ }} works in attributes; static and unknown attributes stay as written', () => {
    const html = output(
        build({
            'pages/page.alo': `<template><a href="/x/{{ 1 + 1 }}/" title='{{ "a\\"b" }}' x-data="{ open: false }" @click='open = !open' hidden>x</a></template>`,
        }),
        'index.html',
    );
    assert.match(html, /<a href="\/x\/2\/" title='a&quot;b' x-data="\{ open: false \}" @click='open = !open' hidden>x<\/a>/);
});

test('\\{{ in an attribute outputs a literal {{', () => {
    const html = output(build({ 'pages/page.alo': '<template><code title="\\{{ x }}">a</code></template>' }), 'index.html');
    assert.match(html, /<code title="\{\{ x \}\}">a<\/code>/);
});

test('void and self-closing HTML elements', () => {
    const html = output(build({ 'pages/page.alo': '<template><br><div /><img src="a.png" /></template>' }), 'index.html');
    assert.match(html, /<br><div><\/div><img src="a.png">/);
});

test('{{ }} is not processed inside script and style', () => {
    const html = output(
        build({ 'pages/page.alo': '<template><script>const a = "{{ x }}";</script><style>a::after { content: "{{" }</style></template>' }),
        'index.html',
    );
    assert.match(html, /const a = "\{\{ x \}\}";/);
    assert.match(html, /content: "\{\{"/);
});

test('an unknown variable fails with line, column and available variables', () => {
    const err = compileError({ 'pages/about/page.alo': '<template>\n  <h1>{{ titel }}</h1>\n</template>' });
    assert.equal(err.file, 'pages/about/page.alo');
    assert.deepEqual([err.line, err.column], [2, 7]);
    assert.match(err.message, /`titel` is not defined/);
    assert.match(err.hint, /`data`, `route`, `base`/);
    assert.ok(err.source.includes('titel'), 'the source is needed for the code frame');
});

test('invalid expressions and runtime errors are explained', () => {
    assert.match(compileError({ 'pages/page.alo': '<template>{{ a b }}</template>' }).message, /Cannot parse the expression/);
    const missing = compileError({ 'pages/page.alo': '<template>{{ data.missing.title }}</template>' });
    assert.equal(missing.message, '`data.missing` is `undefined`, so `.title` cannot be read.');
    assert.match(missing.hint, /`data\.missing\?\.title`/);
    const runtime = compileError({ 'pages/page.alo': '<template>{{ (1).toFixed(200) }}</template>' });
    assert.match(runtime.message, /Error while evaluating an expression/);
});

test('{{{ }}} in an attribute fails', () => {
    assert.match(compileError({ 'pages/page.alo': '<template><a title="{{{ x }}}"></a></template>' }).message, /`\{\{\{ \}\}\}` cannot be used in an attribute/);
});

test('a missing pages/ folder fails as the spec says', () => {
    const err = compileError({ 'components/Card.alo': '' });
    assert.match(err.message, /No `pages\/` folder here/);
    assert.match(err.hint, /npx @msilabs\/alo init/);
});

test('routes come in code-point order', () => {
    const result = build({
        'pages/b/page.alo': '',
        'pages/a-b/page.alo': '',
        'pages/a/page.alo': '',
        'pages/1/page.alo': '',
    });
    assert.deepEqual(result.files.map((f) => f.path), ['1/index.html', 'a/index.html', 'a-b/index.html', 'b/index.html']);
});

test('cache: unchanged files are not parsed again, changed ones are', () => {
    const cache = { sfc: new Map(), data: new Map() };
    const files = {
        'pages/page.alo': '<template>{{ data.post.body }}</template>',
        'components/Card.alo': '<template>c</template>',
        'data/post.md': '# এক',
    };
    compile({ reader: createMemoryReader(files), mode: 'dev', cache });
    const page = cache.sfc.get('page\npages/page.alo').sfc;
    const post = cache.data.get('data/post.md').value;

    files['data/post.md'] = '# দুই';
    const second = compile({ reader: createMemoryReader(files), mode: 'dev', cache });
    assert.equal(cache.sfc.get('page\npages/page.alo').sfc, page, 'an unchanged page comes from the earlier parse');
    assert.notEqual(cache.data.get('data/post.md').value, post, 'changed Markdown is read again');
    assert.match(second.files[0].contents, /দুই/);
});
