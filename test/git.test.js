import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getFileCommitInfo, formatDuration, checkStaleness } from '../src/git.js';
import { runSyncCheck } from '../src/index.js';

const execFileAsync = promisify(execFile);

describe('Git Staleness', () => {
  test('formatDuration formats relative times correctly', () => {
    assert.equal(formatDuration(45), '45s');
    assert.equal(formatDuration(120), '2m');
    assert.equal(formatDuration(7200), '2h');
    assert.equal(formatDuration(172800), '2d');
  });

  test('gracefully skips when outside git repo or untracked', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'git-test-nonrepo-'));
    try {
      const info = await getFileCommitInfo('nonexistent.md', tempDir);
      assert.equal(info.tracked, false);

      const staleness = await checkStaleness('a.md', 'b.md', tempDir);
      assert.equal(staleness.skipped, true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('gracefully handles untracked files inside an active git repository', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'git-test-untracked-'));
    try {
      await execFileAsync('git', ['init'], { cwd: tempDir });
      await execFileAsync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'init'], { cwd: tempDir });
      await writeFile(join(tempDir, 'source.md'), '# Source\n', 'utf8');
      await writeFile(join(tempDir, 'target.md'), '# Target\n', 'utf8');

      const info = await getFileCommitInfo('source.md', tempDir);
      assert.equal(info.available, true);
      assert.equal(info.tracked, false);
      assert.equal(info.timestamp, null);

      const staleness = await checkStaleness('source.md', 'target.md', tempDir);
      assert.equal(staleness.isStale, false);
      assert.equal(staleness.skipped, true);
      assert.match(staleness.reason, /untracked/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('correctly identifies staleness between commits in a git repo', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'git-test-repo-'));
    try {
      // Initialize a temporary git repository
      await execFileAsync('git', ['init'], { cwd: tempDir });

      // First commit: create translation file with committer date in 2025
      await writeFile(join(tempDir, 'README.tr.md'), '# Başlık\n', 'utf8');
      await execFileAsync('git', ['add', 'README.tr.md'], { cwd: tempDir });
      await execFileAsync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Add tr doc'], {
        cwd: tempDir,
        env: { ...process.env, GIT_COMMITTER_DATE: '2025-01-01T10:00:00Z', GIT_AUTHOR_DATE: '2025-01-01T10:00:00Z' }
      });

      // Second commit: source updated later with committer date in 2026
      await writeFile(join(tempDir, 'README.md'), '# Title\n## New Section\n', 'utf8');
      await execFileAsync('git', ['add', 'README.md'], { cwd: tempDir });
      await execFileAsync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Update source doc'], {
        cwd: tempDir,
        env: { ...process.env, GIT_COMMITTER_DATE: '2026-01-01T10:00:00Z', GIT_AUTHOR_DATE: '2026-01-01T10:00:00Z' }
      });

      const staleness = await checkStaleness('README.md', 'README.tr.md', tempDir);
      assert.equal(staleness.skipped, false);
      assert.equal(staleness.isStale, true);
      assert.ok(staleness.diffSeconds > 0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

for (const [name, gap, grace, expected] of [
  ['same commit', 0, 0, false], ['one second with default grace', 1, 0, true],
  ['within grace', 1, 30, false], ['at grace boundary', 30, 30, false], ['beyond grace', 31, 30, true]
]) {
  test(`staleness: ${name}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'git-grace-'));
    const git = args => execFileAsync('git', args, { cwd: dir });
    const commit = async seconds => {
      const date = new Date(Date.UTC(2025, 0, 1) + seconds * 1000).toISOString();
      await git(['add', '.']);
      await execFileAsync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture'], {
        cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
      });
    };
    try {
      await git(['init']);
      await writeFile(join(dir, 'README.md'), '# Source');
      await writeFile(join(dir, 'README.tr.md'), '# Target');
      await commit(0);
      if (gap) {
        await writeFile(join(dir, 'README.md'), '# Updated source');
        await commit(gap);
      }
      const source = await getFileCommitInfo('README.md', dir);
      const target = await getFileCommitInfo('README.tr.md', dir);
      assert.equal(source.commit === target.commit, gap === 0);
      const result = await checkStaleness('README.md', 'README.tr.md', dir, grace);
      assert.equal(result.skipped, false);
      assert.equal(result.isStale, expected);
      assert.equal(result.diffSeconds, gap);
      const check = await runSyncCheck({ cwd: dir, config: { staleness: { graceSeconds: grace } } });
      assert.equal(check.allSynced, !expected);
      const override = await runSyncCheck({ cwd: dir, config: { staleness: { graceSeconds: 0 } }, stalenessGrace: 30 });
      assert.equal(override.allSynced, gap <= 30);
      if (expected) {
        const issue = check.results[0].issues.find(i => i.check === 'gitStaleness');
        assert.equal(Object.hasOwn(issue, 'line'), false);
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
