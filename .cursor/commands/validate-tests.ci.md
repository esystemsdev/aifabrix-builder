# validate-tests-ci

Run from the **aifabrix-builder** repo root:

```bash
npm run test:ci
```

This runs `tests/scripts/ci-simulate.sh`: copy tree to a temp dir, `npm ci`, `npm run lint`, then `npm test` (same two-pass flow as local: default Jest config + isolated Jest config).

## Reading the report

- `temp/ci-reports/last-run-summary.txt` — lint + combined Jest summaries (default **and** isolated).
- `temp/ci-reports/last-run-tests.txt` — full log.
- `temp/ci-reports/last-run-failures.txt` — failure excerpt when tests fail.

The summary lists **two** Jest runs: first block is the default project (~294 suites), second is isolated single-file projects (~30 suites). Both must pass.

## Environment

`tests/setup.js` clears `AIFABRIX_HOME`, `AIFABRIX_WORK`, and `AIFABRIX_CONFIG` unless `PRESERVE_AIFABRIX_TEST_ENV=true`.

## Flaky / order-sensitive tests

Prefer **isolated Jest projects** (`jest.projects.js`: `testPathIgnorePatterns` + `makeIsolatedProject`) for suites that:

- `jest.mock('fs')` with custom `mockImplementation` that must not leak to other files, or
- need real `node:fs` while other suites mock `fs`, or
- partially mock `paths` / other singletons.

Do **not** use a top-level `afterAll` that permanently sets `fs.existsSync` / `fs.readFileSync` to stubs — that poisons the next test file on the same Jest worker (this broke `secrets-generator` then `app-uncovered-lines` on GitHub Actions Node 18 until removed).

## Moving tests out of CI default scope

`tests/local/` is excluded from default and isolated CI runs unless `INCLUDE_LOCAL_TESTS=true`. Use that only for **opt-in** heavy or environment-bound suites—not as the first fix for Jest ordering; prefer isolation above.

**Current local-only URL suites** (path/registry/temp-dir brittleness on GitHub Actions): `tests/local/lib/utils/url-declarative-resolve-expand.test.js`, `url-declarative-truth-table-124.test.js`, `declarative-url-matrix-d-reload.test.js`.

**TTY snapshot suites** (chalk / ANSI stripping differs across runners): `tests/local/lib/utils/datasource-test-run-display-snapshot.test.js`, `external-system-system-test-tty.test.js`.

## GitHub Actions

Use **Node 20+** in workflows if devDependencies declare `engines: { node: '>=20' }` (e.g. `cross-env`, `markdownlint`) to avoid `EBADENGINE` noise and align with local dev. The package test suite is validated on the repo’s supported Node version used in CI.
