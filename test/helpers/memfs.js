'use strict';

// In-memory project reader for core tests. `files` maps POSIX paths to contents.
function createMemoryReader(files) {
    const paths = Object.keys(files);
    const reads = [];

    return {
        reads,
        exists(target) {
            return paths.some((p) => p === target || p.startsWith(target + '/'));
        },
        read(target) {
            if (!(target in files)) throw new Error(`memfs: ${target} নেই`);
            reads.push(target);
            return files[target];
        },
        list(dir) {
            const prefix = dir + '/';
            const entries = new Map();
            for (const p of paths) {
                if (!p.startsWith(prefix)) continue;
                const [name, ...rest] = p.slice(prefix.length).split('/');
                entries.set(name, entries.get(name) || rest.length > 0);
            }
            return [...entries].map(([name, isDirectory]) => ({ name, isDirectory }));
        },
    };
}

module.exports = { createMemoryReader };
