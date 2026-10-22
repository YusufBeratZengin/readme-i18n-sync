/**
 * Format comparison results as clean human-readable text without emojis.
 * @param {import('../comparer.js').ComparisonResult[]} results
 * @param {object} [options]
 * @param {number} [options.fixedCount=0]
 * @returns {string}
 */
export function formatText(results, options = {}) {
  const lines = [];

  const totalPairs = results.length;
  const syncedPairs = results.filter(r => r.synced).length;
  const driftPairs = totalPairs - syncedPairs;

  let totalWarnings = 0;
  let totalErrors = 0;

  for (const res of results) {
    totalWarnings += res.summary.warnings;
    totalErrors += res.summary.errors;

    if (res.synced) {
      lines.push(`[OK] ${res.targetPath} (source: ${res.sourcePath}, lang: ${res.language})`);
    } else {
      lines.push(`[DRIFT] ${res.targetPath} (source: ${res.sourcePath}, lang: ${res.language})`);
      for (const issue of res.issues) {
        const prefix = issue.severity === 'error' ? 'ERROR' : 'WARN';
        lines.push(`  - line ${issue.line}: [${issue.check}] ${issue.message}`);
      }
    }
  }

  lines.push('');
  lines.push('Summary:');
  lines.push(`  Pairs checked: ${totalPairs} (${syncedPairs} synced, ${driftPairs} with drift)`);
  lines.push(`  Issues: ${totalWarnings} warnings, ${totalErrors} errors`);

  if (options.fixedCount && options.fixedCount > 0) {
    lines.push(`  Fixed code blocks: ${options.fixedCount}`);
  }

  return lines.join('\n');
}
