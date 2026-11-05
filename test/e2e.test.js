'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'alo.js');
const EXAMPLE = path.join(__dirname, '..', 'example');

function tempProject(t, from) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alo-e2e-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    if (from) fs.cpSync(from, dir, { recursive: true, filter: (src) => path.basename(src) !== 'dist' });
    return dir;
}

function alo(cwd, args) {
    const result = spawnSync(process.execPath, [BIN, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('example/ বিল্ড হয়ে dist/index.html তৈরি হয়', (t) => {
    const dir = tempProject(t, EXAMPLE);
    const result = alo(dir, ['build']);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /বিল্ড শেষ: 1টা পেইজ/);

    const html = fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8');
    assert.match(html, /^<!DOCTYPE html>\n<html lang="bn">/);
    assert.match(html, /<title>আলো — হালকা স্ট্যাটিক সাইট<\/title>/);
    assert.match(html, /HTML, CSS আর JS লেখো; বিল্ড করলে পাবে স্ট্যাটিক সাইট।/);
    assert.match(html, /<code>\/<\/code>/);
    assert.match(html, /২ \+ ৩ = 5/);
    assert.match(html, /আক্ষরিক বন্ধনী লিখতে: \{\{ এভাবে \}\}/);
    assert.match(html, /<!-- এই কমেন্ট আউটপুটে হুবহু যায় -->/);
    assert.match(html, /<linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">/);
    assert.match(html, /<stop offset="0" stop-color="#ffd54f"><\/stop>/);
    assert.match(html, /<p title="তুলনা: বড়">/);
    assert.match(html, /<pre><code>const আলো = &#39;হালকা&#39;;<\/code><\/pre>/);
    assert.match(html, /<button type="button" x-data="\{ open: false \}" @click="open = !open" :aria-expanded="open">/);
    assert.match(html, /<li>1\. HTML<\/li>[\s\S]*<li>2\. CSS<\/li>[\s\S]*<li>3\. JavaScript<\/li>/);
    assert.match(html, /<p>মাত্র 3টা জিনিস জানলেই চলে।<\/p>/);
    assert.doesNotMatch(html, /অনেক কিছু|কিছুই লাগে না|<template/);
    assert.match(html, /<details open>/);
    assert.match(html, /<button aria-pressed="false">চাপো<\/button>/);
    assert.doesNotMatch(result.stderr, /⚠/);
    assert.ok(!fs.existsSync(path.join(dir, '.alo', 'build')), 'অস্থায়ী ফোল্ডার থেকে যাওয়া উচিত নয়');
});

test('এরর হলে কোড ফ্রেমসহ বাংলা মেসেজ, exit 1, আর আগের dist/ অক্ষত', (t) => {
    const dir = tempProject(t);
    fs.mkdirSync(path.join(dir, 'pages'));
    fs.writeFileSync(path.join(dir, 'pages', 'page.alo'), '<template>\n  <h1>ঠিক আছে</h1>\n</template>\n');
    assert.equal(alo(dir, ['build']).code, 0);

    fs.writeFileSync(path.join(dir, 'pages', 'page.alo'), '<template>\n  <h1>{{ titel }}</h1>\n</template>\n');
    const result = alo(dir, ['build']);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ এরর: pages\/page\.alo:2:7/);
    assert.match(result.stderr, /`titel` নামে কোনো ভেরিয়েবল নেই/);
    assert.match(result.stderr, /2 \|   <h1>\{\{ titel \}\}<\/h1>/);
    assert.match(fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8'), /ঠিক আছে/);
});

test('pages/ না থাকলে বিল্ডে পরিষ্কার এরর', (t) => {
    const dir = tempProject(t);
    const result = alo(dir, ['build']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`pages\/` ফোল্ডার নেই/);
});
