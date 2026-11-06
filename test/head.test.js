'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeHeads, splitHead } = require('../core/head.js');

const CHARSET = '<meta charset="UTF-8">';
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';

test('splitHead separates top-level tags', () => {
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

test('default charset, viewport and title', () => {
    assert.deepEqual(mergeHeads(['', ''], 'Alo'), [CHARSET, VIEWPORT, '<title>Alo</title>']);
    assert.deepEqual(mergeHeads([''], 'আমার <সাইট>'), [CHARSET, VIEWPORT, '<title>আমার &lt;সাইট&gt;</title>']);
});

test('the last title wins', () => {
    assert.deepEqual(mergeHeads(['<title>লেআউট</title>', '<title>পেইজ</title>'], 'Alo')[2], '<title>পেইজ</title>');
});

test('the last meta with the same name or property wins', () => {
    const head = mergeHeads(
        [
            '<meta name="description" content="সাইট"><meta property="og:title" content="ক">',
            '<meta name="Description" content="পেইজ"><meta property="og:title" content="খ">',
        ],
        'Alo',
    );
    assert.deepEqual(head.slice(3), ['<meta name="Description" content="পেইজ">', '<meta property="og:title" content="খ">']);
});

test('user charset and viewport replace the defaults', () => {
    const head = mergeHeads(['<meta name="viewport" content="width=1000"><meta charset="windows-1252">'], 'Alo');
    assert.deepEqual(head, ['<meta charset="windows-1252">', '<meta name="viewport" content="width=1000">', '<title>Alo</title>']);
});

test('exact duplicates appear once, the rest in order', () => {
    const head = mergeHeads(['<link rel="icon" href="/a.ico"><script src="/x.js"></script>', '<link rel="icon" href="/a.ico"><link rel="me" href="/b">'], 'Alo');
    assert.deepEqual(head.slice(3), ['<link rel="icon" href="/a.ico">', '<script src="/x.js"></script>', '<link rel="me" href="/b">']);
});
