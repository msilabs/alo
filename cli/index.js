'use strict';

// Must run before anything else is required, using syntax old Node versions can parse.
const MIN_NODE_MAJOR = 22;
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < MIN_NODE_MAJOR) {
    process.stderr.write(
        '✖ এরর: Alo চালাতে Node.js ' + MIN_NODE_MAJOR + ' বা তার নতুন ভার্সন লাগবে। ' +
            'তোমার আছে v' + process.versions.node + '।\n\n' +
            '  ইঙ্গিত: https://nodejs.org থেকে নতুন LTS ভার্সন ইনস্টল করো।\n',
    );
    process.exit(1);
}

const { AloError, suggest } = require('../core/errors.js');
const log = require('./log.js');
const { version } = require('../package.json');

const COMMANDS = ['init', 'dev', 'build', 'new'];
const FLAGS_BY_COMMAND = {
    init: [],
    dev: ['port', 'base'],
    build: ['base'],
    new: [],
};
const VALUE_FLAGS = ['port', 'base'];

const HELP = `Alo — হালকা স্ট্যাটিক ওয়েব ফ্রেমওয়ার্ক (v${version})

ব্যবহার:
  alo init [folder]                  উদাহরণসহ নতুন প্রজেক্ট
  alo dev [--port 3000] [--base /]   dev সার্ভার + লাইভ রিলোড
  alo build [--base /]               dist/ এ প্রোডাকশন বিল্ড
  alo new page blog/first-post       pages/blog/first-post/page.alo
  alo new layout blog                pages/blog/layout.alo
  alo new component blog/PostCard    components/blog/PostCard.alo
  alo new post blog/hello-world      data/blog/<আজকের তারিখ>-hello-world.md
  alo --help                         এই সাহায্য
  alo --version                      ভার্সন

প্রজেক্টের ভেতরে চালাও: node alo <কমান্ড>`;

function parseArgs(argv) {
    const positionals = [];
    const flags = {};

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--help') {
            flags.help = true;
            continue;
        }
        if (arg === '--version') {
            flags.version = true;
            continue;
        }
        if (!arg.startsWith('-')) {
            positionals.push(arg);
            continue;
        }

        let name = arg.replace(/^-+/, '');
        let value;
        const equals = name.indexOf('=');
        if (equals !== -1) {
            value = name.slice(equals + 1);
            name = name.slice(0, equals);
        }

        if (!VALUE_FLAGS.includes(name)) {
            const close = suggest(name, [...VALUE_FLAGS, 'help', 'version']);
            throw new AloError({
                message: `অজানা ফ্ল্যাগ \`${arg}\`।`,
                hint: close
                    ? `তুমি কি \`--${close}\` বোঝাতে চেয়েছিলে?`
                    : 'Alo-র ফ্ল্যাগ শুধু `--port` আর `--base`। সব দেখতে `alo --help`।',
            });
        }

        if (value === undefined) {
            value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                throw new AloError({
                    message: `\`--${name}\`-এর পরে একটা মান দাও।`,
                    hint: name === 'port' ? 'যেমন: `--port 3000`' : 'যেমন: `--base /my-repo/`',
                });
            }
            i++;
        }
        flags[name] = value;
    }

    return { positionals, flags };
}

function validateFlags(command, flags) {
    for (const name of VALUE_FLAGS) {
        if (flags[name] === undefined) continue;
        if (!FLAGS_BY_COMMAND[command].includes(name)) {
            throw new AloError({
                message: `\`alo ${command}\`-এ \`--${name}\` চলে না।`,
                hint:
                    name === 'port'
                        ? '`--port` শুধু `alo dev`-এ চলে।'
                        : '`--base` শুধু `alo dev` আর `alo build`-এ চলে।',
            });
        }
    }

    if (flags.port !== undefined) {
        const port = Number(flags.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new AloError({
                message: `\`--port\`-এর মান \`${flags.port}\` সঠিক নয়।`,
                hint: '১ থেকে ৬৫৫৩৫-এর মধ্যে একটা পূর্ণসংখ্যা দাও, যেমন `--port 3000`।',
            });
        }
        flags.port = port;
    }
}

async function runCommand(command, args, flags) {
    if (command === 'build') {
        const { build } = require('./build.js');
        await build({ root: process.cwd(), base: flags.base ?? '/' });
        return;
    }
    if (command === 'dev') {
        const { startDevServer } = require('./dev-server.js');
        const server = await startDevServer({ root: process.cwd(), port: flags.port ?? 3000, base: flags.base ?? '/' });
        const stop = () => server.close().then(() => process.exit(0));
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
        return;
    }
    throw new AloError({ message: `\`alo ${command}\` কমান্ড এখনো তৈরি হয়নি।` });
}

async function main(argv) {
    const { positionals, flags } = parseArgs(argv);

    if (flags.version) {
        log.info(version);
        return;
    }

    const [command] = positionals;
    if (flags.help || command === undefined) {
        log.info(HELP);
        return;
    }

    if (!COMMANDS.includes(command)) {
        const close = suggest(command, COMMANDS);
        throw new AloError({
            message: `অজানা কমান্ড \`${command}\`।`,
            hint: close
                ? `তুমি কি \`alo ${close}\` বোঝাতে চেয়েছিলে? সব কমান্ড দেখতে \`alo --help\`।`
                : 'সব কমান্ড দেখতে `alo --help`।',
        });
    }

    validateFlags(command, flags);
    await runCommand(command, positionals.slice(1), flags);
}

main(process.argv.slice(2)).catch((err) => {
    if (err instanceof AloError) {
        log.error(err);
    } else {
        log.bug(err);
    }
    process.exitCode = 1;
});
