# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-22

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
