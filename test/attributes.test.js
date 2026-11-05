'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { wholeValueOutcome } = require('../core/attributes.js');
const { renderBody, renderError } = require('./helpers/render.js');

test('wholeValueOutcome: null বাদ, boolean অনুযায়ী, বাকিটা মান', () => {
    assert.deepEqual(wholeValueOutcome('alt', null), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('alt', undefined), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('disabled', true), { kind: 'bare' });
    assert.deepEqual(wholeValueOutcome('disabled', 'হ্যাঁ'), { kind: 'bare' });
    assert.deepEqual(wholeValueOutcome('Disabled', 0), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('disabled', ''), { kind: 'drop' });
    assert.deepEqual(wholeValueOutcome('aria-expanded', false), { kind: 'value', value: false });
    assert.deepEqual(wholeValueOutcome('title', 0), { kind: 'value', value: 0 });
});

test('পুরো মান null বা undefined হলে অ্যাট্রিবিউট বাদ যায়', () => {
    assert.equal(renderBody(`<img src="a.png" alt="{{ null }}" title="{{ undefined }}">`).body, '<img src="a.png">');
});

test('boolean অ্যাট্রিবিউট সত্য হলে মান ছাড়া, মিথ্যা হলে বাদ', () => {
    const { body } = renderBody(
        `<button disabled="{{ !true }}">a</button><button disabled="{{ 1 }}">b</button><details open="{{ 'yes' }}"></details><input checked="{{ false }}" required="{{ true }}">`,
    );
    assert.equal(body, '<button>a</button><button disabled>b</button><details open></details><input required>');
});

test('অন্য অ্যাট্রিবিউটে false হয় "false"', () => {
    assert.equal(
        renderBody(`<button aria-expanded="{{ false }}" data-count="{{ 0 }}">x</button>`).body,
        '<button aria-expanded="false" data-count="0">x</button>',
    );
});

test('মানের অংশে {{ }} থাকলে সবসময় স্ট্রিং; null খালি', () => {
    assert.equal(
        renderBody(`<div class="card {{ null }}" hidden="x{{ false }}" data-a="{{ 1 }}{{ 2 }}"></div>`).body,
        '<div class="card " hidden="xfalse" data-a="12"></div>',
    );
});

test('পুরো-মানের ফলাফলও escape হয়, আর মূল কোট থাকে', () => {
    assert.equal(renderBody(`<a title='{{ "<\\"&" }}'>x</a>`).body, `<a title='&lt;&quot;&amp;'>x</a>`);
});

test('কোট ছাড়া পুরো-মান {{ }}-এ কোট বসে', () => {
    assert.equal(renderBody('<a title={{ 1 + 1 }}>x</a>').body, '<a title="2">x</a>');
});

test('অ্যাট্রিবিউটে {{{ }}} থাকলে এরর, পুরো-মান হলেও', () => {
    assert.match(renderError(`<a title="{{{ 'x' }}}">x</a>`).message, /অ্যাট্রিবিউটে `\{\{\{ \}\}\}` চলে না/);
    assert.match(renderError(`<a title="a {{{ 'x' }}}">x</a>`).message, /অ্যাট্রিবিউটে `\{\{\{ \}\}\}` চলে না/);
});

test('অ্যাট্রিবিউটে অবজেক্ট বসালে সতর্কবার্তা', () => {
    const { warnings } = renderBody(`<div data-x="{{ ({}) }}"></div>`);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /একটা অবজেক্ট/);
});
