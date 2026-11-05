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

module.exports = { VOID_ELEMENTS, RAW_TEXT_ELEMENTS };
