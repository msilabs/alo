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
        assert.ok(err instanceof AloError, 'expected an AloError');
        return err;
    }
    assert.fail('expected an error');
}

test('keeps tag name case and dotted names', () => {
    const root = parseHtml('<Card></Card><card></card><Blog.PostCard /><linearGradient></linearGradient>');
    assert.deepEqual(
        root.children.map((node) => node.name),
        ['Card', 'card', 'Blog.PostCard', 'linearGradient'],
    );
});

test('void and self-closing elements have no children', () => {
    const root = parseHtml('<div><br><img src="a.png"><Card /><slot /></div>');
    const [div] = root.children;
    assert.deepEqual(div.children.map((node) => node.name), ['br', 'img', 'Card', 'slot']);
    assert.equal(div.children[2].selfClosing, true);
    assert.equal(div.children[0].selfClosing, false);
});

test('four attribute forms and unknown names', () => {
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

test('{{ }} in text becomes separate parts', () => {
    const [p] = parseHtml('<p>হ্যালো {{ name }}, {{{ html }}}!</p>').children;
    assert.deepEqual(
        p.children[0].parts.map((part) => (part.type === 'text' ? part.value : [part.code, part.raw])),
        ['হ্যালো ', ['name', false], ', ', ['html', true], '!'],
    );
});

test('{{ a > b }} does not break a tag', () => {
    const [p] = parseHtml('<p>{{ a > b }} আর {{ a < b }}</p>').children;
    const codes = p.children[0].parts.filter((part) => part.type === 'expr').map((part) => part.code);
    assert.deepEqual(codes, ['a > b', 'a < b']);
});

test('quotes inside an attribute expression keep the value whole', () => {
    const [el] = parseHtml(`<a title="{{ x === "a" ? 'হ্যাঁ' : 'না' }}" href="/blog/{{ post.slug }}/">x</a>`).children;
    assert.equal(el.attrs[0].parts[0].code, `x === "a" ? 'হ্যাঁ' : 'না'`);
    assert.deepEqual(
        el.attrs[1].parts.map((part) => part.value ?? part.code),
        ['/blog/', 'post.slug', '/'],
    );
});

test('}} inside strings, template literals and objects does not end an expression', () => {
    const [p] = parseHtml("<p>{{ '}}' }}{{ `a ${ {b: 1}.b } }}` }}{{ {a: 1}.a }}</p>").children;
    const codes = p.children[0].parts.map((part) => part.code);
    assert.deepEqual(codes, ["'}}'", '`a ${ {b: 1}.b } }}`', '{a: 1}.a']);
});

test('\\{{ becomes a literal {{', () => {
    const [p] = parseHtml('<p>\\{{ x }}</p>').children;
    assert.deepEqual(p.children[0].parts, [{ type: 'text', value: '{{ x }}' }]);
});

test('script and style are raw text; pre and textarea are normal', () => {
    const root = parseHtml('<script>if (a < b) { x = "{{ y }}"; }</script><style>a > b {}</style><pre>{{ code }}</pre>');
    const [script, style, pre] = elements(root.children);
    assert.equal(script.children[0].value, 'if (a < b) { x = "{{ y }}"; }');
    assert.equal(script.children[0].rawText, true);
    assert.equal(style.children[0].value, 'a > b {}');
    assert.equal(pre.children[0].parts[0].code, 'code');
});

test('the inside of a template tag is parsed as elements', () => {
    const [tpl] = parseHtml('<template for="x in list"><li>{{ x }}</li></template>').children;
    assert.equal(tpl.children[0].name, 'li');
});

test('comments and whitespace are kept as written', () => {
    const root = parseHtml('<!-- নোট -->\n  <p> a </p>');
    assert.equal(root.children[0].value, '<!-- নোট -->');
    assert.equal(root.children[1].value, '\n  ');
    assert.equal(root.children[2].children[0].value, ' a ');
});

test('nodes carry line and column', () => {
    const root = parseHtml('<div>\n  <p>\n    {{ x }}</p></div>');
    const p = root.children[0].children[1];
    assert.deepEqual([p.line, p.column], [2, 3]);
    const expr = p.children[0].parts[1];
    assert.deepEqual([expr.line, expr.column], [3, 5]);
});

test('an unclosed tag fails with its line', () => {
    const err = parseError('<div>\n  <p>লেখা\n</div>');
    assert.match(err.message, /`<p>` is not closed/);
    assert.deepEqual([err.file, err.line, err.column], ['test.alo', 2, 3]);

    const eof = parseError('<section>\n<p>a</p>');
    assert.match(eof.message, /`<section>` is never closed/);
    assert.equal(eof.line, 1);
});

test('a stray closing tag and a closed void element fail', () => {
    assert.match(parseError('<p></p></div>').message, /has no matching `<div>`/);
    assert.match(parseError('<br></br>').message, /`<\/br>` is not needed/);
});

test('an unclosed {{ fails with its line', () => {
    const err = parseError('<p>\n  {{ title </p>');
    assert.match(err.message, /Unclosed `\{\{`/);
    assert.deepEqual([err.line, err.column], [2, 3]);
});

test('{{ }} in an attribute name fails', () => {
    assert.match(parseError('<div {{ x }}="1"></div>').message, /cannot be used in an attribute name/);
});

test('an empty {{ }} fails', () => {
    assert.match(parseError('<p>{{ }}</p>').message, /Empty/);
});

test('unquoted values with {{ }} handle spaces and />', () => {
    const [a, b] = parseHtml('<Card count={{ 1 + 2 }} /><Card count={{ 5 }}/>').children;
    assert.deepEqual([a.attrs[0].value, a.selfClosing], ['{{ 1 + 2 }}', true]);
    assert.deepEqual([b.attrs[0].value, b.selfClosing], ['{{ 5 }}', true]);
});

test('{{ }} in a tag name fails', () => {
    for (const source of ['<{{ tag }}>a', '<div{{ x }}></div>', '<p></{{ x }}>']) {
        const err = parseError(source);
        assert.match(err.message, /`\{\{ \}\}` cannot be used in a tag name/, source);
    }
});

test('a closing tag with different case gets a hint', () => {
    const err = parseError('<Card>\n</card>');
    assert.match(err.message, /`<\/card>` does not close `<Card>`/);
    assert.match(err.hint, /write `<\/Card>`/);
    assert.equal(err.line, 2);
});

test('a stray / inside a tag is ignored', () => {
    const [a] = parseHtml('<a / href="x">y</a>').children;
    assert.deepEqual(a.attrs.map((attr) => attr.name), ['href']);
});

test('only lowercase script and style are raw; their closing tag may use any case', () => {
    const [component, script] = parseHtml('<Script>{{ x }}</Script><script>a</SCRIPT>').children;
    assert.equal(component.children[0].parts[0].code, 'x');
    assert.equal(script.children[0].value, 'a');
});

test('a < that starts no tag is plain text', () => {
    const [p] = parseHtml('<p>a < b, 3<4</p>').children;
    assert.equal(p.children[0].value, 'a < b, 3<4');
});

test('an unclosed comment, an unclosed quote and DOCTYPE fail', () => {
    assert.match(parseError('<p>a</p>\n<!-- নোট').message, /Unclosed HTML comment/);
    const quote = parseError('<a href="/x>y</a>');
    assert.match(quote.message, /Unclosed quote in the value of `href`/);
    const doctype = parseError('<!DOCTYPE html>');
    assert.match(doctype.hint, /Alo adds `<!DOCTYPE>` itself/);
});

test('{{ }} inside a comment is left alone', () => {
    const [comment] = parseHtml('<!-- {{ x }} -->').children;
    assert.equal(comment.type, 'comment');
    assert.equal(comment.value, '<!-- {{ x }} -->');
});

test('line numbers stay right with CRLF and multi-line attributes', () => {
    const root = parseHtml('<div>\r\n  <a\r\n    title="{{\r\n      x }}">y</a>\r\n</div>');
    const a = root.children[0].children[1];
    assert.deepEqual([a.line, a.column], [2, 3]);
    const expr = a.attrs[0].parts[0];
    assert.deepEqual([expr.line, expr.column, expr.code], [3, 12, 'x']);
});

test('\\{{ stays literal in attributes', () => {
    const [el] = parseHtml('<code data-x="\\{{ y }}"></code>').children;
    assert.deepEqual(el.attrs[0].parts, [{ type: 'text', value: '{{ y }}' }]);
});

test('a leading BOM is dropped', () => {
    const root = parseHtml('﻿<p>a</p>');
    assert.equal(root.children[0].name, 'p');
});
