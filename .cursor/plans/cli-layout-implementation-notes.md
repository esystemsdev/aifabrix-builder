# CLI layout implementation notes

## Source of truth

- Visual spec: [layout.md](./layout.md) (including contributor appendix: glyphs, CI, implementation map).
- Adoption plan: [129-cli_layout_adoption.plan.md](./129-cli_layout_adoption.plan.md).
- Command inventory: [cli-output-command-matrix.md](./cli-output-command-matrix.md).

## Code entry points

- Shared formatters: `lib/utils/cli-test-layout-chalk.js` (canonical exports).
- Neutral re-export: `lib/utils/cli-layout-chalk.js` → same module.
- Unit tests: `tests/lib/utils/cli-test-layout-chalk.test.js`.

## Phase 3a (done in repo)

- Canonical **✔** in `lib/cli/setup-dev.js`, `lib/cli/setup-dev-path-commands.js`, `lib/cli/setup-secrets.js` (set-secrets-file message), `lib/cli/setup-infra.js` (optional flags + developer ID + TLS line).
- **✖** for datasource validate errors and parameters catalog load error; **✖** in `lib/commands/secure.js` error line.
- Adjusted `tests/lib/cli.test.js` expectations for dev and up-infra success lines.

## Phase 3b–3c (glyph pass — done)

- Bulk-normalized **✓ → ✔** and **✗ → ✖** across `lib/**/*.js`, `tests/**/*.js`, `tests/scripts/test-wrapper.js`, and `integration/hubspot-test/**/*.js` so CLI, tests, and integration scripts match [layout.md](./layout.md) appendix.
- `lib/utils/credential-display.js` status icons updated; list pipeline column in `lib/app/list.js` uses ✔/✖.

## Helper adoption (formatSuccessLine / formatBlockingError / glyphs)

- Most one-line `chalk.green(\`✔ …\`)` / `chalk.green('✔ …')` / leading-`\n✔` patterns in `lib/` now go through **`formatSuccessLine`**, **`formatSuccessParagraph`**, or **`formatBlockingError`** / **`failureGlyph`** / **`successGlyph`** from `cli-test-layout-chalk.js` (codemod + manual fixes for composite lines and status icons).
- Composite lines (e.g. `successGlyph()` + `chalk.white(…)`) and indented validate output (`  ✔ …`) still use raw chalk where a single helper would not match layout.

## Optional follow-up

- Optionally unify `handleCommandError` with `formatBlockingError` (watch JSON/script modes).
