import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { parseMarkdown } from './parser.js';
import { compareDocuments } from './comparer.js';
import { discoverPairs, inferSourceFromTarget } from './pairer.js';
import { checkStaleness, assertTargetClean } from './git.js';
import { fixCodeBlocks, fixCodeBlocksInFile } from './fixer.js';
import { formatOutput, formatText, formatJson, formatGitHub } from './formatters/index.js';
import { loadConfig, DEFAULT_CONFIG, mergeConfig } from './config.js';

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
 * @param {number} [options.stalenessGrace] Override the grace period in seconds
 * @param {boolean} [options.dryRun=false] Preview fixes without writing
 * @param {boolean} [options.force=false] Allow fixes to uncommitted targets
 * @returns {Promise<{ results: import('./comparer.js').ComparisonResult[], totalFixedBlocks: number, plannedChanges: object[], allSynced: boolean }>}
 */
export async function runSyncCheck(options = {}) {
  const cwd = options.cwd || process.cwd();

  // Load configuration
  let config;
  if (typeof options.config === 'object' && options.config !== null) {
    config = mergeConfig(options.config);
  } else {
    config = await loadConfig(typeof options.config === 'string' ? options.config : '.i18n-sync.json', cwd);
  }

  if (options.noGit) {
    config.checks.gitStaleness = false;
  }

  if (options.stalenessGrace !== undefined) config.staleness.graceSeconds = options.stalenessGrace;

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

  // Preflight every planned write before modifying any target.
  let totalFixedBlocks = 0;
  const plannedChanges = [];
  if (options.fixCodeBlocks) {
    for (const pair of pairs) {
      if (!pair.sourceExists || !pair.targetExists) continue;
      const sFull = resolve(cwd, pair.sourcePath);
      const tFull = resolve(cwd, pair.targetPath);
      const plan = await fixCodeBlocksInFile(sFull, tFull, { dryRun: true });
      if (plan.error) throw new Error(plan.error);
      if (plan.plannedCount) {
        if (!options.dryRun && !options.force) await assertTargetClean(tFull, dirname(tFull));
        plannedChanges.push({ targetPath: pair.targetPath, codeBlocks: plan.plannedCount });
      }
    }
    if (!options.dryRun) {
      for (const plan of plannedChanges) {
        const pair = pairs.find(p => p.targetPath === plan.targetPath);
        const result = await fixCodeBlocksInFile(resolve(cwd, pair.sourcePath), resolve(cwd, pair.targetPath), { force: options.force });
        if (result.error) throw new Error(result.error);
        totalFixedBlocks += result.fixedCount;
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
          message: `Source document "${pair.sourcePath}" does not exist`
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
          message: `Target translation document "${pair.targetPath}" does not exist`
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
      gitInfo = await checkStaleness(pair.sourcePath, pair.targetPath, cwd, config.staleness.graceSeconds);
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
    plannedChanges,
    allSynced
  };
}
