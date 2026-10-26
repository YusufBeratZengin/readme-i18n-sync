import { spawnSync } from 'node:child_process';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, cp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runCli, parseArgs } from '../src/cli.js';

describe('CLI', () => {
  test('parseArgs parses flags and options correctly', () => {
    const opts = parseArgs([
      'check',
      '--format=json',
      '--fix-code-blocks',
      '--no-git',
      '--config=custom.json',
      'README.tr.md'
    ]);

    assert.equal(opts.command, 'check');
    assert.equal(opts.format, 'json');
    assert.equal(opts.fixCodeBlocks, true);
    assert.equal(opts.noGit, true);
    assert.equal(opts.config, 'custom.json');
    assert.deepEqual(opts.files, ['README.tr.md']);
  });

  test('--help outputs usage and returns 0', async () => {
    let out = '';
    const code = await runCli(['--help'], {
      stdout: msg => { out += msg; },
      stderr: () => {}
    });

    assert.equal(code, 0);
    assert.ok(out.includes('readme-i18n-sync'));
    assert.ok(out.includes('--fix-code-blocks'));
  });

  test('--version outputs version and returns 0', async () => {
    let out = '';
    const code = await runCli(['--version'], {
      stdout: msg => { out += msg; },
      stderr: () => {}
    });

    assert.equal(code, 0);
    assert.ok(out.includes('0.1.0'));
  });

  test('check against synced fixture returns 0', async () => {
    let out = '';
    const source = resolve('test/fixtures/basic/README.md');
    const target = resolve('test/fixtures/basic/README.tr.md');

    const code = await runCli([
      'check',
      `--source=${source}`,
      `--target=${target}`,
      '--no-git'
    ], {
      stdout: msg => { out += msg; },
      stderr: () => {}
    });

    assert.equal(code, 0);
    assert.ok(out.includes('[OK]'));
    assert.ok(out.includes('1 synced, 0 with drift'));
  });

  test('check against drifting fixture returns 1 in strict mode', async () => {
    let out = '';
    const source = resolve('test/fixtures/basic/README.md');
    const target = resolve('test/fixtures/basic/README.es.md');

    const code = await runCli([
      'check',
      `--source=${source}`,
      `--target=${target}`,
      '--no-git'
    ], {
      stdout: msg => { out += msg; },
      stderr: () => {}
    });

    assert.equal(code, 1);
    assert.ok(out.includes('[DRIFT]'));
    assert.ok(out.includes('with drift'));
  });

  test('--json flag produces structured JSON output', async () => {
    let out = '';
    const source = resolve('test/fixtures/basic/README.md');
    const target = resolve('test/fixtures/basic/README.es.md');

    await runCli([
      'check',
      `--source=${source}`,
      `--target=${target}`,
      '--json',
      '--no-git'
    ], {
      stdout: msg => { out += msg; },
      stderr: () => {}
    });

    const parsed = JSON.parse(out);
    assert.equal(parsed.version, '0.1.0');
    assert.equal(parsed.summary.allSynced, false);
    assert.ok(parsed.pairs[0].issues.length > 0);
  });

  test('--github flag produces GitHub Actions annotations', async () => {
    let out = '';
    const source = resolve('test/fixtures/basic/README.md');
    const target = resolve('test/fixtures/basic/README.es.md');

    await runCli([
      'check',
      `--source=${source}`,
      `--target=${target}`,
      '--github',
      '--no-git'
    ], {
      stdout: msg => { out += msg; },
      stderr: () => {}
    });

    assert.ok(out.includes('::warning file='));
    assert.ok(out.includes('title=i18n-sync drift'));
  });

  test('--fix-code-blocks fixes code blocks in target file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cli-fix-test-'));
    try {
      await cp(resolve('test/fixtures/basic'), tempDir, { recursive: true });
      const source = join(tempDir, 'README.md');
      const target = join(tempDir, 'README.es.md');

      let out = '';
      let error = '';
      const code = await runCli([
        'check',
        `--source=${source}`,
        `--target=${target}`,
        '--fix-code-blocks',
        '--no-git'
      ], {
        stdout: msg => { out += msg; },
        stderr: msg => { error += msg; }
      });

      assert.equal(error, '');
      assert.equal(code, 1, 'code fixes leave other structural drift to report');
      assert.match(out, /Fixed code blocks: 2/);
      const updated = await readFile(target, 'utf8');
      assert.ok(updated.includes('npm install sample-pkg'));
      assert.ok(updated.includes('verbose: true'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('returns 0 and informative output when no translation pairs exist', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cli-empty-'));
    const previousCwd = process.cwd();
    try {
      process.chdir(tempDir);
      let outText = '';
      const codeText = await runCli(['check', '--no-git'], {
        stdout: msg => { outText += msg; },
        stderr: () => {}
      });
      assert.equal(codeText, 0);
      assert.equal(outText, 'No translation pairs found.');

      let outJson = '';
      const codeJson = await runCli(['check', '--no-git', '--format', 'json'], {
        stdout: msg => { outJson += msg; },
        stderr: () => {}
      });
      assert.equal(codeJson, 0);
      const parsed = JSON.parse(outJson);
      assert.equal(parsed.summary.pairsChecked, 0);
      assert.equal(parsed.summary.allSynced, true);
      assert.deepEqual(parsed.pairs, []);
    } finally {
      process.chdir(previousCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

const cli = resolve('bin/i18n-sync.js');
for (const [name, args, expected, pattern] of [
  ['synced', ['--source', 'README.md', '--target', 'README.tr.md'], 0, /\[OK\]/],
  ['drift', [], 1, /\[DRIFT\]/],
  ['strict', ['--strict'], 1, /\[DRIFT\]/],
  ['warn only', ['--warn-only'], 0, /\[DRIFT\]/],
  ['legacy no strict', ['--no-strict'], 0, /\[DRIFT\]/],
  ['unknown flag', ['--typo'], 2, /Unknown option/],
  ['bad format', ['--format', 'xml'], 2, /--format/],
  ['missing argument', ['--config'], 2, /requires a value/],
  ['missing target', ['--source', 'README.md'], 2, /--source and --target/],
  ['bad duration', ['--staleness-grace', 'later'], 2, /--staleness-grace/]
]) {
  test(`CLI exit table: ${name}`, () => {
    const result = spawnSync(process.execPath, [cli, 'check', '--no-git', ...args], {
      cwd: resolve('test/fixtures/basic'), encoding: 'utf8'
    });
    assert.ifError(result.error);
    assert.equal(result.status, expected);
    assert.match(expected === 2 ? result.stderr : result.stdout, pattern);
    if (expected === 2) {
      assert.equal(result.stdout, '');
      assert.equal(result.stderr.trim().split('\n').length, 1);
      assert.doesNotMatch(result.stderr, /\n\s+at /);
    }
  });
}
for (const [duration, seconds] of [['30s', 30], ['10m', 600], ['2h', 7200], ['3d', 259200]]) {
  test(`CLI duration ${duration}`, () => {
    assert.equal(parseArgs(['--staleness-grace', duration]).stalenessGrace, seconds);
    assert.equal(parseArgs([`--staleness-grace=${duration}`]).stalenessGrace, seconds);
  });
}
test('malformed config exits 2 with one error line and no stack', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cli-config-'));
  try {
    await writeFile(join(dir, '.i18n-sync.json'), '{ broken');
    const result = spawnSync(process.execPath, [cli, 'check'], { cwd: dir, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Error: .*configuration/);
    assert.equal(result.stderr.trim().split('\n').length, 1);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('CLI dry-run prints planned fixes and leaves target bytes unchanged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cli-dry-run-'));
  try {
    await cp(resolve('test/fixtures/basic'), dir, { recursive: true });
    const target = join(dir, 'README.es.md');
    const before = await readFile(target);
    const result = spawnSync(process.execPath, [cli, 'check', '--no-git', '--fix-code-blocks', '--dry-run'], { cwd: dir, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Would update 2 code block\(s\) in README.es.md/);
    assert.deepEqual(await readFile(target), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
