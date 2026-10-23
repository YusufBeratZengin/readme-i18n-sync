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
  staleness: { graceSeconds: 0 },
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
    if (configPath !== '.i18n-sync.json') throw new Error(`Configuration file "${configPath}" does not exist`);
    return mergeConfig({});
  }

  try {
    const raw = await readFile(fullPath, 'utf8');
    return mergeConfig(JSON.parse(raw));
  } catch (err) {
    throw new Error(`Failed to read configuration file "${configPath}": ${err.message}`);
  }
}

// Validate the subset of JSON Schema used by schema.json, without dependencies.
const schema = JSON.parse(await readFile(new URL('../schema.json', import.meta.url), 'utf8'));

function validate(value, rule, key = 'config') {
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (rule.type === 'integer' ? !Number.isSafeInteger(value) : type !== rule.type) {
    throw new Error(`${key} must be ${rule.type}`);
  }
  if (type === 'object') {
    for (const required of rule.required || []) {
      if (!(required in value)) throw new Error(`${key}.${required} is required`);
    }
    for (const [name, child] of Object.entries(value)) {
      if (!Object.hasOwn(rule.properties || {}, name)) {
        if (rule.additionalProperties === false) throw new Error(`${key}.${name} is unknown`);
      } else validate(child, rule.properties[name], `${key}.${name}`);
    }
  } else if (type === 'array') {
    value.forEach((item, i) => validate(item, rule.items, `${key}[${i}]`));
  } else if (type === 'string') {
    if (rule.minLength && value.length < rule.minLength) throw new Error(`${key} must not be empty`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) throw new Error(`${key} must contain :lang (or <lang>)`);
  } else if (type === 'number' && rule.minimum !== undefined && value < rule.minimum) {
    throw new Error(`${key} must be at least ${rule.minimum}`);
  }
}

export function mergeConfig(config) {
  validate(config, schema);
  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...config,
    checks: { ...DEFAULT_CONFIG.checks, ...config.checks },
    staleness: { ...DEFAULT_CONFIG.staleness, ...config.staleness }
  };
}
