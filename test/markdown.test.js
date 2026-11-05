'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMarkdown, slugify } = require('../core/markdown.js');
const { loadMarkdownFile } = require('../core/data.js');
const { AloError } = require('../core/errors.js');

test('হেডিংয়ে নিজে থেকে id, বাংলা অক্ষর থাকে, ডুপ্লিকেটে -2', () => {
    assert.equal(
        renderMarkdown('# শুরু করা\n\n## Hello, World!\n\n## শুরু করা\n\nSetext\n---\n'),
        '<h1 id="শুরু-করা">শুরু করা</h1>\n<h2 id="hello-world">Hello, World!</h2>\n<h2 id="শুরু-করা-2">শুরু করা</h2>\n<h2 id="setext">Setext</h2>\n',
    );
    assert.equal(slugify('আলো: হালকা ফ্রেমওয়ার্ক?'), 'আলো-হালকা-ফ্রেমওয়ার্ক');
    assert.equal(slugify('!!!'), 'section');
});

test('কোড ব্লকে ভাষার class, হাইলাইটিং নেই', () => {
    assert.equal(renderMarkdown('```js\nconst a = 1 < 2;\n```'), '<pre><code class="language-js">const a = 1 &lt; 2;\n</code></pre>\n');
    assert.equal(renderMarkdown('    indented'), '<pre><code>indented\n</code></pre>\n');
});

test('GFM টেবিল, alignment সহ', () => {
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

test('টেবিল নয়: কলামের সংখ্যা না মিললে বা পাইপ না থাকলে', () => {
    assert.equal(renderMarkdown('a | b\n--- | --- | ---'), '<p>a | b\n--- | --- | ---</p>\n');
    assert.equal(renderMarkdown('a\n---'), '<h2 id="a">a</h2>\n');
});

test('strikethrough ~~ ~~', () => {
    assert.equal(renderMarkdown('~~পুরনো~~ নতুন, ~এক~ নয়'), '<p><del>পুরনো</del> নতুন, ~এক~ নয়</p>\n');
});

test('raw HTML হুবহু যায়, sanitize হয় না', () => {
    assert.equal(renderMarkdown('<div class="note">\n\n**হ্যাঁ**\n\n</div>'), '<div class="note">\n<p><strong>হ্যাঁ</strong></p>\n</div>\n');
    assert.equal(renderMarkdown('এখানে <kbd>Ctrl</kbd> চাপো'), '<p>এখানে <kbd>Ctrl</kbd> চাপো</p>\n');
});

test('{{ }} Markdown-এ আক্ষরিক থাকে', () => {
    assert.equal(renderMarkdown('{{ data.x }} আর `{{ y }}`'), '<p>{{ data.x }} আর <code>{{ y }}</code></p>\n');
});

test('সাপোর্ট নেই এমন জিনিস আক্ষরিক লেখা হয়', () => {
    assert.equal(renderMarkdown('[লিংক][ref]\n\n[ref]: /url'), '<p>[লিংক][ref]</p>\n<p>[ref]: /url</p>\n');
    assert.equal(renderMarkdown('- [ ] কাজ'), '<ul>\n<li>[ ] কাজ</li>\n</ul>\n');
    assert.equal(renderMarkdown('লেখা[^1] :smile:'), '<p>লেখা[^1] :smile:</p>\n');
});

test('বাংলা লেখায় লিংক, ছবি আর নেস্টেড লিস্ট', () => {
    assert.equal(
        renderMarkdown('দেখো [আমাদের কথা](/about/ "শিরোনাম") আর ![লোগো](/images/logo.svg)\n\n1. এক\n   - ক\n2. দুই'),
        '<p>দেখো <a href="/about/" title="শিরোনাম">আমাদের কথা</a> আর <img src="/images/logo.svg" alt="লোগো" /></p>\n<ol>\n<li>এক\n<ul>\n<li>ক</li>\n</ul>\n</li>\n<li>দুই</li>\n</ol>\n',
    );
});

test('loadMarkdownFile: ফ্রন্ট ম্যাটার আর অলস body', () => {
    const value = loadMarkdownFile('---\ntitle: ক\ntags: [a]\n---\n# শিরোনাম\n', 'data/a.md');
    assert.equal(value.title, 'ক');
    assert.deepEqual(value.tags, ['a']);
    assert.ok(Object.isFrozen(value) && Object.isFrozen(value.tags));
    assert.equal(value.body, '<h1 id="শিরোনাম">শিরোনাম</h1>\n');
    assert.deepEqual(Object.keys(value), ['title', 'tags', 'body']);
});

test('loadMarkdownFile: ফ্রন্ট ম্যাটার ঐচ্ছিক; প্রথম লাইন --- না হলে সবটাই বডি', () => {
    assert.deepEqual(Object.keys(loadMarkdownFile('# শুধু বডি', 'a.md')), ['body']);
    assert.equal(loadMarkdownFile('লেখা\n\n---\n\nআরও', 'a.md').body, '<p>লেখা</p>\n<hr />\n<p>আরও</p>\n');
});

test('loadMarkdownFile: বন্ধ না করা ফ্রন্ট ম্যাটার আর body key-তে এরর', () => {
    assert.throws(() => loadMarkdownFile('---\ntitle: ক\n', 'data/a.md'), (err) => err instanceof AloError && /বন্ধ হয়নি/.test(err.message));
    assert.throws(
        () => loadMarkdownFile('---\ntitle: ক\nbody: x\n---\n', 'data/a.md'),
        (err) => err instanceof AloError && err.line === 3 && /`body` ফ্রন্ট ম্যাটারে রাখা যায় না/.test(err.message),
    );
});
