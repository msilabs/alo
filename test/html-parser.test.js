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

test('কোট ছাড়া মানে {{ }} থাকলে স্পেস আর /> দুটোই ঠিক থাকে', () => {
    const [a, b] = parseHtml('<Card count={{ 1 + 2 }} /><Card count={{ 5 }}/>').children;
    assert.deepEqual([a.attrs[0].value, a.selfClosing], ['{{ 1 + 2 }}', true]);
    assert.deepEqual([b.attrs[0].value, b.selfClosing], ['{{ 5 }}', true]);
});

test('ট্যাগের নামে {{ }} থাকলে এরর', () => {
    for (const source of ['<{{ tag }}>a', '<div{{ x }}></div>', '<p></{{ x }}>']) {
        const err = parseError(source);
        assert.match(err.message, /ট্যাগের নামে `\{\{ \}\}` চলে না/, source);
    }
});

test('বন্ধ করার ট্যাগে বড়-ছোট হাত না মিললে ইঙ্গিত', () => {
    const err = parseError('<Card>\n</card>');
    assert.match(err.message, /`<\/card>` দিয়ে `<Card>` বন্ধ হয় না/);
    assert.match(err.hint, /`<\/Card>` লেখো/);
    assert.equal(err.line, 2);
});

test('ট্যাগের ভেতরে বাড়তি / উপেক্ষা হয়', () => {
    const [a] = parseHtml('<a / href="x">y</a>').children;
    assert.deepEqual(a.attrs.map((attr) => attr.name), ['href']);
});

test('শুধু ছোট হাতের script আর style raw; বন্ধ ট্যাগ যেকোনো কেসে', () => {
    const [component, script] = parseHtml('<Script>{{ x }}</Script><script>a</SCRIPT>').children;
    assert.equal(component.children[0].parts[0].code, 'x');
    assert.equal(script.children[0].value, 'a');
});

test('ট্যাগ নয় এমন < আক্ষরিক লেখা', () => {
    const [p] = parseHtml('<p>a < b, 3<4</p>').children;
    assert.equal(p.children[0].value, 'a < b, 3<4');
});

test('বন্ধ না করা কমেন্ট, কোট আর DOCTYPE-এ এরর', () => {
    assert.match(parseError('<p>a</p>\n<!-- নোট').message, /কমেন্ট বন্ধ হয়নি/);
    const quote = parseError('<a href="/x>y</a>');
    assert.match(quote.message, /`href`-এর মানের কোট বন্ধ হয়নি/);
    const doctype = parseError('<!DOCTYPE html>');
    assert.match(doctype.hint, /Alo নিজে বসায়/);
});

test('কমেন্টের ভেতরের {{ }} ছোঁয়া হয় না', () => {
    const [comment] = parseHtml('<!-- {{ x }} -->').children;
    assert.equal(comment.type, 'comment');
    assert.equal(comment.value, '<!-- {{ x }} -->');
});

test('CRLF আর কয়েক লাইনের অ্যাট্রিবিউটে লাইন নম্বর ঠিক থাকে', () => {
    const root = parseHtml('<div>\r\n  <a\r\n    title="{{\r\n      x }}">y</a>\r\n</div>');
    const a = root.children[0].children[1];
    assert.deepEqual([a.line, a.column], [2, 3]);
    const expr = a.attrs[0].parts[0];
    assert.deepEqual([expr.line, expr.column, expr.code], [3, 12, 'x']);
});

test('অ্যাট্রিবিউটে \\{{ আক্ষরিক থাকে', () => {
    const [el] = parseHtml('<code data-x="\\{{ y }}"></code>').children;
    assert.deepEqual(el.attrs[0].parts, [{ type: 'text', value: '{{ y }}' }]);
});

test('শুরুর BOM বাদ যায়', () => {
    const root = parseHtml('﻿<p>a</p>');
    assert.equal(root.children[0].name, 'p');
});
