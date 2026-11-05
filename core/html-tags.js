'use strict';

const VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

const BOOLEAN_ATTRIBUTES = new Set([
    'disabled',
    'checked',
    'selected',
    'hidden',
    'required',
    'readonly',
    'open',
    'multiple',
    'autofocus',
    'inert',
    'novalidate',
    'defer',
    'async',
    'controls',
    'loop',
    'muted',
    'playsinline',
    'default',
    'reversed',
    'formnovalidate',
    'itemscope',
    'allowfullscreen',
]);

module.exports = { VOID_ELEMENTS, RAW_TEXT_ELEMENTS, BOOLEAN_ATTRIBUTES };
