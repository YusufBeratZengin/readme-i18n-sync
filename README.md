# readme-i18n-sync
[![CI](https://github.com/YusufBeratZengin/readme-i18n-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/readme-i18n-sync/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/readme-i18n-sync)](https://www.npmjs.com/package/readme-i18n-sync) [![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org) [![Dependencies](https://img.shields.io/badge/runtime_dependencies-0-green)](package.json)
<!-- i18n-sync-ignore -->
English | [Türkçe](README.tr.md)

Detect structural drift between source Markdown and its translations.
Runs locally with zero runtime dependencies; compares structure and git history.
Install: `npm install -g readme-i18n-sync` (Node.js 20+).
Run: `i18n-sync check`.

## Demo

Real output from `node ../../../bin/i18n-sync.js check` inside `test/fixtures/basic/` (exit 1). Spanish has intentional drift; Turkish is synced. Git staleness is disabled in this fixture for repeatable output.

<!-- basic-output -->
~~~text
[DRIFT] README.es.md (source: README.md, lang: es)
  - line 20: [headings] Heading #4 level mismatch: source has H3 ("Configuration"), target has H2 ("Configuración")
  - line 7: [codeBlocks] Code block #1 content differs from source
  - line 15: [codeBlocks] Code block #2 content differs from source
  - [links] Missing link target in translation: "https://example.com/project" (source line 30)
  - [images] Missing image source in translation: "https://example.com/logo.png" (source line 30)
  - line 22: [tables] Table #1 column count mismatch: source has 3 columns, target has 2
  - line 26: [admonitions] Admonition #1 type mismatch: source has [!NOTE], target has [!WARNING]
  - [versions] Version mismatch: source version "0.1.0" not found in translation (source line 30)
  - line 29: [versions] Outdated or extra version: translation mentions version "0.0.9", not found in source
[OK] README.tr.md (source: README.md, lang: tr)

Summary:
  Pairs checked: 2 (1 synced, 1 with drift)
  Issues: 9 warnings, 0 errors
~~~
<!-- /basic-output -->

## Install

Use the install command above, or run a checkout directly with `node bin/i18n-sync.js check`. No build step is needed.

## Usage

~~~bash
i18n-sync check
i18n-sync check --format json
i18n-sync check --format github
i18n-sync check README.tr.md
i18n-sync check --source README.md --target README.tr.md
i18n-sync check --staleness-grace 10m --warn-only
i18n-sync check --fix-code-blocks --dry-run
~~~

Remove `--dry-run` to apply code block fixes. Targets with uncommitted changes are protected; `--force` explicitly permits overwriting their code blocks. Fixes preserve the target's LF or CRLF line endings. Preview output names each target and its block count; JSON adds `plannedChanges`.

The ESM API is also available:

~~~javascript
import { runSyncCheck } from 'readme-i18n-sync';

const { results, allSynced } = await runSyncCheck({
  cwd: process.cwd(),
  noGit: true
});
console.log({ pairs: results.length, allSynced });
~~~

## Examples

See [the runnable multilingual example](examples/README.md), including an Actions workflow. Its `README.md` / `README.tr.md` and `docs/en/guide.md` / `docs/tr/guide.md` pairs are synced.

## Configuration

Create `.i18n-sync.json` in the directory you check. Unspecified settings retain their defaults. Invalid settings name the offending key and exit 2. The [schema](schema.json) also supports editor validation.

~~~json
{
  "sourceLanguage": "en",
  "patterns": [
    { "source": "README.md", "target": "README.:lang.md" },
    { "source": "docs/en/**/*.{md,markdown}", "target": "docs/:lang/**/*.{md,markdown}" }
  ],
  "checks": { "gitStaleness": true },
  "staleness": { "graceSeconds": 30 },
  "ignoreLanguages": [],
  "ignoreFiles": []
}
~~~

| Option | Behavior |
| --- | --- |
| `--format text/json/github` | Terminal text (default), JSON, or Actions annotations; `--json` and `--github` are shortcuts. |
| `--config path`, `-c path` | Read a custom configuration file. |
| `--staleness-grace 30s` | Override `staleness.graceSeconds` (default 0); units: `s`, `m`, `h`, `d`. |
| `--no-git` | Disable git staleness checks. |
| `--strict` | Exit 1 on drift (default). |
| `--warn-only`, `--no-strict` | Print drift and exit 0; errors still exit 2. |
| `--fix-code-blocks` | Copy differing code blocks from the source. |
| `--dry-run` | Preview fixes without writing; drift still exits 1. |
| `--force` | Permit fixes to targets with uncommitted changes. |
| `--source path --target path` | Check an explicit pair. |
| `--help`, `--version` | Show help or the version. |

## How it works

The parser extracts headings, fenced code blocks, link destinations, image URLs, tables, GitHub admonitions, and semantic versions. Checks compare counts, heading levels, table columns, block languages and contents, URLs, alert types, and versions. Each check can be disabled in `checks`; see the schema for names.

Default pairing finds `README.<lang>.md` and `docs/<lang>/**`. BCP-47-like tokens support `zh-CN`, `pt_BR`, and `zh-Hans`; `draft`, `bak`, and `CHANGELOG` suffixes are excluded. Target patterns require `:lang` (legacy `<lang>` is also accepted).

Git checks compare each file's last commit hash and committer timestamp. The same commit is always synced; otherwise a source newer by more than the grace period is stale. Missing git history is skipped. File-level issues omit target lines; missing links, images, and versions identify their source line.

Use `<!-- i18n-sync-ignore -->` before a localized element, or wrap a region with `<!-- i18n-sync-ignore-start -->` and `<!-- i18n-sync-ignore-end -->`.

## What it does not check

- Prose quality, grammar, or readability.
- Translation correctness or whether meaning has changed.
- Whether anchors renamed by translators resolve correctly. Link destinations are compared as written; localized anchors may need ignore markers.

Checks run locally without network access. JSON may contain document excerpts from differing code blocks; review it before sharing.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Synced, no pairs found, or drift with `--warn-only`. |
| 1 | Structural drift or a missing document. |
| 2 | Usage, configuration, or execution error (including a refused fix). |

## Development

From a checkout:

~~~bash
npm run lint
npm test
npm pack --dry-run
~~~

Tests use Node's built-in runner, local fixtures, and temporary git repositories. They require git and make no network requests. CI checks Node 20, 22, and 24 on Linux and Windows.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), the [code of conduct](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Keep the English and Turkish READMEs in sync.

## License

[MIT](LICENSE). Copyright (c) 2026 Yusuf Berat Zengin.
