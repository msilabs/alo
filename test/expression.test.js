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

test('operators, literals and template literals', () => {
    const scope = { a: 7, b: 2, s: 'x', list: [1, 2, 3], user: { name: 'ক', tags: ['a', 'b'] }, nothing: null };
    const expectations = [
        ['a % b', 1],
        ['a ** b', 49],
        ['-a + +b', -5],
        ['!a', false],
        ['a > b && b > 1', true],
        ['a < b || "fallback"', 'fallback'],
        ['nothing ?? "none"', 'none'],
        ['a > 5 ? "big" : "small"', 'big'],
        ['typeof s', 'string'],
        ['typeof missingName', 'undefined'],
        ['"name" in user', true],
        ['0x10 + 1_000', 1016],
        ['`${s}-${a + b}-\\${`', 'x-9-${'],
        ['"a\\nb"', 'a\nb'],
        ['nothing?.name', undefined],
        ['nothing?.a.b.c', undefined],
        ['nothing?.[0]', undefined],
        ['nothing?.()', undefined],
        ['user.tags[1]', 'b'],
        ['user["name"]', 'ক'],
        ['list.map(n => n * 2).join("-")', '2-4-6'],
        ['list.filter((n, i) => i > 0 && n < 3).length', 1],
        ['Object.entries({ k: 1 }).map(([key, value]) => key + value)[0]', 'k1'],
        ['[...list, 4].length', 4],
        ['({ ...user, extra: 1 }).extra', 1],
        ['({ s, [s + "2"]: 2 })["x2"]', 2],
        ['"a-b".replace(/-/g, "+")', 'a+b'],
        ['6 / 3 / 2', 1],
        ['Math.max(...list)', 3],
        ['JSON.stringify({ a: [1] })', '{"a":[1]}'],
        ['new Date(0).toISOString()', '1970-01-01T00:00:00.000Z'],
        ['new Intl.NumberFormat("en").format(1234)', '1,234'],
        ['NaN === NaN', false],
    ];
    for (const [code, expected] of expectations) {
        assert.deepEqual(evaluate(code, scope, where), expected, code);
    }
});

test('a method is called with its object as this', () => {
    assert.equal(evaluate('o.get()', { o: { v: 5, get() { return this.v; } } }, where), 5);
});

test('code execution is not possible', () => {
    const attacks = [
        'process.exit(1)',
        'require("fs")',
        'globalThis',
        'eval("1")',
        'Function("return 1")()',
        'constructor.constructor("return 1")()',
        '[].constructor.constructor("return 1")()',
        '"".constructor.constructor("return 1")()',
        '(() => 1).constructor("return 1")()',
        'x["constructor"]["constructor"]("return 1")()',
        'x.__proto__',
        'x["__proto__"]',
        'x.__defineGetter__',
        'Math.constructor',
        'Object.getPrototypeOf({})',
        'Object.getOwnPropertyDescriptor({}, "a")',
        'Object.prototype',
        'Array.prototype',
        '({ __proto__: {} })',
        '({ ["constructor"]: 1 })',
        'new Function("return 1")',
        'new Object()',
        'new x()',
        'this',
        'import("fs")',
        'function () {}',
        '(function () { return 1 })()',
        'class A {}',
        'x => { return 1 }',
        'a; b',
        '`${process}`',
        'x`tagged`',
    ];
    const scope = { x: { a: 1 }, a: 1, b: 2 };
    for (const code of attacks) {
        assert.throws(() => evaluate(code, scope, where), AloError, code);
    }
});

test('blocked names give a clear message', () => {
    assert.match(evalError('x.constructor', { x: {} }).message, /Reading `constructor` is not allowed/);
    assert.match(evalError('x.__proto__', { x: {} }).message, /Reading `__proto__` is not allowed/);
    assert.match(evalError('x.prototype = 1', { x: {} }).message, /Changing `prototype` is not allowed/);
    assert.match(evalError('new Function("1")', {}).message, /`Function` is not defined/);
    assert.match(evalError('new x()', { x: class {} }).message, /`new x` is not allowed/);
});

test('syntax errors are static and tell what is not supported', () => {
    const cases = [
        ['(function () { return 1 })()', /`function` is not supported/],
        ['a b', /Unexpected `b`/],
        ['a +', /ends too early/],
        ['"open', /string is not closed/],
        ['1 +* 2', /Unexpected `\*`/],
        ['x => { a: 1 }', /expression body/],
        ['let a', /`let` is not supported/],
    ];
    for (const [code, hint] of cases) {
        const err = evalError(code, { a: 1 });
        assert.match(err.message, /Cannot parse the expression/, code);
        assert.match(err.hint, hint, code);
    }
});

test('very deep nesting fails instead of crashing', () => {
    const err = evalError('('.repeat(5000) + '1' + ')'.repeat(5000), {});
    assert.match(err.hint, /nested too deeply/);
});

test('errors never run code from the expression', () => {
    const err = evalError('a.b.c', { a: {} });
    assert.equal(err.message, '`a.b` is `undefined`, so `.c` cannot be read.');
    assert.match(err.hint, /`a\.b\?\.c`/);
    assert.equal(evalError('x()', { x: 1 }).message, '`x` is not a function.');
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
