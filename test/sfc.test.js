'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSfc } = require('../core/sfc.js');
const { AloError } = require('../core/errors.js');

function sfcError(source, kind = 'page') {
    try {
        parseSfc(source, 'x.alo', kind);
    } catch (err) {
        assert.ok(err instanceof AloError);
        return err;
    }
    assert.fail('expected an error');
}

test('splits blocks in any order', () => {
    const sfc = parseSfc(
        '<!-- কমেন্ট চলে -->\n<script>go()</script>\n<template><p>a</p></template>\n<style>p {}</style>\n<style global>body {}</style>\n<head><title>t</title></head>\n',
        'pages/page.alo',
        'page',
    );
    assert.equal(sfc.template.children[0].name, 'p');
    assert.equal(sfc.script.children[0].value, 'go()');
    assert.equal(sfc.style.children[0].value, 'p {}');
    assert.equal(sfc.styleGlobal.children[0].value, 'body {}');
    assert.equal(sfc.head.children[0].name, 'title');
});

test('every block is optional', () => {
    const sfc = parseSfc('', 'x.alo', 'component');
    assert.equal(sfc.template, undefined);
});

test('text outside a block fails with the right line', () => {
    const err = sfcError('<template></template>\n\n  হ্যালো');
    assert.match(err.message, /Text outside a block/);
    assert.deepEqual([err.line, err.column], [3, 3]);
});

test('an unknown top-level block fails', () => {
    const err = sfcError('<div></div>');
    assert.match(err.message, /Unknown top-level block `<div>`/);
});

test('a repeated block fails', () => {
    const err = sfcError('<template></template>\n<template></template>');
    assert.match(err.message, /appears more than once/);
    assert.equal(err.line, 2);
});

test('a component with <head> fails', () => {
    assert.match(sfcError('<head></head>', 'component').message, /Components cannot have `<head>`/);
    assert.ok(parseSfc('<head></head><template><slot /></template>', 'x.alo', 'layout').head);
});

test('a layout needs exactly one <slot />', () => {
    assert.ok(parseSfc('<template><header></header><main><slot /></main></template>', 'x.alo', 'layout'));

    const none = sfcError('<template>\n  <main></main>\n</template>', 'layout');
    assert.match(none.message, /The layout has no `<slot \/>`/);
    assert.equal(none.line, 1);
    assert.match(sfcError('<style></style>', 'layout').message, /The layout has no `<slot \/>`/);

    const two = sfcError('<template>\n  <slot />\n  <slot />\n</template>', 'layout');
    assert.match(two.message, /More than one/);
    assert.equal(two.line, 3);
    assert.match(two.hint, /line 2/);
});

test('layout slot counting includes logic templates and components, not plain templates', () => {
    assert.ok(parseSfc('<template><template if="x"><slot /></template></template>', 'x.alo', 'layout'));
    assert.ok(parseSfc('<template><Card><slot /></Card></template>', 'x.alo', 'layout'));

    const webComponent = '<template><template id="wc"><slot name="x"></slot></template><slot /></template>';
    assert.ok(parseSfc(webComponent, 'x.alo', 'layout'));
    assert.match(sfcError('<template><template id="wc"><slot></slot></template></template>', 'layout').message, /has no `<slot \/>`/);
});

test('pages and components do not need a slot', () => {
    assert.ok(parseSfc('<template><p>a</p></template>', 'x.alo', 'page'));
    assert.ok(parseSfc('<template><p>a</p></template>', 'x.alo', 'component'));
});

test('attributes on top-level blocks fail, except <style global>', () => {
    assert.match(sfcError('<template class="x"></template>').message, /cannot have attributes/);
    assert.match(sfcError('<style scoped></style>').hint, /<style global>/);
    assert.match(sfcError('<style global="1"></style>').message, /cannot have attributes/);
});

test('html, head or body inside a template fails', () => {
    for (const tag of ['html', 'head', 'body']) {
        const err = sfcError(`<template>\n  <div><${tag}></${tag}></div>\n</template>`);
        assert.match(err.message, new RegExp(`The \`<${tag}>\` tag cannot be used here`));
        assert.equal(err.line, 2);
    }
});
