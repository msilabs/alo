'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function build(files, mode = 'build') {
    const result = compile({ reader: createMemoryReader(files), mode });
    const pages = {};
    for (const file of result.files) {
        const html = file.contents;
        pages[file.path] = html.includes('<body>\n</body>') ? '' : html.slice(html.indexOf('<body>\n') + 7, html.indexOf('\n</body>'));
        pages[file.path + ':html'] = html;
    }
    return { pages, warnings: result.warnings, paths: result.files.map((f) => f.path).filter((p) => p.endsWith('.html')) };
}

function buildError(files) {
    try {
        build(files);
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('expected an error');
}

const BLOG = {
    'pages/(site)/blog/[slug]/page.alo': '<head><title>{{ item.title }}</title></head><template><h1>{{ item.title }}</h1><time>{{ item.date }}</time><p>{{ route.path }}</p></template>',
    'data/blog/2026-01-10-hello-world.json': '{ "title": "হ্যালো" }',
    'data/blog/2026-02-01-second.json': '{ "title": "দ্বিতীয়" }',
    'data/blog/2026-03-01-later.json': '{ "title": "পরে", "draft": true }',
};

test('[slug] makes one page per item, with item and route.path', () => {
    const { pages, paths } = build(BLOG);
    assert.deepEqual(paths, ['blog/hello-world/index.html', 'blog/second/index.html']);
    assert.equal(pages['blog/hello-world/index.html'], '<h1>হ্যালো</h1><time>2026-01-10</time><p>/blog/hello-world/</p>');
    assert.match(pages['blog/second/index.html:html'], /<title>দ্বিতীয়<\/title>/);
});

test('draft pages are built only in dev', () => {
    assert.ok(build(BLOG, 'dev').paths.includes('blog/later/index.html'));
    assert.ok(!build(BLOG).paths.includes('blog/later/index.html'));
});

test('components do not see item; pass it as a prop', () => {
    const { pages } = build({
        ...BLOG,
        'pages/(site)/blog/[slug]/page.alo': '<template><Meta post="{{ item }}" /></template>',
        'components/Meta.alo': '<template>{{ props.post.slug }}</template>',
    });
    assert.equal(pages['blog/second/index.html'], 'second');

    const err = buildError({ ...BLOG, 'pages/(site)/blog/[slug]/page.alo': '<template><Meta /></template>', 'components/Meta.alo': '<template>{{ item.slug }}</template>' });
    assert.match(err.message, /`item` is not defined/);
});

test('a static page clashing with an item slug fails, naming both sources', () => {
    const err = buildError({ ...BLOG, 'pages/blog/second/page.alo': '' });
    assert.match(err.message, /`dist\/blog\/second\/index\.html` is produced twice: by `pages\/blog\/second\/page\.alo` and `data\/blog\/2026-02-01-second\.json`/);
});

test('a missing data folder fails as the spec says', () => {
    const err = buildError({ 'pages/(site)/blog/[slug]/page.alo': '' });
    assert.equal(err.message, 'Add JSON or Markdown files to `data/blog/` for `pages/(site)/blog/[slug]/`.');
});

test('changing data from a template fails with its location', () => {
    const err = buildError({ ...BLOG, 'pages/page.alo': '<template>\n{{ data.blog.reverse() }}\n</template>' });
    assert.equal(err.file, 'pages/page.alo');
    assert.equal(err.line, 2);
    assert.match(err.message, /`reverse\(\)` changes data/);

    const assign = buildError({ ...BLOG, 'pages/page.alo': '<template>{{ data.blog = [] }}</template>' });
    assert.match(assign.message, /`data\.blog` cannot be changed/);
    assert.equal(assign.file, 'pages/page.alo');
});

test('lang and the default title come from data.site', () => {
    const { pages } = build({ 'pages/page.alo': '', 'data/site.json': '{ "name": "আমার সাইট", "lang": "en" }' });
    assert.match(pages['index.html:html'], /<html lang="en">/);
    assert.match(pages['index.html:html'], /<title>আমার সাইট<\/title>/);
});

test('site.url is only an origin; a path gets a --base hint', () => {
    assert.ok(build({ 'pages/page.alo': '', 'data/site.json': '{ "url": "https://example.com" }' }));

    const path = buildError({ 'pages/page.alo': '', 'data/site.json': '{ "url": "https://example.com/blog" }' });
    assert.equal(path.file, 'data/site.json');
    assert.match(path.hint, /`--base \/blog`/);
    assert.match(buildError({ 'pages/page.alo': '', 'data/site.json': '{ "url": "https://example.com/" }' }).hint, /without a trailing `\/`/);
    assert.match(buildError({ 'pages/page.alo': '', 'data/site.json': '{ "url": "example.com" }' }).message, /is not a valid URL/);
});

test('Markdown posts: front matter in item, body through {{{ item.body }}}', () => {
    const { pages } = build({
        'pages/blog/[slug]/page.alo': '<template><h1>{{ item.title }}</h1>{{{ item.body }}}</template>',
        'data/blog/2026-01-10-hello.md': '---\ntitle: হ্যালো\ntags: [a, b]\n---\n\n## প্রথম অংশ\n\nএটা **গাঢ়** আর {{ না }}।\n',
    });
    assert.equal(pages['blog/hello/index.html'], '<h1>হ্যালো</h1><h2 id="প্রথম-অংশ">প্রথম অংশ</h2>\n<p>এটা <strong>গাঢ়</strong> আর {{ না }}।</p>');
});

test('front matter errors point at the real line of the .md file', () => {
    const err = buildError({
        'pages/page.alo': '<template>{{ data.post.title }}</template>',
        'data/post.md': '---\ntitle: ক\nauthor:\n  name: খ\n---\nবডি',
    });
    assert.deepEqual([err.file, err.line], ['data/post.md', 4]);
    assert.match(err.hint, /Use a `\.json` file/);
});

test('reverse() fails with its location even on a one-post blog', () => {
    const err = buildError({ 'pages/page.alo': '<template>\n  {{ data.blog.reverse() }}\n</template>', 'data/blog/a.json': '{}' });
    assert.deepEqual([err.file, err.line], ['pages/page.alo', 2]);
    assert.match(err.message, /`reverse\(\)` changes data/);
});
