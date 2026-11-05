'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBody, renderError } = require('./helpers/render.js');

test('for: আইটেম আর ইনডেক্স', () => {
    assert.equal(renderBody(`<ul><template for="x in ['a', 'b']"><li>{{ x }}</li></template></ul>`).body, '<ul><li>a</li><li>b</li></ul>');
    assert.equal(
        renderBody(`<template for="( name , i ) in ['ক', 'খ']">{{ i }}:{{ name }};</template>`).body,
        '0:ক;1:খ;',
    );
});

test('for: মোড়ক ছাড়া একাধিক এলিমেন্ট পুনরাবৃত্তি হয়', () => {
    assert.equal(renderBody(`<dl><template for="x in [1, 2]"><dt>{{ x }}</dt><dd>{{ x * 2 }}</dd></template></dl>`).body, '<dl><dt>1</dt><dd>2</dd><dt>2</dt><dd>4</dd></dl>');
});

test('for: খালি অ্যারেতে কিছুই আসে না, নেস্টেড লুপ বাইরের ভেরিয়েবল দেখে', () => {
    assert.equal(renderBody(`<template for="x in []">a</template>`).body, '');
    assert.equal(
        renderBody(`<template for="row in [[1, 2], [3]]"><template for="cell in row">{{ cell }}</template>|</template>`).body,
        '12|3|',
    );
});

test('for: অ্যারে না হলে এরর আর ইঙ্গিত', () => {
    const object = renderError(`\n<template for="x in ({ a: 1 })">a</template>`);
    assert.match(object.message, /`for`-এর মান অ্যারে হতে হবে, কিন্তু `\(\{ a: 1 \}\)` হলো একটা অবজেক্ট/);
    assert.match(object.hint, /Object\.entries/);
    assert.equal(object.line, 2);

    assert.match(renderError(`<template for="x in undefined">a</template>`).message, /হলো `undefined`/);
    assert.match(renderError(`<template for="x in 'abc'">a</template>`).message, /একটা স্ট্রিং/);
});

test('for: ভুল লেখায় এরর', () => {
    for (const value of ['x of list', 'in list', '(x) in list', 'x, i in list']) {
        const err = renderError(`<template for="${value}">a</template>`);
        assert.match(err.message, /বোঝা যাচ্ছে না/, value);
        assert.match(err.hint, /\(post, i\) in data\.blog/);
    }
});

test('if / else-if / else: প্রথম সত্য শাখা', () => {
    const chain = (n) =>
        renderBody(
            `<template if="${n} > 10">বেশি</template>\n<template else-if="${n} > 5">মাঝারি</template>\n<!-- নোট -->\n<template else-if="${n} > 0">কম</template>\n<template else>শেষ</template>`,
        ).body;
    assert.equal(chain(20), 'বেশি');
    assert.equal(chain(7), 'মাঝারি');
    assert.equal(chain(3), 'কম');
    assert.equal(chain(0), 'শেষ');
});

test('if: else ছাড়া মিথ্যা হলে কিছু আসে না, পরের লেখা থাকে', () => {
    assert.equal(renderBody(`<template if="false">a</template> পরে`).body, ' পরে');
    assert.equal(renderBody(`<template if="true">a</template><template if="true">b</template>`).body, 'ab');
});

test('if: শুধু প্রথম সত্য শাখার শর্ত পর্যন্ত চলে', () => {
    assert.equal(renderBody(`<template if="true">a</template><template else-if="missing.x">b</template>`).body, 'a');
});

test('আগে if ছাড়া else-if বা else-এ এরর', () => {
    assert.match(renderError(`<template else>a</template>`).message, /`<template else>`-এর আগে কোনো `<template if>` নেই/);
    assert.match(renderError(`<template else-if="x">a</template>`).message, /`<template else-if>`-এর আগে/);
    assert.match(renderError(`<template if="1">a</template><p></p><template else>b</template>`).message, /`<template else>`-এর আগে/);
    assert.match(renderError(`<template if="1">a</template><template else>b</template><template else>c</template>`).message, /`<template else>`-এর আগে/);
});

test('else-এ মান, আর if বা else-if-এ মান না থাকলে এরর', () => {
    assert.match(renderError(`<template if="1">a</template><template else="x">b</template>`).message, /`else`-এ কোনো মান থাকে না/);
    assert.match(renderError(`<template if>a</template>`).message, /`if`-এ মান দাও/);
    assert.match(renderError(`<template if="1">a</template><template else-if="">b</template>`).message, /`else-if`-এ মান দাও/);
    assert.match(renderError(`<template for>a</template>`).hint, /post in data\.blog/);
});

test('লজিকের মানে {{ }} দিলে এরর', () => {
    const err = renderError(`<template if="{{ x }}">a</template>`);
    assert.match(err.message, /`if`-এর মানে `\{\{ \}\}` লাগে না/);
    assert.match(err.hint, /if="x"/);
});

test('একই template-এ দুটো লজিক থাকলে এরর আর নেস্টিংয়ের ইঙ্গিত', () => {
    const err = renderError(`<template for="x in [1]" if="x">a</template>`);
    assert.match(err.message, /`for` আর `if` একসাথে চলে না/);
    assert.match(err.hint, /<template for="\.\.\.">\n  <template if="\.\.\.">/);
});

test('লজিকওয়ালা template-এ অন্য অ্যাট্রিবিউট থাকলে এরর', () => {
    const err = renderError(`<template if="true" class="x">a</template>`);
    assert.match(err.message, /এই `<template>` আউটপুটে যায় না, তাই `class` এখানে কাজ করবে না/);
    assert.equal(err.hint, 'ভেতরের এলিমেন্টে দাও।');
});

test('কম্পোনেন্ট ট্যাগে লজিক থাকলে এরর আর ইঙ্গিত', () => {
    const err = renderError(`\n  <Blog.PostCard for="post in data.blog" post="{{ post }}" />`);
    assert.equal(err.message, 'লজিক শুধু <template> ট্যাগে লেখা যায়।');
    assert.equal(err.hint, '<template for="post in data.blog">\n  <Blog.PostCard post="{{ post }}" />\n</template>');
    assert.deepEqual([err.line, err.column], [2, 3]);
    assert.match(renderError(`<Card if="x" />`).hint, /<template if="x">/);
    assert.match(renderError(`<Card else />`).hint, /<template else>/);
});

test('সাধারণ এলিমেন্টে লজিকে সতর্কবার্তা; label for-এ নয়', () => {
    const { body, warnings } = renderBody(`<li if="x">a</li><div for="x in y"></div><label for="email">ই-মেইল</label><p else>b</p>`);
    assert.equal(body, '<li if="x">a</li><div for="x in y"></div><label for="email">ই-মেইল</label><p else>b</p>');
    assert.deepEqual(
        warnings.map((w) => w.message),
        ['`<li if>` কাজ করবে না।', '`<div for>` কাজ করবে না।', '`<p else>` কাজ করবে না।'],
    );
    assert.match(warnings[0].hint, /<template if="x">/);
});

test('লজিক ছাড়া template হুবহু থাকে, ভেতরের {{ }} প্রসেস হয়', () => {
    assert.equal(
        renderBody(`<template id="row"><tr><td>{{ 1 + 1 }}</td><slot></slot></tr></template>`).body,
        '<template id="row"><tr><td>2</td><slot></slot></tr></template>',
    );
});

test('<head>-এও template লজিক চলে', () => {
    const { head } = renderBody('', `<title>t</title><template if="true"><meta property="og:image" content="{{ '/a.png' }}"></template><template if="false"><meta name="x"></template>`);
    assert.match(head, /<meta property="og:image" content="\/a\.png">/);
    assert.doesNotMatch(head, /name="x"/);
});

test('নিজের লাইনে একা থাকা লজিক-template লাইনসহ বাদ যায়, ফাঁকা লাইন থাকে না', () => {
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

test('এক লাইনে লেখা লজিক-template আর <pre>-এর ভেতরের হোয়াইটস্পেস বদলায় না', () => {
    assert.equal(renderBody('<p>\n  <template for="x in [1, 2]"><b>{{ x }}</b></template>\n</p>').body, '<p>\n  <b>1</b><b>2</b>\n</p>');
    assert.equal(renderBody('<pre>\n<template if="true">\n  কোড\n</template>\n</pre>').body, '<pre>\n\n  কোড\n\n</pre>');
});

test('লুপ আর শর্তের ভেতরের এররে সঠিক লাইন', () => {
    const err = renderError(`<template for="x in [1]">\n  <template if="x">\n    {{ nope }}\n  </template>\n</template>`);
    assert.equal(err.line, 3);
    assert.match(err.hint, /`x`/);
});
