'use strict';

const { AloError } = require('./errors.js');

function byCodePoint(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
}

function findRoutes(reader) {
    if (!reader.exists('pages')) {
        throw new AloError({
            message: 'এখানে `pages/` ফোল্ডার নেই। তুমি কি প্রজেক্টের রুট ফোল্ডারে আছো?',
            hint: 'নতুন প্রজেক্টের জন্য `npx @msilabs/alo init`।',
        });
    }

    const routes = [];

    function walk(dir, segments) {
        for (const entry of reader.list(dir).sort(byCodePoint)) {
            const entryPath = `${dir}/${entry.name}`;
            if (entry.isDirectory) {
                walk(entryPath, [...segments, entry.name]);
            } else if (entry.name === 'page.alo') {
                const prefix = segments.length > 0 ? segments.join('/') + '/' : '';
                routes.push({ file: entryPath, path: '/' + prefix, output: prefix + 'index.html' });
            }
        }
    }

    walk('pages', []);
    return routes;
}

module.exports = { findRoutes };
