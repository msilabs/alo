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

test('levenshtein counts insertions, deletions and substitutions', () => {
    assert.equal(levenshtein('', ''), 0);
    assert.equal(levenshtein('Card', 'Card'), 0);
    assert.equal(levenshtein('Crad', 'Card'), 2);
    assert.equal(levenshtein('PostLst', 'PostList'), 1);
    assert.equal(levenshtein('kitten', 'sitting'), 3);
});

test('levenshtein counts Bengali text by code point', () => {
    assert.equal(levenshtein('শিরোনাম', 'শিরোনাম'), 0);
    assert.equal(levenshtein('আলো', 'আলোক'), 1);
});

test('suggest returns the closest name', () => {
    assert.equal(suggest('Blog.PostLst', ['Blog.PostList', 'Blog.PostCard', 'Card']), 'Blog.PostList');
    assert.equal(suggest('biuld', ['init', 'dev', 'build', 'new']), 'build');
    assert.equal(suggest('titel', ['title', 'post']), 'title');
});

test('suggest returns nothing for distant names', () => {
    assert.equal(suggest('xyz', ['init', 'dev', 'build', 'new']), null);
    assert.equal(suggest('Something', []), null);
});

test('suggest ignores letter case', () => {
    assert.equal(suggest('blog.postlist', ['Blog.PostList']), 'Blog.PostList');
});

test('codeFrame shows nearby lines and a caret', () => {
    const source = '<template>\n  <h1>আমাদের সম্পর্কে</h1>\n  <Crad title="মিশন" />\n</template>';
    assert.deepEqual(codeFrame(source, 3, 3), [
        '2 |   <h1>আমাদের সম্পর্কে</h1>',
        '3 |   <Crad title="মিশন" />',
        '  |   ^',
        '4 | </template>',
    ]);
});

test('codeFrame pads line numbers and keeps tabs', () => {
    const source = Array.from({ length: 12 }, (_, i) => (i === 9 ? '\t<x>' : 'line ' + (i + 1))).join('\n');
    assert.deepEqual(codeFrame(source, 10, 2), [
        ' 9 | line 9',
        '10 | \t<x>',
        '   | \t^',
        '11 | line 11',
    ]);
});

test('codeFrame stays within the first and last line', () => {
    assert.deepEqual(codeFrame('a\nb', 1), ['1 | a', '2 | b']);
    assert.deepEqual(codeFrame('a\r\nb', 2), ['1 | a', '2 | b']);
    assert.deepEqual(codeFrame('a', 5), []);
});

test('formatDiagnostic lays out an error like the spec', () => {
    const source = '<template>\n  <h1>আমাদের সম্পর্কে</h1>\n  <Crad title="মিশন" />\n</template>';
    const error = new AloError({
        file: 'pages/(site)/about/page.alo',
        line: 3,
        column: 3,
        message: 'Component `<Crad>` not found.',
        hint: 'Did you mean `<Card>`? (components/Card.alo)',
        source,
    });

    assert.deepEqual(formatDiagnostic(error), [
        'pages/(site)/about/page.alo:3:3',
        '  Component `<Crad>` not found.',
        '',
        '  2 |   <h1>আমাদের সম্পর্কে</h1>',
        '  3 |   <Crad title="মিশন" />',
        '    |   ^',
        '  4 | </template>',
        '',
        '  Hint: Did you mean `<Card>`? (components/Card.alo)',
    ]);
});

test('formatDiagnostic shows the caller and multi-line hints', () => {
    const lines = formatDiagnostic({
        file: 'components/blog/PostCard.alo',
        line: 4,
        message: '`post` is `undefined`.',
        calledFrom: { file: 'pages/(site)/page.alo', line: 12 },
        hint: '<template for="post in data.blog">\n  <Blog.PostCard post="{{ post }}" />\n</template>',
    });

    assert.deepEqual(lines, [
        'components/blog/PostCard.alo:4',
        '  `post` is `undefined`.',
        '  Called from: pages/(site)/page.alo:12',
        '',
        '  Hint: <template for="post in data.blog">',
        '          <Blog.PostCard post="{{ post }}" />',
        '        </template>',
    ]);
});

test('an error without a file has an empty location line', () => {
    const lines = formatDiagnostic(new AloError({ message: 'Unknown command.' }));
    assert.deepEqual(lines, ['', '  Unknown command.']);
});

test('AloError is an Error and source is not enumerable', () => {
    const error = new AloError({ file: 'a.alo', line: 1, message: 'wrong', source: 'x' });
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'wrong');
    assert.equal(error.source, 'x');
    assert.ok(!Object.keys(error).includes('source'));
});
