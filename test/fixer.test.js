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
