'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { plan, packageName } = require('../cli/scaffold.js');
const { version } = require('../package.json');

const REPO = path.join(__dirname, '..');
const BIN = path.join(REPO, 'bin', 'alo.js');

function tempDir(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alo-scaffold-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

function run(cwd, args, script = BIN) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function read(dir, file) {
    return fs.readFileSync(path.join(dir, ...file.split('/')), 'utf8');
}

test('init: প্রজেক্টের সব ফাইল আর পরের ধাপ', (t) => {
    const cwd = tempDir(t);
    const result = run(cwd, ['init', 'My Site']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /নতুন Alo প্রজেক্ট তৈরি হলো: My Site/);
    assert.match(result.stdout, /cd "My Site"\n {2}npm install\n {2}node alo dev/);

    const dir = path.join(cwd, 'My Site');
    for (const file of ['alo', 'package.json', '.gitignore', '.gitattributes', '.vscode/settings.json', 'pages/page.alo', 'pages/layout.alo', 'pages/blog/[slug]/page.alo', 'components/Header.alo', 'components/Footer.alo', 'components/Card.alo', 'data/site.json', 'data/blog/2026-01-10-hello-world.md', 'public/favicon.svg']) {
        assert.ok(fs.existsSync(path.join(dir, ...file.split('/'))), file);
    }

    assert.deepEqual(JSON.parse(read(dir, 'package.json')), {
        name: 'my-site',
        private: true,
        engines: { node: '>=22' },
        scripts: { dev: 'alo dev', build: 'alo build' },
        devDependencies: { '@msilabs/alo': `^${version}` },
    });
    assert.match(read(dir, 'alo'), /^#!\/usr\/bin\/env node\ntry \{\n {4}require\('@msilabs\/alo\/cli'\);/);
    assert.equal(read(dir, '.gitignore'), 'node_modules/\ndist/\n.alo/\n');
    assert.equal(read(dir, '.gitattributes'), '*.alo linguist-language=HTML\n');
    assert.deepEqual(JSON.parse(read(dir, '.vscode/settings.json'))['files.associations'], { '*.alo': 'html' });
    if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(dir, 'alo')).mode & 0o100, 'alo ফাইল চালানো যায়');
});

test('init: ফোল্ডারের নাম থেকে প্যাকেজের নাম', () => {
    assert.equal(packageName('/x/My Site'), 'my-site');
    assert.equal(packageName('/x/আলো'), 'my-site');
    assert.equal(packageName('/x/blog_2026'), 'blog-2026');
});

test('init: খালি নয় এমন ফোল্ডারে চলে না; শুধু .git থাকলে চলে', (t) => {
    const cwd = tempDir(t);
    fs.mkdirSync(path.join(cwd, 'full'));
    fs.writeFileSync(path.join(cwd, 'full', 'notes.txt'), 'x');
    const full = run(cwd, ['init', 'full']);
    assert.equal(full.code, 1);
    assert.match(full.stderr, /ফোল্ডারটা খালি নয়/);
    assert.deepEqual(fs.readdirSync(path.join(cwd, 'full')), ['notes.txt']);

    fs.mkdirSync(path.join(cwd, 'repo', '.git'), { recursive: true });
    assert.equal(run(cwd, ['init', 'repo']).code, 0);
    assert.ok(fs.existsSync(path.join(cwd, 'repo', 'pages', 'page.alo')));
});

test('init: নাম ছাড়া চালালে বর্তমান খালি ফোল্ডারেই', (t) => {
    const cwd = tempDir(t);
    const result = run(cwd, ['init']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /\n {2}npm install\n/);
    assert.doesNotMatch(result.stdout, /cd /);
    assert.ok(fs.existsSync(path.join(cwd, 'pages', 'page.alo')));
});

test('init করা প্রজেক্ট এরর আর সতর্কবার্তা ছাড়া বিল্ড হয়', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const result = run(path.join(cwd, 'site'), ['build']);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /বিল্ড শেষ: 5টা পেইজ/);
});

test('রুটের alo ফাইল: npm install ছাড়া সঠিক মেসেজ, ইনস্টলের পরে কাজ করে', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');

    const missing = run(dir, ['build'], path.join(dir, 'alo'));
    assert.equal(missing.code, 1);
    assert.equal(missing.stderr.trim(), 'Alo ইনস্টল করা নেই। আগে `npm install` চালাও।');

    // Stands in for `npm install`: node_modules/@msilabs/alo points at this repository.
    fs.mkdirSync(path.join(dir, 'node_modules', '@msilabs'), { recursive: true });
    fs.symlinkSync(REPO, path.join(dir, 'node_modules', '@msilabs', 'alo'), 'junction');
    const built = run(dir, ['build'], path.join(dir, 'alo'));
    assert.equal(built.code, 0, built.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'index.html')));
});

test('plan: প্রতিটা ধরনের ফাইলের পাথ', () => {
    assert.equal(plan('page', 'blog/first-post').file, 'pages/blog/first-post/page.alo');
    assert.equal(plan('page', '(bare)/launch').note, 'URL: /launch/');
    assert.equal(plan('page', '.').file, 'pages/page.alo');
    assert.match(plan('page', 'blog/[slug]').contents, /\{\{\{ item\.body \}\}\}/);
    assert.equal(plan('layout', 'blog').file, 'pages/blog/layout.alo');
    assert.match(plan('layout', 'blog').contents, /<slot \/>/);
    assert.equal(plan('component', 'Card').file, 'components/Card.alo');
    assert.equal(plan('component', 'post-list/Item').note, 'ব্যবহার: <PostList.Item />');
    assert.match(plan('component', 'blog/PostCard').contents, /class="post-card"/);
    assert.match(plan('post', 'blog/hello-world').file, /^data\/blog\/\d{4}-\d{2}-\d{2}-hello-world\.md$/);
    assert.match(plan('post', 'blog/hello-world').contents, /^---\ntitle: hello world\ndraft: true\n---\n/);
});

test('new: ফাইল বানায়, আর বানানো পেইজ বিল্ড হয়', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');

    for (const args of [['page', 'contact'], ['layout', 'blog'], ['component', 'Button'], ['post', 'blog/second'], ['page', '(bare)/launch']]) {
        const result = run(dir, ['new', ...args]);
        assert.equal(result.code, 0, `${args.join(' ')}: ${result.stderr}`);
        assert.match(result.stdout, /✔ তৈরি হলো: /);
    }
    assert.match(read(dir, 'pages/contact/page.alo'), /<h1>contact<\/h1>/);
    const build = run(dir, ['build']);
    assert.equal(build.code, 0, build.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'contact', 'index.html')));
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'launch', 'index.html')));
});

test('new: আগের ফাইল ওভাররাইট করে না', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');
    const before = read(dir, 'components/Card.alo');
    const result = run(dir, ['new', 'component', 'Card']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`components\/Card\.alo` আগে থেকেই আছে/);
    assert.equal(read(dir, 'components/Card.alo'), before);
});

test('new: ভুল নাম, একই slug, অজানা ধরন আর প্রজেক্টের বাইরে চালানোয় এরর', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');

    const cases = [
        [['component', 'card'], /PascalCase নয়/, /`Card`/],
        [['component', 'Blog/Card'], /ফোল্ডারের নাম `Blog` চলবে না/, /kebab-case/],
        [['page', 'About'], /ফোল্ডারের নাম `About` চলবে না/, /ছোট হাতের/],
        [['page', 'blog/[slug]/x'], /`\[slug\]` চলবে না/, /শেষে/],
        [['post', 'blog/hello-world'], /`hello-world` নামে লেখা আগে থেকেই আছে/, /slug/],
        [['post', 'hello'], /ফোল্ডার আর নাম দুটোই দাও/, /blog\/hello-world/],
        [['pag', 'x'], /`alo new pag` বলে কিছু নেই/, /`alo new page`/],
        [['component'], /`alo new component`-এর পরে একটা নাম দাও/, /Card/],
        [[], /কী বানাতে হবে বলো/, /alo new post/],
    ];
    for (const [args, message, hint] of cases) {
        const result = run(dir, ['new', ...args]);
        assert.equal(result.code, 1, args.join(' '));
        assert.match(result.stderr, message, args.join(' '));
        assert.match(result.stderr, hint, args.join(' '));
    }

    const outside = run(cwd, ['new', 'page', 'x']);
    assert.equal(outside.code, 1);
    assert.match(outside.stderr, /`pages\/` ফোল্ডার নেই/);
});
