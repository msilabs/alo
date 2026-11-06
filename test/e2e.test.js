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

// Scope attributes (data-a-xxxxxx) are checked in their own test; the rest compares content only.
function withoutScope(html) {
    return html.replace(/ data-a-[0-9a-f]{6}/g, '');
}

function alo(cwd, args) {
    const result = spawnSync(process.execPath, [BIN, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('example/ builds its home page', (t) => {
    const dir = tempProject(t, EXAMPLE);
    const result = alo(dir, ['build']);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Built 8 pages/);

    const html = withoutScope(fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8'));
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
    assert.match(html, /<article class="card post-card">\s*<h3><a href="\/blog\/hello-world\/">হ্যালো ওয়ার্ল্ড<\/a><\/h3>\s*<time>2026-01-10<\/time>/);
    assert.match(html, /<ul class="tags">\s*<li>intro<\/li><li>news<\/li>\s*<\/ul>/);
    assert.match(html, /তৃতীয় লেখা[\s\S]*দ্বিতীয় লেখা[\s\S]*হ্যালো ওয়ার্ল্ড/);
    assert.doesNotMatch(html, /শীঘ্রই আসছে/);
    assert.match(html, /<article class="card ">\s*<h3>ফলব্যাক কনটেন্ট<\/h3>\s*<p>এখানে এখনো কিছু লেখা হয়নি।<\/p>/);
    assert.doesNotMatch(html, /<Card|<Blog\.PostCard|<slot/);
    assert.doesNotMatch(result.stderr, /⚠/);
    assert.ok(!fs.existsSync(path.join(dir, '.alo', 'build')), 'the temp folder should not remain');
});

test('example/ routes, route groups, layouts and 404', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const read = (file) => withoutScope(fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8'));

    const home = read('index.html');
    assert.match(home, /<header class="site-header"[ >]/);
    assert.match(home, /<a href="\/" aria-current="page">হোম<\/a>/);
    assert.match(home, /<a href="\/about\/">আমাদের কথা<\/a>/);
    assert.match(home, /<main>\s*<!-- এই কমেন্ট/);
    assert.match(home, /<footer class="site-footer">/);
    assert.match(home, /<meta name="description" content="Alo দিয়ে বানানো উদাহরণ সাইট">/);

    const about = read('about/index.html');
    assert.match(about, /<title>আমাদের কথা \| আলো<\/title>/);
    assert.match(about, /<a href="\/about\/" aria-current="page">আমাদের কথা<\/a>/);
    assert.match(about, /<meta name="description" content="Alo কেন বানানো হলো">/);
    assert.doesNotMatch(about, /উদাহরণ সাইট"/);

    const blog = read('blog/index.html');
    assert.match(blog, /<main>\s*<section class="blog">\s*<p class="blog-label">ব্লগ<\/p>\s*<h1>সব লেখা<\/h1>/);

    const launch = read('launch/index.html');
    assert.doesNotMatch(launch, /site-header|site-footer/);
    assert.match(launch, /<meta name="robots" content="noindex">/);

    const post = read('blog/hello-world/index.html');
    assert.match(post, /<title>হ্যালো ওয়ার্ল্ড \| আলো<\/title>/);
    assert.match(post, /<h1>হ্যালো ওয়ার্ল্ড<\/h1>\s*<time>2026-01-10<\/time>\s*<p>Alo দিয়ে লেখা <strong>প্রথম পোস্ট<\/strong>/);
    assert.match(post, /<h2 id="যা-যা-লাগে">যা যা লাগে<\/h2>/);
    assert.match(post, /<pre><code class="language-html">&lt;Card title=&quot;হ্যালো&quot;&gt;/);
    assert.match(post, /<th style="text-align: left">ফোল্ডার<\/th>/);
    assert.match(read('blog/second-post/index.html'), /<blockquote>\n<p>Markdown-এর ভেতরে <code>\{\{ \}\}<\/code> প্রসেস হয় না/);
    assert.match(read('blog/third-post/index.html'), /<p>প্রতিটা ফাইল থেকে নিজে থেকেই একটা পেইজ তৈরি হয়।<\/p>/);
    assert.match(post, /<section class="blog">/);
    assert.ok(!fs.existsSync(path.join(dir, 'dist', 'blog', 'coming-soon')), 'draft posts should not be in dist/');

    assert.match(about, /রাহিম\s*<span class="badge">প্রধান<\/span>/);
    assert.match(about, /সুমি\s*<span class="badge">ডেভেলপার<\/span>/);
    assert.match(about, /করিম\s*<span class="badge">অতিথি<\/span>/);

    const notFound = read('404.html');
    assert.match(notFound, /<h1>পেইজটা পাওয়া যায়নি<\/h1>/);
    assert.doesNotMatch(notFound, /site-header/);
});

// Asset names carry a content hash in build mode: style.3f9a1c2e.css → style.css
function unhash(url) {
    return url.replace(/\.[0-9a-f]{8}(\.[a-z]+)$/, '$1');
}

function linkedAssets(html) {
    return [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map((m) => m[1]);
}

test('example/ CSS: global/ first, scoped styles, minified, linked on every page', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const read = (file) => fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8');
    const home = read('index.html');
    const href = /<link rel="stylesheet" href="(\/assets\/style\.[0-9a-f]{8}\.css)">\n<\/head>/.exec(home);
    assert.ok(href, 'a hashed stylesheet link is expected');
    const css = read(href[1].slice(1));

    assert.ok(css.indexOf('box-sizing') < css.indexOf('--color-text'), 'reset before theme');
    assert.ok(css.indexOf('--color-text') < css.indexOf('.site-header['), 'global/ before components');
    assert.doesNotMatch(css, /\/\* global/, 'no comments in build');
    assert.doesNotMatch(css.trimEnd(), /\n/, 'CSS is one line in build');
    const header = /<header class="site-header" (data-a-[0-9a-f]{6})[ >]/.exec(home);
    assert.ok(header, 'the header should carry a scope attribute');
    assert.ok(css.includes(`.site-header[${header[1]}]{`));
    assert.ok(css.includes(`nav a[aria-current='page'][${header[1]}]{`));
    assert.match(read('launch/index.html'), /stylesheet/);
});

test('example/ JS: only the scripts a page needs, data-a-c on component roots', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const read = (file) => fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8');
    const scripts = (html) => [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

    const home = read('index.html');
    assert.deepEqual(scripts(home).map(unhash), ['/assets/global.js', '/assets/components.js', '/assets/pages/index.js']);
    assert.match(home, /<div class="faq"[^>]* data-a-c="Faq">/);
    assert.match(home, /<div class="counter" data-start="5"[^>]* data-a-c="Counter">/);
    assert.match(home, /<header class="site-header"[^>]* data-a-c="Header">/);

    assert.deepEqual(scripts(read('about/index.html')).map(unhash), ['/assets/global.js', '/assets/components.js']);
    assert.deepEqual(scripts(read('launch/index.html')).map(unhash), ['/assets/global.js']);
    assert.deepEqual(scripts(read('404.html')).map(unhash), ['/assets/global.js']);

    const [globalJs, componentsJs, pageJs] = scripts(home).map((src) => read(src.slice(1)));
    for (const name of ['Counter', 'Faq', 'Header']) assert.match(componentsJs, new RegExp(`"${name}": function \\(\\$el\\)`));
    assert.doesNotMatch(componentsJs, /"Card"/);
    assert.match(globalJs, /^\/\* global\/main\.js \*\//);
    assert.match(pageJs, /getElementById\('today'\)/);
});

test('example/ production output: hashes, sitemap, robots', (t) => {
    const dir = tempProject(t, EXAMPLE);
    const result = alo(dir, ['build']);
    assert.equal(result.code, 0);
    assert.doesNotMatch(result.stderr, /⚠/);
    const read = (file) => fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8');

    for (const url of linkedAssets(read('index.html'))) {
        assert.match(url, /\.[0-9a-f]{8}\.(css|js)$/, url);
        assert.ok(fs.existsSync(path.join(dir, 'dist', ...url.slice(1).split('/'))), url);
    }

    const sitemap = read('sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(locs, [
        'https://example.com/',
        'https://example.com/about/',
        'https://example.com/blog/',
        'https://example.com/blog/hello-world/',
        'https://example.com/blog/second-post/',
        'https://example.com/blog/third-post/',
    ]);
    assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n');
});

test('example/ with --base /repo/: every link, image, CSS and JS has the base', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build', '--base', 'repo']).code, 0);
    const read = (file) => fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8');

    const pages = ['index.html', 'about/index.html', 'blog/index.html', 'blog/hello-world/index.html', 'launch/index.html', '404.html'];
    for (const page of pages) {
        const html = read(page);
        assert.match(html, /<html lang="bn" data-base="\/repo\/">/, page);
        const rootLinks = [...html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
        assert.ok(rootLinks.length > 0, page);
        for (const link of rootLinks) assert.ok(link.startsWith('/repo/'), `${page}: ${link}`);
        for (const url of linkedAssets(html)) assert.ok(fs.existsSync(path.join(dir, 'dist', ...url.slice('/repo/'.length).split('/'))), url);
    }

    const home = read('index.html');
    assert.match(home, /<a href="\/repo\/about\/">আমাদের কথা<\/a>|<a href="\/repo\/about\/"/);
    assert.match(read('blog/hello-world/index.html'), /<a href="\/repo\/about\/">আমাদের কথা<\/a>/);
    assert.match(home, /aria-current="page"/, 'route.path has no base, so the active link still matches');
    assert.match(read('sitemap.xml'), /<loc>https:\/\/example\.com\/repo\/about\/<\/loc>/);
    const about = read('about/index.html');
    assert.match(about, /<img src="\/repo\/images\/logo\.svg"/);
    assert.match(about, /<link rel="icon" href="\/repo\/favicon\.svg"/);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'images', 'logo.svg')));
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'favicon.svg')));
    assert.match(read('robots.txt'), /Sitemap: https:\/\/example\.com\/repo\/sitemap\.xml/);
});

test('example/ .alo files have no import, stylesheet link or local script src; logic only on <template>', () => {
    const { parseSfc } = require('../core/sfc.js');
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'dist' && entry.name !== '.alo') walk(full);
            } else if (entry.name.endsWith('.alo')) {
                files.push(full);
            }
        }
    };
    walk(EXAMPLE);
    assert.ok(files.length >= 15, 'the example should have enough .alo files');

    const logic = ['for', 'if', 'else-if', 'else'];
    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        const relative = path.relative(EXAMPLE, file);
        assert.doesNotMatch(source, /^\s*import\s/m, relative);
        assert.doesNotMatch(source, /<link[^>]+rel=["']?stylesheet/i, relative);
        assert.doesNotMatch(source, /<script[^>]+src=["']?\/(?!\/)/i, relative);

        const sfc = parseSfc(source, relative, relative.includes('components') ? 'component' : relative.endsWith('layout.alo') ? 'layout' : 'page');
        const visit = (nodes) => {
            for (const node of nodes) {
                if (node.type !== 'element') continue;
                if (node.name !== 'template') {
                    const misplaced = node.attrs.find((attr) => logic.includes(attr.name) && !(attr.name === 'for' && node.name === 'label'));
                    assert.ok(!misplaced, `${relative}:${node.line} <${node.name} ${misplaced?.name}>`);
                }
                visit(node.children);
            }
        };
        visit([...(sfc.head?.children ?? []), ...(sfc.template?.children ?? [])]);
    }
});

test('example/ output keeps Alpine.js attributes and has no reactive runtime', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const home = fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8');
    assert.match(home, /x-data="\{ open: false \}" @click="open = !open" :aria-expanded="open"/);

    const assets = path.join(dir, 'dist', 'assets');
    const scripts = fs.readdirSync(assets, { recursive: true }).filter((file) => String(file).endsWith('.js'));
    for (const file of scripts) {
        const code = fs.readFileSync(path.join(assets, String(file)), 'utf8');
        assert.doesNotMatch(code, /new Proxy|MutationObserver|reactive|createElement\(/, String(file));
    }
});

test('an error prints a code frame, exits with 1 and keeps the old dist/', (t) => {
    const dir = tempProject(t);
    fs.mkdirSync(path.join(dir, 'pages'));
    fs.writeFileSync(path.join(dir, 'pages', 'page.alo'), '<template>\n  <h1>ঠিক আছে</h1>\n</template>\n');
    assert.equal(alo(dir, ['build']).code, 0);

    fs.writeFileSync(path.join(dir, 'pages', 'page.alo'), '<template>\n  <h1>{{ titel }}</h1>\n</template>\n');
    const result = alo(dir, ['build']);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error: pages\/page\.alo:2:7/);
    assert.match(result.stderr, /`titel` is not defined/);
    assert.match(result.stderr, /2 \|   <h1>\{\{ titel \}\}<\/h1>/);
    assert.match(fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8'), /ঠিক আছে/);
});

test('a missing pages/ folder gives a clear build error', (t) => {
    const dir = tempProject(t);
    const result = alo(dir, ['build']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /No `pages\/` folder here/);
});
