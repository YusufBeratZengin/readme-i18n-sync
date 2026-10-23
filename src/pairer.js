import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePath, walkDirectory, globToRegex, matchGlob } from './utils.js';

// BCP-47-like base, script, region and variant tokens; backup suffixes are reserved.
const isLanguage = value => /^[a-z]{2,3}(?:[-_](?:[a-z]{4}|[a-z]{2}|[0-9]{3}|[a-z0-9]{5,8}))*$/i.test(value) && value.toLowerCase() !== 'bak';

/**
 * @typedef {Object} FilePair
 * @property {string} sourcePath - Relative path to source document
 * @property {string} targetPath - Relative path to target translation
 * @property {string} language - Target language identifier
 * @property {boolean} sourceExists - Whether source file exists on disk
 * @property {boolean} targetExists - Whether target file exists on disk
 */

/**
 * Default pairing patterns.
 */
export const DEFAULT_PATTERNS = [
  {
    source: 'README.md',
    target: 'README.:lang.md'
  },
  {
    source: 'docs/en/**/*.{md,markdown}',
    target: 'docs/:lang/**/*.{md,markdown}'
  }
];

/**
 * Discover file pairs in a workspace based on configuration patterns.
 * @param {string} rootDir
 * @param {object} [config]
 * @param {Array<{source: string, target: string}>} [config.patterns]
 * @param {string} [config.sourceLanguage='en']
 * @param {string[]} [config.ignoreLanguages=[]]
 * @param {string[]} [config.ignoreFiles=[]]
 * @returns {Promise<FilePair[]>}
 */
export async function discoverPairs(rootDir = '.', config = {}) {
  const sourceLang = config.sourceLanguage || 'en';
  const patterns = (config.patterns && config.patterns.length > 0)
    ? config.patterns
    : DEFAULT_PATTERNS;
  const ignoreLangs = new Set(config.ignoreLanguages || []);
  const ignoreFiles = config.ignoreFiles || [];

  const allFiles = await walkDirectory(rootDir);
  const pairs = [];
  const pairedTargets = new Set();

  for (const patternDef of patterns) {
    const { source: sourcePattern, target: targetPattern } = patternDef;

    // Check if targetPattern has :lang or <lang>
    const hasLangToken = /(:lang|<lang>)/.test(targetPattern);

    if (hasLangToken) {
      // Build regex to match target files and extract :lang
      const targetRegex = globToRegex(targetPattern, true);

      for (const file of allFiles) {
        if (pairedTargets.has(file)) continue;
        if (ignoreFiles.some(ign => matchGlob(file, ign))) continue;

        const match = targetRegex.exec(file);
        if (match && match.groups && match.groups.lang) {
          const lang = match.groups.lang;
          if (!isLanguage(lang) || lang.toLowerCase() === sourceLang.toLowerCase() || ignoreLangs.has(lang)) continue;

          // Determine corresponding source file path
          let expectedSource;
          if (sourcePattern.includes(':lang') || sourcePattern.includes('<lang>')) {
            expectedSource = sourcePattern.replace(/(?::lang|<lang>)/g, sourceLang);
          } else if (targetPattern.includes('**') && sourcePattern.includes('**')) {
            // e.g. docs/:lang/** -> docs/en/**
            const targetPrefix = targetPattern.split(/:lang|<lang>/)[0];
            const sourcePrefix = sourcePattern.split('**')[0];
            const relativeSuffix = file.slice(targetPrefix.length + lang.length + 1);
            expectedSource = normalizePath(`${sourcePrefix}${relativeSuffix}`);
          } else {
            expectedSource = sourcePattern;
          }

          const sourceFullPath = resolve(rootDir, expectedSource);
          const targetFullPath = resolve(rootDir, file);

          pairedTargets.add(file);
          pairs.push({
            sourcePath: expectedSource,
            targetPath: file,
            language: lang,
            sourceExists: existsSync(sourceFullPath),
            targetExists: existsSync(targetFullPath)
          });
        }
      }
    } else {
      // Direct 1-to-1 pattern (e.g. source: A.md, target: B.md)
      const sourceFullPath = resolve(rootDir, sourcePattern);
      const targetFullPath = resolve(rootDir, targetPattern);
      const lang = patternDef.language || 'unknown';

      pairedTargets.add(targetPattern);
      pairs.push({
        sourcePath: sourcePattern,
        targetPath: targetPattern,
        language: lang,
        sourceExists: existsSync(sourceFullPath),
        targetExists: existsSync(targetFullPath)
      });
    }
  }

  // Also check for root README.<lang>.md if not already found
  const rootReadmeTargetRegex = /^README\.([a-zA-Z0-9_-]+)\.md$/i;
  for (const file of allFiles) {
    if (pairedTargets.has(file)) continue;
    const match = rootReadmeTargetRegex.exec(file);
    if (match) {
      const lang = match[1];
      if (isLanguage(lang) && lang.toLowerCase() !== sourceLang.toLowerCase() && !ignoreLangs.has(lang) && !ignoreFiles.some(ign => matchGlob(file, ign))) {
        pairedTargets.add(file);
        pairs.push({
          sourcePath: 'README.md',
          targetPath: file,
          language: lang,
          sourceExists: existsSync(resolve(rootDir, 'README.md')),
          targetExists: existsSync(resolve(rootDir, file))
        });
      }
    }
  }

  return pairs;
}

/**
 * Infer source file from a target translation path.
 * @param {string} targetPath
 * @param {string} [sourceLang='en']
 * @returns {{ sourcePath: string, language: string } | null}
 */
export function inferSourceFromTarget(targetPath, sourceLang = 'en') {
  const normalized = normalizePath(targetPath);

  // README.<lang>.md -> README.md
  const readmeMatch = normalized.match(/(?:^|\/)README\.([a-zA-Z0-9_-]+)\.md$/i);
  if (readmeMatch && isLanguage(readmeMatch[1])) {
    const lang = readmeMatch[1];
    const source = normalized.replace(/README\.[a-zA-Z0-9_-]+\.md$/i, 'README.md');
    return { sourcePath: source, language: lang };
  }

  // docs/<lang>/... -> docs/en/...
  const docsMatch = normalized.match(/^(.*\/)?docs\/([a-zA-Z0-9_-]+)\/(.+)$/);
  if (docsMatch && isLanguage(docsMatch[2])) {
    const prefix = docsMatch[1] || '';
    const lang = docsMatch[2];
    const rest = docsMatch[3];
    return {
      sourcePath: `${prefix}docs/${sourceLang}/${rest}`,
      language: lang
    };
  }

  // <filename>.<lang>.md -> <filename>.md
  const genericMatch = normalized.match(/^(.*)\.([a-zA-Z0-9_-]+)\.(md|markdown)$/i);
  if (genericMatch && isLanguage(genericMatch[2])) {
    const base = genericMatch[1];
    const lang = genericMatch[2];
    const ext = genericMatch[3];
    return {
      sourcePath: `${base}.${ext}`,
      language: lang
    };
  }

  return null;
}
