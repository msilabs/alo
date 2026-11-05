'use strict';

const { AloError, suggest } = require('./errors.js');

const cache = new Map();

// V8 messages for writes to frozen objects, e.g. `.sort()`, `.push()` or `post.title = 'x'`.
const FROZEN_WRITE = /read only property|not extensible|Cannot delete property|Cannot redefine property|Cannot define property/;

function compileExpression(code, names, location) {
    const key = names.join(',') + '\n' + code;
    let fn = cache.get(key);
    if (fn) return fn;

    try {
        // The newline before `)` keeps a trailing `// comment` from swallowing the parenthesis.
        fn = new Function(...names, `"use strict";\nreturn (${code}\n);`);
    } catch (err) {
        throw new AloError({
            ...location,
            message: `এক্সপ্রেশনটা বোঝা যাচ্ছে না: \`${code}\``,
            hint: `JavaScript বলছে: ${err.message}`,
        });
    }
    cache.set(key, fn);
    return fn;
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// For "Cannot read properties of undefined (reading 'slug')", finds which chain such as
// `post` or `data.blog` was empty by re-evaluating each candidate in front of `.slug`.
function findEmptyOwner(code, property, scope, names) {
    const pattern = new RegExp(`([A-Za-z_$][\\w$]*(?:\\??\\.[A-Za-z_$][\\w$]*)*)\\s*\\??\\.\\s*${escapeRegExp(property)}\\b`, 'g');
    for (const match of code.matchAll(pattern)) {
        try {
            const value = new Function(...names, `"use strict";\nreturn (${match[1]}\n);`)(...names.map((name) => scope[name]));
            if (value === undefined || value === null) return match[1];
        } catch {
            // Not a readable chain on its own; try the next candidate.
        }
    }
    return null;
}

// location: { file, line, column, source } — used only for error messages.
function evaluate(code, scope, location) {
    const names = Object.keys(scope);
    const fn = compileExpression(code, names, location);

    try {
        return fn(...names.map((name) => scope[name]));
    } catch (err) {
        if (err instanceof AloError) {
            // Errors raised deep inside data proxies do not know where the expression is.
            if (!err.file) Object.assign(err, location);
            throw err;
        }

        const missing = err instanceof ReferenceError && /^(\S+) is not defined$/.exec(err.message);
        if (missing) {
            const close = suggest(missing[1], names);
            const available = names.map((name) => `\`${name}\``).join(', ');
            throw new AloError({
                ...location,
                message: `\`${missing[1]}\` নামে কোনো ভেরিয়েবল নেই।`,
                hint: (close ? `তুমি কি \`${close}\` বোঝাতে চেয়েছিলে? ` : '') + `এখানে আছে: ${available}।`,
            });
        }

        const unreadable = err instanceof TypeError && /^Cannot read properties of (undefined|null) \(reading '(.+)'\)$/.exec(err.message);
        if (unreadable) {
            const [, empty, property] = unreadable;
            const owner = findEmptyOwner(code, property, scope, names);
            throw new AloError({
                ...location,
                message: owner
                    ? `\`${owner}\` হলো \`${empty}\`, তাই \`.${property}\` পড়া যায় না।`
                    : `\`${empty}\` থেকে \`.${property}\` পড়া যায় না।`,
                hint: `মান না-ও থাকতে পারলে \`?.\` লেখো, যেমন \`${owner ?? 'x'}?.${property}\`। কম্পোনেন্টে হলে প্রপটা পাঠানো হয়েছে কিনা দেখো।`,
            });
        }

        if (err instanceof TypeError && FROZEN_WRITE.test(err.message)) {
            throw new AloError({
                ...location,
                message: `ডেটা বদলানো যায় না: \`${code}\``,
                hint: 'নতুন মান বানাও: `toReversed()`, `toSorted()` বা `slice()` ব্যবহার করো।',
            });
        }

        throw new AloError({
            ...location,
            message: `এক্সপ্রেশন চালাতে গিয়ে এরর: ${err.message}`,
            hint: `এক্সপ্রেশন: \`${code}\``,
        });
    }
}

module.exports = { evaluate };
