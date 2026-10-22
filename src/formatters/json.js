/**
 * Format comparison results as JSON.
 * @param {import('../comparer.js').ComparisonResult[]} results
 * @param {object} [options]
 * @returns {string}
 */
export function formatJson(results, options = {}) {
  const totalPairs = results.length;
  const syncedPairs = results.filter(r => r.synced).length;
  const driftPairs = totalPairs - syncedPairs;

  let totalWarnings = 0;
  let totalErrors = 0;

  for (const res of results) {
    totalWarnings += res.summary.warnings;
    totalErrors += res.summary.errors;
  }

  const output = {
    version: '0.1.0',
    summary: {
      pairsChecked: totalPairs,
      syncedPairs,
      driftPairs,
      totalIssues: totalWarnings + totalErrors,
      warnings: totalWarnings,
      errors: totalErrors,
      fixedCodeBlocks: options.fixedCount || 0,
      allSynced: driftPairs === 0
    },
    pairs: results
  };

  return JSON.stringify(output, null, 2);
}
