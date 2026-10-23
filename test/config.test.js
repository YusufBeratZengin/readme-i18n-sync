import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, mergeConfig } from '../src/config.js';

const invalid = [
  [null, 'config'], [[], 'config'], [{ unknown: true }, 'unknown'],
  [{ sourceLanguage: 3 }, 'sourceLanguage'], [{ sourceLanguage: '' }, 'sourceLanguage'],
  [{ $schema: false }, '$schema'],
  [{ checks: { typo: true } }, 'checks.typo'], [{ checks: { links: 'yes' } }, 'checks.links'],
  [{ checks: null }, 'checks'], [{ patterns: 'README' }, 'patterns'],
  [{ patterns: [{ source: 'README.md' }] }, 'patterns[0].target'],
  [{ patterns: [{ source: 2, target: 'README.:lang.md' }] }, 'patterns[0].source'],
  [{ patterns: [{ source: '', target: 'README.:lang.md' }] }, 'patterns[0].source'],
  [{ patterns: [{ source: 'README.md', target: 'README.:lang.md', typo: true }] }, 'patterns[0].typo'],
  [{ patterns: [{ source: 'README.md', target: 'README.tr.md' }] }, 'patterns[0].target'],
  [{ ignoreLanguages: [42] }, 'ignoreLanguages[0]'], [{ ignoreFiles: false }, 'ignoreFiles'],
  [{ staleness: { graceSeconds: -1 } }, 'staleness.graceSeconds'],
  [{ staleness: { graceSeconds: '30' } }, 'staleness.graceSeconds'],
  [{ staleness: { graceSeconds: 1.5 } }, 'staleness.graceSeconds'],
  [{ staleness: { typo: 0 } }, 'staleness.typo']
];
for (const [config, key] of invalid) {
  test(`invalid config names ${key}: ${JSON.stringify(config)}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'config-test-'));
    try {
      await writeFile(join(dir, '.i18n-sync.json'), JSON.stringify(config));
      await assert.rejects(loadConfig(undefined, dir), err => err.message.includes(key));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
test('own config loads, defaults merge independently, and grace defaults to zero', async () => {
  assert.equal((await loadConfig()).sourceLanguage, 'en');
  const first = mergeConfig({ checks: { links: false }, staleness: { graceSeconds: 30 } });
  first.checks.headings = false;
  const second = mergeConfig({});
  assert.equal(second.checks.headings, true);
  assert.equal(second.staleness.graceSeconds, 0);
  assert.equal(first.checks.links, false);
  assert.equal(first.checks.images, true);
});
