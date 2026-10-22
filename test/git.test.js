import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getFileCommitInfo, formatDuration, checkStaleness } from '../src/git.js';

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

  test('correctly identifies staleness between commits in a git repo', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'git-test-repo-'));
    try {
      // Initialize a temporary git repository
      await execFileAsync('git', ['init'], { cwd: tempDir });
      await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: tempDir });
      await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });

      // First commit: create translation file with committer date in 2025
      await writeFile(join(tempDir, 'README.tr.md'), '# Başlık\n', 'utf8');
      await execFileAsync('git', ['add', 'README.tr.md'], { cwd: tempDir });
      await execFileAsync('git', ['commit', '-m', 'Add tr doc'], {
        cwd: tempDir,
        env: { ...process.env, GIT_COMMITTER_DATE: '2025-01-01T10:00:00Z', GIT_AUTHOR_DATE: '2025-01-01T10:00:00Z' }
      });

      // Second commit: source updated later with committer date in 2026
      await writeFile(join(tempDir, 'README.md'), '# Title\n## New Section\n', 'utf8');
      await execFileAsync('git', ['add', 'README.md'], { cwd: tempDir });
      await execFileAsync('git', ['commit', '-m', 'Update source doc'], {
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
