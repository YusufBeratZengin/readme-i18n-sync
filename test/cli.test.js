import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
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
      await runCli([
        'check',
        `--source=${source}`,
        `--target=${target}`,
        '--fix-code-blocks',
        '--no-git'
      ], {
        stdout: msg => { out += msg; },
        stderr: () => {}
      });

      const updated = await readFile(target, 'utf8');
      assert.ok(updated.includes('npm install sample-pkg'));
      assert.ok(updated.includes('verbose: true'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
