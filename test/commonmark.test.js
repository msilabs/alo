'use strict';

// Runs the CommonMark 0.31.2 spec examples (test/commonmark/spec.json, data only) against core/markdown.js.
// Every example must pass, except those listed in known-differences.json with a reason.
// A listed example that starts passing fails the test too, so the list never goes stale.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderMarkdown } = require('../core/markdown.js');

const dir = path.join(__dirname, 'commonmark');
const spec = JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8'));
const known = JSON.parse(fs.readFileSync(path.join(dir, 'known-differences.json'), 'utf8'));

const sections = new Map();
for (const example of spec) {
    if (known.skippedSections.includes(example.section)) continue;
    if (!sections.has(example.section)) sections.set(example.section, []);
    sections.get(example.section).push(example);
}

for (const [section, examples] of sections) {
    test(`CommonMark: ${section}`, () => {
        for (const example of examples) {
            const actual = renderMarkdown(example.markdown, { headingIds: false });
            const reason = known.examples[example.example];
            if (reason) {
                assert.ok(known.reasons[reason], `#${example.example}: reason "${reason}" is missing from reasons`);
                assert.notEqual(actual, example.html, `#${example.example} passes now; remove it from known-differences.json`);
            } else {
                assert.equal(actual, example.html, `example #${example.example}\n${example.markdown}`);
            }
        }
    });
}
