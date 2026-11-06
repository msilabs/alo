'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

const BIN = path.join(__dirname, '..', 'bin', 'alo.js');

function tempProject(t, files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alo-public-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const [file, contents] of Object.entries(files)) {
        const target = path.join(dir, ...file.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
    }
    return dir;
}

function alo(cwd, args) {
    const result = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('public/ copy list skips OS clutter and keeps .well-known', () => {
    const { copies } = compile({
        reader: createMemoryReader({
            'pages/page.alo': '',
            'public/favicon.ico': 'x',
            'public/images/logo.svg': '<svg/>',
            'public/.well-known/security.txt': 'x',
            'public/.DS_Store': 'x',
            'public/images/Thumbs.db': 'x',
        }),
        mode: 'dev',
    });
    assert.deepEqual(copies, [
        { from: 'public/.well-known/security.txt', to: '.well-known/security.txt' },
        { from: 'public/favicon.ico', to: 'favicon.ico' },
        { from: 'public/images/logo.svg', to: 'images/logo.svg' },
    ]);
});

test('a public/ file with the name of a generated file fails', () => {
    for (const clash of ['public/index.html', 'public/about/index.html', 'public/404.html']) {
        assert.throws(
            () => compile({ reader: createMemoryReader({ 'pages/page.alo': '', 'pages/about/page.alo': '', 'pages/not-found.alo': '', [clash]: 'x' }) }),
            (err) => err instanceof AloError && err.file === clash && /would be the same file/.test(err.message),
            clash,
        );
    }
});

test('build: public/ is copied byte for byte, binary files too', (t) => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x0a, 0x0d]);
    const dir = tempProject(t, { 'pages/page.alo': '<template>হোম</template>', 'public/images/pixel.png': bytes, 'public/CNAME': 'example.com\n' });
    const result = alo(dir, ['build']);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(fs.readFileSync(path.join(dir, 'dist', 'images', 'pixel.png')), bytes);
    assert.equal(fs.readFileSync(path.join(dir, 'dist', 'CNAME'), 'utf8'), 'example.com\n');
    assert.match(result.stdout, /Built 1 page, 0 assets, 2 files from public\/ in \d+ms → dist\//);
});

test('build: old files from the previous dist/ do not remain', (t) => {
    const dir = tempProject(t, { 'pages/page.alo': '', 'pages/old/page.alo': '' });
    assert.equal(alo(dir, ['build']).code, 0);
    fs.rmSync(path.join(dir, 'pages', 'old'), { recursive: true });
    assert.equal(alo(dir, ['build']).code, 0);
    assert.ok(!fs.existsSync(path.join(dir, 'dist', 'old')));
});

test('build: an error exits with 1, keeps the old dist/ and removes the temp folder', (t) => {
    const dir = tempProject(t, { 'pages/page.alo': '<template>ঠিক</template>' });
    assert.equal(alo(dir, ['build']).code, 0);
    fs.writeFileSync(path.join(dir, 'pages', 'page.alo'), '<template>{{ </template>');
    const result = alo(dir, ['build']);
    assert.equal(result.code, 1);
    assert.match(fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8'), /ঠিক/);
    assert.ok(!fs.existsSync(path.join(dir, '.alo', 'build')));
});

test('build: the summary lists the warning count and unused components', (t) => {
    const dir = tempProject(t, {
        'pages/page.alo': '<template><li if="x">a</li></template>',
        'components/Lonely.alo': '<template><div></div></template>',
    });
    const result = alo(dir, ['build']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Unused components: <Lonely>/);
    assert.match(result.stdout, /3 warnings, see above\./);
    assert.match(result.stderr, /⚠ Warning: pages\/page\.alo:1:15/);
});
