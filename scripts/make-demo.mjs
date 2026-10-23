import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.js';

// Execute the same entrypoint as bin/i18n-sync.js with the documented fixture cwd.
// All input is synthetic, git checks are disabled by the fixture configuration,
// and no shell, network access, or package installation is needed.
const root = new URL('../', import.meta.url);
const previousCwd = process.cwd();
const stdout = [];
const stderr = [];
let exitCode;
try {
  process.chdir(fileURLToPath(new URL('test/fixtures/basic/', root)));
  exitCode = await runCli(['check'], {
    stdout: message => stdout.push(message),
    stderr: message => stderr.push(message)
  });
} finally {
  process.chdir(previousCwd);
}
assert.equal(exitCode, 1, 'The demo fixture must contain intentional drift');
assert.deepEqual(stderr, [], 'The demo must not contain execution errors');
const output = stdout.join('\n').trimEnd().replace(/\r\n/g, '\n');

// Keep both accessible text transcripts honest when regenerating the image.
for (const name of ['README.md', 'README.tr.md']) {
  const markdown = (await readFile(new URL(name, root), 'utf8')).replace(/\r\n/g, '\n');
  const transcript = markdown.match(/<!-- basic-output -->\s*~~~text\n([\s\S]*?)\n~~~\s*<!-- \/basic-output -->/);
  assert.ok(transcript, `${name} needs a basic-output transcript`);
  assert.equal(transcript[1].replace(/\r\n/g, '\n'), output,
    `${name}: update the transcript to match the real CLI output`);
}

const lines = [
  '$ cd test/fixtures/basic',
  '$ node ../../../bin/i18n-sync.js check',
  '',
  ...output.split('\n')
];
const escapeXml = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
})[char]);
const fontSize = 14;
const lineHeight = 24;
const width = Math.max(1000, Math.ceil(Math.max(...lines.map(line => line.length)) * fontSize * 0.62) + 64);
const height = 104 + lines.length * lineHeight;
const text = lines.map((line, index) => {
  const fill = line.startsWith('$') ? '#93c5fd'
    : line.startsWith('[OK]') ? '#86efac'
      : line.startsWith('[DRIFT]') || line.startsWith('  -') ? '#fcd34d'
        : '#e2e8f0';
  return `    <text x="28" y="${90 + index * lineHeight}" fill="${fill}">${escapeXml(line)}</text>`;
}).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">readme-i18n-sync terminal demo</title>
  <desc id="description">Real CLI output: Spanish has nine structural warnings; Turkish is synced. Exit code 1 is expected for this fixture.</desc>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="16" fill="#0f172a" stroke="#334155"/>
  <path d="M17 1H${width - 17}Q${width - 1} 1 ${width - 1} 17V52H1V17Q1 1 17 1Z" fill="#1e293b"/>
  <circle cx="28" cy="26" r="6" fill="#f87171"/>
  <circle cx="50" cy="26" r="6" fill="#fbbf24"/>
  <circle cx="72" cy="26" r="6" fill="#4ade80"/>
  <g font-family="ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace" font-size="${fontSize}" xml:space="preserve">
    <text x="100" y="31" fill="#94a3b8">readme-i18n-sync · intentional drift · exit 1</text>
${text}
  </g>
</svg>
`;
const destination = new URL('docs/demo.svg', root);
if (process.argv.includes('--check')) {
  assert.equal(await readFile(destination, 'utf8'), svg,
    'Demo is out of date; run npm run demo');
  console.log('Demo and both README transcripts match the real CLI output.');
} else {
  await mkdir(new URL('docs/', root), { recursive: true });
  await writeFile(destination, svg);
  console.log(`Generated docs/demo.svg (${output.split('\n').length} output lines; exit ${exitCode}).`);
}
