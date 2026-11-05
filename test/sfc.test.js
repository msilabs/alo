'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSfc } = require('../core/sfc.js');
const { AloError } = require('../core/errors.js');

function sfcError(source, kind = 'page') {
    try {
        parseSfc(source, 'x.alo', kind);
    } catch (err) {
        assert.ok(err instanceof AloError);
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

test('ব্লকগুলো আলাদা হয়, ক্রম যেকোনো', () => {
    const sfc = parseSfc(
        '<!-- কমেন্ট চলে -->\n<script>go()</script>\n<template><p>a</p></template>\n<style>p {}</style>\n<style global>body {}</style>\n<head><title>t</title></head>\n',
        'pages/page.alo',
        'page',
    );
    assert.equal(sfc.template.children[0].name, 'p');
    assert.equal(sfc.script.children[0].value, 'go()');
    assert.equal(sfc.style.children[0].value, 'p {}');
    assert.equal(sfc.styleGlobal.children[0].value, 'body {}');
    assert.equal(sfc.head.children[0].name, 'title');
});

test('সব ব্লক ঐচ্ছিক', () => {
    const sfc = parseSfc('', 'x.alo', 'component');
    assert.equal(sfc.template, undefined);
});

test('ব্লকের বাইরে লেখায় সঠিক লাইনসহ এরর', () => {
    const err = sfcError('<template></template>\n\n  হ্যালো');
    assert.match(err.message, /ব্লকের বাইরে/);
    assert.deepEqual([err.line, err.column], [3, 3]);
});

test('অজানা টপ-লেভেল ব্লকে এরর', () => {
    const err = sfcError('<div></div>');
    assert.match(err.message, /অজানা টপ-লেভেল ব্লক `<div>`/);
});

test('একই ব্লক দুবার থাকলে এরর', () => {
    const err = sfcError('<template></template>\n<template></template>');
    assert.match(err.message, /একবারের বেশি/);
    assert.equal(err.line, 2);
});

test('কম্পোনেন্টে <head> থাকলে এরর', () => {
    assert.match(sfcError('<head></head>', 'component').message, /কম্পোনেন্টে `<head>` চলে না/);
    assert.ok(parseSfc('<head></head>', 'x.alo', 'layout').head);
});

test('টপ-লেভেল ব্লকে অ্যাট্রিবিউট থাকলে এরর; <style global> ছাড়া', () => {
    assert.match(sfcError('<template class="x"></template>').message, /অ্যাট্রিবিউট চলে না/);
    assert.match(sfcError('<style scoped></style>').hint, /<style global>/);
    assert.match(sfcError('<style global="1"></style>').message, /অ্যাট্রিবিউট চলে না/);
});

test('template-এর ভেতরে html, head বা body থাকলে এরর', () => {
    for (const tag of ['html', 'head', 'body']) {
        const err = sfcError(`<template>\n  <div><${tag}></${tag}></div>\n</template>`);
        assert.match(err.message, new RegExp(`\`<${tag}>\` ট্যাগ এখানে লেখা যায় না`));
        assert.equal(err.line, 2);
    }
});
