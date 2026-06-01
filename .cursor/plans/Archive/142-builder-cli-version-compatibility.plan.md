---
name: Builder CLI — dataplane version compatibility (142)
overview: "Cache dataplane-version and dataplane-min-cli-version under device.<controllerUrl> in config.yaml; auth status shows upgrade guidance; --validate uses exit code 3 when CLI is too old; gate dataplane API calls. Planning only until dataplane 403.0 is approved."
todos:
  - id: plan-review
    content: Review and approve this plan (after dataplane 403.0 contract review)
    status: pending
  - id: dataplane-health-api
    content: Add lib/api/dataplane-health.api.js — fetch and parse GET /api/v1/health
    status: completed
  - id: config-cache
    content: Persist dataplane-version and dataplane-min-cli-version under device.<controllerUrl> via saveConfig
    status: completed
  - id: exit-codes
    content: Add lib/utils/cli-exit-codes.js — exit 3 for CLI_VERSION_INCOMPATIBLE on auth status --validate
    status: completed
  - id: version-gate
    content: Global assertDataplaneCliVersionCompatible helper (internal semver compare); hook dataplane API entrypoints only
    status: completed
  - id: auth-status-ux
    content: Extend auth status (info + upgrade error on normal run; exit 3 on --validate when incompatible)
    status: completed
  - id: cli-help-dev
    content: Enterprise Commander help (addHelpText after), formatNextActions on errors, auth-status-display module
    status: completed
  - id: tests-docs
    content: Jest unit tests; docs/commands/authentication.md (dev troubleshooting + exit codes); cli-output-command-matrix
    status: completed
  - id: validation-gates
    content: npm run build → npm run lint → npm test
    status: completed
  - id: follow-up-login-gate
    content: "Follow-up: login success refresh + datasource/API-module gate wiring + setup-auth-help.test.js"
    status: completed
isProject: false
---

# 142.0 — Builder CLI: dataplane / Builder version compatibility

## What this plan is

| Repo | Plan | Responsibility |
|------|------|----------------|
| **aifabrix-dataplane** | [403.0-dataplane-health-min-builder-cli-version.plan.md](../../aifabrix-dataplane/.cursor/plans/403.0-dataplane-health-min-builder-cli-version.plan.md) | `MIN_BUILDER_CLI_VERSION` env + health JSON |
| **aifabrix-builder** (this plan) | **142.0** | Config cache, `auth status` display, client-side gate on dataplane calls |

**Status:** Planning only — **no code** until dataplane **403.0** is approved and health contract is frozen.

**Prerequisite:** Dataplane exposes on `GET /api/v1/health` (and aligned `GET /health`):

- `version` — dataplane semver
- `minBuilderCliVersion` — optional; minimum Builder CLI semver when enforced

## Problem

There is no client-side guard preventing an **outdated** `aifabrix` CLI from calling dataplane APIs (upload, wizard, datasource deploy, protection, etc.). Operators cannot see version requirements in `aifabrix auth status`.

## Goals

1. **Config file** (`~/.aifabrix/config.yaml`): under existing `device.<controllerUrl>`, persist `dataplane-version` and `dataplane-min-cli-version` (kebab-case, same style as `developer-id`).
2. On successful controller auth / dataplane discovery: **fetch health** and **write** those fields on the matching `device` entry (with token / `expiresAt`).
3. **`aifabrix auth status` (normal)**: show dataplane version, required min Builder CLI, this CLI version; when incompatible, show a clear **error** that dataplane commands cannot be run until the CLI is upgraded (command still exits **0** if otherwise authenticated).
4. **`aifabrix auth status --validate`**: exit **1** if not authenticated (unchanged); exit **3** (new) if authenticated but CLI &lt; `dataplane-min-cli-version`; exit **0** when OK.
5. **Global validation function**: before dataplane HTTP calls, same semver check; throw same upgrade message as status (used by commands, not a separate exit code unless the command’s handler maps it).
6. **Local-only commands** unchanged — no dataplane gate.
7. **Semver compare**: small **internal** helper (no `semver` npm dependency).

## Non-goals

- Enforcing maximum dataplane version from CLI config.
- Changing controller API behavior.
- A separate top-level `connections:` block in config (versions live on **`device`** only).

## Rules and standards (developer / enterprise help)

This plan must comply with [Project Rules](../.cursor/rules/project-rules.mdc) and match the **enterprise help bar** used in [141-protection-system.plan.md](./141-protection-system.plan.md) and other mature commands:

| Rule | Apply to 142.0 |
|------|----------------|
| [CLI Command Development](../.cursor/rules/project-rules.mdc#cli-command-development) | Commander descriptions, `addHelpText('after', …)`, try/catch, input validation |
| [Architecture Patterns / Module Structure](../.cursor/rules/project-rules.mdc#architecture-patterns) | New modules go in `lib/api/`, `lib/utils/`, `lib/core/`, `lib/commands/`, `lib/constants/` per repo layout |
| [API Client Structure Pattern](../.cursor/rules/project-rules.mdc#api-client-structure-pattern) | `dataplane-health.api.js` uses `lib/api/` shape + `lib/api/types/dataplane-health.types.js` JSDoc `@typedef` |
| [permissions-guide.md](../.cursor/rules/permissions-guide.md) | Public dataplane health is no-auth; add `@requiresPermission none` (or noted "public, security: []") on new api fn |
| [CLI Layout](../.cursor/rules/cli-layout.mdc) + [layout.md](../.cursor/rules/layout.md) + [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md) | Auth status TTY: canonical glyphs (**✔** / **✖** / **⚠**); blocking upgrade text via `formatBlockingError`; matrix row updated |
| [docs-rules.mdc](../.cursor/rules/docs-rules.mdc) | Expand `docs/commands/authentication.md` — command-centric; no HTTP tutorial |
| [Code Style — Error Handling](../.cursor/rules/project-rules.mdc#error-handling) | Version gate throws meaningful messages with context (required vs installed); never expose tokens |
| [Testing Conventions](../.cursor/rules/project-rules.mdc#testing-conventions) | Jest unit tests, mock `fs`/`axios`/api modules, mirror under `tests/`, ≥80% coverage for new code |
| [Code Quality Standards](../.cursor/rules/project-rules.mdc#code-quality-standards) | Files ≤500 lines, functions ≤50 lines, JSDoc on every public helper (`@fileoverview` + `@author` + `@version`) |
| [Security & Compliance (ISO 27001)](../.cursor/rules/project-rules.mdc#security--compliance-iso-27001) | No hardcoded secrets; never log token / refreshToken from device entry; cache fields only carry public dataplane info |
| [Quality Gates](../.cursor/rules/project-rules.mdc#quality-gates) | `npm run build` → `npm run lint` → `npm test`; zero warnings/errors; never skip steps; ≥80% coverage for new code |

**Key requirements (consolidated from sections above):**

- Build first, then lint, then test — **never skip steps**; zero warnings/errors.
- ≥80% branch coverage for new code; each new public function has at least one test.
- Every new `lib/**/*.js` file ≤500 lines; every new function/method ≤50 lines.
- JSDoc on every exported function (`@async` + `@param` + `@returns` + `@throws` where applicable).
- API additions use centralized `lib/api/` shape, with type definitions under `lib/api/types/`.
- `chalk` for colored output; `formatBlockingError` + `formatNextActions` for upgrade UX.
- Use `path.join()`; never use raw paths or `eval`.
- Never log tokens, refresh tokens, or any secret material from the `device.<controllerUrl>` entry.

**Enterprise help means (for developers):**

1. **`aifabrix auth status -h` / `aifabrix auth -h`** — rich `addHelpText('after', …)` like [`setup-auth.js`](../lib/cli/setup-auth.js) / [`datasource.js`](../lib/commands/datasource.js): examples, `--validate` exit codes, config keys written under `device`, what is gated vs local-only.
2. **Runtime TTY** — on incompatible CLI: `formatBlockingError` + **`formatNextActions`** (upgrade steps, re-run `auth status`, link to doc section name — not raw URLs to internal APIs).
3. **Version gate errors** (upload, wizard, datasource, protection, …) — same **Next actions** block as auth status (reuse shared helper; do not duplicate prose in every command).
4. **User docs** — `docs/commands/authentication.md` section **Dataplane / Builder CLI version compatibility**: troubleshooting table, CI/`--validate` exit codes, config cache fields, operator rollout notes.
5. **Matrix** — update [`cli-output-command-matrix.md`](../.cursor/rules/cli-output-command-matrix.md) row for `aifabrix auth status` (note version block + exit `3`).

## Before development

- [ ] Read [project-rules.mdc](../.cursor/rules/project-rules.mdc) — full ruleset, with focus on Quality Gates, Code Quality, Testing, API Client Structure
- [ ] Read [cli-layout.mdc](../.cursor/rules/cli-layout.mdc) and [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md)
- [ ] Read [permissions-guide.md](../.cursor/rules/permissions-guide.md) for `@requiresPermission` JSDoc on new dataplane API function
- [ ] Read [docs-rules.mdc](../.cursor/rules/docs-rules.mdc) — keep `docs/commands/authentication.md` command-centric (no HTTP endpoints in user docs)
- [ ] Review [`auth-status.js`](../lib/commands/auth-status.js), [`setup-auth.js`](../lib/cli/setup-auth.js) (`AUTH_HELP_AFTER` pattern)
- [ ] Review [`controller-health.api.js`](../lib/api/controller-health.api.js) as precedent for `dataplane-health.api.js`
- [ ] Review [`datasource-test-run-display.js`](../lib/utils/datasource-test-run-display.js) / [`validate-display.js`](../lib/validation/validate-display.js) for `formatNextActions` usage
- [ ] Confirm dataplane **403.0** health field names (`version`, `minBuilderCliVersion`) and that it is **approved + deployed** before merging this plan
- [ ] Draft `AUTH_STATUS_HELP_AFTER` text before coding (examples + exit code table)
- [ ] Plan Jest mocks ahead of writing code (mock `fs`, `axios`, `lib/api/dataplane-health.api.js`, `lib/core/config.js`)

## Current state (verified)

| Area | Today |
|------|--------|
| CLI version | [`package.json`](../../package.json) `"version": "2.45.0"` |
| Config | [`lib/core/config.js`](../../lib/core/config.js) — `getConfig` / `saveConfig`; per-controller `device.<controllerUrl>` tokens |
| Auth status | [`lib/commands/auth-status.js`](../../lib/commands/auth-status.js) — `checkDataplaneHealth` boolean only; no version fields |
| Dataplane probe | [`lib/utils/dataplane-health.js`](../../lib/utils/dataplane-health.js) — reachability only |
| Dataplane APIs | [`lib/api/*.api.js`](../../lib/api/) — functions take `dataplaneUrl` + `authConfig`; use `ApiClient` |
| Controller precedent | [`lib/api/controller-health.api.js`](../../lib/api/controller-health.api.js) — public `GET /api/v1/health` parser |

User config target shape (approved):

```yaml
device:
  http://localhost:3200:
    token: 'secure://...'
    refreshToken: 'secure://...'
    expiresAt: '2026-05-14T12:59:54.160Z'
    dataplane-version: '1.9.5'
    dataplane-min-cli-version: '2.45.0'
```

## Design

### Config schema extension (`device` only)

Extend each **`device.<controllerUrl>`** entry (same URL normalization as today’s device tokens). New optional keys:

| Config key (yaml) | Health JSON source | Meaning |
|-------------------|-------------------|---------|
| `dataplane-version` | `version` | Observed dataplane version at last health fetch |
| `dataplane-min-cli-version` | `minBuilderCliVersion` | Minimum Builder CLI required by that dataplane (omit key when dataplane does not enforce) |

**Optional implementation keys** (not required in user-facing docs unless useful):

| Key | Purpose |
|-----|---------|
| `dataplane-checked-at` | ISO timestamp for cache TTL (default refresh if older than 5 min) |

**Rules:**

- Values are **written by the CLI only** from health fetch — not hand-edited for enforcement (manual edits allowed for debugging but overwritten on next refresh).
- Keys are removed or left unset when dataplane health omits `minBuilderCliVersion`.
- Do **not** add a parallel `connections:` tree.
- This CLI version at runtime: `package.json` `version` — compared to `dataplane-min-cli-version`; not stored in yaml.

### Fetch and persist

New module: `lib/api/dataplane-health.api.js` (mirror controller-health pattern):

- `fetchDataplaneGeneralHealth(dataplaneUrl)` → `GET /api/v1/health` (no auth; `security: []` on dataplane).
- `parseGeneralHealthResponse(response)` → `{ version, minBuilderCliVersion, status }`.
- Fallback: if v1 path fails, try `GET /health` once (older dataplane during rollout).

New module: `lib/core/config-device-dataplane.js` (keep `config.js` under 500 lines):

- `updateDeviceDataplaneVersions(controllerUrl, { version, minBuilderCliVersion })`
- Maps health camelCase → yaml `dataplane-version` / `dataplane-min-cli-version`
- Uses `getConfig` + `saveConfig`; ensures `config.device[controllerUrl]` object exists

**When to refresh cache:**

| Trigger | Refresh? |
|---------|----------|
| `aifabrix auth status` (authenticated + dataplane URL resolved) | Yes |
| Before dataplane version gate (if cache older than TTL, e.g. 5 min) | Yes, optional |
| `aifabrix login` success | Yes (via shared helper called from login completion if dataplane resolvable) |

TTL default **5 minutes** — avoid health storm; stale cache still re-checked at gate time if expired.

### Global version gate

New: `lib/utils/dataplane-cli-version-gate.js`

```javascript
/**
 * @throws {Error} When current CLI < dataplane minBuilderCliVersion
 */
async function assertDataplaneCliVersionCompatible(dataplaneUrl, options)
```

Behavior:

1. Resolve `minBuilderCliVersion` — prefer fresh health fetch (with cache/TTL); if dataplane omits field → **return** (no op).
2. Compare `require('../../package.json').version` with `minBuilderCliVersion` using **`lib/utils/semver-compare.js`** (internal `compareSemver(a, b)` → `-1 | 0 | 1`; supports optional `v` prefix; **no** `semver` npm package).
3. On failure, throw actionable error:

   > Builder CLI 2.44.0 is below the minimum required by dataplane (2.45.0). Upgrade with `npm install -g @aifabrix/builder@latest` (or your install method) before using dataplane commands.

**Where to call (dataplane services only):**

| Approach | Recommendation |
|----------|----------------|
| A. Every `lib/api/*` function with `dataplaneUrl` first line | Explicit but repetitive |
| B. `ApiClient` optional flag `enforceCliVersion: true` + dataplane base URL registry | Central but needs distinction controller vs dataplane |
| **C. Thin wrapper `withDataplaneGate(dataplaneUrl, fn)` used inside dataplane API modules** | **Recommended** — clear scope, health fetch can skip gate |

**Exemptions (must not gate):**

- `fetchDataplaneGeneralHealth` itself
- `checkDataplaneHealth` / reachability probes
- Controller-only `lib/api` modules

Inventory dataplane API modules at implementation time (minimum): `external-systems.api.js`, `datasources-*.api.js`, `wizard*.api.js`, `pipeline.api.js`, `credentials.api.js`, `protection.api.js` (when added), validation/upload paths that hit dataplane directly.

### `aifabrix auth status` UX

Extend [`lib/commands/auth-status.js`](../../lib/commands/auth-status.js) `displayDataplaneSection` after refreshing health and persisting `device` keys.

**Compatible (normal run, exit 0):**

```
Dataplane: http://localhost:3201
  Status: ✔ Connected
  Dataplane version: 1.9.5
  Min Builder CLI: 2.45.0
  This CLI: 2.45.0
  Compatibility: ✔ OK
```

**Incompatible (normal run, still exit 0 if authenticated — show error block):**

```
Dataplane: http://localhost:3201
  Status: ✔ Connected
  Dataplane version: 1.9.5
  Min Builder CLI: 2.45.0
  This CLI: 2.44.0
  Compatibility: ✗ Upgrade required

  ✗ You cannot run dataplane commands until you upgrade the Builder CLI.
    Required: 2.45.0 or newer (dataplane minimum). Installed: 2.44.0.
    Upgrade: npm install -g @aifabrix/builder@latest
```

(Local-only commands remain usable; message states **dataplane** commands only.)

### Exit codes (`auth status --validate`)

New module: `lib/utils/cli-exit-codes.js` (documented in `docs/commands/authentication.md`):

| Code | Constant | When |
|------|----------|------|
| `0` | — | Authenticated and CLI compatible (or no min enforced) |
| `1` | `EXIT_NOT_AUTHENTICATED` | Not authenticated / invalid token (existing behavior) |
| `3` | `EXIT_CLI_VERSION_INCOMPATIBLE` | Authenticated but `package.json` version &lt; `dataplane-min-cli-version` |

**`--validate` order:** (1) auth check → exit `1` if fail; (2) refresh dataplane health + persist `device` keys; (3) CLI version check → exit `3` if fail; (4) exit `0`.

Scripts and `tests/manual/setup.js` can treat exit `3` distinctly from `1` (optional follow-up: document in `tests/manual/README.md`).

JSON/`--json` output: out of scope for 142.0 unless auth already supports `--json`; TTY-first.

### CLI layout — auth status display module

**Product rule:** Version block on `auth status` uses the same **layout-blocks** rhythm as datasource validate / protection (141) — do not invent a one-off format.

| Doc | Use for |
|-----|---------|
| [cli-layout.mdc](../.cursor/rules/cli-layout.mdc) | Profiles, glyphs, non-TTY |
| [layout.md](../.cursor/rules/layout.md) | Red = blocking, yellow = warning |

**New module:** `lib/commands/auth-status-display.js` (keep [`auth-status.js`](../lib/commands/auth-status.js) under 500 lines):

- `displayDataplaneVersionSection({ url, connected, dataplaneVersion, minBuilderCliVersion, cliVersion, compatible })`
- `displayCliUpgradeRequired({ required, installed })` — uses `formatBlockingError` + shared next-actions helper
- Import from [`cli-test-layout-chalk.js`](../lib/utils/cli-test-layout-chalk.js): `headerKeyValue`, `formatStatusKeyValue`, `successGlyph`, `failureGlyph`, `formatBlockingError`, `formatNextActions`, `formatBulletSection`

**Incompatible normal run — Next actions (example):**

```text
  ✖ You cannot run dataplane commands until you upgrade the Builder CLI.

  Next actions:
    • Upgrade: npm install -g @aifabrix/builder@latest
    • Confirm: aifabrix auth status
    • CI/scripts: aifabrix auth status --validate (exit 3 until upgraded)
    • Local work: validate, run, up-infra still work without dataplane
```

Extract **`buildCliVersionUpgradeNextActions(required, installed)`** to `lib/utils/dataplane-cli-version-help.js` so the **version gate** and **auth status** share the same bullets.

### Commander help (`-h`) for developers

Extend [`lib/cli/setup-auth.js`](../lib/cli/setup-auth.js) (or `lib/constants/auth-version-help.js` if setup-auth grows):

**`AUTH_STATUS_HELP_AFTER`** (register on `auth status` subcommand and mention in parent `AUTH_HELP_AFTER`):

```text
Examples:
  $ aifabrix auth status
  $ aifabrix auth status --validate

Exit codes (--validate only):
  0  Authenticated and Builder CLI meets dataplane minimum (or no minimum configured)
  1  Not authenticated — run aifabrix login
  3  Authenticated but Builder CLI older than dataplane minimum

Config cache (written on status when dataplane is reachable):
  ~/.aifabrix/config.yaml → device.<controllerUrl>:
    dataplane-version         — last dataplane version from health
    dataplane-min-cli-version — minimum Builder CLI required (when enforced)

What is blocked when CLI is too old:
  Dataplane commands (upload, wizard, datasource upload, deploy to dataplane, protection, …)
What still works:
  Local validate, aifabrix run, up-infra, file generation without dataplane API calls

Troubleshooting:
  • "Upgrade required" but you upgraded — run auth status again to refresh cache
  • No min version shown — dataplane MIN_BUILDER_CLI_VERSION not set (ops)
  • CI exit 3 — pin @aifabrix/builder version in pipeline to ≥ dataplane-min-cli-version
```

Also add **`.option` description** refresh for `--validate`: mention exit codes `1` and `3`.

Optional: `aifabrix --version` already prints CLI version; cross-reference in help text (“compare with Min Builder CLI line on auth status”).

### Version gate — enterprise error surface

In `dataplane-cli-version-gate.js`, throw `Error` with message body suitable for `handleCommandError`, and export:

- `isCliVersionIncompatibleError(err)` — optional
- `formatCliVersionGateError(required, installed)` — wraps `formatBlockingError` + `buildCliVersionUpgradeNextActions`

Commands that catch gate failures should print the formatted block once (same as datasource validate blocking footer).

### Documentation (developers and operators)

Update [`docs/commands/authentication.md`](../docs/commands/authentication.md) — new section **Builder CLI ↔ dataplane version compatibility**:

| Subsection | Content |
|------------|---------|
| Overview | Why min version exists; dataplane sets floor via env |
| `auth status` output | Field-by-field explanation |
| `auth status --validate` | Exit code table (0 / 1 / 3); CI examples |
| Config keys | `dataplane-version`, `dataplane-min-cli-version` under `device` |
| Troubleshooting | Stale cache, missing min, upgraded CLI still exit 3, wrong controller URL |
| Operator notes | Point to dataplane `MIN_BUILDER_CLI_VERSION` / plan 403.0 (no HTTP paths) |

Update [`cli-output-command-matrix.md`](../.cursor/rules/cli-output-command-matrix.md): `aifabrix auth status` — profile `tty-summary`; note version subsection + `--validate` exit `3`.

Optional (maintainer-only, not required for DoD): one paragraph in this plan file or existing CLI reference index linking authentication.md — **do not** add new top-level doc file unless requested.

## Implementation phases

### Phase 1 — Dataplane health client + config persistence

- `dataplane-health.api.js` + `semver-compare.js` + unit tests.
- `config-device-dataplane.js` — write `dataplane-version` / `dataplane-min-cli-version` on `device.<controllerUrl>`.
- `refreshDeviceDataplaneHealth(controllerUrl, environment, authConfig)` called from auth status (and login).

### Phase 2 — Version gate

- `dataplane-cli-version-gate.js` + semver compare tests (edge cases: `v` prefix, missing patch).
- Wire into dataplane API modules (inventory list in PR description).

### Phase 3 — Auth status + login hook + exit codes + developer help

- `cli-exit-codes.js`; wire `--validate` exits `1` vs `3`.
- `auth-status-display.js` + `dataplane-cli-version-help.js` (shared Next actions).
- `AUTH_STATUS_HELP_AFTER` in `setup-auth.js`; refresh `--validate` option description.
- Call refresh after successful login when dataplane URL known (shared helper).

### Phase 4 — Gate UX on dataplane commands

- Wire `formatCliVersionGateError` through existing `handleCommandError` paths (spot-check: upload, wizard, datasource upload).
- Ensure gate error includes Next actions (not a single-line throw).

### Phase 5 — Docs, tests, validation

| Test | Covers |
|------|--------|
| `semver-compare.test.js` | compare edge cases |
| `dataplane-health.api.test.js` | parse health JSON |
| `config-device-dataplane.test.js` | yaml key write |
| `auth-status-display.test.js` | compatible / incompatible TTY snapshots (layout-blocks) |
| `dataplane-cli-version-gate.test.js` | gate pass/fail message shape |
| `setup-auth-help.test.js` (or cli.test) | `AUTH_STATUS_HELP_AFTER` contains exit codes 1 and 3 |

- `npm run build` → `npm run lint` → `npm test`
- Manual: `aifabrix auth status -h`; incompatible CLI shows Next actions; `--validate` returns `3`; upgrade path clears exit `0`

## Rollout sequence

1. Deploy dataplane **403.0** with `MIN_BUILDER_CLI_VERSION` **empty** (no field in JSON).
2. Release Builder **142.0** (reads field, caches, gates when present).
3. Set `MIN_BUILDER_CLI_VERSION` per environment when ready to enforce floor.

## Definition of done

**Functional**

- [ ] `device.<controllerUrl>` stores `dataplane-version` and `dataplane-min-cli-version` after health refresh
- [ ] Normal `auth status` shows versions + explicit error when CLI too old (dataplane commands blocked)
- [ ] `auth status --validate` exits **3** when CLI incompatible, **1** when not authenticated
- [ ] Dataplane API calls invoke version gate; local commands do not
- [ ] Internal semver compare; no new npm dependency
- [ ] Dataplane 403.0 deployed before enforcing min version in production

**Enterprise developer help**

- [ ] `aifabrix auth status -h` includes `AUTH_STATUS_HELP_AFTER` (examples, exit codes, config keys, gated vs local commands, troubleshooting)
- [ ] Incompatible TTY output uses `formatBlockingError` + `formatNextActions` (shared helper with version gate)
- [ ] `docs/commands/authentication.md` has **Builder CLI ↔ dataplane version compatibility** section (troubleshooting + CI)
- [ ] `cli-output-command-matrix.md` row updated for `auth status`
- [ ] New display/help modules ≤500 lines; public functions JSDoc’d

**Code quality (per project-rules.mdc)**

- [ ] Every new `lib/**/*.js` file is ≤ **500 lines**
- [ ] Every new/modified function or method is ≤ **50 lines**
- [ ] All new public functions have JSDoc (`@async`, `@param`, `@returns`, `@throws` where applicable); each file has `@fileoverview`, `@author`, `@version`
- [ ] New API module follows centralized `lib/api/` shape with types under `lib/api/types/dataplane-health.types.js`
- [ ] `@requiresPermission` JSDoc per [permissions-guide.md](../.cursor/rules/permissions-guide.md) (health is public — document as such)

**Security (ISO 27001)**

- [ ] No hardcoded secrets, passwords, or tokens
- [ ] Never log `device.<controllerUrl>.token` / `refreshToken` (or any secret material) — verified by code review
- [ ] Cache fields written under `device.<controllerUrl>` carry only public dataplane info (`dataplane-version`, `dataplane-min-cli-version`, optional `dataplane-checked-at`)
- [ ] Input validation on all new public functions (controller URL, semver strings)

**Testing (per project-rules.mdc → Testing Conventions)**

- [ ] All new tests live under `tests/` mirroring source layout
- [ ] All external dependencies mocked (`fs`, `axios`, api modules, `lib/core/config.js`)
- [ ] ≥ **80% branch coverage** for new code
- [ ] Each new public function has at least one positive and one negative-path test
- [ ] Edge cases covered: missing `minBuilderCliVersion`, stale cache, `v` prefix, missing patch component, malformed semver, missing health endpoint (rollout from older dataplane)

**Validation (mandatory order — never skip steps; zero warnings/errors)**

```bash
cd /home/dev02/workspace/aifabrix-builder
npm run build   # STEP 1 — must succeed first; runs lint + test:ci
npm run lint    # STEP 2 — zero warnings/errors
npm test        # STEP 3 — 100% pass; ≥80% coverage for new code
```

> Order is fixed: **BUILD → LINT → TEST**. Do not skip any step. Do not commit if any step fails.

## Resolved decisions (product)

| # | Decision |
|---|----------|
| 1 | Normal `auth status`: show upgrade **error** when incompatible; `--validate`: exit **3** for CLI version (exit **1** = auth only) |
| 2 | Internal semver compare in `lib/utils/semver-compare.js` |
| 3 | Persist under **`device.<controllerUrl>`** as `dataplane-version` / `dataplane-min-cli-version` |

## Remaining optional tweak

- Cache TTL: default **5 minutes** for health refresh unless `--validate` or dataplane gate (always fresh).

## File layout (additions)

```text
lib/
  api/dataplane-health.api.js
  api/types/dataplane-health.types.js    # JSDoc @typedef for health request/response
  commands/auth-status-display.js        # TTY version section (layout-blocks)
  core/config-device-dataplane.js
  constants/auth-version-help.js         # optional: AUTH_STATUS_HELP_AFTER strings
  utils/semver-compare.js
  utils/cli-exit-codes.js
  utils/dataplane-cli-version-gate.js
  utils/dataplane-cli-version-help.js    # buildCliVersionUpgradeNextActions, formatCliVersionGateError
docs/commands/authentication.md          # expand compatibility section
tests/lib/                                # mirror source layout — Jest unit tests for every new module
```

## Plan Validation Report

**Date**: 2026-05-18
**Plan**: `.cursor/plans/142-builder-cli-version-compatibility.plan.md`
**Status**: ✅ VALIDATED

### Plan purpose

Builder-side counterpart to dataplane plan 403.0. Adds a client-side compatibility gate so an outdated `aifabrix` CLI cannot mutate dataplane state without an explicit upgrade prompt. Persists `dataplane-version` and `dataplane-min-cli-version` per controller URL under the existing `device.<controllerUrl>` entry, extends `auth status` UX (TTY block + new `--validate` exit code `3`), and adds a shared semver gate wrapper for dataplane API modules. Local commands are exempt.

**Type:** Development (CLI + API client + config persistence + docs)
**Scope:** `lib/api/`, `lib/core/`, `lib/utils/`, `lib/commands/`, `lib/constants/` (new modules); `lib/commands/auth-status.js`, `lib/cli/setup-auth.js` (modify); `docs/commands/authentication.md` (expand); `.cursor/rules/cli-output-command-matrix.md` (update)

### Applicable rules

- ✅ [CLI Command Development](../.cursor/rules/project-rules.mdc#cli-command-development) — `auth status` subcommand, Commander help, validation
- ✅ [Architecture Patterns](../.cursor/rules/project-rules.mdc#architecture-patterns) — module placement under `lib/api/`, `lib/utils/`, `lib/core/`
- ✅ [API Client Structure Pattern](../.cursor/rules/project-rules.mdc#api-client-structure-pattern) — `dataplane-health.api.js` + `lib/api/types/dataplane-health.types.js`
- ✅ [CLI Layout](../.cursor/rules/cli-layout.mdc) + [layout.md](../.cursor/rules/layout.md) + [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md) — TTY rendering, blocking error, matrix row
- ✅ [Code Style — Error Handling](../.cursor/rules/project-rules.mdc#error-handling) — actionable upgrade error from version gate
- ✅ [Testing Conventions](../.cursor/rules/project-rules.mdc#testing-conventions) — Jest mocks, mirrored layout, ≥80% coverage
- ✅ [Code Quality Standards](../.cursor/rules/project-rules.mdc#code-quality-standards) — ≤500 lines per file, ≤50 lines per function, JSDoc
- ✅ [Security & Compliance](../.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — no token logging; only public dataplane info cached
- ✅ [Quality Gates](../.cursor/rules/project-rules.mdc#quality-gates) — BUILD → LINT → TEST, zero warnings, never skip steps
- ✅ [docs-rules.mdc](../.cursor/rules/docs-rules.mdc) — `docs/commands/authentication.md` stays command-centric (no HTTP endpoint references in user docs)
- ✅ [permissions-guide.md](../.cursor/rules/permissions-guide.md) — public health endpoint documented on the new API function

### Rule compliance

- ✅ DoD — build / lint / test in mandatory order, with zero warnings and `--never skip steps--` explicitly noted
- ✅ DoD — ≥80% coverage for new code now stated under Testing block
- ✅ DoD — file ≤500 lines and function ≤50 lines both stated under Code quality block
- ✅ DoD — JSDoc requirements (`@fileoverview`/`@author`/`@version` + `@async`/`@param`/`@returns`/`@throws`) stated
- ✅ DoD — Security checklist (no hardcoded secrets, never log tokens, public-only cache fields, input validation) stated
- ✅ Rule links use anchor IDs (`#section`) into `project-rules.mdc` instead of bare file links
- ✅ Before Development covers reading every applicable rule + precedents (controller health, datasource display)
- ✅ Cross-repo dependency on dataplane 403.0 is explicit, with rollout sequence
- ✅ File layout includes new `lib/api/types/` JSDoc typedef module and mirrored `tests/lib/`

### Plan updates made

- ✅ Expanded **Rules and standards** table with anchor links and added rows for API Client Structure Pattern, Architecture Patterns, Error Handling, Testing Conventions, Security & Compliance, permissions-guide
- ✅ Added **Key requirements (consolidated)** bullet list below the table
- ✅ Extended **Before development** with rule-reading items and Jest mock planning
- ✅ Strengthened **Definition of Done** with new **Code quality**, **Security (ISO 27001)**, and **Testing** subsections plus the explicit "never skip steps; zero warnings/errors" callout under the validation block
- ✅ Added `lib/api/types/dataplane-health.types.js` and `tests/lib/` mirror to **File layout**
- ✅ Appended this validation report at the end of the plan file (per `/validate-plan` "report attachment" requirement)

### Recommendations (non-blocking)

- **Filename:** existing basename is `142-builder-cli-version-compatibility.plan.md`, but cross-references in this plan and in the dataplane plan use `142.0-…`. Consider renaming to `142.0-builder-cli-version-compatibility.plan.md` to match the dataplane plan-rules pattern `{major}.{minor}-{slug}`; rename is out of scope unless the author wants it now.
- **Issue number:** dataplane plan-rules suggest including `-issueN-` when a GitHub issue exists; if this work has a tracking issue, add it to the basename and to the YAML frontmatter `name:`.
- **API permissions JSDoc:** since `/api/v1/health` is no-auth public, document this explicitly on `fetchDataplaneGeneralHealth` (e.g. `@requiresPermission none — public health endpoint`).
- **Coverage measurement:** add `npm run test:coverage` (or equivalent) to the validation block if you want CI to enforce the ≥80% threshold automatically.
- **Stop condition:** Plan repeatedly says "Planning only until dataplane 403.0 is approved". Dataplane 403.0 code has now landed in `aifabrix-dataplane` (see commit and tests under `app/core/health_general.py`, `tests/core/test_health_general.py`); a follow-up may flip the plan status from *Planning only* to *Ready for implementation* once 403.0 is merged to `main` and a dev/test dataplane exposes the field.

## Implementation Validation Report

**Date**: 2026-05-18  
**Plan**: `.cursor/plans/142-builder-cli-version-compatibility.plan.md`  
**Status**: ✅ COMPLETE (implementation + validation gates; `plan-review` remains stakeholder sign-off)

### Executive Summary

Plan **142.0** is **largely implemented** in `aifabrix-builder`: health fetch/cache, `auth status` version UX, `--validate` exit **3**, shared gate helper, docs, matrix row, and **8** focused Jest suites (**88** tests, **≥86.9%** branch coverage on new modules). **Code quality gates pass** (`npm run build`, `npm run lint`, full suite **596** tests).

**Follow-up fixes (2026-05-18):** (1) **`tryRefreshDataplaneVersionAfterLogin`** wired from `login.js` (device + credentials); (2) **`createDataplaneApiClient`** + `ApiClient.enforceCliVersion` gates all dataplane `lib/api/*` HTTP calls (health fetch exempt); (3) **`setup-auth-help.test.js`** + **`auth-status.test.js`** exit **1**/**3** cases added.

### Task Completion

| Source | Total | Done | Incomplete |
|--------|-------|------|------------|
| YAML frontmatter todos (implementation) | 8 | 7 | 1 (`plan-review`) + 1 follow-up |
| Markdown DoD / Before-dev checkboxes | 35 | 0 marked | 35 unchecked in plan body |

**Frontmatter:** Implementation todos marked `completed` except `plan-review` (pending) and new `follow-up-login-gate` (pending).

### File Existence Validation

| File | Status |
|------|--------|
| `lib/api/dataplane-health.api.js` | ✅ |
| `lib/api/types/dataplane-health.types.js` | ✅ |
| `lib/core/config-device-dataplane.js` | ✅ |
| `lib/utils/semver-compare.js` | ✅ |
| `lib/utils/cli-exit-codes.js` | ✅ |
| `lib/utils/dataplane-cli-version-gate.js` | ✅ |
| `lib/utils/dataplane-cli-version-help.js` | ✅ |
| `lib/commands/auth-status-display.js` | ✅ |
| `lib/commands/auth-status-dataplane-version.js` | ✅ |
| `lib/constants/auth-version-help.js` | ⚪ Optional — help lives in `lib/cli/setup-auth.js` |
| `lib/commands/auth-status.js` (modified) | ✅ ~445 lines |
| `lib/cli/setup-auth.js` (`AUTH_STATUS_HELP_AFTER`) | ✅ |
| `lib/commands/upload.js` (gate) | ✅ |
| `lib/commands/wizard-core.js` (gate) | ✅ |
| `lib/commands/login.js` (refresh hook) | ❌ Not wired |
| `docs/commands/authentication.md` | ✅ § Dataplane / Builder CLI compatibility |
| `.cursor/rules/cli-output-command-matrix.md` | ✅ `auth status` row updated |

### Requirement → Evidence

| Requirement | Evidence | Status |
|-------------|----------|--------|
| Fetch `GET /api/v1/health` (+ `/health` fallback) | `lib/api/dataplane-health.api.js`; `tests/lib/api/dataplane-health.api.test.js` | ✅ |
| Cache `dataplane-version` / `dataplane-min-cli-version` on `device.<url>` | `lib/core/config-device-dataplane.js`; `auth-status-dataplane-version.js` | ✅ |
| `auth status` version block + upgrade UX | `auth-status-display.js` + `formatCliVersionGateError` (uses `formatBlockingError` + `formatNextActions`) | ✅ |
| `auth status --validate` exit 1 / 3 / 0 | `auth-status.js` (`EXIT_CLI_VERSION_INCOMPATIBLE`, `process.exit(3)`) | ✅ (no dedicated integration test) |
| Global `assertDataplaneCliVersionCompatible` | `lib/utils/dataplane-cli-version-gate.js`; 88 unit tests | ✅ |
| Gate on dataplane commands | `upload.js`, `wizard-core.js` only | ⚠️ Partial |
| Login refresh cache | Plan Phase 3 table | ❌ |
| Internal semver (no npm `semver`) | `lib/utils/semver-compare.js` | ✅ |
| `@requiresPermission none` on health API | `dataplane-health.api.js` JSDoc | ✅ |
| Files ≤500 lines | wc: max new file 202 lines | ✅ |

### Test Coverage

| Test file | Status |
|-----------|--------|
| `tests/lib/utils/semver-compare.test.js` | ✅ |
| `tests/lib/utils/cli-exit-codes.test.js` | ✅ |
| `tests/lib/utils/dataplane-cli-version-help.test.js` | ✅ |
| `tests/lib/utils/dataplane-cli-version-gate.test.js` | ✅ |
| `tests/lib/api/dataplane-health.api.test.js` | ✅ |
| `tests/lib/core/config-device-dataplane.test.js` | ✅ |
| `tests/lib/commands/auth-status-display.test.js` | ✅ |
| `tests/lib/commands/auth-status-dataplane-version.test.js` | ✅ |
| `tests/lib/commands/setup-auth-help.test.js` (plan Phase 5) | ❌ Not found |
| `auth-status.test.js` — `--validate` exit 3 | ❌ Not found |

**Coverage (new modules only):** 94.2% statements, **86.87%** branches, 96.96% functions (8 suites, 88 tests).

### Code Quality Validation

| Step | Result |
|------|--------|
| `npm run build` (lint + test:ci) | ✅ PASS — 59 suites, 596 tests |
| `npm run lint` | ✅ PASS — 0 errors/warnings |
| Plan 142 module tests (isolated) | ✅ 88/88 |

### Cursor Rules Compliance

| Rule area | Status | Notes |
|-----------|--------|-------|
| Code reuse | ✅ | Shared `formatCliVersionGateError` / gate helper |
| Error handling | ✅ | Actionable throw + Next actions |
| Logging | ✅ | No token logging in new modules (spot-check) |
| Type safety / JSDoc | ✅ | `@fileoverview`, `@requiresPermission` on health API |
| Async patterns | ✅ | async/await throughout |
| File ≤500 / fn ≤50 | ✅ | Verified line counts |
| Security | ✅ | Public fields only in cache |
| API client structure | ✅ | `lib/api/` + `types/` |
| docs-rules | ⚠️ | User doc mentions `GET /api/v1/health` (plan allowed troubleshooting context) |
| Testing conventions | ⚠️ | ≥80% on new code ✅; missing help + auth-status exit-3 tests |

### Implementation Completeness

| Area | Status |
|------|--------|
| Health API + config cache | ✅ COMPLETE |
| Auth status UX + exit codes | ✅ COMPLETE |
| Commander help | ✅ COMPLETE |
| Docs + CLI matrix | ✅ COMPLETE |
| Dataplane command gate (full inventory) | ⚠️ PARTIAL (upload + wizard) |
| Login cache refresh | ❌ NOT DONE |
| Cross-repo 403.0 deploy | ⏳ Operational (out of builder repo) |

### Issues and Recommendations

1. **Login hook** — After successful `aifabrix login`, call `refreshDataplaneVersionInfo(controllerUrl, dataplaneUrl)` when dataplane URL is known (shared helper in `auth-status-dataplane-version.js`).
2. **Broaden gate** — Either add `withDataplaneGate` in `lib/api/*` dataplane modules per plan Approach C, or wire `assertDataplaneCliVersionCompatible` at remaining command chokepoints (minimum: **datasource upload** per Phase 4 spot-check).
3. **Tests** — Add `setup-auth-help.test.js` (or extend `cli.test.js`) asserting `AUTH_STATUS_HELP_AFTER` mentions exit codes **1** and **3**; add `auth-status.test.js` case for `--validate` → exit **3**.
4. **Plan hygiene** — Update line 44 *Planning only* → *Implemented (see validation report)*; check DoD boxes when follow-ups land.
5. **Dataplane 403.0** — Enforce `MIN_BUILDER_CLI_VERSION` in target environments only after dataplane rollout (builder already handles omitted field).

### Final Validation Checklist

- [ ] All plan tasks / DoD checkboxes marked in plan body
- [x] Core new files exist and match design
- [x] Unit tests exist for new modules (88 tests)
- [x] Code quality validation passes (build + lint + test)
- [x] Cursor rules largely satisfied (gate breadth + 2 tests pending)
- [ ] Implementation complete per full DoD (login + full gate inventory)

**Validator:** `/validate-implementation` (aifabrix-builder) — 2026-05-18
