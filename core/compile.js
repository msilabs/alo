'use strict';

const { AloError } = require('./errors.js');
const { parseSfc } = require('./sfc.js');
const { renderNodes, escapeHtml } = require('./render.js');
const { findRoutes } = require('./routes.js');

function renderDocument({ lang, head, title, body }) {
    const lines = [
        '<!DOCTYPE html>',
        `<html lang="${escapeHtml(lang)}">`,
        '<head>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
    ];
    if (title !== null) lines.push(`<title>${escapeHtml(title)}</title>`);
    if (head) lines.push(head);
    lines.push('</head>', '<body>');
    if (body) lines.push(body);
    lines.push('</body>', '</html>', '');
    return lines.join('\n');
}

// Drops only the blank lines around a block, so every line keeps the same indentation.
function trimBlock(html) {
    return html.replace(/^\s*\n/, '').trimEnd();
}

function hasTitle(headBlock) {
    return Boolean(headBlock) && headBlock.children.some((node) => node.type === 'element' && node.name === 'title');
}

function renderPage(sfc, route, options) {
    const data = {};
    const scope = {
        data,
        route: Object.freeze({ path: route.path }),
        base: options.base,
    };
    const ctx = { file: sfc.file, source: sfc.source, scope, warn: options.warn };

    return renderDocument({
        lang: data.site?.lang ?? 'bn',
        head: sfc.head ? trimBlock(renderNodes(sfc.head.children, ctx)) : '',
        title: hasTitle(sfc.head) ? null : 'Alo',
        body: sfc.template ? trimBlock(renderNodes(sfc.template.children, ctx)) : '',
    });
}

// reader: { exists(path), read(path), list(dir) } with POSIX paths relative to the project root.
// Returns the output files instead of writing them, so core never touches the disk.
function compile({ reader, mode = 'build', base = '/' }) {
    const warnings = [];
    const seen = new Set();
    const files = [];

    // The same template line inside a loop would otherwise warn once per item.
    function warn(diagnostic) {
        const key = [diagnostic.file, diagnostic.line, diagnostic.column, diagnostic.message].join('\n');
        if (seen.has(key)) return;
        seen.add(key);
        warnings.push(diagnostic);
    }

    try {
        for (const route of findRoutes(reader)) {
            const sfc = parseSfc(reader.read(route.file), route.file, 'page');
            files.push({ path: route.output, contents: renderPage(sfc, route, { mode, base, warn }) });
        }
    } catch (err) {
        if (err instanceof AloError) {
            if (err.file && err.source === undefined && reader.exists(err.file)) err.source = reader.read(err.file);
            err.warnings = warnings;
        }
        throw err;
    }

    return { files, warnings };
}

module.exports = { compile };
