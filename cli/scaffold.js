'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AloError, suggest } = require('../core/errors.js');
const log = require('./log.js');
const { version } = require('../package.json');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'init');
// A folder holding only these still counts as empty, so `git init` before `alo init` is fine.
const IGNORABLE = new Set(['.git', '.DS_Store', 'Thumbs.db']);

const ROOT_SCRIPT = `#!/usr/bin/env node
try {
    require('@msilabs/alo/cli');
} catch (e) {
    if (
        e.code === 'MODULE_NOT_FOUND' &&
        String(e.message).includes('@msilabs/alo')
    ) {
        console.error('Alo ইনস্টল করা নেই। আগে \`npm install\` চালাও।');
        process.exit(1);
    }
    throw e;
}
`;

const GITIGNORE = 'node_modules/\ndist/\n.alo/\n';
const GITATTRIBUTES = '*.alo linguist-language=HTML\n';
const VSCODE_SETTINGS = `{
    "files.associations": { "*.alo": "html" },
    "workbench.editor.customLabels.patterns": {
        "**/pages/**/page.alo": "\${dirname} (page)",
        "**/pages/**/layout.alo": "\${dirname} (layout)"
    }
}
`;

function packageName(folder) {
    const name = path
        .basename(folder)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return name || 'my-site';
}

function packageJson(name) {
    const data = {
        name,
        private: true,
        engines: { node: '>=22' },
        scripts: { dev: 'alo dev', build: 'alo build' },
        devDependencies: { '@msilabs/alo': `^${version}` },
    };
    return JSON.stringify(data, null, 4) + '\n';
}

function writeNew(file, contents) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
}

function init(cwd, folder = '.') {
    const target = path.resolve(cwd, folder);
    if (fs.existsSync(target)) {
        if (!fs.statSync(target).isDirectory()) {
            throw new AloError({ message: `\`${folder}\` একটা ফাইল, ফোল্ডার নয়।`, hint: 'নতুন প্রজেক্টের জন্য অন্য নাম দাও।' });
        }
        const contents = fs.readdirSync(target).filter((name) => !IGNORABLE.has(name));
        if (contents.length > 0) {
            throw new AloError({
                message: `\`${folder}\` ফোল্ডারটা খালি নয়, তাই এখানে নতুন প্রজেক্ট বানানো হলো না।`,
                hint: 'নতুন নাম দাও, যেমন `npx @msilabs/alo init my-site`, অথবা একটা খালি ফোল্ডারে চালাও।',
            });
        }
    }

    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(TEMPLATE_DIR, target, { recursive: true });
    writeNew(path.join(target, 'alo'), ROOT_SCRIPT);
    fs.chmodSync(path.join(target, 'alo'), 0o755);
    writeNew(path.join(target, 'package.json'), packageJson(packageName(target)));
    writeNew(path.join(target, '.gitignore'), GITIGNORE);
    writeNew(path.join(target, '.gitattributes'), GITATTRIBUTES);
    writeNew(path.join(target, '.vscode', 'settings.json'), VSCODE_SETTINGS);

    const relative = path.relative(cwd, target);
    const steps = [];
    if (relative) steps.push(`cd ${relative.includes(' ') ? JSON.stringify(relative) : relative}`);
    steps.push('npm install', 'node alo dev');
    log.success(`নতুন Alo প্রজেক্ট তৈরি হলো: ${relative || '.'}`);
    log.info(`\nএরপর চালাও:\n${steps.map((step) => '  ' + step).join('\n')}\n`);
}

// ---------------------------------------------------------------- alo new

const PLAIN = /^[a-z0-9-]+$/;
const GROUP = /^\([a-z0-9-]+\)$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const KINDS = ['page', 'layout', 'component', 'post'];

function usage(kind) {
    return {
        page: '`alo new page blog/first-post`',
        layout: '`alo new layout blog`',
        component: '`alo new component Card` অথবা `alo new component blog/PostCard`',
        post: '`alo new post blog/hello-world`',
    }[kind];
}

function splitName(name) {
    return String(name)
        .replace(/\\/g, '/')
        .split('/')
        .filter((part) => part !== '' && part !== '.');
}

function checkPageSegments(segments, kind) {
    segments.forEach((segment, i) => {
        if (PLAIN.test(segment) || GROUP.test(segment)) return;
        if (segment === '[slug]' && kind === 'page' && i === segments.length - 1) return;
        throw new AloError({
            message: `ফোল্ডারের নাম \`${segment}\` চলবে না।`,
            hint:
                segment === '[slug]'
                    ? '`[slug]` থাকে শুধু পেইজের পাথের শেষে, যেমন `alo new page blog/[slug]`।'
                    : 'নামে শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা আর হাইফেন চলে; রাউট গ্রুপ হলে `(name)`।',
        });
    });
}

function urlOf(segments) {
    const visible = segments.filter((segment) => !GROUP.test(segment));
    return '/' + visible.map((segment) => segment + '/').join('');
}

function pageTemplate(segments) {
    if (segments[segments.length - 1] === '[slug]') {
        return `<head>
    <title>{{ item.title }}</title>
</head>

<template>
    <article>
        <h1>{{ item.title }}</h1>
        {{{ item.body }}}
    </article>
</template>
`;
    }
    const title = segments.filter((s) => !GROUP.test(s)).pop()?.replace(/-/g, ' ') || 'হোম';
    return `<head>
    <title>${title}</title>
</head>

<template>
    <h1>${title}</h1>
</template>
`;
}

const LAYOUT_TEMPLATE = `<template>
    <slot />
</template>
`;

function componentTemplate(name) {
    const className = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    return `<template>
    <div class="${className}">
        <slot />
    </div>
</template>
`;
}

function today() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Returns { file, contents, note } for one `alo new` request.
function plan(kind, name) {
    const segments = splitName(name);

    if (kind === 'page') {
        checkPageSegments(segments, 'page');
        const file = ['pages', ...segments, 'page.alo'].join('/');
        const last = segments[segments.length - 1];
        const note = last === '[slug]' ? `ডেটা রাখো \`data/${segments.slice(0, -1).filter((s) => !GROUP.test(s)).join('/')}/\`-এ` : `URL: ${urlOf(segments)}`;
        return { file, contents: pageTemplate(segments), note };
    }

    if (kind === 'layout') {
        checkPageSegments(segments, 'layout');
        return { file: ['pages', ...segments, 'layout.alo'].join('/'), contents: LAYOUT_TEMPLATE, note: `${urlOf(segments)}-এর নিচের সব পেইজে খাটে` };
    }

    if (kind === 'component') {
        const componentName = segments.pop();
        if (!componentName || !PASCAL.test(componentName)) {
            const fixed = (componentName ?? '').replace(/(^|[-_ ]+)([a-zA-Z0-9])/g, (_, __, ch) => ch.toUpperCase());
            throw new AloError({
                message: `কম্পোনেন্টের নাম \`${componentName ?? ''}\` PascalCase নয়।`,
                hint: PASCAL.test(fixed) ? `যেমন \`${fixed}\`: বড় হাতে শুরু, শব্দগুলো জোড়া।` : 'বড় হাতে শুরু করো, যেমন `Card` বা `PostCard`।',
            });
        }
        for (const folder of segments) {
            if (!PLAIN.test(folder)) {
                throw new AloError({ message: `ফোল্ডারের নাম \`${folder}\` চলবে না।`, hint: 'কম্পোনেন্টের ফোল্ডারের নাম ছোট হাতের kebab-case, যেমন `blog` বা `post-list`।' });
            }
        }
        const tag = [...segments.map((s) => s.replace(/(^|-)([a-z0-9])/g, (_, __, ch) => ch.toUpperCase())), componentName].join('.');
        return { file: ['components', ...segments, componentName + '.alo'].join('/'), contents: componentTemplate(componentName), note: `ব্যবহার: <${tag} />` };
    }

    // post
    const slug = segments.pop();
    if (segments.length === 0 || !slug) {
        throw new AloError({ message: 'লেখার জন্য ফোল্ডার আর নাম দুটোই দাও।', hint: usage('post') });
    }
    for (const part of [...segments, slug]) {
        if (!PLAIN.test(part)) {
            throw new AloError({ message: `নাম \`${part}\` চলবে না।`, hint: 'শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা আর হাইফেন, যেমন `blog/hello-world`।' });
        }
    }
    const file = ['data', ...segments, `${today()}-${slug}.md`].join('/');
    const contents = `---\ntitle: ${slug.replace(/-/g, ' ')}\ndraft: true\n---\n\nএখানে লেখা শুরু করো।\n`;
    return { file, contents, note: 'খসড়া: `draft: true` সরালে build-এ আসবে' };
}

function create(cwd, args) {
    const [kind, name] = args;
    if (!kind) {
        throw new AloError({ message: 'কী বানাতে হবে বলো।', hint: KINDS.map((k) => usage(k)).join('\n') });
    }
    if (!KINDS.includes(kind)) {
        const close = suggest(kind, KINDS);
        throw new AloError({
            message: `\`alo new ${kind}\` বলে কিছু নেই।`,
            hint: (close ? `তুমি কি \`alo new ${close}\` বোঝাতে চেয়েছিলে?\n` : '') + `বানানো যায়: ${KINDS.map((k) => `\`${k}\``).join(', ')}।`,
        });
    }
    // `alo new page .` is allowed and makes the home page; every other kind needs a real name.
    if (name === undefined || (kind !== 'page' && splitName(name).length === 0)) {
        throw new AloError({ message: `\`alo new ${kind}\`-এর পরে একটা নাম দাও।`, hint: `যেমন: ${usage(kind)}` });
    }
    if (!fs.existsSync(path.join(cwd, 'pages'))) {
        throw new AloError({ message: 'এখানে `pages/` ফোল্ডার নেই। তুমি কি প্রজেক্টের রুট ফোল্ডারে আছো?', hint: 'নতুন প্রজেক্টের জন্য `npx @msilabs/alo init`।' });
    }

    const { file, contents, note } = plan(kind, name);
    const target = path.join(cwd, ...file.split('/'));

    // A post with the same slug (whatever its date) would clash at build time.
    if (kind === 'post' && fs.existsSync(path.dirname(target))) {
        const slug = path.basename(file).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
        const twin = fs.readdirSync(path.dirname(target)).find((entry) => entry.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(md|json)$/, '') === slug);
        if (twin) {
            throw new AloError({ message: `\`${slug}\` নামে লেখা আগে থেকেই আছে: \`${path.posix.join(path.posix.dirname(file), twin)}\`।`, hint: 'অন্য নাম দাও; তারিখ আলাদা হলেও slug একই হলে URL মিলে যায়।' });
        }
    }

    if (fs.existsSync(target)) {
        throw new AloError({ message: `\`${file}\` আগে থেকেই আছে, তাই নতুন করে বানানো হলো না।`, hint: 'অন্য নাম দাও, অথবা ফাইলটা নিজে খুলে বদলাও।' });
    }
    writeNew(target, contents);
    log.success(`তৈরি হলো: ${file}`);
    log.dim(`  ${note}`);
}

module.exports = { init, create, plan, packageName };
