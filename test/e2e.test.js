'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'alo.js');
const EXAMPLE = path.join(__dirname, '..', 'site');

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

test('site/ builds its home page', (t) => {
    const dir = tempProject(t, EXAMPLE);
    const result = alo(dir, ['build']);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Built \d+ pages/);
    assert.doesNotMatch(result.stderr, /⚠/);
    assert.ok(!fs.existsSync(path.join(dir, '.alo', 'build')), 'the temp folder should not remain');

    const html = withoutScope(fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8'));
    assert.match(html, /^<!DOCTYPE html>\n<html lang="bn">/);
    assert.match(html, /<title>আলো: HTML জানলেই পুরো ওয়েবসাইট<\/title>/);
    assert.match(html, /<h1>HTML জানলেই<br>পুরো ওয়েবসাইট<\/h1>/);
    assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/);

    // Eight stable features on the home page, each with its status badge from the if/else-if chain.
    assert.equal((html.match(/<span class="badge badge-stable">চালু<\/span>/g) ?? []).length, 8);
    assert.match(html, /<div class="grid features-grid"/);
    // Only the templates card is marked new; the VS Code card keeps its list of points and link to its post.
    assert.equal((html.match(/<span class="badge badge-new">নতুন<\/span>/g) ?? []).length, 1);
    assert.equal((html.match(/<article class="feature" data-new="true" data-highlight="true">/g) ?? []).length, 1);
    assert.equal((html.match(/<article class="feature" data-highlight="true">/g) ?? []).length, 1, 'the VS Code card is a highlight but not new');
    assert.equal((html.match(/<article class="feature">/g) ?? []).length, 6, 'no data attributes on the six core cards');
    assert.equal((html.match(/<div class="highlights">/g) ?? []).length, 1);
    assert.match(html, /<ul class="points">\s*<li>&lt; লিখলেই সব কম্পোনেন্টের তালিকা/);
    assert.match(html, /<a class="more" href="\/blog\/vscode-extension\/">কীভাবে ইনস্টল আর ব্যবহার করবেন →<\/a>/);
    assert.doesNotMatch(html, /badge-planned|badge-beta/);

    // \{{ in a code sample stays a literal {{ in the page.
    assert.match(html, /&lt;h3&gt;\{\{ props\.title \}\}&lt;\/h3&gt;/);

    // The newest three posts, with Bengali dates, newest first.
    assert.match(html, /১৫ নভেম্বর, ২০২৬[\s\S]*আলো ১.২: init-এ চারটি টেমপ্লেট[\s\S]*১১ নভেম্বর, ২০২৬[\s\S]*আলোর VS Code এক্সটেনশন এসেছে[\s\S]*সামনে যা আসছে/);
    assert.doesNotMatch(html, /<a href="\/blog\/data-and-markdown\/">/);

    assert.match(html, /<div class="counter" data-start="10"/);
    assert.equal((html.match(/<div class="faq"/g) ?? []).length, 4);
    assert.match(html, /<radialGradient id="logo-glow-header"[\s\S]*<radialGradient id="logo-glow-footer"/);
    assert.doesNotMatch(html, /<Card|<Blog\.PostCard|<Feature|<slot|<template (for|if|else)/);
});

test('site/ routes, route groups, layouts and 404', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const read = (file) => withoutScope(fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8'));

    const home = read('index.html');
    assert.match(home, /<header class="site-header"[ >]/);
    assert.match(home, /<a href="\/" aria-current="page">হোম<\/a>/);
    assert.match(home, /<a href="\/docs\/">ডকস<\/a>/);
    assert.match(home, /<footer class="site-footer">/);
    assert.match(home, /<meta name="description" content="HTML, CSS আর JS লিখেই কম্পোনেন্ট/);

    const docs = read('docs/index.html');
    assert.match(docs, /<title>শুরু করুন \| আলো<\/title>/);
    assert.match(docs, /<a href="\/docs\/" aria-current="page">ডকস<\/a>/);
    assert.match(docs, /<a href="\/docs\/" aria-current="page">দ্রুত শুরু<\/a>/, 'the docs sidebar marks the current page');
    assert.match(docs, /<meta name="description" content="পাঁচ মিনিটে আলো দিয়ে প্রথম সাইট বানানোর গাইড।">/);
    assert.doesNotMatch(docs, /<meta name="description" content="HTML, CSS আর JS লিখেই/, 'the page description replaces the layout one');
    assert.match(docs, /<h2 id="কম্পোনেন্ট-বানান">কম্পোনেন্ট বানান<\/h2>[\s\S]*components\/blog\/PostCard\.alo   → &lt;Blog\.PostCard \/&gt;/);
    assert.match(docs, /&lt;span class="badge"&gt;\{\{ props\.label \}\}&lt;\/span&gt;/, '\\{{ in the component sample stays literal');

    const doc = read('docs/components/index.html');
    assert.match(doc, /<title>কম্পোনেন্ট আর প্রপস \| ডকস \| আলো<\/title>/);
    assert.match(doc, /<a href="\/docs\/" aria-current="page">ডকস<\/a>/, 'the menu link stays active on pages below it');
    assert.match(doc, /<a class="level-2" href="#প্রপস">প্রপস<\/a>\s*<a class="level-3" href="#ভুল-নামের-প্রপ">ভুল নামের প্রপ<\/a>/, 'the "on this page" list comes from the headings of the body');
    assert.match(doc, /<a class="previous" href="\/docs\/layouts\/">[\s\S]*<a class="next" href="\/docs\/templates\/">/, 'previous and next follow the order of data/docs-nav.json');
    assert.match(doc, /<span class="crumb">মূল ধারণা<\/span>/);
    assert.match(docs, /<a class="level-2" href="#কম্পোনেন্ট-বানান">কম্পোনেন্ট বানান<\/a>/, 'a hand-written page passes its headings to <Docs.Toc>');

    const about = read('about/index.html');
    assert.equal((about.match(/badge-stable/g) ?? []).length, 0);
    assert.doesNotMatch(about, /badge-beta/);
    assert.equal((about.match(/<span class="badge badge-planned">আসছে<\/span>/g) ?? []).length, 2);

    const blog = read('blog/index.html');
    assert.match(blog, /<main>\s*<div class="blog reading">\s*<p class="eyebrow">ব্লগ<\/p>/);
    assert.match(blog, /মোট ৭টি লেখা/);

    const post = read('blog/introducing-alo/index.html');
    assert.match(post, /<title>আলো: HTML জানলেই বানান নিজের ওয়েবসাইট \| আলো<\/title>/);
    assert.match(post, /<meta name="description" content="কেন আরেকটি ফ্রেমওয়ার্ক, আর কাদের জন্য আলো বানানো হলো।">/);
    assert.match(post, /<time datetime="2026-11-05">৫ নভেম্বর, ২০২৬<\/time>/);
    assert.match(post, /<h2 id="যা-আলাদা">যা আলাদা<\/h2>/);
    assert.match(post, /<pre><code class="language-bash">npx @msilabs\/alo init my-site/);
    assert.match(read('blog/components-and-layouts/index.html'), /<th>কোথায় রাখবেন<\/th>/);
    const deploy = read('blog/deploy-to-github-pages/index.html');
    assert.match(deploy, /<pre><code class="language-yaml">name: Pages/);
    assert.match(deploy, /url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/, 'post bodies are not templates');
    assert.match(read('blog/data-and-markdown/index.html'), /<time datetime="2026-11-06">৬ নভেম্বর, ২০২৬<\/time>/);
    assert.match(read('blog/whats-next/index.html'), /<time datetime="2026-11-07">৭ নভেম্বর, ২০২৬<\/time>/);
    const extension = read('blog/vscode-extension/index.html');
    assert.match(extension, /<time datetime="2026-11-11">১১ নভেম্বর, ২০২৬<\/time>/);
    assert.match(extension, /<a href="https:\/\/marketplace\.visualstudio\.com\/items\?itemName=msilabs\.alo-vscode">/);

    const launch = read('launch/index.html');
    assert.doesNotMatch(launch, /site-header|site-footer/);
    assert.match(launch, /<meta name="robots" content="noindex">/);
    assert.match(launch, /<h1>আলো ১\.০ এসেছে<\/h1>/);
    assert.match(launch, /fonts\.googleapis\.com/, 'the root layout wraps route groups too');

    const notFound = read('404.html');
    assert.match(notFound, /<h1>এই পেইজটি পাওয়া যায়নি<\/h1>/);
    assert.doesNotMatch(notFound, /site-header/);
    assert.match(notFound, /fonts\.googleapis\.com/, 'not-found gets pages/layout.alo');
});

// Asset names carry a content hash in build mode: style.3f9a1c2e.css → style.css
function unhash(url) {
    return url.replace(/\.[0-9a-f]{8}(\.[a-z]+)$/, '$1');
}

// Local CSS and JS only; the Google Fonts stylesheet is external.
function linkedAssets(html) {
    return [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="(\/[^"]*)"/g)].map((m) => m[1]);
}

test('site/ CSS: global/ first, scoped styles, minified, linked on every page', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const read = (file) => fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8');
    const home = read('index.html');
    const href = /<link rel="stylesheet" href="(\/assets\/style\.[0-9a-f]{8}\.css)">\n<\/head>/.exec(home);
    assert.ok(href, 'a hashed stylesheet link is expected');
    const css = read(href[1].slice(1));

    assert.ok(css.indexOf('box-sizing') < css.indexOf('--accent:'), 'reset before theme');
    assert.ok(css.indexOf('--accent:') < css.indexOf('.site-header['), 'global/ before components');
    assert.doesNotMatch(css, /\/\* global/, 'no comments in build');
    assert.doesNotMatch(css.trimEnd(), /\n/, 'CSS is one line in build');
    const header = /<header class="site-header" (data-a-[0-9a-f]{6})[ >]/.exec(home);
    assert.ok(header, 'the header should carry a scope attribute');
    assert.ok(css.includes(`.site-header[${header[1]}]{`));
    assert.ok(css.includes(`nav a[aria-current='page'][${header[1]}]{`));
    assert.match(read('launch/index.html'), /stylesheet/);
});

test('site/ JS: only the scripts a page needs, data-a-c on component roots', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const read = (file) => fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8');
    const scripts = (html) => [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

    const home = read('index.html');
    assert.deepEqual(scripts(home).map(unhash), ['/assets/global.js', '/assets/components.js']);
    assert.match(home, /<div class="faq"[^>]* data-a-c="Faq">/);
    assert.match(home, /<div class="counter" data-start="10"[^>]* data-a-c="Counter">/);
    assert.match(home, /<header class="site-header"[^>]* data-a-c="Header">/);

    assert.deepEqual(scripts(read('about/index.html')).map(unhash), ['/assets/global.js', '/assets/components.js']);
    assert.deepEqual(scripts(read('launch/index.html')).map(unhash), ['/assets/global.js']);
    assert.deepEqual(scripts(read('404.html')).map(unhash), ['/assets/global.js']);

    const [globalJs, componentsJs] = scripts(home).map((src) => read(src.slice(1)));
    for (const name of ['Counter', 'Faq', 'Header']) assert.match(componentsJs, new RegExp(`"${name}": function \\(\\$el\\)`));
    assert.doesNotMatch(componentsJs, /"Card"/);
    assert.match(globalJs, /^\/\* global\/main\.js \*\//);
});

test('site/ production output: hashes, sitemap, robots', (t) => {
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
    const docsNav = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'docs-nav.json'), 'utf8'));
    const docsLocs = docsNav.flatMap((group) => group.items.map((link) => 'https://msilabs.github.io' + link.href));
    assert.deepEqual(locs.filter((loc) => loc.includes('/docs/')), docsLocs.toSorted(), 'every docs page is listed in data/docs-nav.json, and nothing else');
    assert.deepEqual(locs.filter((loc) => !loc.includes('/docs/')), [
        'https://msilabs.github.io/',
        'https://msilabs.github.io/about/',
        'https://msilabs.github.io/blog/',
        'https://msilabs.github.io/blog/components-and-layouts/',
        'https://msilabs.github.io/blog/data-and-markdown/',
        'https://msilabs.github.io/blog/deploy-to-github-pages/',
        'https://msilabs.github.io/blog/init-templates/',
        'https://msilabs.github.io/blog/introducing-alo/',
        'https://msilabs.github.io/blog/vscode-extension/',
        'https://msilabs.github.io/blog/whats-next/',
    ]);
    assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://msilabs.github.io/sitemap.xml\n');
});

test('site/ with --base /repo/: every link, image, CSS and JS has the base', (t) => {
    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build', '--base', 'repo']).code, 0);
    const read = (file) => fs.readFileSync(path.join(dir, 'dist', ...file.split('/')), 'utf8');

    const pages = ['index.html', 'docs/index.html', 'about/index.html', 'blog/index.html', 'blog/introducing-alo/index.html', 'launch/index.html', '404.html'];
    for (const page of pages) {
        const html = read(page);
        assert.match(html, /<html lang="bn" data-base="\/repo\/">/, page);
        // Real attributes only; code samples in the docs show escaped HTML as text.
        const rootLinks = [...html.matchAll(/<[a-z][^<>]*?\s(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
        assert.ok(rootLinks.length > 0, page);
        for (const link of rootLinks) assert.ok(link.startsWith('/repo/'), `${page}: ${link}`);
        for (const url of linkedAssets(html)) assert.ok(fs.existsSync(path.join(dir, 'dist', ...url.slice('/repo/'.length).split('/'))), url);
    }

    const home = read('index.html');
    assert.match(home, /<a href="\/repo\/about\/"[^>]*>কেন আলো<\/a>/);
    assert.match(read('blog/introducing-alo/index.html'), /<a href="\/repo\/docs\/">শুরু করার গাইড<\/a>/);
    assert.match(home, /aria-current="page"/, 'route.path has no base, so the active link still matches');
    assert.match(read('sitemap.xml'), /<loc>https:\/\/msilabs\.github\.io\/repo\/about\/<\/loc>/);
    assert.match(read('about/index.html'), /<link rel="icon" href="\/repo\/favicon\.svg"/);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'images', 'logo.svg')));
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'favicon.svg')));
    assert.match(read('robots.txt'), /Sitemap: https:\/\/msilabs\.github\.io\/repo\/sitemap\.xml/);
});

test('site/ .alo files have no import, local stylesheet link or local script src; logic only on <template>', () => {
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
    assert.ok(files.length >= 15, 'the site should have enough .alo files');

    const logic = ['for', 'if', 'else-if', 'else'];
    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        const relative = path.relative(EXAMPLE, file);
        assert.doesNotMatch(source, /^\s*import\s/m, relative);
        for (const link of source.match(/<link[^>]*rel=["']?stylesheet[^>]*>/gi) ?? []) {
            assert.match(link, /href=["']?https?:/, `${relative}: only external stylesheets may be linked by hand`);
        }
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

test('Alpine.js attributes pass through unchanged, and site/ has no reactive runtime', (t) => {
    const project = tempProject(t);
    fs.mkdirSync(path.join(project, 'pages'));
    fs.writeFileSync(path.join(project, 'pages', 'page.alo'), '<template><div x-data="{ open: false }"><button @click="open = !open" :aria-expanded="open" x-on:keyup.enter="go()">মেনু</button></div></template>');
    assert.equal(alo(project, ['build']).code, 0);
    assert.match(fs.readFileSync(path.join(project, 'dist', 'index.html'), 'utf8'), /<div x-data="\{ open: false \}"><button @click="open = !open" :aria-expanded="open" x-on:keyup\.enter="go\(\)">মেনু<\/button><\/div>/);

    const dir = tempProject(t, EXAMPLE);
    assert.equal(alo(dir, ['build']).code, 0);
    const assets = path.join(dir, 'dist', 'assets');
    const scripts = fs.readdirSync(assets, { recursive: true }).filter((file) => String(file).endsWith('.js'));
    assert.ok(scripts.length > 0);
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
