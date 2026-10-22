import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { parseMarkdown } from './parser.js';
import { compareDocuments } from './comparer.js';
import { discoverPairs, inferSourceFromTarget } from './pairer.js';
import { checkStaleness } from './git.js';
import { fixCodeBlocks, fixCodeBlocksInFile } from './fixer.js';
import { formatOutput, formatText, formatJson, formatGitHub } from './formatters/index.js';
import { loadConfig, DEFAULT_CONFIG } from './config.js';

export {
  parseMarkdown,
  compareDocuments,
  discoverPairs,
  inferSourceFromTarget,
  checkStaleness,
  fixCodeBlocks,
  fixCodeBlocksInFile,
  formatOutput,
  formatText,
  formatJson,
  formatGitHub,
  loadConfig,
  DEFAULT_CONFIG
};

/**
 * Execute synchronization check for documentation pairs.
 * @param {object} [options]
 * @param {string} [options.cwd=process.cwd()]
 * @param {string|object} [options.config] Path to config or config object
 * @param {boolean} [options.fixCodeBlocks=false]
 * @param {string[]} [options.files=[]] Specific target files to check
 * @param {string} [options.source] Manual source file
 * @param {string} [options.target] Manual target file
 * @param {boolean} [options.noGit=false]
 * @returns {Promise<{ results: import('./comparer.js').ComparisonResult[], totalFixedBlocks: number, allSynced: boolean }>}
 */
export async function runSyncCheck(options = {}) {
  const cwd = options.cwd || process.cwd();

  // Load configuration
  let config;
  if (typeof options.config === 'object' && options.config !== null) {
    config = { ...DEFAULT_CONFIG, ...options.config };
  } else {
    config = await loadConfig(typeof options.config === 'string' ? options.config : '.i18n-sync.json', cwd);
  }

  if (options.noGit) {
    config.checks.gitStaleness = false;
  }

  // Determine pairs to inspect
  let pairs = [];

  if (options.source && options.target) {
    pairs = [{
      sourcePath: options.source,
      targetPath: options.target,
      language: 'manual',
      sourceExists: existsSync(resolve(cwd, options.source)),
      targetExists: existsSync(resolve(cwd, options.target))
    }];
  } else if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      const inferred = inferSourceFromTarget(file, config.sourceLanguage);
      const sourcePath = inferred ? inferred.sourcePath : 'README.md';
      const lang = inferred ? inferred.language : 'unknown';

      pairs.push({
        sourcePath,
        targetPath: file,
        language: lang,
        sourceExists: existsSync(resolve(cwd, sourcePath)),
        targetExists: existsSync(resolve(cwd, file))
      });
    }
  } else {
    pairs = await discoverPairs(cwd, config);
  }

  // If fixCodeBlocks flag is on, fix code blocks first
  let totalFixedBlocks = 0;
  if (options.fixCodeBlocks) {
    for (const pair of pairs) {
      if (pair.sourceExists && pair.targetExists) {
        const sFull = resolve(cwd, pair.sourcePath);
        const tFull = resolve(cwd, pair.targetPath);
        const fixResult = await fixCodeBlocksInFile(sFull, tFull);
        if (fixResult.fixed) {
          totalFixedBlocks += fixResult.fixedCount;
        }
      }
    }
  }

  // Now compare all pairs
  const results = [];

  for (const pair of pairs) {
    const sFull = resolve(cwd, pair.sourcePath);
    const tFull = resolve(cwd, pair.targetPath);

    if (!pair.sourceExists) {
      results.push({
        sourcePath: pair.sourcePath,
        targetPath: pair.targetPath,
        language: pair.language,
        synced: false,
        issues: [{
          check: 'files',
          severity: 'error',
          message: `Source document "${pair.sourcePath}" does not exist`,
          line: 1
        }],
        summary: { total: 1, warnings: 0, errors: 1 }
      });
      continue;
    }

    if (!pair.targetExists) {
      results.push({
        sourcePath: pair.sourcePath,
        targetPath: pair.targetPath,
        language: pair.language,
        synced: false,
        issues: [{
          check: 'files',
          severity: 'error',
          message: `Target translation document "${pair.targetPath}" does not exist`,
          line: 1
        }],
        summary: { total: 1, warnings: 0, errors: 1 }
      });
      continue;
    }

    const [sourceContent, targetContent] = await Promise.all([
      readFile(sFull, 'utf8'),
      readFile(tFull, 'utf8')
    ]);

    const sourceDoc = parseMarkdown(sourceContent);
    const targetDoc = parseMarkdown(targetContent);

    let gitInfo = null;
    if (config.checks.gitStaleness) {
      gitInfo = await checkStaleness(pair.sourcePath, pair.targetPath, cwd);
    }

    const comparison = compareDocuments(sourceDoc, targetDoc, {
      checks: config.checks,
      gitInfo,
      sourcePath: pair.sourcePath,
      targetPath: pair.targetPath,
      language: pair.language
    });

    results.push(comparison);
  }

  const allSynced = results.every(r => r.synced);

  return {
    results,
    totalFixedBlocks,
    allSynced
  };
}
