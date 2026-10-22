import { readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

/**
 * Normalize path separators to forward slashes.
 * @param {string} p
 * @returns {string}
 */
export function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Convert a glob pattern to a regular expression.
 * Supports:
 * - `**` matches any characters across path segments
 * - `*` matches any characters within a single path segment
 * - `?` matches single character within a single path segment
 * - `{a,b,c}` matches choices
 * - `:lang` or `<lang>` captures language code (e.g. `tr`, `zh-CN`, `es`)
 * @param {string} pattern
 * @param {boolean} [captureLang=false]
 * @returns {RegExp}
 */
export function globToRegex(pattern, captureLang = false) {
  const normalized = normalizePath(pattern);
  let regexStr = '^';
  let i = 0;

  while (i < normalized.length) {
    // Check for :lang or <lang>
    if (captureLang && (normalized.startsWith(':lang', i) || normalized.startsWith('<lang>', i))) {
      const tokenLen = normalized.startsWith(':lang', i) ? 5 : 6;
      regexStr += '(?<lang>[a-zA-Z0-9_-]+)';
      i += tokenLen;
      continue;
    }

    // Check for brace expansion {a,b,c}
    if (normalized[i] === '{') {
      const closeIdx = normalized.indexOf('}', i);
      if (closeIdx !== -1) {
        const choices = normalized.slice(i + 1, closeIdx).split(',').map(s => s.trim());
        const escapedChoices = choices.map(choice => choice.replace(/[.+^$()[\]\\*?]/g, '\\$&'));
        regexStr += `(?:${escapedChoices.join('|')})`;
        i = closeIdx + 1;
        continue;
      }
    }

    // Check for **
    if (normalized.slice(i, i + 2) === '**') {
      if (normalized[i + 2] === '/') {
        // **/ can match zero or more directories
        regexStr += '(?:.+/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
      continue;
    }

    // Check for *
    if (normalized[i] === '*') {
      regexStr += '[^/]*';
      i += 1;
      continue;
    }

    // Check for ?
    if (normalized[i] === '?') {
      regexStr += '[^/]';
      i += 1;
      continue;
    }

    // Escape regex special chars
    const c = normalized[i];
    if (['.', '+', '^', '$', '(', ')', '[', ']', '\\', '|'].includes(c)) {
      regexStr += `\\${c}`;
      i += 1;
      continue;
    }

    regexStr += c;
    i += 1;
  }

  regexStr += '$';
  return new RegExp(regexStr);
}

/**
 * Match a file path against a glob pattern.
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
export function matchGlob(filePath, pattern) {
  const normalized = normalizePath(filePath);
  const regex = globToRegex(pattern, false);
  return regex.test(normalized);
}

/**
 * Walk a directory recursively and return all matching files as relative paths.
 * @param {string} dir Base directory
 * @param {object} [options]
 * @param {string[]} [options.ignore] Folders or paths to ignore
 * @returns {Promise<string[]>} List of relative normalized paths
 */
export function walkDirectory(dir, options = {}) {
  const ignoreList = new Set([
    'node_modules',
    '.git',
    '.github',
    'dist',
    'coverage',
    ...(options.ignore || [])
  ]);

  async function walk(currentDir, base) {
    const results = [];
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (ignoreList.has(entry.name)) {
        continue;
      }

      const fullPath = join(currentDir, entry.name);
      const relPath = normalizePath(relative(base, fullPath));

      if (entry.isDirectory()) {
        const sub = await walk(fullPath, base);
        results.push(...sub);
      } else if (entry.isFile()) {
        results.push(relPath);
      }
    }

    return results;
  }

  return walk(resolve(dir), resolve(dir));
}
