'use strict';

const { AloError } = require('./errors.js');
const { parseSfc } = require('./sfc.js');
const { renderNodes, escapeHtml } = require('./render.js');
const { findRoutes } = require('./routes.js');
const { mergeHeads } = require('./head.js');
const { scanComponents, propUsage, referencedComponents } = require('./components.js');

function renderDocument({ lang, head, body }) {
    const lines = ['<!DOCTYPE html>', `<html lang="${escapeHtml(lang)}">`, '<head>', ...head, '</head>', '<body>'];
    if (body) lines.push(body);
    lines.push('</body>', '</html>', '');
    return lines.join('\n');
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
        if (!sfcCache.has(file)) sfcCache.set(file, parseSfc(reader.read(file), file, kind));
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
function renderRoute(route, kind, options) {
    const { project, warn, base } = options;
    const data = {};
    const scope = { data, route: Object.freeze({ path: route.path }), base };

    const page = project.loadSfc(route.file, kind);
    const layouts = route.layouts.map((file) => project.loadSfc(file, 'layout'));

    const context = (sfc, slot) => ({
        file: sfc.file,
        source: sfc.source,
        scope,
        warn,
        project,
        slot,
        stack: [],
        inPlainTemplate: false,
    });

    let body = page.template ? renderNodes(page.template.children, context(page, undefined)) : '';
    for (const layout of [...layouts].reverse()) {
        body = renderNodes(layout.template.children, context(layout, { html: body }));
    }

    const heads = [...layouts, page].map((sfc) => (sfc.head ? renderNodes(sfc.head.children, context(sfc, undefined)) : ''));

    return {
        sfcs: [...layouts, page],
        html: renderDocument({
            lang: data.site?.lang ?? 'bn',
            head: mergeHeads(heads, data.site?.name ?? 'Alo'),
            body: trimBlock(body),
        }),
    };
}

// A component counts as used if any page or layout reaches it, even inside an `if` branch that is false right now.
function warnUnusedComponents(project, roots, warn) {
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
        const options = { project, warn, mode, base };
        const { pages, notFound } = findRoutes(reader, warn);
        const rendered = new Set();

        for (const page of pages) {
            if (page.dynamic) {
                throw new AloError({ file: page.file, message: 'ডায়নামিক পেইজ (`[slug]`) এখনো তৈরি হয়নি।', hint: 'এটা আসবে ডেটার মাইলস্টোনে।' });
            }
            const { html, sfcs } = renderRoute(page, 'page', options);
            sfcs.forEach((sfc) => rendered.add(sfc));
            files.push({ path: page.output, contents: html });
        }

        if (notFound) {
            const { html, sfcs } = renderRoute(notFound, 'not-found', options);
            sfcs.forEach((sfc) => rendered.add(sfc));
            files.push({ path: notFound.output, contents: html });
        }

        warnUnusedComponents(project, rendered, warn);
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
