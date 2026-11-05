'use strict';

const { AloError } = require('./errors.js');
const { evaluate } = require('./expression.js');
const { VOID_ELEMENTS } = require('./html-tags.js');
const { isStatic, isWholeExpression, wholeValueOutcome } = require('./attributes.js');
const { LOGIC_ATTRIBUTES, isLogicTemplate } = require('./sfc.js');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const FOR_PATTERN = /^\s*(?:([A-Za-z_$][\w$]*)|\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\))\s+in\s+([\s\S]+)$/;

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function isComponentName(name) {
    return /^[A-Z]/.test(name);
}

function location(ctx, node) {
    return { file: ctx.file, line: node.line, column: node.column, source: ctx.source };
}

function fail(ctx, node, message, hint) {
    throw new AloError({ ...location(ctx, node), message, hint });
}

function describe(value) {
    if (value === null) return '`null`';
    if (value === undefined) return '`undefined`';
    if (typeof value === 'object') return 'একটা অবজেক্ট';
    if (typeof value === 'string') return 'একটা স্ট্রিং';
    return `\`${String(value)}\``;
}

function stringify(value, part, ctx) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'function') {
        ctx.warn({
            ...location(ctx, part),
            message: `\`{{ ${part.code} }}\` একটা ফাংশন, তাই আউটপুটে তার কোড বসবে।`,
            hint: 'ফাংশনটা ডাকতে চাইলে শেষে `()` দাও।',
        });
    } else if (typeof value === 'object') {
        const what = Array.isArray(value) ? 'একটা অ্যারে, তাই আউটপুটে কমা দিয়ে জোড়া লেখা' : 'একটা অবজেক্ট, তাই আউটপুটে `[object Object]`';
        ctx.warn({
            ...location(ctx, part),
            message: `\`{{ ${part.code} }}\` ${what} বসবে।`,
            hint: Array.isArray(value)
                ? 'প্রতিটা আইটেম দেখাতে `<template for>` লেখো, অথবা `.join(\', \')`।'
                : 'নির্দিষ্ট ফিল্ড লেখো, যেমন `{{ post.title }}`।',
        });
    }
    return String(value);
}

function evaluatePart(part, ctx) {
    return evaluate(part.code, ctx.scope, location(ctx, part));
}

function renderParts(parts, ctx, inAttribute) {
    let out = '';
    for (const part of parts) {
        if (part.type === 'text') {
            out += part.value;
            continue;
        }
        if (part.raw && inAttribute) {
            fail(ctx, part, 'অ্যাট্রিবিউটে `{{{ }}}` চলে না।', '`{{{ }}}` শুধু লেখার জায়গায় চলে। অ্যাট্রিবিউটে `{{ }}` লেখো।');
        }
        const text = stringify(evaluatePart(part, ctx), part, ctx);
        out += part.raw ? text : escapeHtml(text);
    }
    return out;
}

function renderAttribute(attr, ctx) {
    if (isStatic(attr)) return ' ' + attr.raw;

    const quote = attr.quote || '"';
    if (isWholeExpression(attr) && !attr.parts[0].raw) {
        const part = attr.parts[0];
        const outcome = wholeValueOutcome(attr.name, evaluatePart(part, ctx));
        if (outcome.kind === 'drop') return '';
        if (outcome.kind === 'bare') return ' ' + attr.name;
        return ` ${attr.name}=${quote}${escapeHtml(stringify(outcome.value, part, ctx))}${quote}`;
    }
    return ` ${attr.name}=${quote}${renderParts(attr.parts, ctx, true)}${quote}`;
}

function checkElementLogic(node, ctx) {
    const logic = node.attrs.find((attr) => LOGIC_ATTRIBUTES.includes(attr.name));
    if (!logic) return;

    if (isComponentName(node.name)) {
        const value = logic.value === null ? '' : `="${logic.value}"`;
        const rest = node.attrs.filter((attr) => attr !== logic).map((attr) => ' ' + attr.raw).join('');
        fail(ctx, node, 'লজিক শুধু <template> ট্যাগে লেখা যায়।', `<template ${logic.name}${value}>\n  <${node.name}${rest} />\n</template>`);
    }

    for (const attr of node.attrs) {
        const looksLikeLoop = attr.name === 'for' && attr.value !== null && FOR_PATTERN.test(attr.value);
        if (attr.name === 'for' && !looksLikeLoop) continue;
        if (!LOGIC_ATTRIBUTES.includes(attr.name)) continue;
        ctx.warn({
            ...location(ctx, attr),
            message: `\`<${node.name} ${attr.name}>\` কাজ করবে না।`,
            hint: `লজিক শুধু \`<template>\`-এ চলে: \`<template ${attr.name}${attr.value === null ? '' : `="${attr.value}"`}>\` দিয়ে মোড়াও।`,
        });
    }
}

function renderElement(node, ctx) {
    checkElementLogic(node, ctx);

    let attrs = '';
    for (const attr of node.attrs) attrs += renderAttribute(attr, ctx);

    const open = `<${node.name}${attrs}>`;
    if (VOID_ELEMENTS.has(node.name)) return open;
    return open + renderNodes(node.children, ctx) + `</${node.name}>`;
}

function renderNode(node, ctx) {
    if (node.type === 'comment') return node.value;
    if (node.type === 'text') return node.rawText ? node.value : renderParts(node.parts, ctx, false);
    return renderElement(node, ctx);
}

// Validates a logic <template> and returns its single logic attribute.
function logicOf(node, ctx) {
    const logic = node.attrs.filter((attr) => LOGIC_ATTRIBUTES.includes(attr.name));
    if (logic.length > 1) {
        fail(
            ctx,
            logic[1],
            `একই \`<template>\`-এ \`${logic[0].name}\` আর \`${logic[1].name}\` একসাথে চলে না।`,
            `একটার ভেতরে আরেকটা রাখো:\n<template ${logic[0].name}="...">\n  <template ${logic[1].name}="...">…</template>\n</template>`,
        );
    }

    const other = node.attrs.find((attr) => !LOGIC_ATTRIBUTES.includes(attr.name));
    if (other) {
        fail(ctx, other, `এই \`<template>\` আউটপুটে যায় না, তাই \`${other.name}\` এখানে কাজ করবে না।`, 'ভেতরের এলিমেন্টে দাও।');
    }

    const [attr] = logic;
    if (attr.name === 'else') {
        if (attr.value !== null) {
            fail(ctx, attr, '`else`-এ কোনো মান থাকে না।', 'শুধু `<template else>` লেখো। শর্ত লাগলে `<template else-if="...">`।');
        }
        return attr;
    }

    if (attr.value === null || attr.value.trim() === '') {
        const example = attr.name === 'for' ? 'post in data.blog' : 'post.featured';
        fail(ctx, attr, `\`${attr.name}\`-এ মান দাও।`, `যেমন: \`<template ${attr.name}="${example}">\``);
    }
    if (attr.parts.some((part) => part.type === 'expr')) {
        const plain = attr.parts.map((part) => (part.type === 'expr' ? part.code : part.value)).join('');
        fail(ctx, attr, `\`${attr.name}\`-এর মানে \`{{ }}\` লাগে না।`, `সরাসরি লেখো: \`${attr.name}="${plain}"\``);
    }
    return attr;
}

function renderFor(node, attr, ctx) {
    const match = FOR_PATTERN.exec(attr.value);
    if (!match) {
        fail(ctx, attr, `\`for="${attr.value}"\` বোঝা যাচ্ছে না।`, 'লেখো `post in data.blog`, অথবা ইনডেক্সসহ `(post, i) in data.blog`।');
    }

    const [, single, pairItem, indexName, listCode] = match;
    const itemName = single ?? pairItem;
    const list = evaluate(listCode.trim(), ctx.scope, location(ctx, attr));
    if (!Array.isArray(list)) {
        const hint =
            list !== null && typeof list === 'object'
                ? `অবজেক্টের ওপর লুপ চালাতে লেখো: \`${itemName} in Object.entries(${listCode.trim()})\``
                : 'নামের বানান ঠিক আছে কিনা দেখো।';
        fail(ctx, attr, `\`for\`-এর মান অ্যারে হতে হবে, কিন্তু \`${listCode.trim()}\` হলো ${describe(list)}।`, hint);
    }

    let out = '';
    for (let index = 0; index < list.length; index++) {
        const scope = { ...ctx.scope, [itemName]: list[index] };
        if (indexName) scope[indexName] = index;
        out += renderNodes(node.children, { ...ctx, scope });
    }
    return out;
}

function isSkippable(node) {
    return node.type === 'comment' || (node.type === 'text' && !node.rawText && node.value.trim() === '');
}

// Collects `if` plus the `else-if`/`else` templates right after it; only whitespace and comments may sit between.
function renderIfChain(nodes, start, ctx) {
    const chain = [{ node: nodes[start], attr: logicOf(nodes[start], ctx) }];
    let next = start + 1;

    for (let k = next; ; k++) {
        while (k < nodes.length && isSkippable(nodes[k])) k++;
        const candidate = nodes[k];
        if (!candidate || candidate.type !== 'element' || !isLogicTemplate(candidate)) break;

        const attr = logicOf(candidate, ctx);
        if (attr.name !== 'else-if' && attr.name !== 'else') break;
        chain.push({ node: candidate, attr });
        next = k + 1;
        if (attr.name === 'else') break;
    }

    for (const { node, attr } of chain) {
        if (attr.name === 'else' || evaluate(attr.value, ctx.scope, location(ctx, attr))) {
            return { html: renderNodes(node.children, ctx), next };
        }
    }
    return { html: '', next };
}

// ctx: { file, source, scope, warn(diagnostic) }
function renderNodes(nodes, ctx) {
    let out = '';
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type !== 'element' || !isLogicTemplate(node)) {
            out += renderNode(node, ctx);
            continue;
        }

        const attr = logicOf(node, ctx);
        if (attr.name === 'for') {
            out += renderFor(node, attr, ctx);
        } else if (attr.name === 'if') {
            const { html, next } = renderIfChain(nodes, i, ctx);
            out += html;
            i = next - 1;
        } else {
            fail(
                ctx,
                attr,
                `\`<template ${attr.name}>\`-এর আগে কোনো \`<template if>\` নেই।`,
                '`else-if` আর `else` থাকে `<template if>` বা `<template else-if>`-এর ঠিক পরে; মাঝে শুধু ফাঁকা জায়গা বা কমেন্ট চলে।',
            );
        }
    }
    return out;
}

module.exports = { renderNodes, escapeHtml };
