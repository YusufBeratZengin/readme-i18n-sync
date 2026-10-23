import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSyncCheck } from '../src/index.js';

async function withWorkspace(callback) {
  const cwd = await mkdtemp(join(tmpdir(), 'sync-check-'));
  try {
    await callback(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test('missing source and target documents produce distinct file-level errors', async () => {
  await withWorkspace(async cwd => {
    const options = { cwd, noGit: true, source: 'source.md', target: 'target.md', fixCodeBlocks: true };
    const missingSource = await runSyncCheck(options);
    assert.equal(missingSource.allSynced, false);
    assert.equal(missingSource.results[0].issues[0].check, 'files');
    assert.match(missingSource.results[0].issues[0].message, /Source document "source.md" does not exist/);
    assert.deepEqual(missingSource.results[0].summary, { total: 1, warnings: 0, errors: 1 });
    assert.deepEqual(missingSource.plannedChanges, []);
    await writeFile(join(cwd, 'source.md'), '# Source\n');
    const missingTarget = await runSyncCheck(options);
    assert.match(missingTarget.results[0].issues[0].message, /Target translation document "target.md" does not exist/);
    assert.equal(Object.hasOwn(missingTarget.results[0].issues[0], 'line'), false);
    assert.equal(missingTarget.totalFixedBlocks, 0);
  });
});

test('explicit file lists infer sources and fall back to README for unrecognized names', async () => {
  await withWorkspace(async cwd => {
    for (const name of ['README.md', 'README.tr.md', 'notes.md']) {
      await writeFile(join(cwd, name), '# Title\n');
    }
    const result = await runSyncCheck({ cwd, noGit: true, files: ['README.tr.md', 'notes.md'] });
    assert.equal(result.allSynced, true);
    assert.deepEqual(result.results.map(({ sourcePath, targetPath, language }) => ({ sourcePath, targetPath, language })), [
      { sourcePath: 'README.md', targetPath: 'README.tr.md', language: 'tr' },
      { sourcePath: 'README.md', targetPath: 'notes.md', language: 'unknown' }
    ]);
  });
});

test('empty directories return no results and loading a custom config respects disabled checks', async () => {
  await withWorkspace(async cwd => {
    const empty = await runSyncCheck({ cwd, noGit: true });
    assert.equal(empty.allSynced, true);
    assert.deepEqual(empty.results, []);
    await writeFile(join(cwd, 'README.md'), '# Source\n');
    await writeFile(join(cwd, 'README.tr.md'), '## Target\n');
    await writeFile(join(cwd, 'custom.json'), JSON.stringify({ checks: { headings: false } }));
    const configured = await runSyncCheck({ cwd, config: 'custom.json', noGit: true });
    assert.equal(configured.allSynced, true);
    const defaults = await runSyncCheck({ cwd, noGit: true });
    assert.equal(defaults.allSynced, false, 'a previous config must not mutate the defaults');
  });
});

test('fix preflight checks every target before writing the first target', async () => {
  await withWorkspace(async cwd => {
    const source = '# Source\n```js\nnewCode();\n```\n';
    const target = '# Target\n```js\noldCode();\n```\n';
    await writeFile(join(cwd, 'README.md'), source);
    await writeFile(join(cwd, 'README.tr.md'), target);
    // A path that exists but cannot be read as a document makes preflight fail.
    await mkdir(join(cwd, 'README.es.md'));
    await assert.rejects(runSyncCheck({
      cwd, noGit: true, files: ['README.tr.md', 'README.es.md'],
      fixCodeBlocks: true, force: true
    }), /EISDIR|EPERM|illegal operation|directory/i);
    assert.equal(await readFile(join(cwd, 'README.tr.md'), 'utf8'), target,
      'a later preflight error must not cause a partial write');
  });
});
