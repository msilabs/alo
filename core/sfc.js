'use strict';

const { AloError } = require('./errors.js');
const { parseHtml } = require('./html-parser.js');

const BLOCKS = ['head', 'template', 'style', 'script'];
const DOCUMENT_TAGS = ['html', 'head', 'body'];

function blockKey(node, fail) {
    if (node.name === 'style' && node.attrs.length === 1 && node.attrs[0].name === 'global' && node.attrs[0].value === null) {
        return 'styleGlobal';
    }
    if (node.attrs.length > 0) {
        const hint = node.name === 'style' ? 'একমাত্র ব্যতিক্রম `<style global>`।' : 'টপ-লেভেল ব্লক সবসময় অ্যাট্রিবিউট ছাড়া লেখো।';
        fail(node, `টপ-লেভেলের \`<${node.name}>\` ব্লকে অ্যাট্রিবিউট চলে না।`, hint);
    }
    return node.name === 'style' ? 'style' : node.name;
}

function checkNoDocumentTags(nodes, fail) {
    for (const node of nodes) {
        if (node.type !== 'element') continue;
        if (DOCUMENT_TAGS.includes(node.name)) {
            fail(node, `\`<${node.name}>\` ট্যাগ এখানে লেখা যায় না।`, '`<html>`, `<head>` আর `<body>` Alo নিজে বানায়।');
        }
        checkNoDocumentTags(node.children, fail);
    }
}

// kind: 'page' | 'layout' | 'component' | 'not-found'
function parseSfc(source, file, kind) {
    const root = parseHtml(source, file);

    function fail(node, message, hint) {
        throw new AloError({ file, line: node.line, column: node.column, message, hint, source: root.source });
    }

    const blocks = { file, source: root.source, kind };

    for (const node of root.children) {
        if (node.type === 'comment') continue;
        if (node.type === 'text') {
            const offset = node.value.search(/\S/);
            if (offset === -1) continue;
            const before = node.value.slice(0, offset);
            const lines = before.split('\n');
            const line = node.line + lines.length - 1;
            const column = lines.length === 1 ? node.column + offset : lines[lines.length - 1].length + 1;
            fail({ line, column }, 'ব্লকের বাইরে লেখা আছে।', 'HTML মার্কআপ `<template>` ব্লকের ভেতরে রাখো।');
        }

        if (!BLOCKS.includes(node.name)) {
            fail(node, `অজানা টপ-লেভেল ব্লক \`<${node.name}>\`।`, 'টপ-লেভেলে শুধু `<head>`, `<template>`, `<style>` আর `<script>` চলে। HTML মার্কআপ `<template>`-এর ভেতরে রাখো।');
        }
        if (node.name === 'head' && kind === 'component') {
            fail(node, 'কম্পোনেন্টে `<head>` চলে না।', '`<head>` শুধু page আর layout-এ লেখা যায়।');
        }

        const key = blockKey(node, fail);
        if (blocks[key]) {
            const label = key === 'styleGlobal' ? '<style global>' : `<${node.name}>`;
            fail(node, `\`${label}\` ব্লক একবারের বেশি আছে।`, `প্রথম \`${label}\` আছে লাইন ${blocks[key].line}-এ। দুটো এক করো।`);
        }
        blocks[key] = node;
    }

    if (blocks.template) checkNoDocumentTags(blocks.template.children, fail);
    if (blocks.head) checkNoDocumentTags(blocks.head.children, fail);

    return blocks;
}

module.exports = { parseSfc };
