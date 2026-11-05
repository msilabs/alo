'use strict';

const { scopeCss } = require('./css-scope.js');

function byPath(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

// Lists global/*.css and global/*.js (subfolders too), each sorted by full project-relative path.
function scanGlobal(reader, warn) {
    const css = [];
    const js = [];
    if (!reader.exists('global')) return { css, js };

    function walk(dir) {
        for (const entry of reader.list(dir)) {
            if (entry.name.startsWith('.')) continue;
            const file = `${dir}/${entry.name}`;
            if (entry.isDirectory) walk(file);
            else if (entry.name.endsWith('.css')) css.push(file);
            else if (entry.name.endsWith('.js')) js.push(file);
            else warn({ file, message: '`global/`-এ শুধু `.css` আর `.js` ফাইল কাজে লাগে, এটা উপেক্ষা করা হলো।', hint: 'JSON ডেটা `data/`-এ রাখো; ছবি বা ফন্ট `public/`-এ।' });
        }
    }

    walk('global');
    return { css: css.sort(byPath), js: js.sort(byPath) };
}

function blockText(block) {
    return block ? block.children.map((node) => node.value).join('') : '';
}

// global/ CSS first, then the CSS of every used .alo file (each once), each part marked with its source.
function buildStyle({ reader, globals, sfcs }) {
    const parts = [];
    for (const file of globals) {
        const css = reader.read(file).trim();
        if (css) parts.push(`/* ${file} */\n${css}`);
    }

    for (const sfc of [...sfcs].sort((a, b) => byPath(a.file, b.file))) {
        const scoped = blockText(sfc.style);
        const global = blockText(sfc.styleGlobal).trim();
        if (scoped.trim()) {
            // Untrimmed, so CSS errors keep the right line numbers.
            const where = { file: sfc.file, line: sfc.style.children[0].line, source: sfc.source };
            parts.push(`/* ${sfc.file} */\n${scopeCss(scoped, sfc.scopeAttr, where).trim()}`);
        }
        if (global) parts.push(`/* ${sfc.file} (global) */\n${global}`);
    }

    return parts.length > 0 ? parts.join('\n\n') + '\n' : '';
}

module.exports = { scanGlobal, buildStyle, blockText };
