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
```

## Running Tests

Run the built-in test runner:

```bash
npm test
```

Run syntax checks:

```bash
npm run lint
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
