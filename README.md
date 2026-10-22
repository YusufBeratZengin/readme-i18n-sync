# readme-i18n-sync

Structural drift detection for multilingual repository documentation.

Multilingual repositories often ship stale translations. Translators update prose, but upstream documentation frequently changes code blocks, configuration tables, anchor links, warning callouts, and version numbers. This tool compares document structure rather than prose, alerting you when translations miss structural elements or fall behind upstream git commits.

## Features

- Structure-based comparison: verifies headings, code blocks, links, images, tables, admonitions, and semver strings.
- Automated code block synchronization: `--fix-code-blocks` copies updated code snippets from the source into translated files without altering translated prose.
- Zero runtime dependencies: built entirely on Node.js standard libraries.
- Flexible pairing: pairs root `README.md` with `README.<lang>.md` and `docs/en/**` with `docs/<lang>/**` out of the box.
- Git staleness detection: compares committer timestamps using `git log -1 --format=%ct -- <file>`.
- Ignore markers: exclude localized additions using HTML comment tags (`<!-- i18n-sync-ignore -->`).
- Multiple output formats: clean terminal text, structured JSON, and GitHub Actions workflow annotations.

## Structural Checks

| Check | Description |
| --- | --- |
| Headings | Verifies total heading count, depth sequence, and hierarchical levels. |
| Code Blocks | Verifies block count, language identifiers, and byte-identical contents. |
| Links | Verifies destination URLs exist in translated documents. |
| Images | Verifies image count and source image URLs. |
| Tables | Verifies table count and column structure per table. |
| Admonitions | Verifies GitHub callout alert types (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`). |
| Versions | Verifies semantic version strings match between source and translation. |
| Git Staleness | Verifies translation committer date is not older than source committer date. |

## Installation

```bash
npm install -g readme-i18n-sync
```

Or run directly using `npx`:

```bash
npx readme-i18n-sync check
```

## Usage

### Run Default Check

Scan the repository for paired documentation and verify structural parity:

```bash
i18n-sync check
```

### Auto-Fix Outdated Code Blocks

Synchronize code snippets from the source document directly into translated files:

```bash
i18n-sync check --fix-code-blocks
```

### Output Formats

Generate structured JSON for custom tooling:

```bash
i18n-sync check --format json
```

Generate GitHub Actions workflow annotations:

```bash
i18n-sync check --format github
```

### Check Specific Files

Specify explicit source and target files:

```bash
i18n-sync check --source README.md --target README.tr.md
```

## Configuration

You can configure pairing patterns and checks by creating a `.i18n-sync.json` file in your repository root:

```json
{
  "$schema": "https://raw.githubusercontent.com/YusufBeratZengin/readme-i18n-sync/main/schema.json",
  "sourceLanguage": "en",
  "patterns": [
    {
      "source": "README.md",
      "target": "README.:lang.md"
    },
    {
      "source": "docs/en/**/*.{md,markdown}",
      "target": "docs/:lang/**/*.{md,markdown}"
    }
  ],
  "checks": {
    "headings": true,
    "codeBlocks": true,
    "codeBlocksIdentical": true,
    "links": true,
    "images": true,
    "tables": true,
    "admonitions": true,
    "versions": true,
    "gitStaleness": true
  },
  "ignoreLanguages": [],
  "ignoreFiles": []
}
```

## Ignore Markers

When a translation contains locale-specific content (such as a regional mirror or local community link), use ignore comments to bypass drift detection:

```markdown
<!-- i18n-sync-ignore -->
### Regional Mirror

<!-- i18n-sync-ignore-start -->
```bash
npm install --registry=https://registry.example.org
```
<!-- i18n-sync-ignore-end -->
```

## GitHub Actions Integration

Add the following workflow file to `.github/workflows/docs-sync.yml`:

```yaml
name: Documentation Sync Check

on:
  pull_request:
    paths:
      - 'README*.md'
      - 'docs/**'

jobs:
  verify-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Check documentation drift
        run: npx readme-i18n-sync check --format github
```

## Programmatic API

You can also use `readme-i18n-sync` programmatically in Node.js >=20:

```javascript
import { runSyncCheck, parseMarkdown, compareDocuments } from 'readme-i18n-sync';

const { results, allSynced } = await runSyncCheck({
  cwd: process.cwd(),
  fixCodeBlocks: false
});

console.log(`Documentation synchronized: ${allSynced}`);
```

## License

MIT License. Copyright (c) 2026 Yusuf Berat Zengin. See [LICENSE](https://github.com/YusufBeratZengin/readme-i18n-sync/blob/main/LICENSE) for details.
