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

// Writes generated files and copies public/ files byte for byte into `dir`.
function writeOutput(root, dir, { files, copies }) {
    for (const file of files) {
        const target = path.join(dir, ...file.path.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.contents);
    }
    for (const copy of copies) {
        const target = path.join(dir, ...copy.to.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, ...copy.from.split('/')), target);
    }
}

function compileProject(root, mode, base, { reader = createFsReader(root), cache = null } = {}) {
    try {
        return compile({ reader, mode, base, cache });
    } catch (err) {
        for (const warning of err.warnings ?? []) log.warn(warning);
        throw err;
    }
}

function summary(result, ms) {
    const pages = result.files.filter((file) => file.path.endsWith('.html')).length;
    const assets = result.files.filter((file) => file.path.startsWith('assets/')).length;
    const parts = [`${pages}টা পেইজ`, `${assets}টা asset`];
    if (result.copies.length > 0) parts.push(`public/ থেকে ${result.copies.length}টা ফাইল`);
    return `বিল্ড শেষ: ${parts.join(', ')}, ${ms}ms → dist/`;
}

// Builds into .alo/build first and only then replaces dist/, so a failed build leaves the old dist/ intact.
async function build({ root, base }) {
    const started = performance.now();
    const result = compileProject(root, 'build', base);
    for (const warning of result.warnings) log.warn(warning);

    const temp = path.join(root, '.alo', 'build');
    const dist = path.join(root, 'dist');
    fs.rmSync(temp, { recursive: true, force: true });
    try {
        writeOutput(root, temp, result);
        fs.rmSync(dist, { recursive: true, force: true });
        fs.renameSync(temp, dist);
    } catch (err) {
        fs.rmSync(temp, { recursive: true, force: true });
        throw err;
    }

    log.success(summary(result, Math.round(performance.now() - started)));
    if (result.unused.length > 0) log.dim(`  অব্যবহৃত কম্পোনেন্ট: ${result.unused.map((name) => `<${name}>`).join(', ')}`);
    if (result.warnings.length > 0) log.dim(`  ${result.warnings.length}টা সতর্কবার্তা, উপরে দেখো।`);
}

module.exports = { build, createFsReader, compileProject, writeOutput };
