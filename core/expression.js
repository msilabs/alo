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
