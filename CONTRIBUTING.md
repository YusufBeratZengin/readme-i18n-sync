# Contributing to readme-i18n-sync

Contributions are welcome. Please read these guidelines before opening issues or pull requests.

## Development Setup

Requirements:
- Node.js >= 20.0.0
- Git

Clone the repository and install dev dependencies if needed (the project itself has zero runtime dependencies):

```bash
git clone https://github.com/YusufBeratZengin/readme-i18n-sync.git
cd readme-i18n-sync
npm ci
```

## Running Tests

Run the built-in test runner:

```bash
npm test
```

Every test run prints Node's built-in coverage report. On Node 22.8+, run the
same 85% source line coverage gate used by CI:

```bash
npm test -- --test-coverage-include=src/** --test-coverage-lines=85
```

There is no separate typecheck command in this JavaScript project.

Run lint checks:

```bash
npm run lint
```

Lint checks the syntax of every JavaScript module in `bin/`, `src/`, `scripts/`,
and `test/`, including nested directories. It requires no additional dependencies.

After changing the CLI or demo fixture, update the text transcripts in both
READMEs and regenerate the terminal image:

```bash
npm run demo
npm run demo:check
```

## Pull Request Process

1. Fork the repository and create your feature branch from `main`.
2. Ensure existing tests pass and add new unit tests for any changed or added behavior.
3. Keep commit messages clear, following the Conventional Commits specification.
4. If you modify `README.md`, ensure the Turkish translation `README.tr.md` remains structurally synchronized. Verify using `npm run check`.
5. Submit your pull request to the `main` branch of `https://github.com/YusufBeratZengin/readme-i18n-sync`.

## Code Style

- Use standard ECMAScript modules (`import`/`export`).
- Preserve zero runtime dependency footprint in `src/`.
- Do not introduce emojis or marketing fluff into documentation.
- Maintain consistent 2-space indentation.

## AI and Automated Tooling Policy

Contributions assisted by AI or automated tools are welcome provided that:
- The contributor reviews, understands, and takes full responsibility for all submitted changes.
- All code, tests, and documentation are verified locally (`npm test`, `npm run lint`, `npm run check`, `npm run demo:check`).
- No hallucinations, unsupported APIs, unverified external dependencies, or unvetted secrets are introduced.

## Releasing

Releases are maintained by the package owner. This repository uses a single
tag-triggered workflow, `.github/workflows/release.yml`; there is no second
publishing workflow to accidentally publish the same tag twice.

1. Review the Unreleased changelog and update both README files.
2. Run `npm run lint`, `npm test`, and `npm pack --dry-run`. Check the payload.
3. Choose a SemVer version and update `package.json` and `package-lock.json`.
   Update `VERSION` in `src/cli.js` and the JSON formatter version as well.
4. Move the changelog changes into a dated release section. The maintainer commits
   with `chore(release): vX.Y.Z`, creates tag `vX.Y.Z`, and pushes the reviewed tag.
5. The workflow verifies the tag equals the package version, runs the checks,
   and publishes with provenance and public access.

Before the first release, configure npm trusted publishing for owner
`YusufBeratZengin`, repository `readme-i18n-sync`, workflow `release.yml`, and
environment `npm`. Allow direct publishing with `npm publish`. Configure the
GitHub `npm` environment as needed. See the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).
The workflow uses Node 24 and requires npm 11.5.1 or later for OIDC.
No registry token belongs in this repository. If trusted publishing cannot be
configured, stop the release and resolve it with the maintainer.
