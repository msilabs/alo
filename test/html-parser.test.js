'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHtml } = require('../core/html-parser.js');
const { AloError } = require('../core/errors.js');

function elements(nodes) {
    return nodes.filter((node) => node.type === 'element');
}

function parseError(source) {
    try {
        parseHtml(source, 'test.alo');
    } catch (err) {
        assert.ok(err instanceof AloError, 'AloError আশা করা হয়েছিল');
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

test('ট্যাগের নামের কেস আর Dot নাম হুবহু থাকে', () => {
    const root = parseHtml('<Card></Card><card></card><Blog.PostCard /><linearGradient></linearGradient>');
    assert.deepEqual(
        root.children.map((node) => node.name),
        ['Card', 'card', 'Blog.PostCard', 'linearGradient'],
    );
});

test('void আর self-closing এলিমেন্টের কোনো চাইল্ড নেই', () => {
    const root = parseHtml('<div><br><img src="a.png"><Card /><slot /></div>');
    const [div] = root.children;
    assert.deepEqual(div.children.map((node) => node.name), ['br', 'img', 'Card', 'slot']);
    assert.equal(div.children[2].selfClosing, true);
    assert.equal(div.children[0].selfClosing, false);
});

test('অ্যাট্রিবিউটের চার ধরন আর অচেনা নাম', () => {
    const [el] = parseHtml(`<button a="1" b='2' c=3 disabled :click="x" @click.prevent="go()" x-data="{ open: false }"></button>`).children;
    assert.deepEqual(
        el.attrs.map((attr) => [attr.name, attr.value, attr.quote]),
        [
            ['a', '1', '"'],
            ['b', '2', "'"],
            ['c', '3', ''],
            ['disabled', null, ''],
            [':click', 'x', '"'],
            ['@click.prevent', 'go()', '"'],
            ['x-data', '{ open: false }', '"'],
        ],
    );
});

test('লেখায় {{ }} আলাদা অংশ হয়', () => {
    const [p] = parseHtml('<p>হ্যালো {{ name }}, {{{ html }}}!</p>').children;
    assert.deepEqual(
        p.children[0].parts.map((part) => (part.type === 'text' ? part.value : [part.code, part.raw])),
        ['হ্যালো ', ['name', false], ', ', ['html', true], '!'],
    );
});

test('{{ a > b }} ট্যাগ ভাঙে না', () => {
    const [p] = parseHtml('<p>{{ a > b }} আর {{ a < b }}</p>').children;
    const codes = p.children[0].parts.filter((part) => part.type === 'expr').map((part) => part.code);
    assert.deepEqual(codes, ['a > b', 'a < b']);
});

test('অ্যাট্রিবিউটের এক্সপ্রেশনে কোট থাকলেও মান ভাঙে না', () => {
    const [el] = parseHtml(`<a title="{{ x === "a" ? 'হ্যাঁ' : 'না' }}" href="/blog/{{ post.slug }}/">x</a>`).children;
    assert.equal(el.attrs[0].parts[0].code, `x === "a" ? 'হ্যাঁ' : 'না'`);
    assert.deepEqual(
        el.attrs[1].parts.map((part) => part.value ?? part.code),
        ['/blog/', 'post.slug', '/'],
    );
});

test('স্ট্রিং, টেমপ্লেট লিটারাল আর অবজেক্টের ভেতরের }} এক্সপ্রেশন শেষ করে না', () => {
    const [p] = parseHtml("<p>{{ '}}' }}{{ `a ${ {b: 1}.b } }}` }}{{ {a: 1}.a }}</p>").children;
    const codes = p.children[0].parts.map((part) => part.code);
    assert.deepEqual(codes, ["'}}'", '`a ${ {b: 1}.b } }}`', '{a: 1}.a']);
});

test('\\{{ আক্ষরিক {{ হয়', () => {
    const [p] = parseHtml('<p>\\{{ x }}</p>').children;
    assert.deepEqual(p.children[0].parts, [{ type: 'text', value: '{{ x }}' }]);
});

test('script আর style raw text; pre আর textarea সাধারণ', () => {
    const root = parseHtml('<script>if (a < b) { x = "{{ y }}"; }</script><style>a > b {}</style><pre>{{ code }}</pre>');
    const [script, style, pre] = elements(root.children);
    assert.equal(script.children[0].value, 'if (a < b) { x = "{{ y }}"; }');
    assert.equal(script.children[0].rawText, true);
    assert.equal(style.children[0].value, 'a > b {}');
    assert.equal(pre.children[0].parts[0].code, 'code');
});

test('template ট্যাগের ভেতরটা এলিমেন্ট হিসেবে পার্স হয়', () => {
    const [tpl] = parseHtml('<template for="x in list"><li>{{ x }}</li></template>').children;
    assert.equal(tpl.children[0].name, 'li');
});

test('কমেন্ট আর হোয়াইটস্পেস হুবহু থাকে', () => {
    const root = parseHtml('<!-- নোট -->\n  <p> a </p>');
    assert.equal(root.children[0].value, '<!-- নোট -->');
    assert.equal(root.children[1].value, '\n  ');
    assert.equal(root.children[2].children[0].value, ' a ');
});

test('নোডে লাইন আর কলাম থাকে', () => {
    const root = parseHtml('<div>\n  <p>\n    {{ x }}</p></div>');
    const p = root.children[0].children[1];
    assert.deepEqual([p.line, p.column], [2, 3]);
    const expr = p.children[0].parts[1];
    assert.deepEqual([expr.line, expr.column], [3, 5]);
});

test('বন্ধ না করা ট্যাগে লাইনসহ এরর', () => {
    const err = parseError('<div>\n  <p>লেখা\n</div>');
    assert.match(err.message, /`<p>` বন্ধ হয়নি/);
    assert.deepEqual([err.file, err.line, err.column], ['test.alo', 2, 3]);

    const eof = parseError('<section>\n<p>a</p>');
    assert.match(eof.message, /`<section>` বন্ধ হয়নি/);
    assert.equal(eof.line, 1);
});

test('খোলা ছাড়া বন্ধ ট্যাগ আর void বন্ধ করায় এরর', () => {
    assert.match(parseError('<p></p></div>').message, /কোনো খোলা `<div>` নেই/);
    assert.match(parseError('<br></br>').message, /`<\/br>` লাগে না/);
});

test('বন্ধ না করা {{-এ লাইনসহ এরর', () => {
    const err = parseError('<p>\n  {{ title </p>');
    assert.match(err.message, /`\{\{` বন্ধ হয়নি/);
    assert.deepEqual([err.line, err.column], [2, 3]);
});

test('অ্যাট্রিবিউটের নামে {{ }} থাকলে এরর', () => {
    assert.match(parseError('<div {{ x }}="1"></div>').message, /অ্যাট্রিবিউটের নামে/);
});

test('খালি {{ }}-এ এরর', () => {
    assert.match(parseError('<p>{{ }}</p>').message, /খালি/);
});

test('শুরুর BOM বাদ যায়', () => {
    const root = parseHtml('﻿<p>a</p>');
    assert.equal(root.children[0].name, 'p');
});
