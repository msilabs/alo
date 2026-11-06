'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { scanComponents, expectedPath, propUsage, tokenize } = require('../core/components.js');
const { parseSfc } = require('../core/sfc.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function scan(files) {
    const warnings = [];
    const map = scanComponents(createMemoryReader(files), (w) => warnings.push(w));
    return { map, warnings };
}

function site(files) {
    const result = compile({ reader: createMemoryReader(files), mode: 'dev' });
    const html = result.files.find((f) => f.path === 'index.html').contents;
    return { body: html.slice(html.indexOf('<body>\n') + 7, html.indexOf('\n</body>')), warnings: result.warnings };
}

function siteError(files) {
    try {
        compile({ reader: createMemoryReader(files), mode: 'dev' });
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('expected an error');
}

function usage(template) {
    const result = propUsage(parseSfc(`<template>${template}</template>`, 'c.alo', 'component'));
    return { names: [...result.props].sort(), dynamic: result.dynamic };
}

test('folders become dotted names; kebab folders become PascalCase', () => {
    const { map } = scan({
        'components/Card.alo': '',
        'components/blog/PostCard.alo': '',
        'components/post-list/Item.alo': '',
        'components/shop/cart-items/Row.alo': '',
    });
    assert.deepEqual([...map.keys()].sort(), ['Blog.PostCard', 'Card', 'PostList.Item', 'Shop.CartItems.Row']);
    assert.equal(map.get('PostList.Item').file, 'components/post-list/Item.alo');
});

test('no components/ folder gives an empty map', () => {
    assert.equal(scan({ 'pages/page.alo': '' }).map.size, 0);
});

test('non-PascalCase files and non-kebab-case folders fail', () => {
    for (const [path, pattern] of [
        ['components/card.alo', /`card\.alo` is not allowed/],
        ['components/post-card.alo', /PostCard\.alo/],
        ['components/Blog/Card.alo', /folder name `Blog` is not allowed/],
        ['components/post_list/Item.alo', /`post_list`/],
    ]) {
        try {
            scan({ [path]: '' });
            assert.fail(path);
        } catch (err) {
            assert.ok(err instanceof AloError, path);
            assert.match(err.message + ' ' + err.hint, pattern, path);
        }
    }
});

test('a non-.alo file warns', () => {
    const { map, warnings } = scan({ 'components/Card.alo': '', 'components/notes.txt': '' });
    assert.equal(map.size, 1);
    assert.equal(warnings[0].file, 'components/notes.txt');
});

test('expectedPath turns a dotted name into a file path', () => {
    assert.equal(expectedPath('Card'), 'components/Card.alo');
    assert.equal(expectedPath('Blog.PostCard'), 'components/blog/PostCard.alo');
    assert.equal(expectedPath('PostList.Item'), 'components/post-list/Item.alo');
});

test('an unknown component suggests a close name and its file', () => {
    const err = siteError({
        'pages/page.alo': '<template>\n  <Blog.PostLst />\n</template>',
        'components/blog/PostList.alo': '',
    });
    assert.equal(err.message, 'Component `<Blog.PostLst>` not found.');
    assert.equal(err.hint, 'Did you mean `<Blog.PostList>`? (components/blog/PostList.alo)');
    assert.deepEqual([err.line, err.column], [2, 3]);
});

test('an uppercase HTML tag name gets a lowercase hint', () => {
    assert.match(siteError({ 'pages/page.alo': '<template><DIV>a</DIV></template>' }).hint, /write `<div>` in lowercase/);
    assert.match(siteError({ 'pages/page.alo': '<template><Header /></template>' }).hint, /`<header>`/);
});

test('without a close name, the hint says which file to create', () => {
    assert.equal(siteError({ 'pages/page.alo': '<template><Blog.Sidebar /></template>' }).hint, 'Create the component: `components/blog/Sidebar.alo`');
});

test('a component may share its name with an HTML tag', () => {
    const { body } = site({
        'pages/page.alo': '<template><Header /></template>',
        'components/Header.alo': '<template><header>শিরোনাম</header></template>',
    });
    assert.equal(body, '<header>শিরোনাম</header>');
});

test('unused components warn; use in a false branch or nested use still counts', () => {
    const { warnings } = site({
        'pages/page.alo': '<template><template if="false"><Card /></template></template>',
        'components/Card.alo': '<template><Badge /></template>',
        'components/Badge.alo': '<template>b</template>',
        'components/Unused.alo': '<template>u</template>',
    });
    assert.deepEqual(
        warnings.map((w) => [w.file, w.message]),
        [['components/Unused.alo', '`<Unused>` is never used.']],
    );
});

test('tokenize separates strings and properties', () => {
    const tokens = tokenize("a.b + 'c d' + `x ${ e } y` + 1.5 + f?.g + [...h]");
    assert.deepEqual(
        tokens.filter((t) => t.type === 'ident').map((t) => t.value),
        ['a', 'b', 'e', 'f', 'g', 'h'],
    );
});

test('propUsage records props.x and marks whole-props use as dynamic', () => {
    assert.deepEqual(usage(`<h2 class="{{ props.class }}">{{ props.title }}</h2><p>{{ post.date }}</p>`), {
        names: ['class', 'title'],
        dynamic: false,
    });
    assert.deepEqual(usage(`<template for="tag in props.tags"><i>{{ tag }}</i></template><template if="props.featured">*</template>`).names, [
        'featured',
        'tags',
    ]);
    assert.equal(usage(`{{ props[key] }}`).dynamic, true);
    assert.equal(usage(`{{ JSON.stringify(props) }}`).dynamic, true);
    assert.deepEqual(usage(`{{ props?.title }}`), { names: ['title'], dynamic: false });
    assert.deepEqual(usage(`{{ 'props.title' }}{{ post.props }}`), { names: [], dynamic: false });
});
