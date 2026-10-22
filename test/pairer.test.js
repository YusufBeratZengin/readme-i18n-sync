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
});
