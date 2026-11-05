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
    assert.fail('এরর আশা করা হয়েছিল');
}

test('স্কেলার: কোট ছাড়া, সিঙ্গেল আর ডাবল কোট, সংখ্যা, boolean, null', () => {
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

test('inline আর block লিস্ট, শুধু স্কেলার দিয়ে', () => {
    assert.deepEqual(parseYaml('tags: [intro, "c d", 3, true]\nempty: []\nitems:\n  - a\n  - 2\n- b\nnone:'), {
        tags: ['intro', 'c d', 3, true],
        empty: [],
        items: ['a', 2, 'b'],
        none: null,
    });
});

test('কমেন্ট আর খালি লাইন; কোটের ভেতরে বা শব্দের মাঝে # কমেন্ট নয়', () => {
    assert.deepEqual(parseYaml('# শুরু\n\ntitle: ক # কমেন্ট\nurl: https://x.com/a#b\nq: "a # b"\ntags: [a, "#b"] # শেষ\n'), {
        title: 'ক',
        url: 'https://x.com/a#b',
        q: 'a # b',
        tags: ['a', '#b'],
    });
});

test('key যেমন লেখা তেমন থাকে, মানের ভেতরে : চলে', () => {
    assert.deepEqual(parseYaml('Post Title: a\ntime: 10:30\nlink: https://example.com'), {
        'Post Title': 'a',
        time: '10:30',
        link: 'https://example.com',
    });
});

test('অসাপোর্টেড গঠনে লাইনসহ এরর আর .json-এর ইঙ্গিত', () => {
    const cases = [
        ['author:\n  name: ক', 2, /নেস্টেড অবজেক্ট/],
        ['bio: |\n  লাইন', 1, /কয়েক লাইনের মান/],
        ['bio: >', 1, /কয়েক লাইনের মান/],
        ['a: &anchor x', 1, /anchor, tag বা অবজেক্ট/],
        ['a: *ref', 1, /anchor/],
        ['a: {b: 1}', 1, /অবজেক্ট/],
        ['tags: [[a]]', 1, /লিস্টের ভেতরে লিস্ট/],
    ];
    for (const [text, line, pattern] of cases) {
        const err = yamlError(text);
        assert.equal(err.line, line, text);
        assert.match(err.message, pattern, text);
        assert.match(err.hint, /\.json/, text);
    }
});

test('tab indent, ডুপ্লিকেট key, কোলন ছাড়া লাইন আর বন্ধ না করা কোটে এরর', () => {
    assert.match(yamlError('tags:\n\t- a').message, /tab/);
    const dup = yamlError('title: a\ntitle: b');
    assert.match(dup.message, /`title` key দুবার/);
    assert.equal(dup.line, 2);
    assert.match(yamlError('শুধু লেখা').message, /বোঝা যাচ্ছে না/);
    assert.match(yamlError('title: "খোলা').message, /কোট বন্ধ হয়নি/);
    assert.match(yamlError('- a').message, /কোনো key-এর নিচে নেই/);
});

test('lineOffset দিয়ে ফাইলের আসল লাইন', () => {
    assert.equal(yamlError('title: a\na: {', 1).line, 3);
});
