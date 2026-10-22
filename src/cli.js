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
  --no-git               Disable git commit staleness check
  --source <path>        Manually specify source file
  --target <path>        Manually specify target file
  --version, -v          Show version number
  --help, -h             Show this help message

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
    command: 'check',
    format: 'text',
    fixCodeBlocks: false,
    config: null,
    strict: true,
    noGit: false,
    source: null,
    target: null,
    help: false,
    version: false,
    files: []
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === 'check') {
      options.command = 'check';
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--github') {
      options.format = 'github';
    } else if (arg === '--fix-code-blocks') {
      options.fixCodeBlocks = true;
    } else if (arg === '--no-git') {
      options.noGit = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--no-strict') {
      options.strict = false;
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1];
    } else if (arg === '--format') {
      options.format = args[++i];
    } else if (arg.startsWith('--config=')) {
      options.config = arg.split('=')[1];
    } else if (arg === '--config' || arg === '-c') {
      options.config = args[++i];
    } else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg === '--source') {
      options.source = args[++i];
    } else if (arg.startsWith('--target=')) {
      options.target = arg.split('=')[1];
    } else if (arg === '--target') {
      options.target = args[++i];
    } else if (!arg.startsWith('-')) {
      options.files.push(arg);
    }
    i++;
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

  const options = parseArgs(args);

  if (options.help) {
    stdout(HELP_TEXT.trim());
    return 0;
  }

  if (options.version) {
    stdout(`readme-i18n-sync v${VERSION}`);
    return 0;
  }

  try {
    const { results, totalFixedBlocks, allSynced } = await runSyncCheck({
      cwd: process.cwd(),
      config: options.config,
      fixCodeBlocks: options.fixCodeBlocks,
      files: options.files,
      source: options.source,
      target: options.target,
      noGit: options.noGit
    });

    if (results.length === 0) {
      if (options.format === 'json') {
        stdout(JSON.stringify({ version: VERSION, summary: { pairsChecked: 0, allSynced: true }, pairs: [] }, null, 2));
      } else {
        stdout('No translation pairs found.');
      }
      return 0;
    }

    const output = formatOutput(options.format, results, { fixedCount: totalFixedBlocks });
    stdout(output);

    if (allSynced) {
      return 0;
    }

    return options.strict ? 1 : 0;
  } catch (err) {
    stderr(`Error: ${err.message}`);
    return 1;
  }
}
