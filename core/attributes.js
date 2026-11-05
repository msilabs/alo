'use strict';

const { BOOLEAN_ATTRIBUTES } = require('./html-tags.js');

// True when the value has no `{{ }}` and no `\{{` escape, so the source can be copied as-is.
function isStatic(attr) {
    if (attr.value === null) return true;
    return attr.parts.every((part) => part.type === 'text') && attr.parts.map((part) => part.value).join('') === attr.value;
}

// True when the whole value is a single `{{ expr }}`, e.g. `disabled="{{ !ready }}"`.
function isWholeExpression(attr) {
    return attr.value !== null && attr.parts.length === 1 && attr.parts[0].type === 'expr';
}

// Decides what a whole-value `{{ }}` attribute becomes on an HTML element:
// { kind: 'drop' } | { kind: 'bare' } | { kind: 'value', value }
function wholeValueOutcome(name, value) {
    if (value === null || value === undefined) return { kind: 'drop' };
    if (BOOLEAN_ATTRIBUTES.has(name.toLowerCase())) return value ? { kind: 'bare' } : { kind: 'drop' };
    return { kind: 'value', value };
}

module.exports = { isStatic, isWholeExpression, wholeValueOutcome };
