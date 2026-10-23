import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

async function collectFiles(directory) {
  const files = [];
  const entries = await readdir(new URL(`${directory}/`, root), { withFileTypes: true });
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

// node --check accepts one input file; extra positional arguments are not checked.
// Enumerate files ourselves so nested modules and scripts work on every OS.
const files = (await Promise.all(['bin', 'src', 'scripts', 'test'].map(collectFiles)))
  .flat().sort();
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: fileURLToPath(root),
    stdio: 'inherit'
  });
  if (result.error) {
    console.error(`Cannot check ${file}: ${result.error.code || 'process error'}`);
    process.exit(1);
  }
  if (result.status !== 0) failed = true;
}
if (failed) process.exitCode = 1;
else console.log(`Syntax checked ${files.length} JavaScript files.`);
