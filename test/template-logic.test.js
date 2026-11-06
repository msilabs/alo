'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBody, renderError } = require('./helpers/render.js');

test('for: item and index', () => {
    assert.equal(renderBody(`<ul><template for="x in ['a', 'b']"><li>{{ x }}</li></template></ul>`).body, '<ul><li>a</li><li>b</li></ul>');
    assert.equal(
        renderBody(`<template for="( name , i ) in ['ক', 'খ']">{{ i }}:{{ name }};</template>`).body,
        '0:ক;1:খ;',
    );
});

test('for: repeats several elements without a wrapper', () => {
    assert.equal(renderBody(`<dl><template for="x in [1, 2]"><dt>{{ x }}</dt><dd>{{ x * 2 }}</dd></template></dl>`).body, '<dl><dt>1</dt><dd>2</dd><dt>2</dt><dd>4</dd></dl>');
});

test('for: an empty array renders nothing; nested loops see outer variables', () => {
    assert.equal(renderBody(`<template for="x in []">a</template>`).body, '');
    assert.equal(
        renderBody(`<template for="row in [[1, 2], [3]]"><template for="cell in row">{{ cell }}</template>|</template>`).body,
        '12|3|',
    );
});

test('for: a non-array fails with a hint', () => {
    const object = renderError(`\n<template for="x in ({ a: 1 })">a</template>`);
    assert.match(object.message, /`for` needs an array, but `\(\{ a: 1 \}\)` is an object/);
    assert.match(object.hint, /Object\.entries/);
    assert.equal(object.line, 2);

    assert.match(renderError(`<template for="x in undefined">a</template>`).message, /is `undefined`/);
    assert.match(renderError(`<template for="x in 'abc'">a</template>`).message, /is a string/);
});

test('for: invalid syntax fails', () => {
    for (const value of ['x of list', 'in list', '(x) in list', 'x, i in list']) {
        const err = renderError(`<template for="${value}">a</template>`);
        assert.match(err.message, /Cannot parse/, value);
        assert.match(err.hint, /\(post, i\) in data\.blog/);
    }
});

test('if / else-if / else: the first true branch wins', () => {
    const chain = (n) =>
        renderBody(
            `<template if="${n} > 10">বেশি</template>\n<template else-if="${n} > 5">মাঝারি</template>\n<!-- নোট -->\n<template else-if="${n} > 0">কম</template>\n<template else>শেষ</template>`,
        ).body;
    assert.equal(chain(20), 'বেশি');
    assert.equal(chain(7), 'মাঝারি');
    assert.equal(chain(3), 'কম');
    assert.equal(chain(0), 'শেষ');
});

test('if: false without else renders nothing and keeps what follows', () => {
    assert.equal(renderBody(`<template if="false">a</template> পরে`).body, ' পরে');
    assert.equal(renderBody(`<template if="true">a</template><template if="true">b</template>`).body, 'ab');
});

test('if: conditions after the first true branch are not evaluated', () => {
    assert.equal(renderBody(`<template if="true">a</template><template else-if="missing.x">b</template>`).body, 'a');
});

test('else-if or else without a preceding if fails', () => {
    assert.match(renderError(`<template else>a</template>`).message, /`<template else>` has no `<template if>` before it/);
    assert.match(renderError(`<template else-if="x">a</template>`).message, /`<template else-if>` has no `<template if>` before it/);
    assert.match(renderError(`<template if="1">a</template><p></p><template else>b</template>`).message, /`<template else>` has no/);
    assert.match(renderError(`<template if="1">a</template><template else>b</template><template else>c</template>`).message, /`<template else>` has no/);
});

test('a value on else, or no value on if or else-if, fails', () => {
    assert.match(renderError(`<template if="1">a</template><template else="x">b</template>`).message, /`else` takes no value/);
    assert.match(renderError(`<template if>a</template>`).message, /`if` needs a value/);
    assert.match(renderError(`<template if="1">a</template><template else-if="">b</template>`).message, /`else-if` needs a value/);
    assert.match(renderError(`<template for>a</template>`).hint, /post in data\.blog/);
});

test('{{ }} in a logic value fails', () => {
    const err = renderError(`<template if="{{ x }}">a</template>`);
    assert.match(err.message, /`if` does not need `\{\{ \}\}`/);
    assert.match(err.hint, /if="x"/);
});

test('two logic attributes on one template fail with a nesting hint', () => {
    const err = renderError(`<template for="x in [1]" if="x">a</template>`);
    assert.match(err.message, /`for` and `if` cannot be on the same/);
    assert.match(err.hint, /<template for="\.\.\.">\n  <template if="\.\.\.">/);
});

test('other attributes on a logic template fail', () => {
    const err = renderError(`<template if="true" class="x">a</template>`);
    assert.match(err.message, /This `<template>` is not part of the output, so `class` has no effect here/);
    assert.equal(err.hint, 'Put it on an element inside.');
});

test('logic on a component tag fails with a hint', () => {
    const err = renderError(`\n  <Blog.PostCard for="post in data.blog" post="{{ post }}" />`);
    assert.equal(err.message, 'Logic can only be written on a <template> tag.');
    assert.equal(err.hint, '<template for="post in data.blog">\n  <Blog.PostCard post="{{ post }}" />\n</template>');
    assert.deepEqual([err.line, err.column], [2, 3]);
    assert.match(renderError(`<Card if="x" />`).hint, /<template if="x">/);
    assert.match(renderError(`<Card else />`).hint, /<template else>/);
});

test('logic on a normal element warns; label for does not', () => {
    const { body, warnings } = renderBody(`<li if="x">a</li><div for="x in y"></div><label for="email">ই-মেইল</label><p else>b</p>`);
    assert.equal(body, '<li if="x">a</li><div for="x in y"></div><label for="email">ই-মেইল</label><p else>b</p>');
    assert.deepEqual(
        warnings.map((w) => w.message),
        ['`<li if>` will not work.', '`<div for>` will not work.', '`<p else>` will not work.'],
    );
    assert.match(warnings[0].hint, /<template if="x">/);
});

test('a plain template stays, and {{ }} inside it is processed', () => {
    assert.equal(
        renderBody(`<template id="row"><tr><td>{{ 1 + 1 }}</td><slot></slot></tr></template>`).body,
        '<template id="row"><tr><td>2</td><slot></slot></tr></template>',
    );
});

test('template logic works in <head> too', () => {
    const { head } = renderBody('', `<title>t</title><template if="true"><meta property="og:image" content="{{ '/a.png' }}"></template><template if="false"><meta name="x"></template>`);
    assert.match(head, /<meta property="og:image" content="\/a\.png">/);
    assert.doesNotMatch(head, /name="x"/);
});

test('a logic template alone on its line takes the line with it', () => {
    const snippet = [
        '',
        '<ul>',
        '    <template for="x in [1, 2]">',
        '        <li>{{ x }}</li>',
        '    </template>',
        '</ul>',
        '<template if="false">',
        '    <p>না</p>',
        '</template>',
        '<template else>',
        '    <template if="true">',
        '        <p>হ্যাঁ</p>',
        '    </template>',
        '</template>',
        '<footer></footer>',
        '',
    ].join('\n');
    assert.equal(renderBody(snippet).body, ['<ul>', '        <li>1</li>', '        <li>2</li>', '</ul>', '        <p>হ্যাঁ</p>', '<footer></footer>'].join('\n'));
});

test('whitespace of inline logic templates and inside <pre> is kept', () => {
    assert.equal(renderBody('<p>\n  <template for="x in [1, 2]"><b>{{ x }}</b></template>\n</p>').body, '<p>\n  <b>1</b><b>2</b>\n</p>');
    assert.equal(renderBody('<pre>\n<template if="true">\n  কোড\n</template>\n</pre>').body, '<pre>\n\n  কোড\n\n</pre>');
});

test('errors inside loops and conditions have the right line', () => {
    const err = renderError(`<template for="x in [1]">\n  <template if="x">\n    {{ nope }}\n  </template>\n</template>`);
    assert.equal(err.line, 3);
    assert.match(err.hint, /`x`/);
});
