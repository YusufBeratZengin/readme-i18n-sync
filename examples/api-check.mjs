import { fileURLToPath } from 'node:url';
import { runSyncCheck } from 'readme-i18n-sync';

// Run structural drift check programmatically using the ESM API
const cwd = fileURLToPath(new URL('.', import.meta.url));
const { results, allSynced } = await runSyncCheck({
  cwd,
  noGit: true
});

console.log(`Checked ${results.length} pair(s). All synced: ${allSynced}`);
for (const pair of results) {
  const status = pair.synced ? 'OK' : 'DRIFT';
  console.log(`[${status}] ${pair.targetPath} (source: ${pair.sourcePath}, issues: ${pair.issues.length})`);
}
