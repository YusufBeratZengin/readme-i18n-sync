import { formatText } from './text.js';
import { formatJson } from './json.js';
import { formatGitHub } from './github.js';

export { formatText, formatJson, formatGitHub };

/**
 * Format results based on selected format name.
 * @param {'text'|'json'|'github'} format
 * @param {import('../comparer.js').ComparisonResult[]} results
 * @param {object} [options]
 * @returns {string}
 */
export function formatOutput(format, results, options = {}) {
  switch (format) {
    case 'json':
      return formatJson(results, options);
    case 'github':
      return formatGitHub(results, options);
    case 'text':
    default:
      return formatText(results, options);
  }
}
