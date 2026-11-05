'use strict';

const { AloError } = require('./errors.js');

const COMPLEX_HINT = 'জটিল ডেটার জন্য `.json` ফাইল ব্যবহার করো।';
const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

// Front matter supports only a small part of YAML: `key: value`, scalars, and flat lists.
// lineOffset: how many lines come before the YAML in the file, so errors point at the real line.
function parseYaml(text, { file, lineOffset = 0, source } = {}) {
    const lines = text.split(/\r?\n/);
    const result = {};
    let listKey = null;

    function fail(index, message, hint = COMPLEX_HINT) {
        throw new AloError({ file, line: index + 1 + lineOffset, column: 1, source, message, hint });
    }

    lines.forEach((raw, index) => {
        if (/^ *\t/.test(raw)) fail(index, 'ফ্রন্ট ম্যাটারে tab দিয়ে indent চলে না।', 'স্পেস ব্যবহার করো।');
        const line = stripComment(raw, index, fail).trimEnd();
        if (line.trim() === '') return;

        const item = /^(\s*)- (.*)$|^(\s*)-$/.exec(line);
        if (item) {
            if (listKey === null) fail(index, 'লিস্টের আইটেম কোনো key-এর নিচে নেই।', 'আগে `tags:` লেখো, তারপর পরের লাইনগুলোতে `- মান`।');
            if (result[listKey] === null) result[listKey] = [];
            result[listKey].push(parseScalar((item[2] ?? '').trim(), index, fail));
            return;
        }

        if (/^\s/.test(line)) fail(index, 'নেস্টেড অবজেক্ট ফ্রন্ট ম্যাটারে চলে না।');

        const colon = findColon(line);
        if (colon === -1) fail(index, `\`${line.trim()}\` লাইনটা বোঝা যাচ্ছে না।`, 'প্রতিটা লাইন হবে `key: value`।');
        const key = line.slice(0, colon).trim();
        if (key === '') fail(index, '`:`-এর আগে কোনো key নেই।', 'প্রতিটা লাইন হবে `key: value`।');
        if (Object.hasOwn(result, key)) fail(index, `\`${key}\` key দুবার আছে।`, 'একটা রাখো।');

        const value = line.slice(colon + 1).trim();
        // `key:` with nothing after it is null, unless `- item` lines follow.
        if (value === '') {
            result[key] = null;
            listKey = key;
            return;
        }
        listKey = null;
        result[key] = parseValue(value, index, fail);
    });

    return result;
}

// The first `:` followed by a space or the line end, outside quotes.
function findColon(line) {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === ':' && (i === line.length - 1 || line[i + 1] === ' ')) {
            return i;
        }
    }
    return -1;
}

// `#` starts a comment only outside quotes and after whitespace (or at the line start).
function stripComment(line, index, fail) {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === '\\' && quote === '"') i++;
            else if (ch === "'" && quote === "'" && line[i + 1] === "'") i++;
            else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            const before = line.slice(0, i).trimEnd();
            if (before === '' || /[:\-[,]$/.test(before)) quote = ch;
        } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
            return line.slice(0, i);
        }
    }
    if (quote) fail(index, 'কোট বন্ধ হয়নি।', `মানের শেষে \`${quote}\` দাও।`);
    return line;
}

function parseValue(value, index, fail) {
    if (value === '|' || value === '>' || /^[|>][+-]?\d*$/.test(value)) fail(index, '`|` বা `>` দিয়ে কয়েক লাইনের মান ফ্রন্ট ম্যাটারে চলে না।');
    if (value.startsWith('[')) return parseInlineList(value, index, fail);
    return parseScalar(value, index, fail);
}

function parseInlineList(value, index, fail) {
    if (!value.endsWith(']')) fail(index, '`[` লিস্ট `]` দিয়ে বন্ধ হয়নি।', 'যেমন: `tags: [intro, news]`');
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];

    const items = [];
    let current = '';
    let quote = null;
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (quote) {
            current += ch;
            if (ch === '\\' && quote === '"') current += inner[++i] ?? '';
            else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
            current += ch;
        } else if (ch === ',') {
            items.push(current.trim());
            current = '';
        } else if (ch === '[' || ch === '{') {
            fail(index, 'লিস্টের ভেতরে লিস্ট বা অবজেক্ট চলে না।');
        } else {
            current += ch;
        }
    }
    items.push(current.trim());
    return items.map((item) => parseScalar(item, index, fail));
}

function parseScalar(value, index, fail) {
    if (value.startsWith('"')) {
        if (value.length < 2 || !value.endsWith('"')) fail(index, 'কোট বন্ধ হয়নি।', 'মানের শেষে `"` দাও।');
        return value.slice(1, -1).replace(/\\(.)/g, (_, ch) => ({ n: '\n', t: '\t', '"': '"', '\\': '\\' })[ch] ?? '\\' + ch);
    }
    if (value.startsWith("'")) {
        if (value.length < 2 || !value.endsWith("'")) fail(index, 'কোট বন্ধ হয়নি।', "মানের শেষে `'` দাও।");
        return value.slice(1, -1).replace(/''/g, "'");
    }
    if (/^[&*!{]/.test(value)) fail(index, `\`${value[0]}\` দিয়ে শুরু হওয়া মান (anchor, tag বা অবজেক্ট) ফ্রন্ট ম্যাটারে চলে না।`, 'লেখা হলে কোটে রাখো, যেমন `"*দারুণ*"`। জটিল ডেটার জন্য `.json` ফাইল ব্যবহার করো।');
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;
    if (NUMBER.test(value)) return Number(value);
    return value;
}

module.exports = { parseYaml };
