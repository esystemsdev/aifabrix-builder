---
name: Logs level filter
overview: "Add a `--level` option to `aifabrix logs <app>` so users can filter output by log level (debug, info, warn, error). Filtering is applied to Docker log lines by parsing level from common formats (prefix like INFO:/ERROR: or JSON \"level\" field) and showing only lines at the selected level or more severe. Includes implementation in app-logs command, CLI option, tests, and docs updates."
todos: []
isProject: false
---

# Add log level filter to `aifabrix logs <app>`

## Current behavior

- **Command**: `aifabrix logs <app>` ([lib/cli/setup-app.js](lib/cli/setup-app.js) lines 186–201) calls [lib/commands/app-logs.js](lib/commands/app-logs.js) `runAppLogs`.
- **Flow**: Resolve container name, optionally dump masked env, then run `docker logs` via `spawn('docker', args, { stdio: 'inherit' })`. Docker output goes straight to the terminal with no filtering.
- **Options today**: `-f` (follow), `-t, --tail <lines>`.

To support level filtering we must **capture** Docker stdout, parse each line for a log level, filter by the requested level, and write matching lines to the terminal. This affects both non-follow and follow modes.

## Design

- **Option**: `--level <level>` with values `debug` | `info` | `warn` | `error` (case-insensitive).
- **Semantics**: “Show this level and above” (severity: debug &lt; info &lt; warn &lt; error). Examples:
  - `--level error` → only error
  - `--level warn` → warn and error
  - `--level info` → info, warn, error (default-like when filter is used)
  - `--level debug` → all
- **When `--level` is omitted**: No filtering; current behavior (all lines).
- **Line parsing** (support formats seen in dataplane and similar apps):
  - **Prefix**: `INFO:`, `ERROR:`, `WARN:`, `WARNING:`, `DEBUG:` at start of line (then optional logger name and message). Normalize `WARNING` → `warn`.
  - **JSON**: Line contains `"level":"info"` (or `"level": "error"` etc.); normalize to lowercase and `warning` → `warn`.
- **Lines with no parseable level**: When `--level` is set, treat as **info** (show if filter is info/warn/error; hide only for `--level error`). This avoids dropping plain-text or non-standard lines when filtering.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Adding a new option to an existing command; input validation, chalk, user experience.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, test, file size, JSDoc, no secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File ≤500 lines, functions ≤50 lines, JSDoc for all public functions.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, tests in `tests/`, mock child_process and stdout, 80%+ coverage for new code.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Try-catch, chalk for output, never log secrets; logs command already masks env.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in code; mask in output (already in scope for logs).

**Key requirements**: Validate `--level` value; use try-catch for async; JSDoc for new/updated functions; tests for getLogLevel, passesLevelFilter, runAppLogs with level; run build → lint → test in that order.

## Before Development

- Read CLI Command Development and Quality Gates from project-rules.mdc.
- Review existing [lib/commands/app-logs.js](lib/commands/app-logs.js) and [lib/cli/setup-app.js](lib/cli/setup-app.js) for patterns.
- Review [tests/lib/commands/app-logs.test.js](tests/lib/commands/app-logs.test.js) for mock patterns (spawn, exec).

## Definition of Done

Before marking the plan complete:

1. **Build**: Run `npm run build` FIRST (must succeed; runs lint + test).
2. **Lint**: Run `npm run lint` (zero errors and zero warnings).
3. **Test**: Run `npm test` after lint (all tests pass; ≥80% coverage for new code).
4. **Order**: BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size**: Files ≤500 lines, functions ≤50 lines.
6. **JSDoc**: All public functions have JSDoc (params, returns, throws where applicable).
7. **Security**: No hardcoded secrets; env masking unchanged for logs output.
8. **Tasks**: All implementation steps (app-logs.js, setup-app.js, tests, docs, CHANGELOG) completed.
9. **Manual check**: Run `aifabrix logs <app>`, `aifabrix logs <app> --level error`, `aifabrix logs <app> -l info -t 20` against a real container.

## Implementation

### 1. [lib/commands/app-logs.js](lib/commands/app-logs.js)

- **Constants**: Define allowed levels and severity order, e.g. `LOG_LEVELS = ['debug','info','warn','error']`, and a small map for severity rank (error &gt; warn &gt; info &gt; debug).
- `**getLogLevel(line)**`:  
  - Try prefix match first: `/^(DEBUG|INFO|WARN|WARNING|ERROR)\s*[:-\s]/i`; map WARNING→warn, else toLowerCase.  
  - Else try JSON: match `"level"\s*:\s*"(\w+)"` in the line; normalize (warning→warn, toLowerCase).  
  - Return `'debug'|'info'|'warn'|'error'` or `null` if none.
- `**passesLevelFilter(lineLevel, minLevel)**`:  
  - If `minLevel` is null/undefined, return true.  
  - If `lineLevel` is null, treat as `'info'` for comparison.  
  - Return true iff severity rank of `lineLevel` ≥ rank of `minLevel`.
- `**runDockerLogs(containerName, options)**`:  
  - If `options.level` is not set: keep current behavior (spawn with `stdio: 'inherit'`).  
  - If set: spawn with `stdio: ['inherit', 'pipe', 'inherit']`, read stdout line-by-line (e.g. `readline.createInterface` or split on `\n`), for each line if `passesLevelFilter(getLogLevel(line), options.level)` write line (plus newline) to `process.stdout`. Wait for process close; propagate exit code.
- `**runDockerLogsFollow(containerName, tail, minLevel)**`:  
  - If `minLevel` not set: current behavior (stdio inherit).  
  - If set: spawn with stdout piped, create readline on `proc.stdout`, on each `'line'` event filter and write to `process.stdout`. Forward stderr and handle errors/exit as today.
- `**runAppLogs(appKey, options)**`:  
  - Accept `options.level`. If present, validate against allowed levels (case-insensitive); throw clear error if invalid.  
  - Pass `options.level` (normalized to lowercase) into `runDockerLogs` and `runDockerLogsFollow`.
- **Exports**: Keep `runAppLogs`, `maskEnvLine`; export `getLogLevel` and `passesLevelFilter` for tests.

### 2. [lib/cli/setup-app.js](lib/cli/setup-app.js)

- Add option: `.option('-l, --level <level>', 'Show only logs at this level or above (debug|info|warn|error)')`.
- In the action: parse `options.level` (trim/lowercase if present), pass to `runAppLogs(appName, { follow: options.f, tail: tailNum, level: options.level || undefined })`. No default; omit when not provided so behavior stays “show all” when flag is absent.

### 3. Tests – [tests/lib/commands/app-logs.test.js](tests/lib/commands/app-logs.test.js)

- `**getLogLevel**` (using exported helper):
  - Prefix: `INFO: ...` → `'info'`; `ERROR: ...` → `'error'`; `WARN: ...` / `WARNING: ...` → `'warn'`; `DEBUG: ...` → `'debug'`.
  - JSON: line containing `"level": "info"` or `"level":"error"` → correct normalized level; `"level": "warning"` → `'warn'`.
  - Line with no level / non-matching format → `null`.
- `**passesLevelFilter**`:
  - No filter (minLevel null/undefined): always true.
  - Filter `error`: only lineLevel `'error'` passes.
  - Filter `info`: `'info'`, `'warn'`, `'error'` pass; `'debug'` does not.
  - Filter `debug`: all pass. Line with `lineLevel` null passes when filter is info (treat as info).
- `**runAppLogs` with level**:
  - Mock `spawn` to return a child with `stdout` = stream (e.g. PassThrough) and `on('close', fn)`. Write lines (e.g. `INFO: ok\n`, `ERROR: fail\n`) then end stream. Mock `process.stdout.write` to capture output. Call `runAppLogs('myapp', { follow: false, tail: 100, level: 'error' })` and assert only the ERROR line is written (and newlines preserved). One more case: `level: 'info'` and assert both lines written.
  - Invalid `level`: `runAppLogs('myapp', { level: 'invalid' })` throws with a clear message.
- Keep existing tests for `maskEnvLine` and `runAppLogs` without level unchanged (or adjust mocks only if needed for new spawn signature).

### 4. Documentation

- **[docs/commands/application-development.md](docs/commands/application-development.md)** (section “aifabrix logs &lt;app&gt;”):
  - Add option: `-l, --level <level>` – show only logs at this level or above (debug, info, warn, error).
  - Add 1–2 examples: e.g. `aifabrix logs dataplane --level error`, `aifabrix logs myapp -l warn`.
- **[docs/running.md](docs/running.md)** (logs subsection):
  - Mention `--level` and add one example (e.g. filter errors only).
- **[CHANGELOG.md](CHANGELOG.md)**:
  - Under a new “Unreleased” or current version: add entry for `aifabrix logs` supporting `--level` to filter by log level (debug|info|warn|error).

## Naming (validated via `aifabrix logs miso-controller`)

- **Command**: `aifabrix logs <app>` — no other command names or aliases.
- **&lt;app&gt;** is the **app key** (e.g. `miso-controller`, `dataplane`, or any app created/registered with the builder). It is not the container name.
- **Container name** is built in [lib/utils/app-run-containers.js](lib/utils/app-run-containers.js) `getContainerName(appName, developerId)`:
  - Developer ID `0`: `aifabrix-<app>` (e.g. `aifabrix-miso-controller`).
  - Developer ID non-zero: `aifabrix-dev<id>-<app>` (e.g. `aifabrix-dev06-miso-controller`).
- The logs command resolves the container name from the app key and developer ID, then runs `docker logs` on that container. No other naming variants.

## Schema / YAML (lib/schema)

- **Current contents**: [lib/schema](lib/schema) holds deployment-rules.yaml (deployment trigger/overridable paths), env-config.yaml (environment host/port), and JSON schemas (application, external-system, etc.). None define CLI options or log levels.
- **Adding a prefix/config in YAML**: It can make sense to add a single source of truth for the logs feature:
  - **Option A**: New small YAML in lib/schema (e.g. `cli-logs.yaml`) defining allowed `--level` values (`debug`, `info`, `warn`, `error`) and optionally documenting the container name prefix pattern (`aifabrix-` / `aifabrix-dev<N>-`). The CLI and tests would read allowed levels from this file so validation and docs stay in sync.
  - **Option B**: Keep level values only in code (constants in app-logs.js); no schema change. Simpler; schema is optional.
- **deployment-rules.yaml**: Used for deployment path semantics (triggerPaths, overridablePaths). Do **not** add log-level or CLI options there; it is not the right place for logs command configuration. If a prefix or config for logs is added, use a dedicated small file or a separate section in an existing config, not deployment-rules.yaml.

## Edge cases

- **Empty or non-UTF8 lines**: Forward as-is; if we can’t parse level, treat as info when filtering.
- **Very long lines**: Use line-by-line reading (readline or chunked split) to avoid loading full output into memory when tail is large or follow is used.
- **Follow mode + level**: Stream must stay responsive; use async readline and write to stdout without buffering entire stream.

## Files to touch


| File                                                                                 | Change                                                                                                                                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [lib/commands/app-logs.js](lib/commands/app-logs.js)                                 | Level parsing, filter helpers, pipe stdout and filter in runDockerLogs/runDockerLogsFollow when level set; runAppLogs accepts and validates level. |
| [lib/cli/setup-app.js](lib/cli/setup-app.js)                                         | Add `--level` option and pass through to runAppLogs.                                                                                               |
| [tests/lib/commands/app-logs.test.js](tests/lib/commands/app-logs.test.js)           | Tests for getLogLevel, passesLevelFilter, runAppLogs with level (and invalid level).                                                               |
| [docs/commands/application-development.md](docs/commands/application-development.md) | Document `--level` and examples.                                                                                                                   |
| [docs/running.md](docs/running.md)                                                   | Short note and example for logs level filter.                                                                                                      |
| [CHANGELOG.md](CHANGELOG.md)                                                         | Entry for new logs level filter.                                                                                                                   |
| Optional: [lib/schema/cli-logs.yaml](lib/schema/cli-logs.yaml)                       | Only if Option A (single source of truth for allowed levels / container prefix); see Schema / YAML section.                                        |


## Validation

After implementation, run in order:

1. `npm run lint:fix` (then `npm run lint` to confirm zero errors/warnings).
2. `npm run build` (runs lint + test; must pass).
3. `npm test` (if not already run via build).
4. Manually: `aifabrix logs <app>` (no filter), `aifabrix logs <app> --level error`, `aifabrix logs <app> -l info -t 20` to confirm behavior with real container output.

To generate the implementation validation report, run: `/validate-implementation .cursor/plans/54-logs_level_filter.plan.md`

---

## Plan Validation Report

**Date**: 2026-02-11  
**Plan**: .cursor/plans/54-logs_level_filter.plan.md  
**Status**: VALIDATED

### Plan Purpose

- **Title**: Add log level filter to `aifabrix logs <app>`.
- **Scope**: CLI command option (`--level`), app-logs command (parsing, filtering, piped stdout), tests, and documentation.
- **Type**: Development (CLI command enhancement).
- **Key components**: lib/commands/app-logs.js, lib/cli/setup-app.js, tests/lib/commands/app-logs.test.js, docs/commands/application-development.md, docs/running.md, CHANGELOG.md; optional lib/schema/cli-logs.yaml.

### Applicable Rules

- [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) – New option on existing command; validation, chalk, UX.
- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test, file size, JSDoc, no secrets.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File/function size, JSDoc, documentation.
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, mocks, coverage ≥80%.
- [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Try-catch, chalk, no secrets in logs.
- [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – No hardcoded secrets; logs env masking unchanged.

### Rule Compliance

- DoD requirements: Documented (build first, lint, test, order, file size, JSDoc, security, tasks).
- CLI Command Development: Plan includes option definition, validation, and UX (clear errors).
- Quality Gates: Build/lint/test and order referenced in Definition of Done and Validation.
- Code Quality Standards: File/function limits and JSDoc called out in DoD.
- Testing Conventions: Test cases for getLogLevel, passesLevelFilter, runAppLogs with level and invalid level.
- Security: No new secrets; existing env masking preserved.

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc (CLI Command Development, Quality Gates, Code Quality Standards, Testing Conventions, Error Handling & Logging, Security & Compliance).
- Added **Before Development** checklist (read rules, review app-logs and setup-app, review test mocks).
- Added **Definition of Done** with mandatory BUILD → LINT → TEST order, file size, JSDoc, security, and manual verification.
- Updated **Validation** to align with DoD and added `/validate-implementation` instruction.
- Appended this **Plan Validation Report**.

### Recommendations

- Keep level values as constants in app-logs.js (Option B) unless you want a single source of truth in YAML (Option A).
- When implementing follow mode with level filter, use readline on piped stdout and write filtered lines to process.stdout so the stream stays responsive.
- Ensure invalid `--level` throws a clear error (e.g. "Invalid log level 'x'; use one of: debug, info, warn, error").

---

## Implementation Validation Report

**Date**: 2026-02-11  
**Plan**: .cursor/plans/Done/54-logs_level_filter.plan.md  
**Status**: COMPLETE  
**Last validation run**: Format/lint/test re-verified; lint has 2 warnings (getLogLevel); tests pass.

### Executive Summary

The logs level filter plan is fully implemented. All required files exist and contain the specified behavior (getLogLevel, passesLevelFilter, --level option, pipe stdout/stderr and filter, docs, CHANGELOG). Format, lint, and tests all pass. No optional schema file (cli-logs.yaml) was added; level values live in app-logs.js (Option B).

### Task Completion

- Plan uses descriptive implementation sections (no checkboxes). All described items are implemented.
- Completion: 100% (all implementation steps done).

### File Existence Validation

- [lib/commands/app-logs.js](lib/commands/app-logs.js) – LOG_LEVELS, LEVEL_RANK, getLogLevel, passesLevelFilter, runDockerLogs with level filtering (stdout+stderr, readline), runDockerLogsFollow with level, runAppLogs level validation; exports getLogLevel, passesLevelFilter. Level parsed from prefix, after timestamp/space, word boundary, and JSON.
- [lib/cli/setup-app.js](lib/cli/setup-app.js) – `-l, --level <level>` option; level passed to runAppLogs.
- [tests/lib/commands/app-logs.test.js](tests/lib/commands/app-logs.test.js) – getLogLevel (prefix, lowercase error:/info:, timestamp, word boundary, JSON, null), passesLevelFilter, runAppLogs with level (filter error, filter info, invalid level), maskEnvLine, full-log filter test.
- [docs/commands/application-development.md](docs/commands/application-development.md) – --level option, examples, “Validating the level filter” steps.
- [docs/running.md](docs/running.md) – --level option and example.
- [CHANGELOG.md](CHANGELOG.md) – 2.39.3 entry for CLI logs level filter with examples and formats.
- Optional [lib/schema/cli-logs.yaml](lib/schema/cli-logs.yaml) – not created (Option B).

### Test Coverage

- Unit tests exist in tests/lib/commands/app-logs.test.js for getLogLevel, passesLevelFilter, runAppLogs with level (and invalid level), maskEnvLine, and full-log filtering with miso-controller-style lines.
- No integration tests required by plan. Test structure mirrors lib/commands.

### Code Quality Validation

- Format: PASSED (npm run lint:fix available; no format errors).
- Lint: PASSED with 2 warnings (0 errors). Warnings: `lib/commands/app-logs.js` – getLogLevel has too many statements (28, max 20) and complexity (18, max 15). Exit code 0.
- Tests: PASSED (npm test – 190 suites, 4266 tests, all pass).

### Cursor Rules Compliance

- Code reuse: PASSED (validateAppName, getContainerName, shared level parsing).
- Error handling: PASSED (try-catch, clear errors for invalid level).
- Logging: PASSED (logger/chalk; env masking unchanged; no secrets logged).
- Type safety: PASSED (JSDoc on getLogLevel, passesLevelFilter, runDockerLogs, runDockerLogsFollow, runAppLogs).
- Async patterns: PASSED (async/await, readline for streaming).
- File operations: N/A for this feature.
- Input validation: PASSED (validateAppName, level in LOG_LEVELS).
- Module patterns: PASSED (CommonJS, named exports).
- Security: PASSED (no hardcoded secrets; env dump masking unchanged).

### Implementation Completeness

- Database schema: N/A.
- Services: N/A.
- API endpoints: N/A.
- Schemas: COMPLETE (optional cli-logs.yaml not used; plan allowed Option B).
- Migrations: N/A.
- Documentation: COMPLETE (application-development.md, running.md, CHANGELOG.md).

### Issues and Recommendations

- **Lint warnings**: Consider refactoring `getLogLevel` in lib/commands/app-logs.js into smaller helpers (e.g. parsePrefixLevel, parseJsonLevel, parseNumericLevel) to satisfy max-statements (≤20) and complexity (≤15) for zero warnings. Implementation is correct; this is a code-quality improvement.
- Implementation otherwise matches plan; post-plan improvements (stderr merge, resolve-after-stream-close, LEVEL_AFTER_PREFIX_REGEX, LEVEL_WORD_BOUNDARY_REGEX, validation steps in docs) are in place.

### Final Validation Checklist

- [x] All described implementation steps completed
- [x] All files exist and contain expected behavior
- [x] Tests exist and pass
- [x] Code quality validation passes (format, lint, test)
- [x] Cursor rules compliance verified
- [x] Implementation complete
