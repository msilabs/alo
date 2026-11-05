'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findRoutes } = require('../core/routes.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function routes(paths) {
    const files = {};
    for (const p of paths) files[p] = '';
    const warnings = [];
    const result = findRoutes(createMemoryReader(files), (w) => warnings.push(w));
    return { ...result, warnings };
}

function routeError(paths) {
    try {
        routes(paths);
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

function summary(result) {
    return result.pages.map((page) => [page.file, page.path, page.output]);
}

test('স্ট্যাটিক পেইজ: ফোল্ডার মানে URL', () => {
    assert.deepEqual(summary(routes(['pages/page.alo', 'pages/about/page.alo', 'pages/docs/getting-started/page.alo'])), [
        ['pages/about/page.alo', '/about/', 'about/index.html'],
        ['pages/docs/getting-started/page.alo', '/docs/getting-started/', 'docs/getting-started/index.html'],
        ['pages/page.alo', '/', 'index.html'],
    ]);
});

test('রাউট গ্রুপ URL-এ যায় না; গ্রুপের page.alo প্যারেন্টের URL পায়', () => {
    assert.deepEqual(summary(routes(['pages/(site)/page.alo', 'pages/(site)/about/page.alo', 'pages/(bare)/(inner)/launch/page.alo'])), [
        ['pages/(bare)/(inner)/launch/page.alo', '/launch/', 'launch/index.html'],
        ['pages/(site)/about/page.alo', '/about/', 'about/index.html'],
        ['pages/(site)/page.alo', '/', 'index.html'],
    ]);
});

test('লেআউট চেইন রুট থেকে কাছের দিকে, গ্রুপসহ', () => {
    const { pages } = routes([
        'pages/layout.alo',
        'pages/(site)/layout.alo',
        'pages/(site)/blog/layout.alo',
        'pages/(site)/blog/page.alo',
        'pages/(site)/blog/[slug]/page.alo',
        'pages/(bare)/launch/page.alo',
    ]);
    const chain = Object.fromEntries(pages.map((page) => [page.file, page.layouts]));
    assert.deepEqual(chain['pages/(site)/blog/page.alo'], ['pages/layout.alo', 'pages/(site)/layout.alo', 'pages/(site)/blog/layout.alo']);
    assert.deepEqual(chain['pages/(site)/blog/[slug]/page.alo'], chain['pages/(site)/blog/page.alo']);
    assert.deepEqual(chain['pages/(bare)/launch/page.alo'], ['pages/layout.alo']);
});

test('[slug] ডায়নামিক রাউট: ডেটার ফোল্ডার গ্রুপ বাদ দিয়ে', () => {
    const [page] = routes(['pages/(site)/blog/[slug]/page.alo']).pages;
    assert.deepEqual(page.dynamic, { dataDir: 'data/blog', prefix: ['blog'] });
});

test('[slug] ছাড়া অন্য বন্ধনী-নামে এরর আর ইঙ্গিত', () => {
    const err = routeError(['pages/blog/[id]/page.alo']);
    assert.match(err.message, /`\[id\]` চলবে না/);
    assert.equal(err.hint, 'ডায়নামিক ফোল্ডারের নাম সবসময় `[slug]`।');
});

test('[slug] মাঝখানে বা দুবার থাকলে এরর', () => {
    assert.match(routeError(['pages/blog/[slug]/comments/page.alo']).message, /`\[slug\]` পাথের শেষ ফোল্ডার হতে হবে/);
    assert.match(routeError(['pages/[slug]/[slug]/page.alo']).message, /একবারই থাকতে পারে/);
    assert.ok(routes(['pages/blog/[slug]/(x)/page.alo']).pages[0].dynamic);
});

test('অবৈধ ফোল্ডারের নামে এরর', () => {
    for (const name of ['About', 'my_page', 'হোম', '(Site)']) {
        const err = routeError([`pages/${name}/page.alo`]);
        assert.match(err.message, /চলবে না/, name);
        assert.equal(err.file, `pages/${name}`);
    }
});

test('একই আউটপুট দুই জায়গা থেকে এলে দুটো ফাইলসহ এরর', () => {
    const err = routeError(['pages/(a)/about/page.alo', 'pages/(b)/about/page.alo']);
    assert.match(err.message, /`dist\/about\/index\.html` দুই জায়গা থেকে তৈরি হচ্ছে: `pages\/\(a\)\/about\/page\.alo` আর `pages\/\(b\)\/about\/page\.alo`/);

    assert.match(routeError(['pages/page.alo', 'pages/(site)/page.alo']).message, /`dist\/index\.html`/);
    assert.match(routeError(['pages/(a)/blog/[slug]/page.alo', 'pages/(b)/blog/[slug]/page.alo']).message, /blog\/\[slug\]/);
});

test('not-found শুধু রুটে; শুধু pages/layout.alo পায়', () => {
    const { notFound } = routes(['pages/not-found.alo', 'pages/layout.alo', 'pages/page.alo']);
    assert.deepEqual(notFound, { file: 'pages/not-found.alo', path: '/404.html', output: '404.html', layouts: ['pages/layout.alo'] });

    const grouped = routes(['pages/not-found.alo', 'pages/(site)/layout.alo', 'pages/(site)/page.alo']);
    assert.deepEqual(grouped.notFound.layouts, []);

    const nested = routes(['pages/blog/not-found.alo', 'pages/blog/page.alo']);
    assert.equal(nested.notFound, null);
    assert.match(nested.warnings[0].message, /শুধু `pages\/`-এর রুটে/);
});

test('pages/-এ অন্য ফাইলে সতর্কবার্তা', () => {
    const { warnings } = routes(['pages/page.alo', 'pages/Card.alo', 'pages/logo.png']);
    assert.deepEqual(
        warnings.map((w) => w.file),
        ['pages/Card.alo', 'pages/logo.png'],
    );
    assert.match(warnings[0].hint, /কম্পোনেন্ট `components\/`-এ রাখো/);
});

test('নিচে কোনো পেইজ ছাড়া লেআউটে সতর্কবার্তা', () => {
    const { warnings } = routes(['pages/page.alo', 'pages/blog/layout.alo']);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].file, 'pages/blog/layout.alo');
    assert.match(warnings[0].message, /কোনো `page\.alo` নেই/);
});
