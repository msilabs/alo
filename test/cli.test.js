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

test('--version prints the version', () => {
    const result = alo(['--version']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), version);
});

test('--help and a bare alo print the help', () => {
    for (const args of [['--help'], []]) {
        const result = alo(args);
        assert.equal(result.code, 0);
        assert.match(result.stdout, /Usage:/);
        assert.match(result.stdout, /alo build \[--base \/\]/);
    }
});

test('an unknown command suggests a close one', () => {
    const result = alo(['biuld']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error:/);
    assert.match(result.stderr, /Unknown command `biuld`/);
    assert.match(result.stderr, /Did you mean `alo build`/);
});

test('a distant unknown command only points to help', () => {
    const result = alo(['xyzzy']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /alo --help/);
    assert.doesNotMatch(result.stderr, /Did you mean/);
});

test('an unknown flag fails with a suggestion', () => {
    const result = alo(['dev', '--prot', '3000']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown flag `--prot`/);
    assert.match(result.stderr, /Did you mean `--port`/);
});

test('a flag on the wrong command fails', () => {
    const result = alo(['build', '--port', '3000']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`--port` does not work with `alo build`/);
});

test('a flag without a value fails', () => {
    const result = alo(['dev', '--port']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`--port` needs a value/);
});

test('an invalid port fails', () => {
    for (const port of ['abc', '0', '70000', '30.5']) {
        const result = alo(['dev', `--port=${port}`]);
        assert.equal(result.code, 1, port);
        assert.match(result.stderr, /Invalid `--port` value/);
    }
});

test('an old Node version gets a clear error', () => {
    const result = alo(['--version'], ['--require', FAKE_NODE_20]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Alo needs Node\.js 22 or newer/);
    assert.match(result.stderr, /v20\.1\.0/);
    assert.equal(result.stdout, '');
});

test('NO_COLOR turns off ANSI codes', () => {
    const result = alo(['biuld']);
    assert.doesNotMatch(result.stderr, /\x1b\[/);
});
