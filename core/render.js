'use strict';

const { AloError } = require('./errors.js');
const { evaluate } = require('./expression.js');
const { VOID_ELEMENTS } = require('./html-tags.js');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function toText(value) {
    return value === undefined || value === null ? '' : String(value);
}

function location(ctx, part) {
    return { file: ctx.file, line: part.line, column: part.column, source: ctx.source };
}

function renderParts(parts, ctx, inAttribute) {
    let out = '';
    for (const part of parts) {
        if (part.type === 'text') {
            out += part.value;
            continue;
        }
        if (part.raw && inAttribute) {
            throw new AloError({
                ...location(ctx, part),
                message: 'অ্যাট্রিবিউটে `{{{ }}}` চলে না।',
                hint: '`{{{ }}}` শুধু লেখার জায়গায় চলে। অ্যাট্রিবিউটে `{{ }}` লেখো।',
            });
        }
        const text = toText(evaluate(part.code, ctx.scope, location(ctx, part)));
        out += part.raw ? text : escapeHtml(text);
    }
    return out;
}

function isStatic(attr) {
    return attr.parts.every((part) => part.type === 'text') && attr.parts.map((part) => part.value).join('') === attr.value;
}

function renderAttributes(attrs, ctx) {
    let out = '';
    for (const attr of attrs) {
        if (attr.value === null || isStatic(attr)) {
            out += ' ' + attr.raw;
            continue;
        }
        const quote = attr.quote || '"';
        out += ` ${attr.name}=${quote}${renderParts(attr.parts, ctx, true)}${quote}`;
    }
    return out;
}

function renderNode(node, ctx) {
    if (node.type === 'comment') return node.value;
    if (node.type === 'text') return node.rawText ? node.value : renderParts(node.parts, ctx, false);

    const open = `<${node.name}${renderAttributes(node.attrs, ctx)}>`;
    if (VOID_ELEMENTS.has(node.name)) return open;
    return open + renderNodes(node.children, ctx) + `</${node.name}>`;
}

// ctx: { file, source, scope }
function renderNodes(nodes, ctx) {
    let out = '';
    for (const node of nodes) out += renderNode(node, ctx);
    return out;
}

module.exports = { renderNodes, escapeHtml };
