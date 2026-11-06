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
    assert.fail('expected an error');
}

function summary(result) {
    return result.pages.map((page) => [page.file, page.path, page.output]);
}

test('static pages: folders are URLs', () => {
    assert.deepEqual(summary(routes(['pages/page.alo', 'pages/about/page.alo', 'pages/docs/getting-started/page.alo'])), [
        ['pages/about/page.alo', '/about/', 'about/index.html'],
        ['pages/docs/getting-started/page.alo', '/docs/getting-started/', 'docs/getting-started/index.html'],
        ['pages/page.alo', '/', 'index.html'],
    ]);
});

test('route groups stay out of the URL; a group page.alo gets the parent URL', () => {
    assert.deepEqual(summary(routes(['pages/(site)/page.alo', 'pages/(site)/about/page.alo', 'pages/(bare)/(inner)/launch/page.alo'])), [
        ['pages/(bare)/(inner)/launch/page.alo', '/launch/', 'launch/index.html'],
        ['pages/(site)/about/page.alo', '/about/', 'about/index.html'],
        ['pages/(site)/page.alo', '/', 'index.html'],
    ]);
});

test('layout chain runs from the root inwards, groups included', () => {
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

test('[slug] dynamic route: the data folder ignores groups', () => {
    const [page] = routes(['pages/(site)/blog/[slug]/page.alo']).pages;
    assert.deepEqual(page.dynamic, { dataDir: 'data/blog', prefix: ['blog'] });
});

test('other bracket names than [slug] fail with a hint', () => {
    const err = routeError(['pages/blog/[id]/page.alo']);
    assert.match(err.message, /`\[id\]` is not allowed/);
    assert.equal(err.hint, 'A dynamic folder is always named `[slug]`.');
});

test('[slug] in the middle or twice fails', () => {
    assert.match(routeError(['pages/blog/[slug]/comments/page.alo']).message, /`\[slug\]` must be the last folder in the path/);
    assert.match(routeError(['pages/[slug]/[slug]/page.alo']).message, /only once/);
    assert.ok(routes(['pages/blog/[slug]/(x)/page.alo']).pages[0].dynamic);
});

test('invalid folder names fail', () => {
    for (const name of ['About', 'my_page', 'হোম', '(Site)']) {
        const err = routeError([`pages/${name}/page.alo`]);
        assert.match(err.message, /is not allowed/, name);
        assert.equal(err.file, `pages/${name}`);
    }
});

test('the same output from two sources fails, naming both', () => {
    const err = routeError(['pages/(a)/about/page.alo', 'pages/(b)/about/page.alo']);
    assert.match(err.message, /`dist\/about\/index\.html` is produced twice: by `pages\/\(a\)\/about\/page\.alo` and `pages\/\(b\)\/about\/page\.alo`/);

    assert.match(routeError(['pages/page.alo', 'pages/(site)/page.alo']).message, /`dist\/index\.html`/);
    assert.match(routeError(['pages/(a)/blog/[slug]/page.alo', 'pages/(b)/blog/[slug]/page.alo']).message, /blog\/\[slug\]/);
});

test('not-found works only at the root and gets only pages/layout.alo', () => {
    const { notFound } = routes(['pages/not-found.alo', 'pages/layout.alo', 'pages/page.alo']);
    assert.deepEqual(notFound, { file: 'pages/not-found.alo', path: '/404.html', output: '404.html', layouts: ['pages/layout.alo'] });

    const grouped = routes(['pages/not-found.alo', 'pages/(site)/layout.alo', 'pages/(site)/page.alo']);
    assert.deepEqual(grouped.notFound.layouts, []);

    const nested = routes(['pages/blog/not-found.alo', 'pages/blog/page.alo']);
    assert.equal(nested.notFound, null);
    assert.match(nested.warnings[0].message, /only works at the root of `pages\/`/);
});

test('other files in pages/ warn', () => {
    const { warnings } = routes(['pages/page.alo', 'pages/Card.alo', 'pages/logo.png']);
    assert.deepEqual(
        warnings.map((w) => w.file),
        ['pages/Card.alo', 'pages/logo.png'],
    );
    assert.match(warnings[0].hint, /Put components in `components\/`/);
});

test('a layout with no page below it warns', () => {
    const { warnings } = routes(['pages/page.alo', 'pages/blog/layout.alo']);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].file, 'pages/blog/layout.alo');
    assert.match(warnings[0].message, /No `page\.alo` uses this layout/);
});
