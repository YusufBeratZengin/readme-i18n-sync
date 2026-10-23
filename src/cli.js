import { runSyncCheck, formatOutput } from './index.js';

const HELP_TEXT = `readme-i18n-sync — detect when translated documentation drifts from the source

USAGE:
  i18n-sync [command] [options] [files...]

COMMANDS:
  check                  Run synchronization check (default)

OPTIONS:
  --format <type>        Output format: text, json, github (default: text)
  --json                 Shortcut for --format json
  --github               Shortcut for --format github
  --fix-code-blocks      Copy code blocks from source to target where code differs
  --config <path>, -c    Custom config path (default: .i18n-sync.json)
  --strict               Fail with exit code 1 if any warning or drift is found (default)
  --warn-only            Print drift but exit 0 (alias: --no-strict)
  --dry-run              Preview code block fixes without writing
  --force                Allow fixes to targets with uncommitted changes
  --staleness-grace <duration>  Allow a commit gap (30s, 10m, 2h, 3d)
  --no-git               Disable git commit staleness check
  --source <path>        Manually specify source file
  --target <path>        Manually specify target file
  --version, -v          Show version number
  --help, -h             Show this help message

EXIT CODES:
  0 synced (or --warn-only), 1 drift, 2 usage/configuration error

EXAMPLES:
  i18n-sync check
  i18n-sync check --fix-code-blocks
  i18n-sync check --format github
  i18n-sync check README.tr.md
  i18n-sync check --source README.md --target README.zh-CN.md
`;

export const VERSION = '0.1.0';

/**
 * Parse CLI arguments.
 * @param {string[]} args
 * @returns {object}
 */
export function parseArgs(args) {
  const options = {
    command: 'check', format: 'text', fixCodeBlocks: false, config: null,
    strict: true, noGit: false, source: null, target: null,
    help: false, version: false, files: [], dryRun: false, force: false
  };
  const values = { '--format': 'format', '--config': 'config', '-c': 'config', '--source': 'source', '--target': 'target', '--staleness-grace': 'stalenessGrace' };
  const flags = {
    '--help': ['help', true], '-h': ['help', true], '--version': ['version', true], '-v': ['version', true],
    '--json': ['format', 'json'], '--github': ['format', 'github'],
    '--fix-code-blocks': ['fixCodeBlocks', true], '--no-git': ['noGit', true],
    '--strict': ['strict', true], '--no-strict': ['strict', false], '--warn-only': ['strict', false],
    '--dry-run': ['dryRun', true], '--force': ['force', true]
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const equals = arg.indexOf('=');
    const flag = equals === -1 ? arg : arg.slice(0, equals);
    if (arg === '--') { options.files.push(...args.slice(i + 1)); break; }
    if (arg === 'check') continue;
    if (Object.hasOwn(flags, arg)) {
      const [key, value] = flags[arg];
      options[key] = value;
    } else if (Object.hasOwn(values, flag)) {
      const value = equals === -1 ? args[++i] : arg.slice(equals + 1);
      if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value`);
      options[values[flag]] = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else options.files.push(arg);
  }
  if (!['text', 'json', 'github'].includes(options.format)) throw new Error('--format must be text, json, or github');
  if (Boolean(options.source) !== Boolean(options.target)) throw new Error('--source and --target must be used together');
  if (options.stalenessGrace !== undefined) {
    const match = /^(\d+)([smhd])$/.exec(options.stalenessGrace);
    if (!match) throw new Error('--staleness-grace must be a duration such as 30s, 10m, 2h, or 3d');
    options.stalenessGrace = Number(match[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
    if (!Number.isSafeInteger(options.stalenessGrace)) throw new Error('--staleness-grace is too large');
  }
  return options;
}

/**
 * CLI execution entrypoint.
 * @param {string[]} args
 * @param {object} [io]
 * @param {(msg: string) => void} [io.stdout]
 * @param {(msg: string) => void} [io.stderr]
 * @returns {Promise<number>} Exit code
 */
export async function runCli(args = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || (msg => process.stdout.write(msg + '\n'));
  const stderr = io.stderr || (msg => process.stderr.write(msg + '\n'));

  try {
    const options = parseArgs(args);

    if (options.help) {
      stdout(HELP_TEXT.trim());
      return 0;
    }

    if (options.version) {
      stdout(`readme-i18n-sync v${VERSION}`);
      return 0;
    }

    const { results, totalFixedBlocks, plannedChanges, allSynced } = await runSyncCheck({
      cwd: process.cwd(),
      config: options.config,
      fixCodeBlocks: options.fixCodeBlocks,
      files: options.files,
      source: options.source,
      target: options.target,
      noGit: options.noGit,
      stalenessGrace: options.stalenessGrace,
      dryRun: options.dryRun,
      force: options.force
    });

    if (results.length === 0) {
      if (options.format === 'json') {
        stdout(JSON.stringify({ version: VERSION, summary: { pairsChecked: 0, allSynced: true }, pairs: [] }, null, 2));
      } else {
        stdout('No translation pairs found.');
      }
      return 0;
    }

    const output = formatOutput(options.format, results, { fixedCount: totalFixedBlocks, ...(options.dryRun ? { plannedChanges } : {}) });
    stdout(output);

    if (allSynced) {
      return 0;
    }

    return options.strict ? 1 : 0;
  } catch (err) {
    stderr(`Error: ${err.message.replace(/[\r\n]+/g, ' ')}`);
    return 2;
  }
}
