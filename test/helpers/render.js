'use strict';

const assert = require('node:assert/strict');
const { compile } = require('../../core/compile.js');
const { AloError } = require('../../core/errors.js');
const { createMemoryReader } = require('./memfs.js');

const FILE = 'pages/page.alo';

// Renders `<template>{snippet}</template>` as the home page and returns the <body> content.
function renderBody(snippet, head = '') {
    const source = (head ? `<head>${head}</head>\n` : '') + `<template>${snippet}</template>`;
    const { files, warnings } = compile({ reader: createMemoryReader({ [FILE]: source }) });
    const html = files[0].contents;
    const body = html.slice(html.indexOf('<body>\n') + 7, html.indexOf('\n</body>'));
    const headHtml = html.slice(html.indexOf('<head>\n') + 7, html.indexOf('\n</head>'));
    return { body: html.includes('<body>\n</body>') ? '' : body, head: headHtml, warnings };
}

function renderError(snippet) {
    try {
        renderBody(snippet);
    } catch (err) {
        assert.ok(err instanceof AloError, `AloError আশা করা হয়েছিল, পাওয়া গেছে: ${err}`);
        return err;
    }
    assert.fail('এরর আশা করা হয়েছিল');
}

module.exports = { renderBody, renderError, FILE };
