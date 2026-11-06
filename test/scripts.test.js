'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { compile } = require('../core/compile.js');
const { AloError } = require('../core/errors.js');
const { createMemoryReader } = require('./helpers/memfs.js');

function build(files, mode = 'dev') {
    const result = compile({ reader: createMemoryReader(files), mode });
    const out = {};
    for (const file of result.files) out[file.path] = file.contents;
    return { out, warnings: result.warnings };
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

function scriptTags(html) {
    return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
}

// Runs components.js against fake elements: [{ names: 'A B', id }]
function runComponents(code, elements) {
    const calls = [];
    const errors = [];
    const nodes = elements.map((el) => ({ id: el.id, getAttribute: () => el.names }));
    const context = {
        calls,
        document: { querySelectorAll: () => nodes },
        console: { error: (...args) => errors.push(args.join(' ')) },
    };
    vm.runInNewContext(code, context);
    return { calls, errors };
}

const COUNTER = '<template><div class="counter" data-start="{{ props.start ?? 0 }}"><button>+</button></div></template><script>calls.push("Counter:" + $el.id);</script>';

test('data-a-c on the component root, and a separate $el per instance', () => {
    const { out } = build({
        'pages/page.alo': '<template><Counter start="{{ 5 }}" /><Counter /></template>',
        'components/Counter.alo': COUNTER,
    });
    assert.match(out['index.html'], /<div class="counter" data-start="5" data-a-c="Counter"><button>\+<\/button><\/div><div class="counter" data-start="0" data-a-c="Counter">/);

    const { calls } = runComponents(out['assets/components.js'], [
        { id: 'a', names: 'Counter' },
        { id: 'b', names: 'Counter' },
    ]);
    assert.deepEqual(calls, ['Counter:a', 'Counter:b']);
});

test('components without a script get no data-a-c', () => {
    const { out } = build({ 'pages/page.alo': '<template><Card /></template>', 'components/Card.alo': '<template><div></div></template>' });
    assert.doesNotMatch(out['index.html'], /data-a-c/);
    assert.equal(out['assets/components.js'], undefined);
});

test('when a child component is the root, both names are kept', () => {
    const { out } = build({
        'pages/page.alo': '<template><Blog.PostCard /></template>',
        'components/Card.alo': '<template><article><slot /></article></template><script>calls.push("Card");</script>',
        'components/blog/PostCard.alo': '<template><Card>x</Card></template><script>calls.push("PostCard");</script>',
    });
    assert.match(out['index.html'], /<article data-a-c="Card Blog\.PostCard">x<\/article>/);
    const { calls } = runComponents(out['assets/components.js'], [{ id: 'x', names: 'Card Blog.PostCard' }]);
    assert.deepEqual(calls, ['Card', 'PostCard']);
});

test('an error in one component does not stop the others', () => {
    const { out } = build({
        'pages/page.alo': '<template><Broken /><Fine /></template>',
        'components/Broken.alo': '<template><div></div></template><script>throw new Error("ভাঙা");</script>',
        'components/Fine.alo': '<template><div></div></template><script>calls.push("Fine");</script>',
    });
    const { calls, errors } = runComponents(out['assets/components.js'], [
        { id: 1, names: 'Broken' },
        { id: 2, names: 'Fine' },
    ]);
    assert.deepEqual(calls, ['Fine']);
    assert.match(errors[0], /^\[alo\] Broken: Error: ভাঙা/);
});

test('return works in a script; code is marked with its source file', () => {
    const { out } = build({
        'pages/page.alo': '<template><Early /></template>',
        'components/Early.alo': '<template><div></div></template><script>\n    if (!$el) return;\n    calls.push(1);\n</script>',
    });
    assert.match(out['assets/components.js'], /"Early": function \(\$el\) \{\n\/\* components\/Early\.alo \*\/\n    if \(!\$el\) return;/);
    assert.deepEqual(runComponents(out['assets/components.js'], [{ id: 1, names: 'Early' }]).calls, [1]);
});

test('several roots or no root warn', () => {
    const many = build({ 'pages/page.alo': '<template><Two /></template>', 'components/Two.alo': '<template><p>a</p><p>b</p></template><script>x()</script>' });
    assert.match(many.warnings[0].message, /has several root elements/);
    assert.match(many.out['index.html'], /<p data-a-c="Two">a<\/p><p>b<\/p>/);

    const none = build({ 'pages/page.alo': '<template><Text /></template>', 'components/Text.alo': '<template>শুধু লেখা</template><script>x()</script>' });
    assert.match(none.warnings[0].message, /gets no `\$el`/);
    assert.equal(none.warnings[0].file, 'components/Text.alo');
});

test('pages load scripts only when they need them', () => {
    const { out } = build({
        'pages/layout.alo': '<template><slot /></template>',
        'pages/page.alo': '<template><Counter /></template>',
        'pages/plain/page.alo': '<template><p>কিছু নেই</p></template>',
        'components/Counter.alo': COUNTER,
    });
    assert.deepEqual(scriptTags(out['index.html']), ['/assets/components.js']);
    assert.deepEqual(scriptTags(out['plain/index.html']), []);
});

test('page and layout scripts: root layout first, each in its own IIFE, no $el', () => {
    const { out } = build({
        'pages/layout.alo': '<template><slot /></template><script>root();</script>',
        'pages/blog/layout.alo': '<template><slot /></template><script>blog();</script>',
        'pages/blog/page.alo': '<template>x</template><script>const page = 1;</script>',
        'pages/about/page.alo': '<template>y</template>',
    });
    assert.equal(
        out['assets/pages/blog.js'],
        '/* pages/layout.alo */\n(() => {\nroot();\n})();\n\n/* pages/blog/layout.alo */\n(() => {\nblog();\n})();\n\n/* pages/blog/page.alo */\n(() => {\nconst page = 1;\n})();\n',
    );
    assert.deepEqual(scriptTags(out['blog/index.html']), ['/assets/pages/blog.js']);
    assert.deepEqual(scriptTags(out['about/index.html']), ['/assets/pages/about.js']);
    assert.match(out['assets/pages/about.js'], /root\(\);/);
});

test('page script names: index, nested, [slug] and 404', () => {
    const { out } = build({
        'pages/(site)/page.alo': '<script>a()</script>',
        'pages/docs/getting-started/page.alo': '<script>b()</script>',
        'pages/blog/[slug]/page.alo': '<template>{{ item.slug }}</template><script>c()</script>',
        'data/blog/one.json': '{}',
        'data/blog/two.json': '{}',
        'pages/not-found.alo': '<script>d()</script>',
    });
    assert.deepEqual(
        Object.keys(out).filter((p) => p.startsWith('assets/pages/')).sort(),
        ['assets/pages/404.js', 'assets/pages/blog__slug.js', 'assets/pages/docs__getting-started.js', 'assets/pages/index.js'],
    );
    assert.deepEqual(scriptTags(out['blog/one/index.html']), ['/assets/pages/blog__slug.js']);
    assert.deepEqual(scriptTags(out['blog/two/index.html']), ['/assets/pages/blog__slug.js']);
});

test('global/ JS: full path order, no IIFE, joined with ;\\n, first on every page', () => {
    const { out } = build({
        'global/main.js': 'function hello() {}',
        'global/a/first.js': 'var first = 1',
        'pages/page.alo': '<template><Counter /></template><script>go()</script>',
        'components/Counter.alo': COUNTER,
    });
    assert.equal(out['assets/global.js'], '/* global/a/first.js */\nvar first = 1\n;\n/* global/main.js */\nfunction hello() {}\n');
    assert.deepEqual(scriptTags(out['index.html']), ['/assets/global.js', '/assets/components.js', '/assets/pages/index.js']);
});

test('JavaScript syntax errors fail the build with the real line', () => {
    const component = buildError({
        'pages/page.alo': '<template><Bad /></template>',
        'components/Bad.alo': '<template><div></div></template>\n\n<script>\n    const a = 1;\n    let b = ;\n</script>',
    });
    assert.deepEqual([component.file, component.line], ['components/Bad.alo', 5]);
    assert.match(component.message, /JavaScript syntax error/);

    const global = buildError({ 'pages/page.alo': '', 'global/main.js': 'ok();\nif (x {\n' });
    assert.deepEqual([global.file, global.line], ['global/main.js', 2]);

    const page = buildError({ 'pages/page.alo': '<script>\nimport x from "y";\n</script>' });
    assert.equal(page.line, 2);
    assert.match(page.hint, /`import` is not supported/);
});

test('scripts of unused components stay out of components.js', () => {
    const { out } = build({
        'pages/page.alo': '<template><Counter /></template>',
        'components/Counter.alo': COUNTER,
        'components/Unused.alo': '<template><div></div></template><script>unused()</script>',
    });
    assert.doesNotMatch(out['assets/components.js'], /unused/);
});
