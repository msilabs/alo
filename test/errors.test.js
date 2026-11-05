'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    AloError,
    levenshtein,
    suggest,
    codeFrame,
    formatDiagnostic,
} = require('../core/errors.js');

test('levenshtein গোনে যোগ, বাদ আর বদল', () => {
    assert.equal(levenshtein('', ''), 0);
    assert.equal(levenshtein('Card', 'Card'), 0);
    assert.equal(levenshtein('Crad', 'Card'), 2);
    assert.equal(levenshtein('PostLst', 'PostList'), 1);
    assert.equal(levenshtein('kitten', 'sitting'), 3);
});

test('levenshtein বাংলা অক্ষর কোড-পয়েন্ট ধরে গোনে', () => {
    assert.equal(levenshtein('শিরোনাম', 'শিরোনাম'), 0);
    assert.equal(levenshtein('আলো', 'আলোক'), 1);
});

test('suggest সবচেয়ে কাছের নাম দেয়', () => {
    assert.equal(suggest('Blog.PostLst', ['Blog.PostList', 'Blog.PostCard', 'Card']), 'Blog.PostList');
    assert.equal(suggest('biuld', ['init', 'dev', 'build', 'new']), 'build');
    assert.equal(suggest('titel', ['title', 'post']), 'title');
});

test('suggest অনেক দূরের নাম দেয় না', () => {
    assert.equal(suggest('xyz', ['init', 'dev', 'build', 'new']), null);
    assert.equal(suggest('Something', []), null);
});

test('suggest বড়-ছোট হাতের পার্থক্য উপেক্ষা করে মেলায়', () => {
    assert.equal(suggest('blog.postlist', ['Blog.PostList']), 'Blog.PostList');
});

test('codeFrame আশেপাশের লাইন আর ক্যারেট দেখায়', () => {
    const source = '<template>\n  <h1>আমাদের সম্পর্কে</h1>\n  <Crad title="মিশন" />\n</template>';
    assert.deepEqual(codeFrame(source, 3, 3), [
        '2 |   <h1>আমাদের সম্পর্কে</h1>',
        '3 |   <Crad title="মিশন" />',
        '  |   ^',
        '4 | </template>',
    ]);
});

test('codeFrame নম্বরের প্রস্থ মেলায় আর ট্যাব রাখে', () => {
    const source = Array.from({ length: 12 }, (_, i) => (i === 9 ? '\t<x>' : 'line ' + (i + 1))).join('\n');
    assert.deepEqual(codeFrame(source, 10, 2), [
        ' 9 | line 9',
        '10 | \t<x>',
        '   | \t^',
        '11 | line 11',
    ]);
});

test('codeFrame প্রথম আর শেষ লাইনে সীমার বাইরে যায় না', () => {
    assert.deepEqual(codeFrame('a\nb', 1), ['1 | a', '2 | b']);
    assert.deepEqual(codeFrame('a\r\nb', 2), ['1 | a', '2 | b']);
    assert.deepEqual(codeFrame('a', 5), []);
});

test('formatDiagnostic স্পেকের ধরনে এরর সাজায়', () => {
    const source = '<template>\n  <h1>আমাদের সম্পর্কে</h1>\n  <Crad title="মিশন" />\n</template>';
    const error = new AloError({
        file: 'pages/(site)/about/page.alo',
        line: 3,
        column: 3,
        message: '<Crad> কম্পোনেন্ট পাওয়া যায়নি।',
        hint: 'তুমি কি <Card> বোঝাতে চেয়েছিলে? (components/Card.alo)',
        source,
    });

    assert.deepEqual(formatDiagnostic(error), [
        'pages/(site)/about/page.alo:3:3',
        '  <Crad> কম্পোনেন্ট পাওয়া যায়নি।',
        '',
        '  2 |   <h1>আমাদের সম্পর্কে</h1>',
        '  3 |   <Crad title="মিশন" />',
        '    |   ^',
        '  4 | </template>',
        '',
        '  ইঙ্গিত: তুমি কি <Card> বোঝাতে চেয়েছিলে? (components/Card.alo)',
    ]);
});

test('formatDiagnostic ডাকার জায়গা আর কয়েক লাইনের ইঙ্গিত দেখায়', () => {
    const lines = formatDiagnostic({
        file: 'components/blog/PostCard.alo',
        line: 4,
        message: '`post` হলো `undefined`।',
        calledFrom: { file: 'pages/(site)/page.alo', line: 12 },
        hint: '<template for="post in data.blog">\n  <Blog.PostCard post="{{ post }}" />\n</template>',
    });

    assert.deepEqual(lines, [
        'components/blog/PostCard.alo:4',
        '  `post` হলো `undefined`।',
        '  ডাকা হয়েছে: pages/(site)/page.alo:12',
        '',
        '  ইঙ্গিত: <template for="post in data.blog">',
        '            <Blog.PostCard post="{{ post }}" />',
        '          </template>',
    ]);
});

test('ফাইল ছাড়া এররে অবস্থানের লাইন খালি থাকে', () => {
    const lines = formatDiagnostic(new AloError({ message: 'অজানা কমান্ড।' }));
    assert.deepEqual(lines, ['', '  অজানা কমান্ড।']);
});

test('AloError একটা Error, আর source enumerable নয়', () => {
    const error = new AloError({ file: 'a.alo', line: 1, message: 'ভুল', source: 'x' });
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'ভুল');
    assert.equal(error.source, 'x');
    assert.ok(!Object.keys(error).includes('source'));
});
