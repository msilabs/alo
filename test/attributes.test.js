'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { wholeValueOutcome } = require('../core/attributes.js');
const { renderBody, renderError } = require('./helpers/render.js');

test('wholeValueOutcome: drops null, follows booleans, keeps other values', () => {
    assert.deepEqual(wholeValueOutcome('alt', null), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('alt', undefined), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('disabled', true), { kind: 'bare' });
    assert.deepEqual(wholeValueOutcome('disabled', 'হ্যাঁ'), { kind: 'bare' });
    assert.deepEqual(wholeValueOutcome('Disabled', 0), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('disabled', ''), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('aria-expanded', false), { kind: 'value', value: false });
    assert.deepEqual(wholeValueOutcome('title', 0), { kind: 'value', value: 0 });
});

test('a whole null or undefined value drops the attribute', () => {
    assert.equal(renderBody(`<img src="a.png" alt="{{ null }}" title="{{ undefined }}">`).body, '<img src="a.png">');
});

test('a boolean attribute is bare when true and dropped when false', () => {
    const { body } = renderBody(
        `<button disabled="{{ !true }}">a</button><button disabled="{{ 1 }}">b</button><details open="{{ 'yes' }}"></details><input checked="{{ false }}" required="{{ true }}">`,
    );
    assert.equal(body, '<button>a</button><button disabled>b</button><details open></details><input required>');
});

test('false becomes "false" on other attributes', () => {
    assert.equal(
        renderBody(`<button aria-expanded="{{ false }}" data-count="{{ 0 }}">x</button>`).body,
        '<button aria-expanded="false" data-count="0">x</button>',
    );
});

test('{{ }} in part of a value is always a string; null is empty', () => {
    assert.equal(
        renderBody(`<div class="card {{ null }}" hidden="x{{ false }}" data-a="{{ 1 }}{{ 2 }}"></div>`).body,
        '<div class="card " hidden="xfalse" data-a="12"></div>',
    );
});

test('a whole-value result is escaped and keeps the original quote', () => {
    assert.equal(renderBody(`<a title='{{ "<\\"&" }}'>x</a>`).body, `<a title='&lt;&quot;&amp;'>x</a>`);
});

test('an unquoted whole-value {{ }} gets quotes', () => {
    assert.equal(renderBody('<a title={{ 1 + 1 }}>x</a>').body, '<a title="2">x</a>');
});

test('{{{ }}} in an attribute fails, even as the whole value', () => {
    assert.match(renderError(`<a title="{{{ 'x' }}}">x</a>`).message, /`\{\{\{ \}\}\}` cannot be used in an attribute/);
    assert.match(renderError(`<a title="a {{{ 'x' }}}">x</a>`).message, /`\{\{\{ \}\}\}` cannot be used in an attribute/);
});

test('an object in an attribute warns', () => {
    const { warnings } = renderBody(`<div data-x="{{ ({}) }}"></div>`);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /is an object/);
});
