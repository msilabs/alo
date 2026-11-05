'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('../core/compile.js');
const log = require('./log.js');

function createFsReader(root) {
    const resolve = (relative) => path.join(root, ...relative.split('/'));
    return {
        exists(relative) {
            return fs.existsSync(resolve(relative));
        },
        read(relative) {
            return fs.readFileSync(resolve(relative), 'utf8');
        },
        list(relative) {
            return fs
                .readdirSync(resolve(relative), { withFileTypes: true })
                .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
        },
    };
}

function writeFiles(dir, files) {
    for (const file of files) {
        const target = path.join(dir, ...file.path.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.contents);
    }
}

async function build({ root, base }) {
    const started = performance.now();

    let result;
    try {
        result = compile({ reader: createFsReader(root), mode: 'build', base });
    } catch (err) {
        for (const warning of err.warnings ?? []) log.warn(warning);
        throw err;
    }
    for (const warning of result.warnings) log.warn(warning);

    // Build into a temporary folder first so a failed build never leaves a half-written dist/.
    const temp = path.join(root, '.alo', 'build');
    const dist = path.join(root, 'dist');
    fs.rmSync(temp, { recursive: true, force: true });
    writeFiles(temp, result.files);
    fs.rmSync(dist, { recursive: true, force: true });
    fs.renameSync(temp, dist);

    const pages = result.files.filter((file) => file.path.endsWith('.html')).length;
    const ms = Math.round(performance.now() - started);
    log.success(`বিল্ড শেষ: ${pages}টা পেইজ, ${ms}ms → dist/`);
}

module.exports = { build, createFsReader };
