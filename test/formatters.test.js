import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, formatJson, formatGitHub } from '../src/formatters/index.js';

describe('Formatters', () => {
  const mockResults = [
    {
      sourcePath: 'README.md',
      targetPath: 'README.tr.md',
      language: 'tr',
      synced: false,
      issues: [
        {
          check: 'codeBlocks',
          severity: 'warning',
          message: 'Code block #1 content differs from source',
          line: 12
        },
        {
          check: 'headings',
          severity: 'warning',
          message: 'Heading #3 level mismatch: source has H2, target has H3',
          line: 45
        }
      ],
      summary: { total: 2, warnings: 2, errors: 0 }
    },
    {
      sourcePath: 'docs/en/intro.md',
      targetPath: 'docs/tr/intro.md',
      language: 'tr',
      synced: true,
      issues: [],
      summary: { total: 0, warnings: 0, errors: 0 }
    }
  ];

  test('formatText formats results without emojis and includes summary', () => {
    const text = formatText(mockResults, { fixedCount: 1 });
    assert.ok(text.includes('[DRIFT] README.tr.md'));
    assert.ok(text.includes('[OK] docs/tr/intro.md'));
    assert.ok(text.includes('line 12: [codeBlocks]'));
    assert.ok(text.includes('Pairs checked: 2 (1 synced, 1 with drift)'));
    assert.ok(text.includes('Issues: 2 warnings, 0 errors'));
    assert.ok(text.includes('Fixed code blocks: 1'));

    // Verify no emojis are present
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
    assert.equal(emojiRegex.test(text), false);
  });

  test('formatJson produces valid JSON with correct structure', () => {
    const jsonStr = formatJson(mockResults, { fixedCount: 1 });
    const data = JSON.parse(jsonStr);

    assert.equal(data.summary.pairsChecked, 2);
    assert.equal(data.summary.syncedPairs, 1);
    assert.equal(data.summary.driftPairs, 1);
    assert.equal(data.summary.warnings, 2);
    assert.equal(data.summary.fixedCodeBlocks, 1);
    assert.equal(data.pairs.length, 2);
  });

  test('formatGitHub produces GitHub Actions annotations', () => {
    const gh = formatGitHub(mockResults);
    assert.ok(gh.includes('::warning file=README.tr.md,line=12,title=i18n-sync drift [codeBlocks]::Code block #1 content differs from source'));
    assert.ok(gh.includes('::warning file=README.tr.md,line=45,title=i18n-sync drift [headings]::Heading #3 level mismatch: source has H2, target has H3'));
  });
});

for (const check of ['gitStaleness', 'files']) {
  test(`${check} is a file-level issue in text, JSON, and GitHub output`, () => {
    const results = [{ sourcePath: 'README.md', targetPath: 'README.tr.md', language: 'tr', synced: false,
      issues: [{ check, severity: 'warning', message: 'File issue', line: 1 }],
      summary: { total: 1, warnings: 1, errors: 0 } }];
    assert.doesNotMatch(formatText(results), /line \d|undefined/);
    assert.doesNotMatch(formatGitHub(results), /line=/);
    const issue = JSON.parse(formatJson(results)).pairs[0].issues[0];
    assert.equal(Object.hasOwn(issue, 'line'), false);
    assert.equal(results[0].issues[0].line, 1, 'formatting does not mutate results');
  });
}
