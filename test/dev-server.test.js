'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { startDevServer } = require('../cli/dev-server.js');

function project(t, files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alo-dev-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const [file, contents] of Object.entries(files)) {
        const target = path.join(dir, ...file.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
    }
    return dir;
}

async function serve(t, files, options = {}) {
    const root = project(t, files);
    const server = await startDevServer({ root, port: 0, silent: true, ...options });
    t.after(() => server.close());
    const get = (pathname) => fetch(`http://localhost:${server.port}${pathname}`, { redirect: 'manual' });
    return { root, server, get };
}

// Listens to the live reload stream and counts `data: reload` messages.
function reloadListener(port, pathname = '/__alo/reload') {
    let count = 0;
    const req = http.get({ host: 'localhost', port, path: pathname }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            count += (chunk.match(/data: reload/g) ?? []).length;
        });
    });
    req.on('error', () => {});
    return { count: () => count, close: () => req.destroy() };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// File watchers (macOS FSEvents especially) may report the test's own setup writes a little late,
// so tests poll for the expected result instead of trusting the first reload event.
async function eventually(check, ms = 5000) {
    const until = Date.now() + ms;
    for (;;) {
        try {
            return await check();
        } catch (err) {
            if (Date.now() > until) throw err;
            await wait(100);
        }
    }
}

const SITE = {
    'pages/page.alo': '<template><h1>হোম</h1></template>',
    'pages/about/page.alo': '<template><h1>আমরা</h1></template>',
    'pages/not-found.alo': '<template><h1>নেই</h1></template>',
    'data/blog/draft.json': '{ "draft": true, "title": "খসড়া" }',
    'pages/blog/[slug]/page.alo': '<template><h1>{{ item.title }}</h1></template>',
    'global/site.css': 'body { margin: 0 }',
    'public/images/a.svg': '<svg/>',
};

test('pages, clean URLs, 404, Content-Type and drafts', async (t) => {
    const { get } = await serve(t, SITE);

    const home = await get('/');
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('content-type'), 'text/html; charset=utf-8');
    const html = await home.text();
    assert.match(html, /<h1>হোম<\/h1>/);
    assert.match(html, /new EventSource\("\/__alo\/reload"\)/);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/style\.css">/, 'no hashes in dev');

    const redirect = await get('/about?x=1');
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get('location'), '/about/?x=1');
    assert.match(await (await get('/about/')).text(), /আমরা/);

    const missing = await get('/nope/');
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /<h1>নেই<\/h1>/);

    assert.equal((await get('/assets/style.css')).headers.get('content-type'), 'text/css; charset=utf-8');
    assert.equal((await get('/images/a.svg')).headers.get('content-type'), 'image/svg+xml');
    assert.match(await (await get('/blog/draft/')).text(), /খসড়া/, 'drafts show in dev');
});

test('files outside the project are never served', async (t) => {
    const { get } = await serve(t, { ...SITE, 'secret.txt': 'গোপন' });
    for (const pathname of ['/..%2fsecret.txt', '/%2e%2e/%2e%2e/secret.txt', '/../../secret.txt']) {
        const res = await get(pathname);
        assert.notEqual(res.status, 200, pathname);
        assert.doesNotMatch(await res.text(), /গোপন/, pathname);
    }
});

test('methods other than GET and HEAD get 405', async (t) => {
    const { server } = await serve(t, SITE);
    const res = await fetch(`http://localhost:${server.port}/`, { method: 'POST' });
    assert.equal(res.status, 405);
});

test('a changed file triggers a live reload with the new content', async (t) => {
    const { root, server, get } = await serve(t, SITE);
    await wait(300);
    const reloads = reloadListener(server.port);
    t.after(() => reloads.close());
    await wait(100);
    const before = reloads.count();

    fs.writeFileSync(path.join(root, 'pages', 'page.alo'), '<template><h1>নতুন হোম</h1></template>');
    await eventually(async () => assert.match(await (await get('/')).text(), /নতুন হোম/));
    await eventually(() => assert.ok(reloads.count() > before, 'a reload event should arrive'));
});
test('a build error shows the overlay until it is fixed', async (t) => {
    const { root, get } = await serve(t, SITE);
    await wait(300);

    fs.writeFileSync(path.join(root, 'pages', 'about', 'page.alo'), '<template>\n  {{ nope }}\n</template>');
    const overlay = await eventually(async () => {
        const res = await get('/');
        assert.equal(res.status, 500);
        return res.text();
    });
    assert.match(overlay, /Build error/);
    assert.match(overlay, /pages\/about\/page\.alo:2:3/);
    assert.match(overlay, /`nope` is not defined/);
    assert.match(overlay, /EventSource/);
    assert.equal((await get('/assets/style.css')).status, 200, 'CSS is served from the last good build');

    fs.writeFileSync(path.join(root, 'pages', 'about', 'page.alo'), '<template>ঠিক</template>');
    await eventually(async () => assert.equal((await get('/')).status, 200));
});
test('a folder created later is picked up', async (t) => {
    const { root, get } = await serve(t, { 'pages/page.alo': '<template><Card /></template>', 'components/Card.alo': '<template>পুরনো</template>' });
    await wait(300);
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'data', 'site.json'), '{ "name": "নতুন" }');
    await eventually(async () => assert.match(await (await get('/')).text(), /<title>নতুন<\/title>/));
});
test('--base: the site lives under base, / redirects there, and the reload path has the base', async (t) => {
    const { get } = await serve(t, SITE, { base: 'repo' });
    const root = await get('/');
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/repo/');
    assert.equal((await get('/repo')).status, 302);

    const home = await (await get('/repo/')).text();
    assert.match(home, /<h1>হোম<\/h1>/);
    assert.match(home, /href="\/repo\/assets\/style\.css"/);
    assert.match(home, /new EventSource\("\/repo\/__alo\/reload"\)/);
    assert.equal((await get('/about/')).status, 404);
});

test('a busy port moves to the next one', async (t) => {
    const blocker = http.createServer();
    await new Promise((resolve) => blocker.listen(0, 'localhost', resolve));
    t.after(() => blocker.close());
    const busy = blocker.address().port;

    const root = project(t, SITE);
    const server = await startDevServer({ root, port: busy, silent: true });
    t.after(() => server.close());
    assert.equal(server.port, busy + 1);
});
