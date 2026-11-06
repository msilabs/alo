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
    assert.fail('expected an error');
}

test('expressions are plain JavaScript with scope variables', () => {
    assert.equal(evaluate('a + b * 2', { a: 1, b: 3 }, where), 7);
    assert.equal(evaluate('list.toReversed().slice(0, 2).join()', { list: [1, 2, 3] }, where), '3,2');
    assert.equal(evaluate('title ?? "নেই"', { title: undefined }, where), 'নেই');
    assert.equal(evaluate('x // কমেন্ট', { x: 5 }, where), 5);
});

test('expressions run in strict mode', () => {
    assert.equal(evaluate('(function () { return this; })()', {}, where), undefined);
});

test('an unknown variable lists suggestions and what is available', () => {
    const err = evalError('titel', { title: 'a', data: {} });
    assert.equal(err.message, '`titel` is not defined.');
    assert.match(err.hint, /Did you mean `title`/);
    assert.match(err.hint, /Available here: `title`, `data`/);
    assert.deepEqual([err.file, err.line, err.column], ['pages/page.alo', 3, 5]);
});

test('changing frozen data by method or assignment fails', () => {
    const scope = { posts: Object.freeze([3, 1, 2]), post: Object.freeze({ title: 'a' }) };
    for (const code of ['posts.sort()', 'posts.reverse()', 'posts.push(4)', 'post.title = "b"', 'post.extra = 1', 'delete post.title']) {
        const err = evalError(code, scope);
        assert.match(err.message, /Data cannot be changed/, code);
        assert.match(err.hint, /`toReversed\(\)`, `toSorted\(\)` or `slice\(\)`/, code);
    }
});

test('new values can be made from frozen data', () => {
    const scope = { posts: Object.freeze([3, 1, 2]) };
    assert.deepEqual(evaluate('posts.toSorted()', scope, where), [1, 2, 3]);
    assert.deepEqual(evaluate('posts.toReversed()', scope, where), [2, 1, 3]);
});

test('an AloError without a location gets the expression location', () => {
    const scope = {
        boom() {
            throw new AloError({ message: 'inner error' });
        },
    };
    const err = evalError('boom()', scope);
    assert.equal(err.message, 'inner error');
    assert.deepEqual([err.file, err.line], ['pages/page.alo', 3]);
});

test('in text: escaping, raw HTML, empty null and undefined, literal \\{{', () => {
    const { body } = renderBody(`{{ '<i>' }}|{{{ '<i>' }}}|{{ null }}{{ undefined }}|\\{{ x }}`);
    assert.equal(body, '&lt;i&gt;|<i>||{{ x }}');
});

test('an object, array or function in text warns', () => {
    const { body, warnings } = renderBody(`{{ ({ a: 1 }) }}|{{ [1, 2] }}|{{ 'x'.trim }}`);
    assert.match(body, /^\[object Object\]\|1,2\|function trim/);
    assert.equal(warnings.length, 3);
    assert.match(warnings[0].message, /is an object/);
    assert.match(warnings[1].hint, /<template for>/);
    assert.match(warnings[2].hint, /`\(\)`/);
});

test('the same warning inside a loop is shown once', () => {
    const { warnings } = renderBody(`<template for="x in [1, 2, 3]">{{ [x] }}</template>`);
    assert.equal(warnings.length, 1);
});

test('expression errors carry their location', () => {
    const err = renderError('\n  <p>{{ data.x.y }}</p>');
    assert.deepEqual([err.line, err.column], [2, 6]);
    assert.equal(err.message, '`data.x` is `undefined`, so `.y` cannot be read.');
});
