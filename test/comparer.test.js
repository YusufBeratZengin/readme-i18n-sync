import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../src/parser.js';
import { compareDocuments } from '../src/comparer.js';

describe('Comparer', () => {
  test('returns synced=true when documents match structurally', () => {
    const source = `
# Title
## Install
\`\`\`bash
npm i test
\`\`\`
See [Site](https://example.com)
`;
    const target = `
# Başlık
## Kurulum
\`\`\`bash
npm i test
\`\`\`
Bkz [Site](https://example.com)
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc, { sourcePath: 'README.md', targetPath: 'README.tr.md' });

    assert.equal(res.synced, true);
    assert.equal(res.issues.length, 0);
  });

  test('detects heading level mismatch', () => {
    const source = `
# Title
## Section 1
`;
    const target = `
# Title
### Section 1
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc);

    assert.equal(res.synced, false);
    const headingIssue = res.issues.find(i => i.check === 'headings');
    assert.ok(headingIssue);
    assert.match(headingIssue.message, /Heading #2 level mismatch/);
  });

  test('detects code block content difference when codeBlocksIdentical is true', () => {
    const source = `
\`\`\`bash
npm install pkg@2.0.0
\`\`\`
`;
    const target = `
\`\`\`bash
npm install pkg@1.0.0
\`\`\`
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc, { checks: { codeBlocksIdentical: true } });

    assert.equal(res.synced, false);
    const cbIssue = res.issues.find(i => i.check === 'codeBlocks');
    assert.ok(cbIssue);
    assert.match(cbIssue.message, /content differs from source/);
  });

  test('ignores code block content difference when codeBlocksIdentical is false', () => {
    const source = `
\`\`\`bash
npm install pkg@2.0.0
\`\`\`
`;
    const target = `
\`\`\`bash
npm install pkg@1.0.0
\`\`\`
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc, { checks: { codeBlocksIdentical: false, versions: false } });

    assert.equal(res.synced, true);
  });

  test('detects missing link targets', () => {
    const source = `
[Documentation](https://example.com/docs)
[Changelog](https://example.com/changelog)
`;
    const target = `
[Belgeler](https://example.com/docs)
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc);

    assert.equal(res.synced, false);
    const linkIssue = res.issues.find(i => i.check === 'links');
    assert.ok(linkIssue);
    assert.match(linkIssue.message, /Missing link target/);
  });

  test('detects image count and missing source mismatch', () => {
    const source = `
![Logo](https://example.com/logo.png)
![Banner](https://example.com/banner.png)
`;
    const target = `
![Logo](https://example.com/logo.png)
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc);

    assert.equal(res.synced, false);
    const imgIssue = res.issues.find(i => i.check === 'images');
    assert.ok(imgIssue);
    assert.match(imgIssue.message, /Image count mismatch/);
  });

  test('detects table column count mismatch', () => {
    const source = `
| A | B | C |
| - | - | - |
| 1 | 2 | 3 |
`;
    const target = `
| A | B |
| - | - |
| 1 | 2 |
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc);

    assert.equal(res.synced, false);
    const tableIssue = res.issues.find(i => i.check === 'tables');
    assert.ok(tableIssue);
    assert.match(tableIssue.message, /column count mismatch/);
  });

  test('detects admonition type mismatch', () => {
    const source = `
> [!NOTE]
> Info
`;
    const target = `
> [!WARNING]
> Info
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc);

    assert.equal(res.synced, false);
    const admIssue = res.issues.find(i => i.check === 'admonitions');
    assert.ok(admIssue);
    assert.match(admIssue.message, /Admonition #1 type mismatch/);
  });

  test('detects version mismatches', () => {
    const source = `Latest release is 1.2.0`;
    const target = `Son sürüm 1.1.0`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc);

    assert.equal(res.synced, false);
    const verIssue = res.issues.find(i => i.check === 'versions');
    assert.ok(verIssue);
    assert.match(verIssue.message, /1.2.0/);
  });

  test('detects git staleness when gitInfo isStale is true', () => {
    const source = `# Title`;
    const target = `# Title`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const gitInfo = {
      isStale: true,
      skipped: false,
      sourceTime: new Date('2026-10-20'),
      targetTime: new Date('2026-10-18'),
      diffSeconds: 172800
    };
    const res = compareDocuments(sDoc, tDoc, { gitInfo });

    assert.equal(res.synced, false);
    const staleIssue = res.issues.find(i => i.check === 'gitStaleness');
    assert.ok(staleIssue);
    assert.match(staleIssue.message, /Translation is stale/);
  });

  test('ignores elements marked with ignore comments', () => {
    const source = `
# Title
## Section
`;
    const target = `
# Title
<!-- i18n-sync-ignore -->
### Extra Local Section
## Section
`;
    const sDoc = parseMarkdown(source);
    const tDoc = parseMarkdown(target);
    const res = compareDocuments(sDoc, tDoc);

    assert.equal(res.synced, true);
    assert.equal(res.issues.length, 0);
  });
});
