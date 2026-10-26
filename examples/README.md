# Multilingual documentation example

## Run

From this directory in the checkout:

```bash
node ../bin/i18n-sync.js check
```

Git staleness is disabled so the example works without repository history.
The configuration pairs the root READMEs and both guide files.

## Output

<!-- example-output -->
```text
[OK] README.tr.md (source: README.md, lang: tr)
[OK] docs/tr/guide.md (source: docs/en/guide.md, lang: tr)

Summary:
  Pairs checked: 2 (2 synced, 0 with drift)
  Issues: 0 warnings, 0 errors
```
<!-- /example-output -->

## GitHub Actions

Copy `.github/workflows/docs-sync.yml` into a multilingual repository rooted at
these example files. After the package is published, the workflow runs the CLI
on pull requests. Enable `checks.gitStaleness` in that repository to check history.

```yaml
name: Documentation sync
on:
  pull_request:
    paths: ['README*.md', 'docs/**', '.i18n-sync.json']
permissions:
  contents: read
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npx --yes readme-i18n-sync@0.1.0 check --format github --staleness-grace 10m
```

## Programmatic API

Run the sync check programmatically using the JavaScript API:

```bash
node api-check.mjs
```
