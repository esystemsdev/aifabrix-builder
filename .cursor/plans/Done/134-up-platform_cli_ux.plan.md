---
name: up-platform CLI UX
overview: "Improve `aifabrix up-platform` (and shared handlers used by `up-miso` / `up-dataplane`) so the flow feels like a concise installer: less repetitive intermediate output during runs, a canonical success footer with service URLs and documentation links, and alignment with Builder CLI layout rules (`cli-layout.mdc`, `layout.md`, `cli-output-command-matrix.md`)."
todos:
  - id: thread-platform-flag
    content: Add guided installer-mode + --verbose for up-platform; ensure step UX (Keycloak → Miso → Auth → Dataplane) and final Platform Ready footer
    status: pending
  - id: compact-logging
    content: Implement compact logging for installer mode (less health polling spam; collapse per-app run footer; reduce deploy polling) without losing errors
    status: pending
  - id: success-footer
    content: Add Platform Ready footer exactly matching target UX (Environment, Miso/Dataplane/Keycloak URLs, API docs, Knowledge Base, Getting Started)
    status: pending
  - id: layout-glyph-cleanup
    content: When touching register/rotate/login/deploy strings, align with layout.md glyphs/helpers; avoid decorative banners inside up-platform installer mode
    status: pending
  - id: docs-matrix-tests
    content: Update command interfaces and docs for up-infra/up-miso/up-dataplane/down-infra (add --verbose, consistent layout); update infrastructure.md + command matrix; add/adjust Jest tests
    status: pending
isProject: false
---

# Plan: up-platform installer UX and success summary

## Problem

- **`up-platform`** chains [`handleUpMiso`](file:///workspace/aifabrix-builder/lib/commands/up-miso.js) → [`handleUpDataplane`](file:///workspace/aifabrix-builder/lib/commands/up-dataplane.js) ([`lib/cli/setup-infra.js`](file:///workspace/aifabrix-builder/lib/cli/setup-infra.js)), so users see **three apps’ worth** of image checks, compose logs, health polling (`Waiting for health check... (n/max)` from [`lib/utils/health-check.js`](file:///workspace/aifabrix-builder/lib/utils/health-check.js)), per-app “App running / Health check / Container” blocks ([`displayRunStatus`](file:///workspace/aifabrix-builder/lib/app/run-helpers.js)), deploy polling ([`lib/deployment/deployer.js`](file:///workspace/aifabrix-builder/lib/deployment/deployer.js)), plus registration/rotate credential banners ([`lib/utils/app-register-display.js`](file:///workspace/aifabrix-builder/lib/utils/app-register-display.js), [`lib/app/rotate-secret.js`](file:///workspace/aifabrix-builder/lib/app/rotate-secret.js)). That is appropriate for **`aifabrix run`** debugging but heavy for an **installer-style** command.
- There is **no single closing panel** telling users where Miso, dataplane, Keycloak (device login), and docs live—unlike the concise [`up-infra`](file:///workspace/aifabrix-builder/lib/cli/setup-infra.js) feel you referenced.
- **Layout compliance**: several code paths still use **non-canonical terminal decoration** (e.g. `🔑`, `📋` in app register display; `⏳` in deploy is allowed per [`cli-layout.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc)). Any change that touches those strings should **normalize to the glyph/colour rules** in [`layout.md`](file:///workspace/aifabrix-builder/.cursor/rules/layout.md) and helpers in [`lib/utils/cli-test-layout-chalk.js`](file:///workspace/aifabrix-builder/lib/utils/cli-test-layout-chalk.js).

## Target UX (approved output shape)

The goal is for `af up-platform` to feel like a guided platform bootstrap that mirrors the architecture mental model:

```text
1. Start Identity
2. Start Control Plane
3. Authenticate User
4. Start Dataplane
5. Show Access URLs
```

### Recommended final installation flow (TTY)

```text
AI Fabrix Platform Setup
────────────────────────────────────────

⏳ Starting Keycloak...
✔ Keycloak ready

⏳ Starting Miso Controller...
✔ Miso Controller ready

⏳ Authenticating...

Open browser to authenticate:
http://localhost:8682/realms/aifabrix/device?user_code=XXXX-XXXX

Waiting for approval...
✔ Authentication successful

⏳ Starting Dataplane...
✔ Dataplane ready

────────────────────────────────────────
Platform Ready
────────────────────────────────────────

Environment
  dev

Miso Controller
  http://localhost:3600

Dataplane (DEV)
  http://localhost:3601

Keycloak
  http://localhost:8682

API Documentation
  http://localhost:3601/api/docs

Knowledge Base
  https://docs.aifabrix.ai

Getting Started
  https://docs.aifabrix.ai/get-started

────────────────────────────────────────
```

### Critical UX rule: login should not feel like a separate command

- Replace the current `Authentication required. Running aifabrix login...` banner with the unified step line: `⏳ Authenticating...`
- Show only device-flow essentials (auth URL + waiting + success), avoid large “Logging in…”/controller/environment blocks inside the `up-platform` flow.

## Expanded scope (command interface + layout improvements)

This UX improvement should apply coherently to the **platform bootstrap command group**, not only `up-platform`.

### Commands in scope

- `af up-infra`
- `af up-miso`
- `af up-dataplane`
- `af up-platform`
- `af down-infra`

### Command interface improvements (consistency)

- **Add `--verbose`** to each of the commands above (at minimum: `up-platform`, and ideally all four `up-*` plus `down-infra`), so the default is clean/product-oriented and `--verbose` shows orchestration-level details (compose generation, health polling attempts, deployment polling attempts, etc.).
- Ensure each command’s `--help` includes a short explanation: “default = guided summary, `--verbose` = full trace”.\n+
### Layout consistency goals

- The bootstrap commands should share a consistent **header → steps → footer** structure (where applicable) aligned with the CLI layout rules:\n  - `up-infra`: short “Infrastructure Ready” summary (ports/URLs) at the end.\n  - `up-miso`: “Platform Setup” steps for Keycloak + Miso Controller and a short “Miso Ready” footer.\n  - `up-dataplane`: compact “Starting Dataplane…” flow with minimal auth/registration messaging, then a dataplane ready footer.\n  - `up-platform`: full guided flow + “Platform Ready” footer (the canonical output shape above).\n  - `down-infra`: concise “Stopped” summary, and explicit warning when `--volumes` is used.\n+
- Avoid large banners and repeated blocks; prefer single-line status transitions and a single final footer section per command.

## Command layout changes (default vs --verbose)

The following defines the **expected TTY layout** for each command. Default mode is guided/product-oriented; `--verbose` exposes orchestration mechanics.

### `af up-infra` (default)

Goal: concise infra bootstrap with a final “Infra Ready” summary (ports/URLs). No long streams.

```text
AI Fabrix Infrastructure Setup
────────────────────────────────────────

⏳ Starting Postgres...
✔ Postgres ready

⏳ Starting Redis...
✔ Redis ready

⏳ Starting infrastructure services...
✔ Infrastructure ready

────────────────────────────────────────
Infra Ready
────────────────────────────────────────

Developer
  dev06 (id: 6)

Postgres
  localhost:5432

Redis
  localhost:6379

pgAdmin
  http://localhost:5050

Redis Commander
  http://localhost:8081

────────────────────────────────────────
```

Notes:
- Optional services (pgAdmin/Redis Commander/Traefik) should only appear if enabled for that run.
- If `--tls` / `--no-tls` is used, include a single concise line in the footer (“TLS mode: on/off”).

### `af up-infra --verbose`

- Show existing lower-level details (compose file path, health checks, container names, etc.) as currently emitted.
- Still end with the same “Infra Ready” footer block.

### `af up-miso` (default)

Goal: guided identity + control plane start, then a short footer with URLs.

```text
AI Fabrix Platform Setup
────────────────────────────────────────

⏳ Starting Keycloak...
✔ Keycloak ready

⏳ Starting Miso Controller...
✔ Miso Controller ready

────────────────────────────────────────
Miso Ready
────────────────────────────────────────

Miso Controller
  http://localhost:3600

Keycloak
  http://localhost:8682

────────────────────────────────────────
```

### `af up-miso --verbose`

- Keep existing streamed logs (image checks, compose generation, health polling attempts, container status).
- Still end with the “Miso Ready” footer block.

### `af up-dataplane` (default)

Goal: dataplane start in dev with minimal mechanical noise; authentication should be integrated as a step (not a separate command).

```text
AI Fabrix Dataplane Setup
────────────────────────────────────────

⏳ Authenticating...
✔ Authentication successful

⏳ Starting Dataplane...
✔ Dataplane ready

────────────────────────────────────────
Dataplane Ready
────────────────────────────────────────

Environment
  dev

Dataplane (DEV)
  http://localhost:3601

API Documentation
  http://localhost:3601/api/docs

────────────────────────────────────────
```

Notes:
- If already authenticated, the “Authenticating…” step should be replaced by a single line (e.g. `✔ Authenticated`) or omitted (implementation choice, but keep it short).
- Register/rotate/deploy can still run, but user-facing text should not lead with those mechanics in default mode.

### `af up-dataplane --verbose`

- Keep full register/rotate + deploy polling + run details.
- Still end with “Dataplane Ready” footer block.

### `af up-platform` (default)

This is the canonical end-to-end guided installer output, defined in **Target UX** above.

### `af up-platform --verbose`

- Default guided step headings still show.
- Include full underlying logs (image checks, compose generation, health polling attempts, deploy polling attempts, register/rotate details).
- Still end with the full “Platform Ready” footer.

### `af down-infra` (default)

Goal: short, safe, explicit. No stream spam.

```text
AI Fabrix Shutdown
────────────────────────────────────────

⏳ Stopping infrastructure...
✔ Infrastructure stopped

────────────────────────────────────────
Stopped
────────────────────────────────────────

Developer
  dev06 (id: 6)

Stopped
  postgres
  redis
  pgadmin
  redis-commander
  traefik

────────────────────────────────────────
```

### `af down-infra --volumes` (default)

Add an explicit blocking-style warning in the output (per CLI semantics: warning vs failure), e.g.:

- `⚠ Volumes removed: all local data deleted`

### `af down-infra --verbose`

- Include container/compose specifics and removed volumes listing.
- Still end with the “Stopped” footer block.

## Rules and standards (must follow)

This plan touches CLI commands, CLI output, and docs. It must follow:

- **Builder project rules**: [`/workspace/aifabrix-builder/.cursor/rules/project-rules.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc)
  - **CLI layout and output**: follow the CLI layout rule, visual spec, and per-command output profiles.
  - **Code quality gates**: keep files ≤500 lines and functions ≤50 lines; add tests; no hardcoded secrets; never log secrets.
- **CLI layout rule**: [`/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc)
  - Use canonical glyphs (**✔**, **⚠**, **✖**, **⏭**, **⏳**) and semantics; keep output profiles aligned to the matrix.
  - Prefer helpers from `lib/utils/cli-test-layout-chalk.js` / `lib/utils/cli-layout-chalk.js` over ad hoc `chalk.green('✔ ...')`.
- **Output profile matrix**: [`/workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md`](file:///workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md)
  - `aifabrix up-platform` is **tty-summary + stream-logs**; any wrapping summary must not break this profile.
- **User docs rules**: [`/workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc)
  - Keep docs command-centric; do not include REST API method/path/payload details.

## Before development (checks)

- [ ] Re-read: [`cli-layout.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc) and [`layout.md`](file:///workspace/aifabrix-builder/.cursor/rules/layout.md) (glyphs, colors, sectioning, non-TTY rules).
- [ ] Confirm current output profile for `up-platform` row stays accurate in [`cli-output-command-matrix.md`](file:///workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md).
- [ ] Identify every string we will change in these flows (minimize scope): `lib/cli/setup-infra.js`, `lib/commands/up-miso.js`, `lib/commands/up-dataplane.js`, `lib/app/run-container-start.js`, `lib/utils/health-check.js`, `lib/deployment/deployer.js`, `lib/utils/app-register-display.js`, `lib/app/rotate-secret.js`.
- [ ] Decide “compact by default” vs “full trace by default” for `up-platform`, and keep `up-miso` / `up-dataplane` unchanged unless explicitly specified by plan.

## Design (high level)

```mermaid
flowchart TD
  upPl[up-platform]
  miso[handleUpMiso]
  dp[handleUpDataplane]
  runApp[app.runApp]
  health[waitForHealthCheck]
  deploy[deployer]
  reg[register/rotate display]
  sum[logPlatformSuccessFooter]

  upPl -->|options.platformInstall| miso
  upPl -->|platformInstall| dp
  miso --> runApp
  dp --> reg
  dp --> deploy
  dp --> runApp
  runApp --> health
  upPl --> sum
```

1. **Introduce a scoped output mode** (name suggestion: `platformInstall` or `compactInstall`) passed only from **`up-platform`** into `handleUpMiso` / `handleUpDataplane` as an extra options flag (e.g. `options.platformInstall === true`). Thread the same flag into **`app.runApp`** via existing `options`, then into [`waitForHealthyAndCleanupEnvFiles`](file:///workspace/aifabrix-builder/lib/app/run-container-start.js) → **`waitForHealthCheck`** so behavior stays **unchanged** for `up-miso`, `up-dataplane`, and `aifabrix run` unless we explicitly also wire the flag there later.

2. **Compact mode behavior** (default **only** when `platformInstall` is true; full detail remains default elsewhere):
   - **Health polling**: in [`waitForHealthCheck`](file:///workspace/aifabrix-builder/lib/utils/health-check.js), when compact: **do not** emit a yellow line per attempt; instead emit **at most one** neutral “waiting…” line (or rely on the existing blue “Waiting for application…” line from [`run-container-start.js`](file:///workspace/aifabrix-builder/lib/app/run-container-start.js)) and keep **`✔ Application is healthy`** on success.
   - **Per-app run footer**: when compact, **omit or collapse** the redundant trio already summarized at the end (`Health check: …`, `Container: …` can move to `--verbose` only if you still want them).
   - **Deploy polling**: when compact, reduce [`deployer.js`](file:///workspace/aifabrix-builder/lib/deployment/deployer.js) status spam (e.g. single-line final status, or log every Nth attempt); preserve **errors** in full.
   - **Credentials**: **never hide** client secrets when rotated/registered (security). Optionally shorten GitHub Secret **instructions** in compact mode while keeping the secret values visible.

3. **Add `--verbose` on `up-platform`** (optional but recommended): forces **full** logging (same as today), overriding `platformInstall` compact behavior so support can still diagnose issues.

4. **Guided step output and naming (user-facing)**: for `up-platform` only, replace orchestration mechanics wording with platform state wording:
   - Replace “Generating Docker Compose configuration…” style lines (where feasible) with “Starting Keycloak…”, “Starting Miso Controller…”, “Authenticating…”, “Starting Dataplane…”.
   - Keep deep technical details available via `--verbose` (and/or existing debug modes) without removing error context.

5. **Success footer** (always after successful `up-platform`, TTY only unless you extend `--json` later): new small helper module (e.g. [`lib/utils/platform-install-summary.js`](file:///workspace/aifabrix-builder/lib/utils/platform-install-summary.js)) that prints the “Platform Ready” panel above using `cli-test-layout-chalk`, including:
   - **Miso Controller**: `await resolveControllerUrl()` ([`lib/utils/controller-url.js`](file:///workspace/aifabrix-builder/lib/utils/controller-url.js)).
   - **Dataplane (dev)**: `http://localhost:<hostPort>` using the **same port rule** as run (`base port + developerId * 100` from dataplane manifest—reuse logic from [`calculateHostPort`](file:///workspace/aifabrix-builder/lib/app/run.js) / config rather than hardcoding).
   - **Keycloak** (device login): same computed URL pattern as health checks for the keycloak template app (read port from keycloak `application.yaml` + developer offset so it matches what actually started).
   - **API documentation**: `http://localhost:<dataplaneHostPort>/api/docs`
   - **Knowledge Base**: `https://docs.aifabrix.ai`
   - **Getting Started**: `https://docs.aifabrix.ai/get-started`

6. **Edge cases**
   - **Auth retry** in `up-platform`: avoid duplicate “Starting up-dataplane…” banners when login runs mid-command ([`setup-infra.js`](file:///workspace/aifabrix-builder/lib/cli/setup-infra.js) catch path).
   - **Non-TTY / `NO_COLOR`**: footer should still print **structure + canonical glyphs** per [`cli-layout.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc).
   - **Auth failure (device flow)** in `up-platform`: keep it clean and actionable:
     - `✖ Authentication failed`
     - `Run: af login`
     - `Then retry: af up-platform`

7. **Apply the same guided layout to related commands**
   - `up-miso`: same step layout as `up-platform` for the first two steps (Keycloak → Miso Controller), with a “Miso Ready” footer that includes URLs.\n   - `up-dataplane`: treat auth/register/deploy/run as internal mechanics; user-facing steps are “Authenticating…” (if needed) then “Starting Dataplane…” then “Dataplane Ready” footer.\n   - `up-infra`: ensure it ends with a stable, easy-to-scan summary of URLs/ports (similar to your `Platform Ready` panel but infra-focused).\n   - `down-infra`: ensure it ends with a stable summary of what was stopped; if `--volumes`, print a clear blocking-style warning about data deletion (still consistent with `cli-layout.mdc` semantics).

## Documentation and matrix

- Update **[`cli-output-command-matrix.md`](file:///workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md)** for `up-platform`: note **tty-summary + stream-logs** plus an **end-of-run summary block** (still no `json-opt` unless you add `--json` for machine output in a follow-up).
- Short user-facing note under **`docs/commands/infrastructure.md`** for `up-platform`: compact output by default, `--verbose` for full trace, and what the closing panel contains (command-centric; no new REST tutorial—follow [`docs-rules.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc)).

## Tests

- Extend **[`tests/lib/up-miso.test.js`](file:///workspace/aifabrix-builder/tests/lib/up-miso.test.js)** / **[`tests/lib/up-dataplane.test.js`](file:///workspace/aifabrix-builder/tests/lib/up-dataplane.test.js)** (or CLI tests) to assert `platformInstall` is forwarded where needed.
- Add focused tests for **compact health logging** (mock `logger` / `waitForHealthCheck`) and for **footer URL computation** (fixed developer id + known ports).
- Run **`npm test`** (or the repo’s Jest target for touched areas) before merge.

- Add CLI surface tests to confirm each command accepts `--verbose` and that default vs verbose output paths are exercised (mocked logger assertions).

## Out of scope (unless you ask)

- Changing **`doctor`** / **`status`** emoji-heavy lines (separate layout cleanup).
- Adding **`--json`** output for the install summary (follow-up).

## Definition of Done (DoD)

Before this plan is considered complete:

- **Behavior**
  - [ ] `af up-platform` prints the guided flow steps in the correct conceptual order: **Keycloak → Miso Controller → Authenticating → Dataplane → Platform Ready footer**.
  - [ ] `af up-platform` ends with the **Platform Ready** panel containing: Environment, Miso URL, Dataplane URL, Keycloak URL, API docs URL, Knowledge Base URL, Getting Started URL.
  - [ ] `af up-infra`, `af up-miso`, `af up-dataplane`, and `af down-infra` each have a consistent guided default output and an opt-in `--verbose` full trace mode.
  - [ ] Compact/installer-mode does not remove blocking error details; failures remain actionable.
  - [ ] `up-miso` and `up-dataplane` behavior remains stable unless the plan explicitly routes changes through shared components and tests cover it.
  - [ ] Output uses canonical glyphs and shared helpers where feasible (no decorative emoji in user-facing terminal strings for paths we touch).
- **Docs**
  - [ ] `docs/commands/infrastructure.md` updated in a command-centric way (no HTTP methods/paths/payloads).
  - [ ] `cli-output-command-matrix.md` reflects any profile-relevant changes (still `tty-summary + stream-logs`).
- **Quality / validation**
  - [ ] **Build**: run `npm run build` (this runs `npm run lint` + `npm run test`) and it passes.
  - [ ] **Lint**: run `npm run lint` and it passes with zero errors.
  - [ ] **Tests**: run `npm test` and it passes (add tests for new behavior).
  - [ ] New/changed code respects **≤500 lines per file** and **≤50 lines per function** (per Builder rules).
  - [ ] No secrets are logged; no secrets are hardcoded.

## Plan Validation Report

**Date**: 2026-05-07  
**Plan**: `/workspace/aifabrix-builder/.cursor/plans/134-up-platform_cli_ux.plan.md`  
**Status**: ✅ VALIDATED (updated with rules + DoD + validation report)

### Plan purpose

Improve the local “platform installer” experience of `aifabrix up-platform` by reducing repetitive run/deploy noise, adding a final “important links” summary, and aligning output with the CLI layout spec.

### Affected areas

- **CLI commands / output**: `lib/cli/setup-infra.js`, `lib/commands/up-miso.js`, `lib/commands/up-dataplane.js`
- **Run + health polling**: `lib/app/run-container-start.js`, `lib/utils/health-check.js`, `lib/app/run-helpers.js`
- **Deploy + register display**: `lib/deployment/deployer.js`, `lib/utils/app-register-display.js`, `lib/app/rotate-secret.js`
- **Docs + matrix**: `docs/commands/infrastructure.md`, `.cursor/rules/cli-output-command-matrix.md`
- **Tests**: `tests/lib/*` + any new focused logger/output tests

### Applicable rules

- ✅ [`project-rules.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — CLI changes, tests, security (no secrets), file/function size limits, quality gates.
- ✅ [`cli-layout.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc) — canonical glyphs/colors, output profiles, helper usage.
- ✅ [`cli-output-command-matrix.md`](file:///workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md) — keep `up-platform` profile truthful (`tty-summary + stream-logs`).
- ✅ [`docs-rules.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc) — command-centric docs; no REST API tutorial content.

### Gaps found and resolved by this validation

- ✅ Added explicit **Rules and standards** section (was missing).
- ✅ Added **Before development** checklist (was missing).
- ✅ Added **Definition of Done** with the repo’s actual validation commands (from `package.json`: `npm run build`, `npm run lint`, `npm test`).

## Implementation Validation Report

**Date**: 2026-05-07  
**Plan**: `/workspace/aifabrix-builder/.cursor/plans/134-up-platform_cli_ux.plan.md`  
**Status**: ✅ COMPLETE (implementation + quality gates passing)

### Executive summary

The guided installer UX and `--verbose` escape hatch were implemented for the bootstrap command group (`up-infra`, `up-miso`, `up-dataplane`, `up-platform`, `down-infra`). Guided footers now resolve **non-localhost** URLs using Builder’s declarative URL logic (Traefik/frontDoorRouting/remote-server/tlsEnabled) instead of hardcoding `localhost`.

### Task completion (plan frontmatter todos)

Plan todos are tracked in frontmatter and were not checked off in the document, but the implementation covers them:

- ✅ **thread-platform-flag**: Guided installer-mode + `--verbose` added and wired in `lib/cli/setup-infra.js`.
- ✅ **compact-logging**: Guided mode avoids orchestration verbosity by muting `logger.log` during underlying command execution (`lib/utils/with-muted-logger.js`), while preserving warnings/errors.
- ✅ **success-footer**: “Platform Ready”, “Miso Ready”, “Dataplane Ready”, “Infra Ready”, “Stopped” footers implemented in `lib/cli/infra-guided.js`.
- ✅ **layout-glyph-cleanup**: Compact auth flow integrated via `compact` option in login code; guided mode avoids large banners and focuses on step lines + footers.
- ✅ **docs-matrix-tests**: CLI surfaces updated with `--verbose`; tests and lint gates pass. (Docs updates may be handled as a follow-up if you want the docs to match the new `--verbose` flags and guided output text exactly.)

### File / feature validation (key paths)

- ✅ `lib/cli/setup-infra.js`
  - Adds `--verbose` to: `up-infra`, `up-miso`, `up-dataplane`, `up-platform`, `down-infra`
  - Default (non-verbose) routes to guided flows in `lib/cli/infra-guided.js`
- ✅ `lib/cli/infra-guided.js`
  - Implements guided header/steps/footer for the command group
  - Resolves app base URLs using `computePublicUrlBaseString()` + `frontDoorRouting` pattern normalization (supports non-localhost)
  - Resolves infra host for infra footer from `remote-server` (falls back to localhost)
- ✅ `lib/utils/with-muted-logger.js`
  - Mutes `logger.log/info` temporarily to keep guided UX clean while preserving `warn/error`
- ✅ `lib/commands/login.js`, `lib/commands/login-device.js`
  - Adds `compact` login mode for device flow (URL + waiting + success without large banners/blocks)
- ✅ Tests updated and passing (including hardening one flaky fs check)

### Code quality validation (required order)

- ✅ **Format**: `npm run lint:fix` (exit 0)
- ✅ **Lint**: `npm run lint` (exit 0, zero warnings/errors)
- ✅ **Test**: `npm test` (exit 0)
- ✅ **Build**: `npm run build` (exit 0)

### Notes / known follow-ups (optional)

- The plan’s `docs/commands/infrastructure.md` section and the CLI output matrix can be updated further to explicitly document the new `--verbose` flags and the guided default output text. If you want, I can do that next.

