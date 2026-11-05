'use strict';

const { AloError } = require('./errors.js');
const { parseSfc } = require('./sfc.js');
const { renderNodes, escapeHtml } = require('./render.js');
const { findRoutes } = require('./routes.js');
const { mergeHeads } = require('./head.js');
const { scanComponents, propUsage, referencedComponents } = require('./components.js');
const { createData } = require('./data.js');
const { scopeAttribute } = require('./css-scope.js');
const { scanGlobal, buildStyle, blockText, buildGlobalScript, buildComponentScript, buildPageScript } = require('./assets.js');

const STYLE_PATH = 'assets/style.css';
const GLOBAL_SCRIPT_PATH = 'assets/global.js';
const COMPONENT_SCRIPT_PATH = 'assets/components.js';

function renderDocument({ lang, head, body, stylesheet, scripts }) {
    const lines = ['<!DOCTYPE html>', `<html lang="${escapeHtml(lang)}">`, '<head>', ...head];
    if (stylesheet) lines.push(`<link rel="stylesheet" href="${stylesheet}">`);
    lines.push('</head>', '<body>');
    if (body) lines.push(body);
    for (const src of scripts) lines.push(`<script src="${src}"></script>`);
    lines.push('</body>', '</html>', '');
    return lines.join('\n');
}

// The name of a route's page script: / → index, /about/ → about, /docs/intro/ → docs__intro,
// every page of pages/blog/[slug]/ → blog__slug, not-found → 404.
function scriptName(route) {
    if (route.output === '404.html') return '404';
    const segments = route.dynamic ? [...route.dynamic.prefix, 'slug'] : route.path.split('/').filter(Boolean);
    return segments.length > 0 ? segments.join('__') : 'index';
}

// Drops only the blank lines around a block, so every line keeps the same indentation.
function trimBlock(html) {
    return html.replace(/^\s*\n/, '').trimEnd();
}

function createProject(reader, warn) {
    const components = scanComponents(reader, warn);
    const sfcCache = new Map();
    const usageCache = new Map();

    function loadSfc(file, kind) {
        if (!sfcCache.has(file)) {
            const sfc = parseSfc(reader.read(file), file, kind);
            sfc.scopeAttr = blockText(sfc.style).trim() ? scopeAttribute(file) : null;
            sfcCache.set(file, sfc);
        }
        return sfcCache.get(file);
    }

    return {
        components,
        loadSfc,
        loadComponent: (entry) => loadSfc(entry.file, 'component'),
        usage(sfc) {
            if (!usageCache.has(sfc.file)) usageCache.set(sfc.file, propUsage(sfc));
            return usageCache.get(sfc.file);
        },
    };
}

// Renders one route: the page, then each layout around it from the nearest outwards.
// Heads merge in the opposite order: root layout → inner layouts → page.
// `item` is set only on pages made from a `[slug]` route.
function renderRoute(route, kind, options, item) {
    const { project, warn, base, data, stylesheet, scripts } = options;
    const scope = { data, route: Object.freeze({ path: route.path }), base };
    if (item !== undefined) scope.item = item;

    const page = project.loadSfc(route.file, kind);
    const layouts = route.layouts.map((file) => project.loadSfc(file, 'layout'));

    // Head elements cannot be styled, so they never get the scope attribute.
    const context = (sfc, slot, inHead = false) => ({
        file: sfc.file,
        source: sfc.source,
        scope,
        warn,
        project,
        slot,
        stack: [],
        inPlainTemplate: false,
        scopeAttr: inHead ? null : sfc.scopeAttr,
        scripted,
    });
    const scripted = new Set();

    let body = page.template ? renderNodes(page.template.children, context(page, undefined)) : '';
    for (const layout of [...layouts].reverse()) {
        body = renderNodes(layout.template.children, context(layout, { html: body }));
    }

    const heads = [...layouts, page].map((sfc) => (sfc.head ? renderNodes(sfc.head.children, context(sfc, undefined, true)) : ''));

    // A page loads components.js only if it rendered a component with a script, and its own
    // page script only if one of its files has a <script>.
    const sources = [];
    if (scripts.global) sources.push(scripts.global);
    if (scripted.size > 0) sources.push(scripts.components);
    const pageScript = scripts.page(route, [...layouts, page]);
    if (pageScript) sources.push(pageScript);

    return renderDocument({
        lang: data.site?.lang ?? 'bn',
        head: mergeHeads(heads, data.site?.name ?? 'Alo'),
        body: trimBlock(body),
        stylesheet,
        scripts: sources,
    });
}

// `site.url` is only the origin; a sub-path belongs to `--base`.
function checkSiteUrl(site) {
    if (!site || typeof site.url !== 'string') return;
    const file = 'data/site.json';
    let url;
    try {
        url = new URL(site.url);
    } catch {
        throw new AloError({ file, message: `\`url\`-এর মান \`${site.url}\` সঠিক URL নয়।`, hint: 'পুরো origin লেখো, যেমন `"https://example.com"`।' });
    }
    if (!/^https?:$/.test(url.protocol) || url.pathname !== '/' || url.search || url.hash || site.url.endsWith('/')) {
        const hint = url.pathname !== '/' ? `পাথ \`--base\` দিয়ে দাও: \`url\`-এ লেখো \`"${url.origin}"\`, আর বিল্ড করো \`--base ${url.pathname}\`।` : `শুধু origin লেখো, শেষে \`/\` ছাড়া: \`"${url.origin}"\`।`;
        throw new AloError({ file, message: '`url`-এ শুধু সাইটের origin থাকে।', hint });
    }
}

// A component counts as used if any page or layout reaches it, even inside an `if` branch that is false right now.
// Returns the used components' parsed files and warns about the rest.
function findUsedComponents(project, roots, warn) {
    const used = new Set();
    const queue = [...roots];
    while (queue.length > 0) {
        const sfc = queue.pop();
        const nodes = [...(sfc.head?.children ?? []), ...(sfc.template?.children ?? [])];
        for (const name of referencedComponents(nodes)) {
            const entry = project.components.get(name);
            if (!entry || used.has(name)) continue;
            used.add(name);
            queue.push(project.loadComponent(entry));
        }
    }

    for (const entry of project.components.values()) {
        if (!used.has(entry.name)) {
            warn({ file: entry.file, message: `\`<${entry.name}>\` কোথাও ব্যবহার হয়নি।`, hint: 'দরকার না থাকলে ফাইলটা মুছে ফেলো।' });
        }
    }
    return [...used].map((name) => {
        const sfc = project.loadComponent(project.components.get(name));
        sfc.componentName = name;
        return sfc;
    });
}

// reader: { exists(path), read(path), list(dir) } with POSIX paths relative to the project root.
// Returns the output files instead of writing them, so core never touches the disk.
function compile({ reader, mode = 'build', base = '/' }) {
    const warnings = [];
    const seen = new Set();
    const files = [];

    // The same template line inside a loop would otherwise warn once per item.
    function warn(diagnostic) {
        const key = [diagnostic.file, diagnostic.line, diagnostic.column, diagnostic.message].join('\n');
        if (seen.has(key)) return;
        seen.add(key);
        warnings.push(diagnostic);
    }

    try {
        const project = createProject(reader, warn);
        const { data, collection } = createData(reader, { mode, warn });
        checkSiteUrl(data.site);
        const { pages, notFound } = findRoutes(reader, warn);

        // Every page, layout and used component is known before rendering, so the stylesheet can be built first.
        const roots = new Set();
        for (const route of notFound ? [...pages, notFound] : pages) {
            roots.add(project.loadSfc(route.file, route === notFound ? 'not-found' : 'page'));
            for (const layout of route.layouts) roots.add(project.loadSfc(layout, 'layout'));
        }
        const components = findUsedComponents(project, roots, warn);
        const globals = scanGlobal(reader, warn);
        const css = buildStyle({ reader, globals: globals.css, sfcs: [...roots, ...components] });
        if (css) files.push({ path: STYLE_PATH, contents: css });

        const globalScript = buildGlobalScript(reader, globals.js);
        if (globalScript) files.push({ path: GLOBAL_SCRIPT_PATH, contents: globalScript });
        const componentScript = buildComponentScript(components.map((sfc) => ({ name: sfc.componentName, sfc })));
        if (componentScript) files.push({ path: COMPONENT_SCRIPT_PATH, contents: componentScript });

        // All pages of a [slug] route share one page script, so each file is built once.
        const pageScripts = new Map();
        const scripts = {
            global: globalScript ? '/' + GLOBAL_SCRIPT_PATH : null,
            components: '/' + COMPONENT_SCRIPT_PATH,
            page(route, sfcs) {
                const path = `assets/pages/${scriptName(route)}.js`;
                if (!pageScripts.has(path)) {
                    const code = buildPageScript(sfcs);
                    pageScripts.set(path, code);
                    if (code) files.push({ path, contents: code });
                }
                return pageScripts.get(path) ? '/' + path : null;
            },
        };

        const options = { project, warn, mode, base, data, stylesheet: css ? '/' + STYLE_PATH : null, scripts };
        const sources = new Map(pages.filter((page) => !page.dynamic).map((page) => [page.output, page.file]));

        const emit = (route, item) => files.push({ path: route.output, contents: renderRoute(route, 'page', options, item) });

        for (const page of pages) {
            if (!page.dynamic) {
                emit(page);
                continue;
            }
            for (const { item, file } of collection(page.dynamic.dataDir, page.file)) {
                const prefix = page.dynamic.prefix.map((segment) => segment + '/').join('');
                const output = `${prefix}${item.slug}/index.html`;
                if (sources.has(output)) {
                    throw new AloError({
                        file,
                        message: `\`dist/${output}\` দুই জায়গা থেকে তৈরি হচ্ছে: \`${sources.get(output)}\` আর \`${file}\`।`,
                        hint: 'ডেটা ফাইলের নাম বা স্ট্যাটিক পেইজের ফোল্ডার বদলাও।',
                    });
                }
                sources.set(output, file);
                emit({ ...page, path: '/' + prefix + item.slug + '/', output }, item);
            }
        }

        if (notFound) files.push({ path: notFound.output, contents: renderRoute(notFound, 'not-found', options) });
    } catch (err) {
        if (err instanceof AloError) {
            if (err.file && err.source === undefined && reader.exists(err.file)) err.source = reader.read(err.file);
            err.warnings = warnings;
        }
        throw err;
    }

    return { files, warnings };
}

module.exports = { compile };
