import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const DEFAULT_CONFIG = {
  $schema: 'https://raw.githubusercontent.com/YusufBeratZengin/readme-i18n-sync/main/schema.json',
  sourceLanguage: 'en',
  patterns: [
    {
      source: 'README.md',
      target: 'README.:lang.md'
    },
    {
      source: 'docs/en/**/*.{md,markdown}',
      target: 'docs/:lang/**/*.{md,markdown}'
    }
  ],
  checks: {
    headings: true,
    codeBlocks: true,
    codeBlocksIdentical: true,
    links: true,
    images: true,
    tables: true,
    admonitions: true,
    versions: true,
    gitStaleness: true
  },
  ignoreLanguages: [],
  ignoreFiles: []
};

/**
 * Load configuration from file or return defaults.
 * @param {string} [configPath='.i18n-sync.json']
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<typeof DEFAULT_CONFIG>}
 */
export async function loadConfig(configPath = '.i18n-sync.json', cwd = process.cwd()) {
  const fullPath = resolve(cwd, configPath);

  if (!existsSync(fullPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = await readFile(fullPath, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      checks: {
        ...DEFAULT_CONFIG.checks,
        ...(parsed.checks || {})
      },
      patterns: parsed.patterns || DEFAULT_CONFIG.patterns,
      ignoreLanguages: parsed.ignoreLanguages || DEFAULT_CONFIG.ignoreLanguages,
      ignoreFiles: parsed.ignoreFiles || DEFAULT_CONFIG.ignoreFiles
    };
  } catch (err) {
    throw new Error(`Failed to read configuration file "${configPath}": ${err.message}`);
  }
}
