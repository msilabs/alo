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

test('raw HTML is escaped by default', () => {
    assert.equal(renderMarkdown('এখানে <kbd>Ctrl</kbd> চাপুন'), '<p>এখানে &lt;kbd&gt;Ctrl&lt;/kbd&gt; চাপুন</p>\n');
    assert.equal(renderMarkdown('<div class="note">\n\n**হ্যাঁ**\n\n</div>'), '<p>&lt;div class=&quot;note&quot;&gt;</p>\n<p><strong>হ্যাঁ</strong></p>\n<p>&lt;/div&gt;</p>\n');
    assert.equal(renderMarkdown('&copy; &unknown; &amp;'), '<p>© &unknown; &amp;</p>\n');
});

test('allowHtml keeps safe tags and attributes', () => {
    const options = { allowHtml: true };
    assert.equal(renderMarkdown('এখানে <kbd>Ctrl</kbd> চাপুন', options), '<p>এখানে <kbd>Ctrl</kbd> চাপুন</p>\n');
    assert.equal(renderMarkdown('<div class="note">\n\n**হ্যাঁ**\n\n</div>', options), '<div class="note">\n<p><strong>হ্যাঁ</strong></p>\n</div>\n');
    assert.equal(renderMarkdown('<a href="/x" title="t">a</a> <img src="/i.png" alt="x">', options), '<p><a href="/x" title="t">a</a> <img src="/i.png" alt="x" /></p>\n');
});

test('markdown: script tags never reach the output', () => {
    for (const options of [{}, { allowHtml: true }]) {
        for (const input of ['<script>alert(1)</script>', 'a <script>alert(1)</script> b', '<SCRIPT SRC=//evil.example></SCRIPT>', '<script\n>alert(1)</script\n>']) {
            assert.doesNotMatch(renderMarkdown(input, options), /<script/i, input);
        }
    }
    assert.equal(renderMarkdown('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n');
    assert.equal(renderMarkdown('<script>alert(1)</script>\n\nokay', { allowHtml: true }), '<p>okay</p>\n');
    assert.equal(renderMarkdown('a <script>x</script> b', { allowHtml: true }), '<p>a x b</p>\n');
});

test('markdown: event handler and style attributes are removed', () => {
    const options = { allowHtml: true };
    const inputs = [
        '<img src="x" onerror="alert(1)">',
        '<img src=x onerror=alert(1)>',
        '<IMG SRC="x" ONERROR="alert(1)">',
        '<div onclick="alert(1)">x</div>',
        '<a href="/ok" onmouseover="alert(1)">x</a>',
        '<p style="background:url(javascript:alert(1))">x</p>',
    ];
    for (const input of inputs) {
        assert.doesNotMatch(renderMarkdown(input, options), /onerror|onclick|onmouseover|style=/i, input);
    }
    assert.equal(renderMarkdown('<img src="x" onerror="alert(1)">', options), '<img src="x" />\n');
    assert.equal(renderMarkdown('<img src="x" onerror="alert(1)">'), '<p>&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;</p>\n');
});

test('markdown: dangerous tags are removed even with allowHtml', () => {
    const options = { allowHtml: true };
    for (const input of ['<iframe src="//evil.example"></iframe>', '<svg onload="alert(1)"><circle></circle></svg>', '<object data="x"></object>', '<embed src="x">', '<style>*{}</style>', '<form action="/x"><input></form>', '<!-- c -->']) {
        assert.doesNotMatch(renderMarkdown(input, options), /<(iframe|svg|object|embed|style|form|input)|<!--/i, input);
    }
});

test('markdown: javascript:, data: and vbscript: links are dropped', () => {
    assert.equal(renderMarkdown('[x](javascript:alert(1))'), '<p>x</p>\n');
    assert.equal(renderMarkdown('[x](JavaScript:alert(1))'), '<p>x</p>\n');
    assert.equal(renderMarkdown('[x](vbscript:msgbox(1))'), '<p>x</p>\n');
    assert.equal(renderMarkdown('[x](data:text/html,<b>x</b>)'), '<p>x</p>\n');
    assert.equal(renderMarkdown('[x](file:///etc/passwd)'), '<p>x</p>\n');
    assert.equal(renderMarkdown('<javascript:alert(1)>'), '<p>javascript:alert(1)</p>\n');
    assert.equal(renderMarkdown('[**x**](javascript:alert(1))'), '<p><strong>x</strong></p>\n');
});

test('markdown: tricks to hide the scheme do not work', () => {
    const tricks = [
        '[x](jav&#x61;script:alert(1))',
        '[x](&#106;avascript:alert(1))',
        '[x](&#x01;javascript:alert(1))',
        '[x](<  javascript:alert(1)>)',
        '[x](<\tjavascript:alert(1)>)',
        '[x]( javascript:alert(1) )',
        '[x](%20javascript:alert(1))',
        '[x](%6Aavascript:alert(1))',
    ];
    for (const input of tricks) {
        assert.doesNotMatch(renderMarkdown(input), /<a /, input);
    }
    assert.equal(renderMarkdown('[x](java&#9;script:alert(1))'), '<p>x</p>\n');
    // An entity without `;` is decoded by browsers, so `&` must stay escaped in the output.
    assert.equal(renderMarkdown('<a href="&#106avascript:alert(1)">x</a>', { allowHtml: true }), '<p><a href="&amp;#106avascript:alert(1)">x</a></p>\n');
    for (const input of ['<a href="jav&#x61;script:alert(1)">x</a>', '<a href="java\nscript:alert(1)">x</a>', '<a href=" javascript:alert(1)">x</a>', '<a href="&#0000106;avascript:alert(1)">x</a>']) {
        assert.doesNotMatch(renderMarkdown(input, { allowHtml: true }), /href/, input);
    }
});

test('markdown: image sources allow only http and https', () => {
    assert.equal(renderMarkdown('![x](data:text/html,<script>alert(1)</script>)'), '<p>x</p>\n');
    assert.equal(renderMarkdown('![লেখা](javascript:alert(1))'), '<p>লেখা</p>\n');
    assert.equal(renderMarkdown('![x](data:image/png;base64,AAAA)'), '<p>x</p>\n');
    assert.equal(renderMarkdown('![x](mailto:a@b.c)'), '<p>x</p>\n');
    assert.equal(renderMarkdown('<img src="data:text/html,x">', { allowHtml: true }), '<img />\n');
    assert.equal(renderMarkdown('![a](https://e.example/a.png)'), '<p><img src="https://e.example/a.png" alt="a" /></p>\n');
});

test('markdown: http, https, mailto and relative URLs stay', () => {
    assert.equal(renderMarkdown('[a](http://e.example)'), '<p><a href="http://e.example">a</a></p>\n');
    assert.equal(renderMarkdown('[a](HTTPS://e.example/x?y=1#z)'), '<p><a href="HTTPS://e.example/x?y=1#z">a</a></p>\n');
    assert.equal(renderMarkdown('[a](mailto:me@e.example)'), '<p><a href="mailto:me@e.example">a</a></p>\n');
    assert.equal(renderMarkdown('<me@e.example>'), '<p><a href="mailto:me@e.example">me@e.example</a></p>\n');
    for (const url of ['/docs/', 'docs/a.md', './a', '../a', '#top', '?q=1', '//cdn.example/a.js', 'a/b:c']) {
        assert.equal(renderMarkdown(`[a](${url})`), `<p><a href="${url}">a</a></p>\n`, url);
    }
});

test('markdown: attribute values are escaped', () => {
    assert.equal(renderMarkdown('[a](/x "t\\"><b>")'), '<p><a href="/x" title="t&quot;&gt;&lt;b&gt;">a</a></p>\n');
    assert.equal(renderMarkdown('![a"><b>](/x.png)'), '<p><img src="/x.png" alt="a&quot;&gt;" /></p>\n');
    assert.equal(renderMarkdown('[a](/x"y)'), '<p><a href="/x%22y">a</a></p>\n');
    assert.equal(renderMarkdown('```a"b<c\nx\n```'), '<pre><code class="language-a&quot;b&lt;c">x\n</code></pre>\n');
    assert.equal(renderMarkdown('# a"b'), '<h1 id="ab">a&quot;b</h1>\n');
    assert.equal(renderMarkdown('<a href="/x" title=\'a"b\'>x</a>', { allowHtml: true }), '<p><a href="/x" title="a&quot;b">x</a></p>\n');
});

test('markdown: a stray < is escaped under allowHtml', () => {
    assert.equal(renderMarkdown('a < b and <3', { allowHtml: true }), '<p>a &lt; b and &lt;3</p>\n');
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
