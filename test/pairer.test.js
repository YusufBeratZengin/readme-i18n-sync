import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { discoverPairs, inferSourceFromTarget } from '../src/pairer.js';

const FIXTURES_BASIC = resolve('test/fixtures/basic');
const FIXTURES_DOCS = resolve('test/fixtures/docs');

describe('Pairer', () => {
  test('discovers README.<lang>.md pairs in root directory', async () => {
    const pairs = await discoverPairs(FIXTURES_BASIC);
    assert.ok(pairs.length >= 2);

    const trPair = pairs.find(p => p.language === 'tr');
    assert.ok(trPair);
    assert.equal(trPair.sourcePath, 'README.md');
    assert.equal(trPair.targetPath, 'README.tr.md');
    assert.equal(trPair.sourceExists, true);
    assert.equal(trPair.targetExists, true);

    const esPair = pairs.find(p => p.language === 'es');
    assert.ok(esPair);
    assert.equal(esPair.sourcePath, 'README.md');
    assert.equal(esPair.targetPath, 'README.es.md');
  });

  test('discovers docs/en/** <-> docs/<lang>/** pairs', async () => {
    const pairs = await discoverPairs(FIXTURES_DOCS);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].language, 'tr');
    assert.equal(pairs[0].sourcePath, 'docs/en/guide.md');
    assert.equal(pairs[0].targetPath, 'docs/tr/guide.md');
  });

  test('infers source path from target translation path', () => {
    const r1 = inferSourceFromTarget('README.tr.md');
    assert.deepEqual(r1, { sourcePath: 'README.md', language: 'tr' });

    const r2 = inferSourceFromTarget('docs/zh-CN/guide/setup.md');
    assert.deepEqual(r2, { sourcePath: 'docs/en/guide/setup.md', language: 'zh-CN' });

    const r3 = inferSourceFromTarget('CONTRIBUTING.de.md');
    assert.deepEqual(r3, { sourcePath: 'CONTRIBUTING.md', language: 'de' });
  });

  test('respects ignoreLanguages in config', async () => {
    const pairs = await discoverPairs(FIXTURES_BASIC, {
      ignoreLanguages: ['es']
    });
    const esPair = pairs.find(p => p.language === 'es');
    assert.equal(esPair, undefined);
  });

  test('discovers 1-to-1 explicit patterns and source patterns containing :lang', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pairer-explicit-'));
    try {
      await writeFile(join(dir, 'doc.md'), '# Doc');
      await writeFile(join(dir, 'doc-tr.md'), '# Belge');
      await mkdir(join(dir, 'docs', 'en'), { recursive: true });
      await mkdir(join(dir, 'docs', 'tr'), { recursive: true });
      await writeFile(join(dir, 'docs', 'en', 'api.md'), '# API');
      await writeFile(join(dir, 'docs', 'tr', 'api.md'), '# API TR');

      const pairs = await discoverPairs(dir, {
        patterns: [
          { source: 'doc.md', target: 'doc-tr.md', language: 'tr' },
          { source: 'docs/:lang/api.md', target: 'docs/:lang/api.md' }
        ]
      });

      assert.equal(pairs.length, 2);
      const direct = pairs.find(p => p.targetPath === 'doc-tr.md');
      assert.ok(direct);
      assert.equal(direct.sourcePath, 'doc.md');
      assert.equal(direct.language, 'tr');

      const langPattern = pairs.find(p => p.targetPath === 'docs/tr/api.md');
      assert.ok(langPattern);
      assert.equal(langPattern.sourcePath, 'docs/en/api.md');
      assert.equal(langPattern.language, 'tr');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

for (const lang of ['zh-CN', 'pt_BR', 'zh-Hans']) {
  test(`infers README.${lang}.md`, () => {
    assert.deepEqual(inferSourceFromTarget(`README.${lang}.md`), { sourcePath: 'README.md', language: lang });
  });
}
for (const suffix of ['draft', 'bak', 'CHANGELOG']) {
  test(`README.${suffix}.md is not a translation`, () => {
    assert.equal(inferSourceFromTarget(`README.${suffix}.md`), null);
  });
}
test('discovers language variants and docs/zh-CN, excluding draft and backup names', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pairer-langs-'));
  try {
    for (const name of ['README.md', 'README.zh-CN.md', 'README.pt_BR.md', 'README.zh-Hans.md', 'README.draft.md', 'README.bak.md', 'README.CHANGELOG.md']) {
      await writeFile(join(dir, name), '# Title');
    }
    for (const lang of ['en', 'zh-CN']) {
      await mkdir(join(dir, 'docs', lang, 'nested'), { recursive: true });
      await writeFile(join(dir, 'docs', lang, 'nested', 'guide.md'), '# Guide');
    }
    const pairs = await discoverPairs(dir);
    assert.deepEqual(pairs.map(p => p.targetPath).sort(), ['README.pt_BR.md', 'README.zh-CN.md', 'README.zh-Hans.md', 'docs/zh-CN/nested/guide.md'].sort());
    assert.equal(pairs.find(p => p.language === 'zh-CN' && p.targetPath.startsWith('docs/')).sourcePath, 'docs/en/nested/guide.md');
    assert.ok(pairs.every(p => p.sourceExists && p.targetExists));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
