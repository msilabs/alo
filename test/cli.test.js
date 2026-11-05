'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { version } = require('../package.json');

const BIN = path.join(__dirname, '..', 'bin', 'alo.js');
const FAKE_NODE_20 = path.join(__dirname, 'helpers', 'fake-node-20.js');

function alo(args, nodeArgs = []) {
    const result = spawnSync(process.execPath, [...nodeArgs, BIN, ...args], {
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('--version ভার্সন দেখায়', () => {
    const result = alo(['--version']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), version);
});

test('--help আর শুধু alo সাহায্য দেখায়', () => {
    for (const args of [['--help'], []]) {
        const result = alo(args);
        assert.equal(result.code, 0);
        assert.match(result.stdout, /ব্যবহার:/);
        assert.match(result.stdout, /alo build \[--base \/\]/);
    }
});

test('অজানা কমান্ডে কাছাকাছি কমান্ডের পরামর্শ', () => {
    const result = alo(['biuld']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ এরর:/);
    assert.match(result.stderr, /অজানা কমান্ড `biuld`/);
    assert.match(result.stderr, /`alo build` বোঝাতে চেয়েছিলে/);
});

test('অনেক দূরের অজানা কমান্ডে শুধু সাহায্যের ইঙ্গিত', () => {
    const result = alo(['xyzzy']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /alo --help/);
    assert.doesNotMatch(result.stderr, /বোঝাতে চেয়েছিলে/);
});

test('অজানা ফ্ল্যাগে এরর আর পরামর্শ', () => {
    const result = alo(['dev', '--prot', '3000']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /অজানা ফ্ল্যাগ `--prot`/);
    assert.match(result.stderr, /`--port` বোঝাতে চেয়েছিলে/);
});

test('ভুল কমান্ডে ফ্ল্যাগ দিলে এরর', () => {
    const result = alo(['build', '--port', '3000']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`alo build`-এ `--port` চলে না/);
});

test('মান ছাড়া ফ্ল্যাগে এরর', () => {
    const result = alo(['dev', '--port']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`--port`-এর পরে একটা মান দাও/);
});

test('ভুল পোর্টে এরর', () => {
    for (const port of ['abc', '0', '70000', '30.5']) {
        const result = alo(['dev', `--port=${port}`]);
        assert.equal(result.code, 1, port);
        assert.match(result.stderr, /`--port`-এর মান/);
    }
});

test('Node-এর ভার্সন কম হলে বাংলা এরর', () => {
    const result = alo(['--version'], ['--require', FAKE_NODE_20]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Node\.js 22 বা তার নতুন ভার্সন লাগবে/);
    assert.match(result.stderr, /v20\.1\.0/);
    assert.equal(result.stdout, '');
});

test('NO_COLOR থাকলে ANSI কোড নেই', () => {
    const result = alo(['biuld']);
    assert.doesNotMatch(result.stderr, /\x1b\[/);
});
