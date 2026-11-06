'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseYaml } = require('../core/yaml.js');
const { AloError } = require('../core/errors.js');

function yamlError(text, lineOffset = 0) {
    try {
        parseYaml(text, { file: 'data/post.md', lineOffset });
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('expected an error');
}

test('scalars: plain, single and double quoted, numbers, booleans, null', () => {
    assert.deepEqual(
        parseYaml(
            [
                'title: হ্যালো ওয়ার্ল্ড',
                "single: 'it''s # not comment'",
                'double: "a \\"b\\" \\\\ \\n end"',
                'int: 42',
                'negative: -3',
                'float: 2.5',
                'exp: 1e3',
                'yes: true',
                'no: false',
                'nothing: null',
                'tilde: ~',
                'date: 2026-01-10',
                'version: 1.2.3',
                'zip: 01234',
            ].join('\n'),
        ),
        {
            title: 'হ্যালো ওয়ার্ল্ড',
            single: "it's # not comment",
            double: 'a "b" \\ \n end',
            int: 42,
            negative: -3,
            float: 2.5,
            exp: 1000,
            yes: true,
            no: false,
            nothing: null,
            tilde: null,
            date: '2026-01-10',
            version: '1.2.3',
            zip: '01234',
        },
    );
});

test('inline and block lists of scalars', () => {
    assert.deepEqual(parseYaml('tags: [intro, "c d", 3, true]\nempty: []\nitems:\n  - a\n  - 2\n- b\nnone:'), {
        tags: ['intro', 'c d', 3, true],
        empty: [],
        items: ['a', 2, 'b'],
        none: null,
    });
});

test('comments and blank lines; # inside quotes or words is not a comment', () => {
    assert.deepEqual(parseYaml('# শুরু\n\ntitle: ক # কমেন্ট\nurl: https://x.com/a#b\nq: "a # b"\ntags: [a, "#b"] # শেষ\n'), {
        title: 'ক',
        url: 'https://x.com/a#b',
        q: 'a # b',
        tags: ['a', '#b'],
    });
});

test('keys stay as written and values may contain :', () => {
    assert.deepEqual(parseYaml('Post Title: a\ntime: 10:30\nlink: https://example.com'), {
        'Post Title': 'a',
        time: '10:30',
        link: 'https://example.com',
    });
});

test('unsupported syntax fails with the line and a .json hint', () => {
    const cases = [
        ['author:\n  name: ক', 2, /Nested objects/],
        ['bio: |\n  লাইন', 1, /Multi-line values/],
        ['bio: >', 1, /Multi-line values/],
        ['a: &anchor x', 1, /anchors, tags or objects/],
        ['a: *ref', 1, /anchor/],
        ['a: {b: 1}', 1, /objects/],
        ['tags: [[a]]', 1, /Lists cannot contain lists/],
    ];
    for (const [text, line, pattern] of cases) {
        const err = yamlError(text);
        assert.equal(err.line, line, text);
        assert.match(err.message, pattern, text);
        assert.match(err.hint, /\.json/, text);
    }
});

test('tab indents, duplicate keys, lines without a colon and unclosed quotes fail', () => {
    assert.match(yamlError('tags:\n\t- a').message, /Tabs/);
    const dup = yamlError('title: a\ntitle: b');
    assert.match(dup.message, /Duplicate key `title`/);
    assert.equal(dup.line, 2);
    assert.match(yamlError('শুধু লেখা').message, /Cannot parse the line/);
    assert.match(yamlError('title: "খোলা').message, /Unclosed quote/);
    assert.match(yamlError('- a').message, /List item without a key/);
});

test('lineOffset gives the real line in the file', () => {
    assert.equal(yamlError('title: a\na: {', 1).line, 3);
});
