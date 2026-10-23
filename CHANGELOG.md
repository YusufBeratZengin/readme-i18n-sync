# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Reproducible terminal SVG demo with a generator that verifies both README transcripts.
- Built-in Node.js test coverage reporting, an 85% source line coverage gate on Node 22+ in CI, and regression tests for missing files, fix preflight, and dry-run output.
- Weekly JavaScript CodeQL analysis and weekly GitHub Actions dependency updates.
- Package files whitelist, public provenance metadata, and prepublish checks.
- Configurable staleness grace period and `--staleness-grace` duration flag.
- `--warn-only`, safe code-fix previews with `--dry-run`, and explicit `--force`.
- Runtime configuration validation using the published schema.
- Temporary git repository tests, CLI exit tables, location tests, and documentation output checks.
- Tag-triggered OIDC release workflow, issue forms, PR template, Contributor Covenant 2.1, Dependabot, and runnable multilingual examples with Actions integration.

### Changed
- English and Turkish READMEs now share sections, badges, real output, limitations, and exit-code documentation.
- CI covers Node 20, 22, and 24 on Linux and Windows and checks package contents.
- Language pairing accepts regional and script variants while excluding draft and backup suffixes.

### Fixed
- Lint now checks every JavaScript module, including nested formatters, tests, and maintenance scripts, instead of only the first file.
- Files last changed in the same commit never trigger git staleness.
- File-level diagnostics omit line numbers; missing links, images, and versions identify source lines.
- Unknown flags and invalid configuration exit 2 with a single error line.
- Code fixes refuse uncommitted targets, surface write errors, and preserve target line endings.
- Explicit targets outside the working directory use their own directory for git safety checks.

## [0.1.0] - 2026-10-23

### Added
- Markdown block parser supporting ATX and setext headings, fenced code blocks, tables, lists, links, images, admonitions, and version numbers.
- Ignore comment markers support (`<!-- i18n-sync-ignore -->`, `<!-- i18n-sync-ignore-start -->`, `<!-- i18n-sync-ignore-end -->`).
- Automatic pair discovery for root `README.md` <-> `README.<lang>.md` and `docs/en/**` <-> `docs/<lang>/**`.
- Structural drift comparison engine evaluating heading hierarchy, code block byte equality, link targets, images, tables, admonitions, and semver strings.
- Git commit staleness detection via `git log -1 --format=%ct -- <file>`.
- Automated code block synchronization via `--fix-code-blocks`.
- CLI supporting text, JSON, and GitHub Actions annotation formats.
- Configuration loading from `.i18n-sync.json` with JSON Schema support.
- Comprehensive test suite covering parser, pairer, comparer, fixer, formatters, and git checks.
