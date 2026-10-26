import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runSyncCheck } from '../src/index.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixCodeBlocks, fixCodeBlocksInFile } from '../src/fixer.js';

describe('Fixer', () => {
  test('updates target code blocks from source while preserving translated prose', () => {
    const source = `# Title

Here is how you install:

\`\`\`bash
npm install updated-package@2.0.0
\`\`\`

And run it:

\`\`\`javascript
const client = new Client({ timeout: 5000 });
client.connect();
\`\`\`
`;

    const target = `# Başlık

Kurulum şu şekildedir:

\`\`\`bash
npm install old-package@1.0.0
\`\`\`

Ve çalıştırın:

\`\`\`javascript
const client = new Client({ timeout: 1000 });
client.connect();
\`\`\`
`;

    const result = fixCodeBlocks(source, target);
    assert.equal(result.fixed, true);
    assert.equal(result.fixedCount, 2);

    // Verify translated prose is preserved
    assert.ok(result.newContent.includes('# Başlık'));
    assert.ok(result.newContent.includes('Kurulum şu şekildedir:'));
    assert.ok(result.newContent.includes('Ve çalıştırın:'));

    // Verify code was updated
    assert.ok(result.newContent.includes('npm install updated-package@2.0.0'));
    assert.ok(result.newContent.includes('timeout: 5000'));
    assert.ok(!result.newContent.includes('old-package@1.0.0'));
  });

  test('returns fixed=false when code blocks already match', () => {
    const source = `\`\`\`bash\necho "same"\n\`\`\``;
    const target = `\`\`\`bash\necho "same"\n\`\`\``;

    const result = fixCodeBlocks(source, target);
    assert.equal(result.fixed, false);
    assert.equal(result.fixedCount, 0);
  });

  test('returns fixed=false when source or target has no code blocks', () => {
    assert.deepEqual(fixCodeBlocks('# No code', '```js\ncode();\n```'), {
      fixed: false,
      fixedCount: 0,
      newContent: '```js\ncode();\n```'
    });
    assert.deepEqual(fixCodeBlocks('```js\ncode();\n```', '# No code'), {
      fixed: false,
      fixedCount: 0,
      newContent: '# No code'
    });
  });

  test('fixCodeBlocksInFile modifies target file on disk', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'i18n-fix-test-'));
    const sourceFile = join(tempDir, 'source.md');
    const targetFile = join(tempDir, 'target.md');

    try {
      await writeFile(sourceFile, '```bash\necho "new"\n```', 'utf8');
      await writeFile(targetFile, '```bash\necho "old"\n```', 'utf8');

      const res = await fixCodeBlocksInFile(sourceFile, targetFile);
      assert.equal(res.fixed, true);
      assert.equal(res.fixedCount, 1);

      const updated = await readFile(targetFile, 'utf8');
      assert.ok(updated.includes('echo "new"'));
      assert.ok(!updated.includes('echo "old"'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

for (const eol of ['\n', '\r\n']) {
  test(`fixes preserve target ${JSON.stringify(eol)} line endings`, () => {
    const source = '# Source\n\n```js\nnewCode();\nmoreCode();\n```\n';
    const target = ['# Target', '', '```js', 'oldCode();', '```', 'Tail', ''].join(eol);
    const result = fixCodeBlocks(source, target);
    assert.equal(result.fixedCount, 1);
    assert.equal(result.newContent, ['# Target', '', '```js', 'newCode();', 'moreCode();', '```', 'Tail', ''].join(eol));
  });
}
test('fixes refuse dirty git targets, dry-run previews, and force explicitly permits writing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fix-git-'));
  const git = args => promisify(execFile)('git', args, { cwd: dir });
  const target = join(dir, 'README.tr.md');
  try {
    await git(['init']);
    await writeFile(join(dir, 'README.md'), '# Source\n```js\nnewCode();\n```\n');
    await writeFile(target, '# Target\n```js\noldCode();\n```\n');
    await git(['add', '.']);
    await git(['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']);
    await writeFile(target, '# Local edit\r\n```js\r\noldCode();\r\n```\r\n');
    const before = await readFile(target);
    const options = { cwd: dir, noGit: true, fixCodeBlocks: true };
    const dry = await runSyncCheck({ ...options, dryRun: true });
    assert.equal(dry.totalFixedBlocks, 0);
    assert.deepEqual(dry.plannedChanges, [{ targetPath: 'README.tr.md', codeBlocks: 1 }]);
    assert.deepEqual(await readFile(target), before);
    await assert.rejects(runSyncCheck(options), /uncommitted changes.*--force/);
    assert.deepEqual(await readFile(target), before);
    await git(['add', '.']);
    await assert.rejects(runSyncCheck(options), /uncommitted changes/);
    assert.deepEqual(await readFile(target), before);
    const forced = await runSyncCheck({ ...options, force: true });
    assert.equal(forced.totalFixedBlocks, 1);
    assert.equal(await readFile(target, 'utf8'), '# Local edit\r\n```js\r\nnewCode();\r\n```\r\n');

    await git(['rm', '--cached', '--force', 'README.tr.md']);
    // Restore code drift so the untracked target requires a write after the forced fix.
    await writeFile(target, before);
    const untrackedBytes = await readFile(target);
    await assert.rejects(runSyncCheck({ ...options, source: 'README.md', target: 'README.tr.md' }), /uncommitted changes/);
    assert.deepEqual(await readFile(target), untrackedBytes);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
