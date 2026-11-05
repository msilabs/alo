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
    assert.fail('এরর আশা করা হয়েছিল');
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test('ফাইল মানে তার মান; শুধু ফাইলের ফোল্ডার অ্যারে; সাবফোল্ডারওয়ালা ফোল্ডার অবজেক্ট', () => {
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

test('হাইফেনওয়ালা নাম camelCase key হয়; অজানা key undefined', () => {
    const { data } = setup({ 'data/footer-links.json': '[1]', 'data/team-2026/a.json': '{}' });
    assert.deepEqual(plain(data.footerLinks), [1]);
    assert.equal(data.team2026.length, 1);
    assert.equal(data.missing, undefined);
});

test('data/ না থাকলে খালি অবজেক্ট', () => {
    const { data } = setup({ 'pages/page.alo': '' });
    assert.deepEqual(Object.keys(data), []);
});

test('ভুল নাম আর সংঘর্ষে এরর', () => {
    assert.match(dataError({ 'data/Team.json': '{}' }, (d) => d.team).message, /নাম `Team\.json` চলবে না/);
    assert.match(dataError({ 'data/my_list.json': '{}' }, (d) => d).hint, /ছোট হাতের/);
    assert.match(dataError({ 'data/blog.json': '[]', 'data/blog/a.json': '{}' }, (d) => d).message, /একই নামে ফাইল আর ফোল্ডার/);
    assert.match(dataError({ 'data/x.json': '{}', 'data/x.md': '' }, (d) => d).message, /একই নামে `\.json` আর `\.md`/);
});

test('অন্য এক্সটেনশনে সতর্কবার্তা, ডটফাইল চুপচাপ বাদ', () => {
    const { data, warnings } = setup({ 'data/notes.txt': '', 'data/.DS_Store': '', 'data/a.json': '1' });
    assert.deepEqual(Object.keys(data), ['a']);
    assert.deepEqual(warnings.map((w) => w.file), ['data/notes.txt']);
});

test('অ্যারে: পূর্ণ ফাইলনাম ক্রমে; তারিখ থেকে item.date, বাকিটা slug', () => {
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

test('তারিখ ফাইলনামে না থাকলে ডেটার date চলে', () => {
    assert.equal(setup({ 'data/blog/a.json': '{ "date": "2026-05-01" }' }).data.blog[0].date, '2026-05-01');
});

test('তারিখ আর slug-এর ভুলে এরর', () => {
    const read = (d) => d.blog;
    assert.match(dataError({ 'data/blog/2026-02-30-x.json': '{}' }, read).message, /`2026-02-30` সঠিক নয়/);
    assert.match(dataError({ 'data/blog/2026-01-10.json': '{}' }, read).message, /তারিখের পরে কোনো নাম নেই/);
    assert.match(dataError({ 'data/blog/a.json': '{ "slug": "x" }' }, read).message, /`slug` ফাইলের নাম থেকে আসে/);
    assert.match(dataError({ 'data/blog/2026-01-10-a.json': '{ "date": "x" }' }, read).message, /ফাইলের নামেও আছে, ডেটাতেও/);
    assert.match(dataError({ 'data/blog/a.json': '[1]' }, read).message, /মান অবজেক্ট হতে হবে/);

    const twin = dataError({ 'data/blog/2026-01-10-hello.json': '{}', 'data/blog/2026-02-01-hello.json': '{}' }, read);
    assert.match(twin.message, /slug একই, `hello`: `data\/blog\/2026-01-10-hello\.json` আর `data\/blog\/2026-02-01-hello\.json`/);
});

test('খসড়া build-এ বাদ যায়, dev-এ থাকে', () => {
    const files = { 'data/blog/a.json': '{}', 'data/blog/b.json': '{ "draft": true }', 'data/blog/c.json': '{ "draft": false }' };
    assert.deepEqual(setup(files).data.blog.map((p) => p.slug), ['a', 'c']);
    assert.deepEqual(setup(files, { mode: 'dev' }).data.blog.map((p) => p.slug), ['a', 'b', 'c']);
});

test('অলস লোড: যা পড়া হয়নি তা খোলা হয় না; Markdown body পড়লেই রেন্ডার', () => {
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

test('Proxy-তে Object.keys, in, spread আর JSON কাজ করে, কিন্তু ফাইল পড়ে না', () => {
    const { data, reader } = setup({ 'data/a.json': '1', 'data/b-c.json': '2', 'data/list/x.json': '{}' });
    assert.deepEqual(Object.keys(data), ['a', 'bC', 'list']);
    assert.ok('bC' in data);
    assert.ok(!('nope' in data));
    assert.deepEqual(reader.reads, []);
    assert.deepEqual(plain({ ...data }), { a: 1, bC: 2, list: [{ slug: 'x' }] });
});

test('সব ডেটা frozen; বদলানোর চেষ্টায় এরর', () => {
    const { data } = setup({ 'data/site.json': '{ "nav": { "items": [1] } }', 'data/blog/a.json': '{}' });
    assert.ok(Object.isFrozen(data.site.nav.items));
    assert.ok(Object.isFrozen(data.blog));
    assert.ok(Object.isFrozen(data.blog[0]));

    for (const write of [(d) => (d.site = 1), (d) => delete d.site, (d) => Object.defineProperty(d, 'x', { value: 1 })]) {
        try {
            write(data);
            assert.fail('এরর আশা করা হয়েছিল');
        } catch (err) {
            assert.ok(err instanceof AloError);
            assert.match(err.message, /`data\.(site|x)` বদলানো যায় না/);
            assert.match(err.hint, /toSorted/);
        }
    }
});

test('ভাঙা JSON-এ ফাইল আর লাইন নম্বর', () => {
    const err = dataError({ 'data/team.json': '[\n  { "name": "ক" },\n]' }, (d) => d.team);
    assert.equal(err.file, 'data/team.json');
    assert.equal(err.line, 3);
    assert.match(err.message, /JSON ঠিক নেই/);
    assert.ok(err.source.includes('"ক"'));

    const cut = dataError({ 'data/team.json': '{\n  "a": ' }, (d) => d.team);
    assert.equal(cut.line, 2);
});

test('collection: [slug]-এর ডেটা ফোল্ডার যাচাই', () => {
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
        message: '`pages/(site)/news/[slug]/`-এর জন্য `data/news/` ফোল্ডারে JSON বা Markdown ফাইল রাখো।',
    });
    assert.throws(() => collection('data/shop', 'pages/shop/[slug]/page.alo'), /JSON বা Markdown/);
    assert.throws(() => collection('data/empty', 'pages/empty/[slug]/page.alo'), /JSON বা Markdown/);
});

test('এক আইটেমের বা খালি অ্যারেতেও বদলানোর মেথডে এরর; কপি আর toReversed চলে', () => {
    const { data } = setup({ 'data/blog/a.json': '{ "tags": [] }', 'data/menu.json': '[1]' });
    for (const call of [() => data.blog.reverse(), () => data.blog.sort(), () => data.menu.reverse(), () => data.blog[0].tags.push(1), () => data.menu.splice(0, 0)]) {
        assert.throws(call, (err) => err instanceof AloError && /ডেটা বদলায়/.test(err.message) && /toReversed/.test(err.hint));
    }
    assert.deepEqual(data.menu.toReversed(), [1]);
    assert.deepEqual([...data.menu].sort(), [1]);
    assert.equal(JSON.stringify(data.menu), '[1]');
    assert.deepEqual(Object.keys(data.menu), ['0']);
    assert.ok(Array.isArray(data.blog));
});
