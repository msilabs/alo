'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createData } = require('../core/data.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

// A stand-in for the Markdown loader: `key: value` lines, then the body; `body` stays lazy.
function fakeMarkdown(counter) {
    return (source) => {
        const [head, body] = source.split('\n---\n');
        const value = {};
        for (const line of head.split('\n').filter(Boolean)) {
            const [key, raw] = line.split(': ');
            value[key] = raw === 'true' ? true : raw;
        }
        Object.defineProperty(value, 'body', {
            enumerable: true,
            get() {
                counter.renders++;
                return `<p>${body}</p>`;
            },
        });
        return Object.freeze(value);
    };
}

function setup(files, { mode = 'build' } = {}) {
    const reader = createMemoryReader(files);
    const warnings = [];
    const counter = { renders: 0 };
    const store = createData(reader, { mode, warn: (w) => warnings.push(w), loadMarkdown: fakeMarkdown(counter) });
    return { ...store, reader, warnings, counter };
}

function dataError(files, read) {
    try {
        read(setup(files).data);
    } catch (err) {
        assert.ok(err instanceof AloError, String(err));
        return err;
    }
    assert.fail('expected an error');
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test('a file is its value; a folder of files is an array; a folder with subfolders is an object', () => {
    const { data } = setup({
        'data/site.json': '{ "name": "আলো" }',
        'data/blog/a.json': '{ "title": "ক" }',
        'data/blog/b.md': 'title: খ\n---\nবডি',
        'data/shop/info.json': '"দোকান"',
        'data/shop/products/x.json': '{ "price": 5 }',
    });
    assert.equal(data.site.name, 'আলো');
    assert.ok(Array.isArray(data.blog));
    assert.deepEqual(plain(data.blog), [
        { title: 'ক', slug: 'a' },
        { title: 'খ', body: '<p>বডি</p>', slug: 'b' },
    ]);
    assert.equal(data.shop.info, 'দোকান');
    assert.deepEqual(plain(data.shop.products), [{ price: 5, slug: 'x' }]);
});

test('hyphenated names become camelCase keys; unknown keys are undefined', () => {
    const { data } = setup({ 'data/footer-links.json': '[1]', 'data/team-2026/a.json': '{}' });
    assert.deepEqual(plain(data.footerLinks), [1]);
    assert.equal(data.team2026.length, 1);
    assert.equal(data.missing, undefined);
});

test('no data/ folder gives an empty object', () => {
    const { data } = setup({ 'pages/page.alo': '' });
    assert.deepEqual(Object.keys(data), []);
});

test('invalid names and clashes fail', () => {
    assert.match(dataError({ 'data/Team.json': '{}' }, (d) => d.team).message, /Name `Team\.json` is not allowed/);
    assert.match(dataError({ 'data/my_list.json': '{}' }, (d) => d).hint, /lowercase/);
    assert.match(dataError({ 'data/blog.json': '[]', 'data/blog/a.json': '{}' }, (d) => d).message, /A file and a folder share a name/);
    assert.match(dataError({ 'data/x.json': '{}', 'data/x.md': '' }, (d) => d).message, /A `\.json` and a `\.md` file share a name/);
});

test('other extensions warn; dotfiles are skipped quietly', () => {
    const { data, warnings } = setup({ 'data/notes.txt': '', 'data/.DS_Store': '', 'data/a.json': '1' });
    assert.deepEqual(Object.keys(data), ['a']);
    assert.deepEqual(warnings.map((w) => w.file), ['data/notes.txt']);
});

test('arrays: ordered by full file name; the date becomes item.date and the rest the slug', () => {
    const { data } = setup({
        'data/blog/2026-03-05-third.json': '{}',
        'data/blog/2026-01-10-hello-world.json': '{}',
        'data/blog/2026-02-01-second.json': '{}',
    });
    assert.deepEqual(plain(data.blog), [
        { slug: 'hello-world', date: '2026-01-10' },
        { slug: 'second', date: '2026-02-01' },
        { slug: 'third', date: '2026-03-05' },
    ]);
    const numbered = setup({ 'data/steps/02-b.json': '{}', 'data/steps/01-a.json': '{}', 'data/steps/10-c.json': '{}' }).data;
    assert.deepEqual(numbered.steps.map((s) => s.slug), ['01-a', '02-b', '10-c']);
});

test('without a date in the file name, the data date is used', () => {
    assert.equal(setup({ 'data/blog/a.json': '{ "date": "2026-05-01" }' }).data.blog[0].date, '2026-05-01');
});

test('date and slug mistakes fail', () => {
    const read = (d) => d.blog;
    assert.match(dataError({ 'data/blog/2026-02-30-x.json': '{}' }, read).message, /`2026-02-30` in the file name is not valid/);
    assert.match(dataError({ 'data/blog/2026-01-10.json': '{}' }, read).message, /no name after the date/);
    assert.match(dataError({ 'data/blog/a.json': '{ "slug": "x" }' }, read).message, /`slug` comes from the file name/);
    assert.match(dataError({ 'data/blog/2026-01-10-a.json': '{ "date": "x" }' }, read).message, /both in the file name and in the data/);
    assert.match(dataError({ 'data/blog/a.json': '[1]' }, read).message, /must be an object/);

    const twin = dataError({ 'data/blog/2026-01-10-hello.json': '{}', 'data/blog/2026-02-01-hello.json': '{}' }, read);
    assert.match(twin.message, /same slug `hello`: `data\/blog\/2026-01-10-hello\.json` and `data\/blog\/2026-02-01-hello\.json`/);
});

test('drafts are left out of build and kept in dev', () => {
    const files = { 'data/blog/a.json': '{}', 'data/blog/b.json': '{ "draft": true }', 'data/blog/c.json': '{ "draft": false }' };
    assert.deepEqual(setup(files).data.blog.map((p) => p.slug), ['a', 'c']);
    assert.deepEqual(setup(files, { mode: 'dev' }).data.blog.map((p) => p.slug), ['a', 'b', 'c']);
});

test('lazy loading: unread files are not opened; a Markdown body renders when read', () => {
    const { data, reader, counter } = setup({
        'data/site.json': '{}',
        'data/team.json': '[]',
        'data/blog/a.md': 'title: ক\n---\nবডি',
    });
    assert.deepEqual(reader.reads, []);
    void data.site;
    assert.deepEqual(reader.reads, ['data/site.json']);
    void data.site;
    assert.deepEqual(reader.reads, ['data/site.json']);

    assert.equal(data.blog[0].title, 'ক');
    assert.equal(counter.renders, 0);
    assert.equal(data.blog[0].body, '<p>বডি</p>');
    assert.equal(counter.renders, 1);
    assert.ok(!reader.reads.includes('data/team.json'));
});

test('Object.keys, in, spread and JSON work on the proxy without reading files', () => {
    const { data, reader } = setup({ 'data/a.json': '1', 'data/b-c.json': '2', 'data/list/x.json': '{}' });
    assert.deepEqual(Object.keys(data), ['a', 'bC', 'list']);
    assert.ok('bC' in data);
    assert.ok(!('nope' in data));
    assert.deepEqual(reader.reads, []);
    assert.deepEqual(plain({ ...data }), { a: 1, bC: 2, list: [{ slug: 'x' }] });
});

test('all data is frozen; changing it fails', () => {
    const { data } = setup({ 'data/site.json': '{ "nav": { "items": [1] } }', 'data/blog/a.json': '{}' });
    assert.ok(Object.isFrozen(data.site.nav.items));
    assert.ok(Object.isFrozen(data.blog));
    assert.ok(Object.isFrozen(data.blog[0]));

    for (const write of [(d) => (d.site = 1), (d) => delete d.site, (d) => Object.defineProperty(d, 'x', { value: 1 })]) {
        try {
            write(data);
            assert.fail('expected an error');
        } catch (err) {
            assert.ok(err instanceof AloError);
            assert.match(err.message, /`data\.(site|x)` cannot be changed/);
            assert.match(err.hint, /toSorted/);
        }
    }
});

test('broken JSON fails with file and line', () => {
    const err = dataError({ 'data/team.json': '[\n  { "name": "ক" },\n]' }, (d) => d.team);
    assert.equal(err.file, 'data/team.json');
    assert.equal(err.line, 3);
    assert.match(err.message, /Invalid JSON/);
    assert.ok(err.source.includes('"ক"'));

    const cut = dataError({ 'data/team.json': '{\n  "a": ' }, (d) => d.team);
    assert.equal(cut.line, 2);
});

test('collection checks the data folder of a [slug] route', () => {
    const { collection } = setup({
        'data/blog/2026-01-10-a.json': '{}',
        'data/blog/b.json': '{ "draft": true }',
        'data/shop/products/x.json': '{}',
        'data/empty.json': '[]',
    });
    assert.deepEqual(
        collection('data/blog', 'pages/blog/[slug]/page.alo').map((e) => [e.item.slug, e.file]),
        [['a', 'data/blog/2026-01-10-a.json']],
    );

    assert.throws(() => collection('data/news', 'pages/(site)/news/[slug]/page.alo'), {
        message: 'Add JSON or Markdown files to `data/news/` for `pages/(site)/news/[slug]/`.',
    });
    assert.throws(() => collection('data/shop', 'pages/shop/[slug]/page.alo'), /JSON or Markdown/);
    assert.throws(() => collection('data/empty', 'pages/empty/[slug]/page.alo'), /JSON or Markdown/);
});

test('mutating methods fail even on one-item or empty arrays; copies and toReversed work', () => {
    const { data } = setup({ 'data/blog/a.json': '{ "tags": [] }', 'data/menu.json': '[1]' });
    for (const call of [() => data.blog.reverse(), () => data.blog.sort(), () => data.menu.reverse(), () => data.blog[0].tags.push(1), () => data.menu.splice(0, 0)]) {
        assert.throws(call, (err) => err instanceof AloError && /changes data/.test(err.message) && /toReversed/.test(err.hint));
    }
    assert.deepEqual(data.menu.toReversed(), [1]);
    assert.deepEqual([...data.menu].sort(), [1]);
    assert.equal(JSON.stringify(data.menu), '[1]');
    assert.deepEqual(Object.keys(data.menu), ['0']);
    assert.ok(Array.isArray(data.blog));
});
