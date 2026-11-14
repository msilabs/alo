'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { plan, packageName, TEMPLATES, TEMPLATE_NAMES } = require('../cli/scaffold.js');
const { version } = require('../package.json');

const REPO = path.join(__dirname, '..');
const BIN = path.join(REPO, 'bin', 'alo.js');

function tempDir(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alo-scaffold-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

function run(cwd, args, script = BIN) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function read(dir, file) {
    return fs.readFileSync(path.join(dir, ...file.split('/')), 'utf8');
}

test('init: every project file and the next steps', (t) => {
    const cwd = tempDir(t);
    const result = run(cwd, ['init', 'My Site']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Created a new Alo project: My Site/);
    assert.match(result.stdout, /cd "My Site"\n {2}npm install\n {2}node alo dev/);

    const dir = path.join(cwd, 'My Site');
    for (const file of ['alo', 'package.json', '.gitignore', '.gitattributes', '.vscode/settings.json', '.vscode/extensions.json', 'pages/page.alo', 'pages/layout.alo', 'pages/blog/[slug]/page.alo', 'components/Header.alo', 'components/Footer.alo', 'components/Card.alo', 'data/site.json', 'data/blog/2026-01-10-hello-world.md', 'public/favicon.svg', 'AGENTS.md']) {
        assert.ok(fs.existsSync(path.join(dir, ...file.split('/'))), file);
    }

    assert.deepEqual(JSON.parse(read(dir, 'package.json')), {
        name: 'my-site',
        private: true,
        engines: { node: '>=22' },
        scripts: { dev: 'alo dev', build: 'alo build' },
        devDependencies: { '@msilabs/alo': `^${version}` },
    });
    assert.match(read(dir, 'alo'), /^#!\/usr\/bin\/env node\ntry \{\n {4}require\('@msilabs\/alo\/cli'\);/);
    assert.equal(read(dir, '.gitignore'), 'node_modules/\ndist/\n.alo/\n');
    assert.equal(read(dir, '.gitattributes'), '*.alo linguist-language=HTML\n');
    const settings = JSON.parse(read(dir, '.vscode/settings.json'));
    assert.equal(settings['files.associations'], undefined, 'it would override the extension’s `alo` language');
    assert.equal(settings['workbench.editor.customLabels.patterns']['**/pages/**/page.alo'], '${dirname} (page)');
    assert.deepEqual(JSON.parse(read(dir, '.vscode/extensions.json')), { recommendations: ['msilabs.alo-vscode'] });
    if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(dir, 'alo')).mode & 0o100, 'the alo file is executable');
});

test('init: package name from the folder name', () => {
    assert.equal(packageName('/x/My Site'), 'my-site');
    assert.equal(packageName('/x/আলো'), 'my-site');
    assert.equal(packageName('/x/blog_2026'), 'blog-2026');
});

test('init: refuses a non-empty folder but allows one with only .git', (t) => {
    const cwd = tempDir(t);
    fs.mkdirSync(path.join(cwd, 'full'));
    fs.writeFileSync(path.join(cwd, 'full', 'notes.txt'), 'x');
    const full = run(cwd, ['init', 'full']);
    assert.equal(full.code, 1);
    assert.match(full.stderr, /is not empty/);
    assert.deepEqual(fs.readdirSync(path.join(cwd, 'full')), ['notes.txt']);

    fs.mkdirSync(path.join(cwd, 'repo', '.git'), { recursive: true });
    assert.equal(run(cwd, ['init', 'repo']).code, 0);
    assert.ok(fs.existsSync(path.join(cwd, 'repo', 'pages', 'page.alo')));
});

test('init: without a name it uses the current empty folder', (t) => {
    const cwd = tempDir(t);
    const result = run(cwd, ['init']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /\n {2}npm install\n/);
    assert.doesNotMatch(result.stdout, /cd /);
    assert.ok(fs.existsSync(path.join(cwd, 'pages', 'page.alo')));
});

test('a new init project builds without errors or warnings', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const result = run(path.join(cwd, 'site'), ['build']);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /Built 5 pages/);
});

test('the root alo file: a clear message before npm install, works after', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');

    const missing = run(dir, ['build'], path.join(dir, 'alo'));
    assert.equal(missing.code, 1);
    assert.equal(missing.stderr.trim(), 'Alo is not installed. Run `npm install` first.');

    // Stands in for `npm install`: node_modules/@msilabs/alo points at this repository.
    fs.mkdirSync(path.join(dir, 'node_modules', '@msilabs'), { recursive: true });
    fs.symlinkSync(REPO, path.join(dir, 'node_modules', '@msilabs', 'alo'), 'junction');
    const built = run(dir, ['build'], path.join(dir, 'alo'));
    assert.equal(built.code, 0, built.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'index.html')));
});

test('plan: the file path for each kind', () => {
    assert.equal(plan('page', 'blog/first-post').file, 'pages/blog/first-post/page.alo');
    assert.equal(plan('page', '(bare)/launch').note, 'URL: /launch/');
    assert.equal(plan('page', '.').file, 'pages/page.alo');
    assert.match(plan('page', 'blog/[slug]').contents, /\{\{\{ item\.body \}\}\}/);
    assert.equal(plan('layout', 'blog').file, 'pages/blog/layout.alo');
    assert.match(plan('layout', 'blog').contents, /<slot \/>/);
    assert.equal(plan('component', 'Card').file, 'components/Card.alo');
    assert.equal(plan('component', 'post-list/Item').note, 'Use it as <PostList.Item />');
    assert.match(plan('component', 'blog/PostCard').contents, /class="post-card"/);
    assert.match(plan('post', 'blog/hello-world').file, /^data\/blog\/\d{4}-\d{2}-\d{2}-hello-world\.md$/);
    assert.match(plan('post', 'blog/hello-world').contents, /^---\ntitle: hello world\ndraft: true\n---\n/);
});

test('new: creates files, and the new pages build', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');

    for (const args of [['page', 'contact'], ['layout', 'blog'], ['component', 'Button'], ['post', 'blog/second'], ['page', '(bare)/launch']]) {
        const result = run(dir, ['new', ...args]);
        assert.equal(result.code, 0, `${args.join(' ')}: ${result.stderr}`);
        assert.match(result.stdout, /✔ Created /);
    }
    assert.match(read(dir, 'pages/contact/page.alo'), /<h1>contact<\/h1>/);
    const build = run(dir, ['build']);
    assert.equal(build.code, 0, build.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'contact', 'index.html')));
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'launch', 'index.html')));
});

test('new: never overwrites an existing file', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');
    const before = read(dir, 'components/Card.alo');
    const result = run(dir, ['new', 'component', 'Card']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`components\/Card\.alo` already exists/);
    assert.equal(read(dir, 'components/Card.alo'), before);
});

test('new: invalid names, duplicate slugs, unknown kinds and running outside a project fail', (t) => {
    const cwd = tempDir(t);
    run(cwd, ['init', 'site']);
    const dir = path.join(cwd, 'site');

    const cases = [
        [['component', 'card'], /is not PascalCase/, /`Card`/],
        [['component', 'Blog/Card'], /Folder name `Blog` is not allowed/, /kebab-case/],
        [['page', 'About'], /Folder name `About` is not allowed/, /lowercase/],
        [['page', 'blog/[slug]/x'], /`\[slug\]` is not allowed/, /last part/],
        [['post', 'blog/hello-world'], /slug `hello-world` already exists/, /slug/],
        [['post', 'hello'], /Give both a folder and a name/, /blog\/hello-world/],
        [['pag', 'x'], /There is no `alo new pag`/, /`alo new page`/],
        [['component'], /`alo new component` needs a name/, /Card/],
        [[], /Tell Alo what to create/, /alo new post/],
    ];
    for (const [args, message, hint] of cases) {
        const result = run(dir, ['new', ...args]);
        assert.equal(result.code, 1, args.join(' '));
        assert.match(result.stderr, message, args.join(' '));
        assert.match(result.stderr, hint, args.join(' '));
    }

    const outside = run(cwd, ['new', 'page', 'x']);
    assert.equal(outside.code, 1);
    assert.match(outside.stderr, /No `pages\/` folder here/);
});

// ---------------------------------------------------------------- init --template

const TEMPLATES_DIR = path.join(REPO, 'templates');
const GENERATED = ['alo', 'package.json', '.gitignore', '.gitattributes', '.vscode/settings.json', '.vscode/extensions.json'];
// Pages each template builds, and one thing to find in its output.
const EXPECTED = {
    default: { pages: 5, file: 'blog/hello-world/index.html', html: /<article/ },
    blank: { pages: 1, file: 'index.html', html: /<h1>আমার সাইট<\/h1>/ },
};
const MAX_TEMPLATE_BYTES = 80 * 1024;

// Every file below `dir`, as sorted forward-slash paths.
function listFiles(dir) {
    return fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .sort();
}

test('templates: the list in the code matches the folders in templates/', () => {
    const folders = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    assert.deepEqual(Object.values(TEMPLATES).sort(), folders.sort());
    assert.deepEqual(TEMPLATE_NAMES.toSorted(), Object.keys(EXPECTED).sort(), 'add the new template to EXPECTED');
    assert.equal(TEMPLATES.default, 'init');
});

for (const name of TEMPLATE_NAMES) {
    test(`template ${name}: init, then a build without errors or warnings`, (t) => {
        const cwd = tempDir(t);
        const created = run(cwd, ['init', 'site', '--template', name]);
        assert.equal(created.code, 0, created.stderr);
        assert.match(created.stdout, /Created a new Alo project: site/);
        if (name === 'default') assert.doesNotMatch(created.stdout, /Template:/);
        else assert.match(created.stdout, new RegExp(`\\n {2}Template: ${name}\\n`));

        const dir = path.join(cwd, 'site');
        for (const file of [...GENERATED, 'AGENTS.md', 'pages/page.alo', 'data/site.json', 'public/favicon.svg']) {
            assert.ok(fs.existsSync(path.join(dir, ...file.split('/'))), file);
        }
        assert.equal(read(dir, 'AGENTS.md'), read(TEMPLATES_DIR, 'init/AGENTS.md'));

        const built = run(dir, ['build']);
        assert.equal(built.code, 0, built.stderr);
        assert.equal(built.stderr, '');
        assert.doesNotMatch(built.stdout, /Unused components|warning/);
        const pages = EXPECTED[name].pages;
        assert.match(built.stdout, new RegExp(`Built ${pages} page${pages === 1 ? '' : 's'}\\b`));
        assert.match(read(dir, 'dist/' + EXPECTED[name].file), EXPECTED[name].html);
    });

    test(`template ${name}: follows the template rules`, () => {
        const dir = path.join(TEMPLATES_DIR, TEMPLATES[name]);
        const files = listFiles(dir);

        const allowed = name === 'default' ? ['AGENTS.md'] : [];
        for (const file of files) {
            if (allowed.includes(file)) continue;
            assert.match(file, /^(pages|components|data|global|public)\//, `${file} is not a site file`);
            assert.doesNotMatch(file, /(^|\/)\./, `${file} is a dotfile`);
        }

        let bytes = 0;
        for (const file of files) {
            bytes += fs.statSync(path.join(dir, file)).size;
            if (file === 'AGENTS.md') continue;
            const text = read(dir, file);
            assert.doesNotMatch(text, /\bsrc\s*=\s*["']?(https?:)?\/\//, `${file} loads a remote file`);
            assert.doesNotMatch(text, /href\s*=\s*["'](https?:)?\/\/[^"']*\.css/, `${file} loads a remote stylesheet`);
            assert.doesNotMatch(text, /url\(\s*["']?(https?:)?\/\//, `${file} loads a remote file from CSS`);
            assert.doesNotMatch(text, /@import/, `${file} uses @import`);
        }
        assert.ok(bytes < MAX_TEMPLATE_BYTES, `${bytes} bytes, the limit is ${MAX_TEMPLATE_BYTES}`);

        const reset = 'global/base/01-reset.css';
        if (files.includes(reset)) assert.equal(read(dir, reset), read(TEMPLATES_DIR, 'init/' + reset));
        assert.equal(read(dir, 'public/favicon.svg'), read(TEMPLATES_DIR, 'init/public/favicon.svg'));
    });
}

test('init: no flag, `--template default` and `--template=default` give the same project', (t) => {
    const cwd = tempDir(t);
    const plain = run(cwd, ['init', 'a']);
    const spaced = run(cwd, ['init', 'b', '--template', 'default']);
    const equals = run(cwd, ['init', '--template=default', 'c']);
    for (const result of [plain, spaced, equals]) {
        assert.equal(result.code, 0, result.stderr);
        assert.doesNotMatch(result.stdout, /Template:/);
    }
    assert.equal(spaced.stdout.replaceAll('b', 'a'), plain.stdout);

    const files = listFiles(path.join(cwd, 'a'));
    assert.deepEqual(listFiles(path.join(cwd, 'b')), files);
    assert.deepEqual(listFiles(path.join(cwd, 'c')), files);
    assert.deepEqual(files.filter((file) => !GENERATED.includes(file)), listFiles(path.join(TEMPLATES_DIR, 'init')));
});

test('init: a folder named like a template is still just a folder', (t) => {
    const cwd = tempDir(t);
    const result = run(cwd, ['init', 'blank']);
    assert.equal(result.code, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Template:/);
    assert.ok(fs.existsSync(path.join(cwd, 'blank', 'pages', 'blog', 'page.alo')));
});

test('init: `--template` without a folder uses the current empty folder', (t) => {
    const cwd = tempDir(t);
    const result = run(cwd, ['init', '--template', 'blank']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Template: blank/);
    assert.doesNotMatch(result.stdout, /cd /);
    assert.deepEqual(listFiles(path.join(cwd, 'pages')), ['page.alo']);
    assert.ok(!fs.existsSync(path.join(cwd, 'components')));
});

test('init: a wrong `--template` fails before anything is written', (t) => {
    const cwd = tempDir(t);
    const list = /Templates: `default`, `blank`/;
    const cases = [
        [['init', 'site', '--template', 'blnk'], /There is no template `blnk`\./, /Did you mean `blank`\?/],
        [['init', 'site', '--template', 'blnk'], /There is no template `blnk`\./, list],
        [['init', 'site', '--template', 'shop'], /There is no template `shop`\./, list],
        [['init', 'site', '--template=user/repo'], /Templates from a repository are not supported\./, list],
        [['init', 'site', '--template', 'github:user/repo'], /Templates from a repository are not supported\./, list],
        [['init', 'site', '--template'], /`--template` needs a value\./, /For example: `--template portfolio`/],
        [['build', '--template', 'blank'], /`--template` does not work with `alo build`\./, /`--template` only works with `alo init`\./],
        [['new', 'page', 'x', '--template', 'blank'], /`--template` does not work with `alo new`\./, /only works with `alo init`/],
    ];
    for (const [args, message, hint] of cases) {
        const result = run(cwd, args);
        assert.equal(result.code, 1, args.join(' '));
        assert.match(result.stderr, message, args.join(' '));
        assert.match(result.stderr, hint, args.join(' '));
        assert.deepEqual(fs.readdirSync(cwd), [], args.join(' '));
    }
    assert.doesNotMatch(run(cwd, ['init', 'site', '--template', 'shop']).stderr, /Did you mean/);
});

test('--help lists every template', (t) => {
    const result = run(tempDir(t), ['--help']);
    assert.match(result.stdout, new RegExp(`\\[--template name\\] +${TEMPLATE_NAMES.join(', ')}\\n`));
});
