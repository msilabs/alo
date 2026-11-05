'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeHeads, splitHead } = require('../core/head.js');

const CHARSET = '<meta charset="UTF-8">';
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';

test('splitHead শীর্ষ স্তরের ট্যাগ আলাদা করে', () => {
    const items = splitHead(`
        <title>a > b</title>
        <meta name="x" content="1 > 0">
        <!-- নোট -->
        <script src="/a.js"></script>
        <link rel="icon" href="/f.ico" />
        <style>p > a {}</style>
    `);
    assert.deepEqual(
        items.map((item) => item.html),
        [
            '<title>a > b</title>',
            '<meta name="x" content="1 > 0">',
            '<!-- নোট -->',
            '<script src="/a.js"></script>',
            '<link rel="icon" href="/f.ico" />',
            '<style>p > a {}</style>',
        ],
    );
    assert.equal(items[1].key, 'name:x');
});

test('ডিফল্ট charset, viewport আর title', () => {
    assert.deepEqual(mergeHeads(['', ''], 'Alo'), [CHARSET, VIEWPORT, '<title>Alo</title>']);
    assert.deepEqual(mergeHeads([''], 'আমার <সাইট>'), [CHARSET, VIEWPORT, '<title>আমার &lt;সাইট&gt;</title>']);
});

test('শেষের title জেতে', () => {
    assert.deepEqual(mergeHeads(['<title>লেআউট</title>', '<title>পেইজ</title>'], 'Alo')[2], '<title>পেইজ</title>');
});

test('একই name বা property-র meta-তে শেষেরটা জেতে', () => {
    const head = mergeHeads(
        [
            '<meta name="description" content="সাইট"><meta property="og:title" content="ক">',
            '<meta name="Description" content="পেইজ"><meta property="og:title" content="খ">',
        ],
        'Alo',
    );
    assert.deepEqual(head.slice(3), ['<meta name="Description" content="পেইজ">', '<meta property="og:title" content="খ">']);
});

test('ইউজারের charset আর viewport ডিফল্টের জায়গা নেয়', () => {
    const head = mergeHeads(['<meta name="viewport" content="width=1000"><meta charset="windows-1252">'], 'Alo');
    assert.deepEqual(head, ['<meta charset="windows-1252">', '<meta name="viewport" content="width=1000">', '<title>Alo</title>']);
});

test('হুবহু ডুপ্লিকেট একবারই বসে, বাকিগুলো ক্রমে', () => {
    const head = mergeHeads(['<link rel="icon" href="/a.ico"><script src="/x.js"></script>', '<link rel="icon" href="/a.ico"><link rel="me" href="/b">'], 'Alo');
    assert.deepEqual(head.slice(3), ['<link rel="icon" href="/a.ico">', '<script src="/x.js"></script>', '<link rel="me" href="/b">']);
});
