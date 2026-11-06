'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMarkdown, slugify } = require('../core/markdown.js');
const { loadMarkdownFile } = require('../core/data.js');
const { AloError } = require('../core/errors.js');

test('headings get ids, Bengali letters stay, duplicates get -2', () => {
    assert.equal(
        renderMarkdown('# শুরু করা\n\n## Hello, World!\n\n## শুরু করা\n\nSetext\n---\n'),
        '<h1 id="শুরু-করা">শুরু করা</h1>\n<h2 id="hello-world">Hello, World!</h2>\n<h2 id="শুরু-করা-2">শুরু করা</h2>\n<h2 id="setext">Setext</h2>\n',
    );
    assert.equal(slugify('আলো: হালকা ফ্রেমওয়ার্ক?'), 'আলো-হালকা-ফ্রেমওয়ার্ক');
    assert.equal(slugify('!!!'), 'section');
});

test('code blocks get a language class and no highlighting', () => {
    assert.equal(renderMarkdown('```js\nconst a = 1 < 2;\n```'), '<pre><code class="language-js">const a = 1 &lt; 2;\n</code></pre>\n');
    assert.equal(renderMarkdown('    indented'), '<pre><code>indented\n</code></pre>\n');
});

test('GFM tables with alignment', () => {
    assert.equal(
        renderMarkdown('| নাম | দাম |\n| :--- | ---: |\n| চা | ১০ |\n| `a\\|b` | **২০** |'),
        [
            '<table>',
            '<thead>',
            '<tr>',
            '<th style="text-align: left">নাম</th>',
            '<th style="text-align: right">দাম</th>',
            '</tr>',
            '</thead>',
            '<tbody>',
            '<tr>',
            '<td style="text-align: left">চা</td>',
            '<td style="text-align: right">১০</td>',
            '</tr>',
            '<tr>',
            '<td style="text-align: left"><code>a|b</code></td>',
            '<td style="text-align: right"><strong>২০</strong></td>',
            '</tr>',
            '</tbody>',
            '</table>',
            '',
        ].join('\n'),
    );
});

test('not a table when column counts differ or there are no pipes', () => {
    assert.equal(renderMarkdown('a | b\n--- | --- | ---'), '<p>a | b\n--- | --- | ---</p>\n');
    assert.equal(renderMarkdown('a\n---'), '<h2 id="a">a</h2>\n');
});

test('strikethrough ~~ ~~', () => {
    assert.equal(renderMarkdown('~~পুরনো~~ নতুন, ~এক~ নয়'), '<p><del>পুরনো</del> নতুন, ~এক~ নয়</p>\n');
});

test('raw HTML passes through without sanitizing', () => {
    assert.equal(renderMarkdown('<div class="note">\n\n**হ্যাঁ**\n\n</div>'), '<div class="note">\n<p><strong>হ্যাঁ</strong></p>\n</div>\n');
    assert.equal(renderMarkdown('এখানে <kbd>Ctrl</kbd> চাপুন'), '<p>এখানে <kbd>Ctrl</kbd> চাপুন</p>\n');
});

test('{{ }} stays literal in Markdown', () => {
    assert.equal(renderMarkdown('{{ data.x }} আর `{{ y }}`'), '<p>{{ data.x }} আর <code>{{ y }}</code></p>\n');
});

test('unsupported syntax stays literal text', () => {
    assert.equal(renderMarkdown('[লিংক][ref]\n\n[ref]: /url'), '<p>[লিংক][ref]</p>\n<p>[ref]: /url</p>\n');
    assert.equal(renderMarkdown('- [ ] কাজ'), '<ul>\n<li>[ ] কাজ</li>\n</ul>\n');
    assert.equal(renderMarkdown('লেখা[^1] :smile:'), '<p>লেখা[^1] :smile:</p>\n');
});

test('links, images and nested lists in Bengali text', () => {
    assert.equal(
        renderMarkdown('দেখুন [আমাদের কথা](/about/ "শিরোনাম") আর ![লোগো](/images/logo.svg)\n\n1. এক\n   - ক\n2. দুই'),
        '<p>দেখুন <a href="/about/" title="শিরোনাম">আমাদের কথা</a> আর <img src="/images/logo.svg" alt="লোগো" /></p>\n<ol>\n<li>এক\n<ul>\n<li>ক</li>\n</ul>\n</li>\n<li>দুই</li>\n</ol>\n',
    );
});

test('loadMarkdownFile: front matter and a lazy body', () => {
    const value = loadMarkdownFile('---\ntitle: ক\ntags: [a]\n---\n# শিরোনাম\n', 'data/a.md');
    assert.equal(value.title, 'ক');
    assert.deepEqual(value.tags, ['a']);
    assert.ok(Object.isFrozen(value) && Object.isFrozen(value.tags));
    assert.equal(value.body, '<h1 id="শিরোনাম">শিরোনাম</h1>\n');
    assert.deepEqual(Object.keys(value), ['title', 'tags', 'body']);
});

test('loadMarkdownFile: front matter is optional; without --- on the first line it is all body', () => {
    assert.deepEqual(Object.keys(loadMarkdownFile('# শুধু বডি', 'a.md')), ['body']);
    assert.equal(loadMarkdownFile('লেখা\n\n---\n\nআরও', 'a.md').body, '<p>লেখা</p>\n<hr />\n<p>আরও</p>\n');
});

test('loadMarkdownFile: unclosed front matter and a body key fail', () => {
    assert.throws(() => loadMarkdownFile('---\ntitle: ক\n', 'data/a.md'), (err) => err instanceof AloError && /not closed/.test(err.message));
    assert.throws(
        () => loadMarkdownFile('---\ntitle: ক\nbody: x\n---\n', 'data/a.md'),
        (err) => err instanceof AloError && err.line === 3 && /`body` cannot be set in front matter/.test(err.message),
    );
});
