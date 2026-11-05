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
    const result = compile({ reader: createMemoryReader(files) });
    const html = result.files.find((f) => f.path === 'index.html').contents;
    return { body: html.slice(html.indexOf('<body>\n') + 7, html.indexOf('\n</body>')), warnings: result.warnings };
}

function siteError(files) {
    try {
        compile({ reader: createMemoryReader(files) });
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

function usage(template) {
    const result = propUsage(parseSfc(`<template>${template}</template>`, 'c.alo', 'component'));
    return { names: [...result.names].sort(), dynamic: result.dynamic };
}

test('ফোল্ডার মানে Dot নাম; kebab ফোল্ডার PascalCase হয়', () => {
    const { map } = scan({
        'components/Card.alo': '',
        'components/blog/PostCard.alo': '',
        'components/post-list/Item.alo': '',
        'components/shop/cart-items/Row.alo': '',
    });
    assert.deepEqual([...map.keys()].sort(), ['Blog.PostCard', 'Card', 'PostList.Item', 'Shop.CartItems.Row']);
    assert.equal(map.get('PostList.Item').file, 'components/post-list/Item.alo');
});

test('components/ না থাকলে খালি ম্যাপ', () => {
    assert.equal(scan({ 'pages/page.alo': '' }).map.size, 0);
});

test('PascalCase নয় এমন ফাইল আর kebab-case নয় এমন ফোল্ডারে এরর', () => {
    for (const [path, pattern] of [
        ['components/card.alo', /`card\.alo` চলবে না/],
        ['components/post-card.alo', /PostCard\.alo/],
        ['components/Blog/Card.alo', /ফোল্ডারের নাম `Blog` চলবে না/],
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

test('.alo নয় এমন ফাইলে সতর্কবার্তা', () => {
    const { map, warnings } = scan({ 'components/Card.alo': '', 'components/notes.txt': '' });
    assert.equal(map.size, 1);
    assert.equal(warnings[0].file, 'components/notes.txt');
});

test('expectedPath Dot নাম থেকে ফাইলের পাথ বানায়', () => {
    assert.equal(expectedPath('Card'), 'components/Card.alo');
    assert.equal(expectedPath('Blog.PostCard'), 'components/blog/PostCard.alo');
    assert.equal(expectedPath('PostList.Item'), 'components/post-list/Item.alo');
});

test('অজানা কম্পোনেন্টে কাছাকাছি নামের পরামর্শ আর ফাইল', () => {
    const err = siteError({
        'pages/page.alo': '<template>\n  <Blog.PostLst />\n</template>',
        'components/blog/PostList.alo': '',
    });
    assert.equal(err.message, '`<Blog.PostLst>` কম্পোনেন্ট পাওয়া যায়নি।');
    assert.equal(err.hint, 'তুমি কি `<Blog.PostList>` বোঝাতে চেয়েছিলে? (components/blog/PostList.alo)');
    assert.deepEqual([err.line, err.column], [2, 3]);
});

test('বড় হাতে লেখা HTML ট্যাগে ছোট হাতের ইঙ্গিত', () => {
    assert.match(siteError({ 'pages/page.alo': '<template><DIV>a</DIV></template>' }).hint, /ছোট হাতে `<div>` লেখো/);
    assert.match(siteError({ 'pages/page.alo': '<template><Header /></template>' }).hint, /`<header>`/);
});

test('কাছাকাছি কিছু না থাকলে ফাইল বানানোর ইঙ্গিত', () => {
    assert.equal(siteError({ 'pages/page.alo': '<template><Blog.Sidebar /></template>' }).hint, 'কম্পোনেন্টটা বানাও: `components/blog/Sidebar.alo`');
});

test('একই নামের কম্পোনেন্ট থাকলে HTML ট্যাগের নামও চলে', () => {
    const { body } = site({
        'pages/page.alo': '<template><Header /></template>',
        'components/Header.alo': '<template><header>শিরোনাম</header></template>',
    });
    assert.equal(body, '<header>শিরোনাম</header>');
});

test('অব্যবহৃত কম্পোনেন্টের সতর্কবার্তা; মিথ্যা শাখা বা নেস্টেড ব্যবহারও গোনা হয়', () => {
    const { warnings } = site({
        'pages/page.alo': '<template><template if="false"><Card /></template></template>',
        'components/Card.alo': '<template><Badge /></template>',
        'components/Badge.alo': '<template>b</template>',
        'components/Unused.alo': '<template>u</template>',
    });
    assert.deepEqual(
        warnings.map((w) => [w.file, w.message]),
        [['components/Unused.alo', '`<Unused>` কোথাও ব্যবহার হয়নি।']],
    );
});

test('tokenize স্ট্রিং আর প্রপার্টি আলাদা করে', () => {
    const tokens = tokenize("a.b + 'c d' + `x ${ e } y` + 1.5 + f?.g + [...h]");
    assert.deepEqual(
        tokens.filter((t) => t.type === 'ident').map((t) => t.value),
        ['a', 'b', 'e', 'f', 'g', 'h'],
    );
});

test('propUsage নাম, props.x আর ডায়নামিক ব্যবহার ধরে', () => {
    assert.deepEqual(usage(`<h2 class="{{ props.class }}">{{ title }}</h2><p>{{ post.date }}</p>`), {
        names: ['class', 'post', 'props', 'title'],
        dynamic: false,
    });
    assert.deepEqual(usage(`<template for="tag in tags"><i>{{ tag }}</i></template><template if="featured">*</template>`).names, [
        'featured',
        'in',
        'tag',
        'tags',
    ]);
    assert.equal(usage(`{{ props[key] }}`).dynamic, true);
    assert.equal(usage(`{{ JSON.stringify(props) }}`).dynamic, true);
    assert.equal(usage(`{{ props?.title }}`).dynamic, false);
    assert.deepEqual(usage(`{{ 'title' }}`).names, []);
});
