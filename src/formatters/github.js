/**
 * Escape data for GitHub Actions workflow command message.
 * @param {string} str
 * @returns {string}
 */
function escapeGitHubData(str) {
  return str
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

/**
 * Format comparison results as GitHub Actions annotations.
 * @param {import('../comparer.js').ComparisonResult[]} results
 * @param {object} [options]
 * @returns {string}
 */
export function formatGitHub(results, options = {}) {
  const lines = [];

  for (const res of results) {
    for (const issue of res.issues) {
      const command = issue.severity === 'error' ? 'error' : 'warning';
      const file = res.targetPath;
      const line = issue.line || 1;
      const title = `i18n-sync drift [${issue.check}]`;
      const message = escapeGitHubData(issue.message);

      lines.push(`::${command} file=${file},line=${line},title=${title}::${message}`);
    }
  }

  // Also append text summary
  const totalPairs = results.length;
  const syncedPairs = results.filter(r => r.synced).length;
  const driftPairs = totalPairs - syncedPairs;

  lines.push('');
  lines.push(`[i18n-sync] Checked ${totalPairs} pair(s): ${syncedPairs} synced, ${driftPairs} with drift.`);

  return lines.join('\n');
}
