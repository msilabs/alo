'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../core/expression.js');
const { AloError } = require('../core/errors.js');
const { renderBody, renderError } = require('./helpers/render.js');

const where = { file: 'pages/page.alo', line: 3, column: 5 };

function evalError(code, scope) {
    try {
        evaluate(code, scope, where);
    } catch (err) {
        assert.ok(err instanceof AloError);
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

test('এক্সপ্রেশন সাধারণ JavaScript, স্কোপের ভেরিয়েবলসহ', () => {
    assert.equal(evaluate('a + b * 2', { a: 1, b: 3 }, where), 7);
    assert.equal(evaluate('list.toReversed().slice(0, 2).join()', { list: [1, 2, 3] }, where), '3,2');
    assert.equal(evaluate('title ?? "নেই"', { title: undefined }, where), 'নেই');
    assert.equal(evaluate('x // কমেন্ট', { x: 5 }, where), 5);
});

test('ফাংশন "use strict"-এ চলে', () => {
    assert.equal(evaluate('(function () { return this; })()', {}, where), undefined);
});

test('অজানা ভেরিয়েবলে পরামর্শ আর উপলব্ধ তালিকা', () => {
    const err = evalError('titel', { title: 'a', data: {} });
    assert.equal(err.message, '`titel` নামে কোনো ভেরিয়েবল নেই।');
    assert.match(err.hint, /`title` বোঝাতে চেয়েছিলে/);
    assert.match(err.hint, /এখানে আছে: `title`, `data`/);
    assert.deepEqual([err.file, err.line, err.column], ['pages/page.alo', 3, 5]);
});

test('frozen ডেটা মেথড দিয়ে বা সরাসরি বদলানোর চেষ্টায় এরর', () => {
    const scope = { posts: Object.freeze([3, 1, 2]), post: Object.freeze({ title: 'a' }) };
    for (const code of ['posts.sort()', 'posts.reverse()', 'posts.push(4)', 'post.title = "b"', 'post.extra = 1', 'delete post.title']) {
        const err = evalError(code, scope);
        assert.match(err.message, /ডেটা বদলানো যায় না/, code);
        assert.match(err.hint, /`toReversed\(\)`, `toSorted\(\)` বা `slice\(\)`/, code);
    }
});

test('frozen ডেটা থেকে নতুন মান বানানো চলে', () => {
    const scope = { posts: Object.freeze([3, 1, 2]) };
    assert.deepEqual(evaluate('posts.toSorted()', scope, where), [1, 2, 3]);
    assert.deepEqual(evaluate('posts.toReversed()', scope, where), [2, 1, 3]);
});

test('অবস্থান ছাড়া AloError-এ এক্সপ্রেশনের অবস্থান বসে', () => {
    const scope = {
        boom() {
            throw new AloError({ message: 'ভেতরের এরর' });
        },
    };
    const err = evalError('boom()', scope);
    assert.equal(err.message, 'ভেতরের এরর');
    assert.deepEqual([err.file, err.line], ['pages/page.alo', 3]);
});

test('লেখায়: escape, raw, null আর undefined খালি, \\{{ আক্ষরিক', () => {
    const { body } = renderBody(`{{ '<i>' }}|{{{ '<i>' }}}|{{ null }}{{ undefined }}|\\{{ x }}`);
    assert.equal(body, '&lt;i&gt;|<i>||{{ x }}');
});

test('লেখায় অবজেক্ট, অ্যারে বা ফাংশন বসালে সতর্কবার্তা', () => {
    const { body, warnings } = renderBody(`{{ ({ a: 1 }) }}|{{ [1, 2] }}|{{ 'x'.trim }}`);
    assert.match(body, /^\[object Object\]\|1,2\|function trim/);
    assert.equal(warnings.length, 3);
    assert.match(warnings[0].message, /একটা অবজেক্ট/);
    assert.match(warnings[1].hint, /<template for>/);
    assert.match(warnings[2].hint, /`\(\)`/);
});

test('লুপের ভেতরের একই সতর্কবার্তা একবারই আসে', () => {
    const { warnings } = renderBody(`<template for="x in [1, 2, 3]">{{ [x] }}</template>`);
    assert.equal(warnings.length, 1);
});

test('এক্সপ্রেশনের এররে অবস্থান থাকে', () => {
    const err = renderError('\n  <p>{{ data.x.y }}</p>');
    assert.deepEqual([err.line, err.column], [2, 6]);
    assert.match(err.message, /এক্সপ্রেশন চালাতে গিয়ে এরর/);
});
