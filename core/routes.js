'use strict';

const { AloError } = require('./errors.js');

const PLAIN_FOLDER = /^[a-z0-9-]+$/;
const GROUP_FOLDER = /^\([a-z0-9-]+\)$/;
const ROUTE_FILES = ['page.alo', 'layout.alo', 'not-found.alo'];

function byName(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
}

function checkFolderName(name, file, afterSlug) {
    if (GROUP_FOLDER.test(name)) return 'group';
    if (name === '[slug]') {
        if (afterSlug) {
            throw new AloError({ file, message: 'একটা পাথে `[slug]` একবারই থাকতে পারে।', hint: 'ডায়নামিক রাউট এক লেভেলের; ভেতরের `[slug]` সরাও।' });
        }
        return 'slug';
    }
    if (/^\[.*\]$/.test(name)) {
        throw new AloError({ file, message: `ডায়নামিক ফোল্ডারের নাম \`${name}\` চলবে না।`, hint: 'ডায়নামিক ফোল্ডারের নাম সবসময় `[slug]`।' });
    }
    if (!PLAIN_FOLDER.test(name)) {
        throw new AloError({
            file,
            message: `\`pages/\`-এ ফোল্ডারের নাম \`${name}\` চলবে না।`,
            hint: 'নামে শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা আর হাইফেন চলে; রাউট গ্রুপ হলে `(name)`, ডায়নামিক হলে `[slug]`।',
        });
    }
    if (afterSlug) {
        throw new AloError({ file, message: '`[slug]` পাথের শেষ ফোল্ডার হতে হবে।', hint: '`[slug]`-এর ভেতরে শুধু `page.alo` রাখো।' });
    }
    return 'plain';
}

function urlFor(segments) {
    return '/' + segments.map((segment) => segment + '/').join('');
}

// Scans pages/ and returns:
//   pages: [{ file, path, output, layouts, dynamic: null | { dataDir, prefix } }]
//   notFound: null | { file, path, output, layouts }
// Route groups `(name)` stay out of the URL but still take part in the layout chain.
function findRoutes(reader, warn) {
    if (!reader.exists('pages')) {
        throw new AloError({
            message: 'এখানে `pages/` ফোল্ডার নেই। তুমি কি প্রজেক্টের রুট ফোল্ডারে আছো?',
            hint: 'নতুন প্রজেক্টের জন্য `npx @msilabs/alo init`।',
        });
    }

    const pages = [];
    let notFound = null;
    const outputs = new Map();

    function claim(output, file) {
        const other = outputs.get(output);
        if (other) {
            throw new AloError({
                file,
                message: `\`dist/${output}\` দুই জায়গা থেকে তৈরি হচ্ছে: \`${other}\` আর \`${file}\`।`,
                hint: 'রাউট গ্রুপ `(name)` URL-এ গোনা হয় না; একটা পেইজ সরাও বা অন্য ফোল্ডারে রাখো।',
            });
        }
        outputs.set(output, file);
    }

    // Returns how many pages live at or below `dir`, for the "layout without pages" warning.
    function walk(dir, segments, layouts, slug) {
        const entries = reader.list(dir).sort(byName);
        const ownLayout = entries.find((entry) => !entry.isDirectory && entry.name === 'layout.alo');
        const chain = ownLayout ? [...layouts, `${dir}/layout.alo`] : layouts;
        let count = 0;

        for (const entry of entries) {
            const file = `${dir}/${entry.name}`;

            if (entry.isDirectory) {
                const kind = checkFolderName(entry.name, file, slug !== null);
                if (kind === 'group') count += walk(file, segments, chain, slug);
                else if (kind === 'slug') count += walk(file, segments, chain, { prefix: segments });
                else count += walk(file, [...segments, entry.name], chain, slug);
                continue;
            }

            if (entry.name === 'page.alo') {
                count++;
                if (slug) {
                    const pattern = [...slug.prefix, '[slug]'].join('/') + '/index.html';
                    claim(pattern, file);
                    pages.push({ file, layouts: chain, dynamic: { dataDir: ['data', ...slug.prefix].join('/'), prefix: slug.prefix } });
                } else {
                    const output = segments.map((s) => s + '/').join('') + 'index.html';
                    claim(output, file);
                    pages.push({ file, path: urlFor(segments), output, layouts: chain, dynamic: null });
                }
            } else if (entry.name === 'not-found.alo') {
                if (dir === 'pages') {
                    notFound = { file, path: '/404.html', output: '404.html', layouts: ownLayout ? ['pages/layout.alo'] : [] };
                } else {
                    warn({ file, message: '`not-found.alo` শুধু `pages/`-এর রুটে কাজ করে, এটা উপেক্ষা করা হলো।', hint: '`pages/not-found.alo`-এ সরাও।' });
                }
            } else if (entry.name.endsWith('.alo') && !ROUTE_FILES.includes(entry.name)) {
                warn({ file, message: `\`pages/\`-এ \`${entry.name}\` কাজে লাগে না।`, hint: 'কম্পোনেন্ট `components/`-এ রাখো। `pages/`-এ শুধু `page.alo`, `layout.alo` আর `not-found.alo` থাকে।' });
            } else if (!entry.name.endsWith('.alo')) {
                warn({ file, message: `\`pages/\`-এ \`${entry.name}\` কাজে লাগে না।`, hint: 'ছবি বা অন্য ফাইল `public/`-এ রাখো, ডেটা `data/`-এ।' });
            }
        }

        if (ownLayout && count === 0) {
            warn({ file: `${dir}/layout.alo`, message: 'এই লেআউটের নিচে কোনো `page.alo` নেই।', hint: 'দরকার না থাকলে লেআউটটা সরাও।' });
        }
        return count;
    }

    walk('pages', [], [], null);
    return { pages, notFound };
}

module.exports = { findRoutes, urlFor };
