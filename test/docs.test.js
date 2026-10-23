import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseMarkdown } from '../src/parser.js';
import { runSyncCheck } from '../src/index.js';

const cli = resolve('bin/i18n-sync.js');
for (const [directory, marker, readmes, status] of [
  ['test/fixtures/basic', 'basic-output', ['README.md', 'README.tr.md'], 1],
  ['examples', 'example-output', ['examples/README.md', 'examples/README.tr.md'], 0]
]) {
  test(`documented output matches a real CLI run in ${directory}`, async () => {
    const result = spawnSync(process.execPath, [cli, 'check'], { cwd: resolve(directory), encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, status);
    assert.equal(result.stderr, '');
    for (const path of readmes) {
      const markdown = await readFile(path, 'utf8');
      const section = markdown.split(`<!-- ${marker} -->`)[1].split(`<!-- /${marker} -->`)[0];
      const documented = parseMarkdown(section).codeBlocks[0].content;
      const actual = result.stdout.trimEnd().replace(/\r\n/g, '\n');
      assert.deepEqual(documented.split('\n').slice(0, 3), actual.split('\n').slice(0, 3));
      assert.equal(documented, actual);
    }
  });
}

test('English and Turkish README sections and structural elements stay in sync', async () => {
  const en = parseMarkdown(await readFile('README.md', 'utf8'));
  const tr = parseMarkdown(await readFile('README.tr.md', 'utf8'));
  assert.equal(en.headings.length, tr.headings.length);
  assert.deepEqual(en.headings.map(h => h.level), tr.headings.map(h => h.level));
  const result = await runSyncCheck({ source: 'README.md', target: 'README.tr.md', noGit: true });
  assert.equal(result.allSynced, true, JSON.stringify(result.results[0].issues));
});

test('example Actions snippet matches the runnable workflow file', async () => {
  const workflow = (await readFile('examples/.github/workflows/docs-sync.yml', 'utf8')).trimEnd();
  for (const path of ['examples/README.md', 'examples/README.tr.md']) {
    const markdown = await readFile(path, 'utf8');
    assert.equal(parseMarkdown(markdown).codeBlocks.find(b => b.lang === 'yaml').content, workflow);
  }
});
