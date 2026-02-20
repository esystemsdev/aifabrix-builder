---
name: Docs and CLI improvements
overview: Plan covers documentation rewrites (secrets, README, deploying, running, infrastructure, external-systems), standardizing back links to the docs README, fixing infrastructure RAM/disk figures, and adding two CLI commands (aifabrix logs, aifabrix down-app) plus aifabrix run --tag support.
todos: []
isProject: false
---

# Documentation and CLI Improvements Plan

## Rules and Standards

This plan must comply with the following from [Project Rules](.cursor/rules/project-rules.mdc) (path relative to repo root: `aifabrix-builder/.cursor/rules/project-rules.mdc`):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory: build completes successfully, lint passes, all tests pass, coverage ≥80% for new code. Applies to all work.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions. Applies to new CLI code and any new modules.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New commands (logs, down-app, run --tag): add in `lib/cli/` (or equivalent), input validation, error handling with chalk, user-friendly messages. Applies to `aifabrix logs`, `aifabrix down-app`, and `aifabrix run --tag`.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/`, mirror source structure, Jest, mock Docker/external deps, 80%+ coverage for new code. Applies to new CLI commands.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No hardcoded secrets; never log secrets/tokens; mask in output. Applies to secrets doc rewrite and to `aifabrix logs` (env dump must mask secrets).
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Try-catch for async, chalk for output, never expose sensitive data in errors. Applies to all new code.

**Key requirements**

- Run `npm run build` first (lint + test); then `npm run lint`; then `npm test` / `npm run test:ci`. Order: BUILD → LINT → TEST.
- New commands: validate app name (e.g. existing `validateAppName`), use path.join(), JSDoc for all public functions.
- For `aifabrix logs`: when showing env or logs, mask secrets/passwords/tokens (no raw values in output).
- Documentation edits: keep consistent style with existing docs; use Mermaid from flows-and-visuals.md if adding diagrams.

## Before Development

- Read applicable sections of project-rules.mdc (Quality Gates, CLI Command Development, Security & Compliance, Error Handling).
- Confirm CLI entry point and where new commands are registered (e.g. `lib/cli/setup-app.js`, `setup-infra.js`).
- For RAM/disk figures: measure or look up Docker stack resource usage before changing infrastructure.md.
- For run --tag: confirm how compose/generator selects image tag (variables.yaml vs override).

## Definition of Done

Before marking the plan complete:

1. **Build:** Run `npm run build` first; it must complete successfully (runs lint + test:ci).
2. **Lint:** Run `npm run lint`; must pass with zero errors and zero warnings.
3. **Test:** Run `npm test` or `npm run test:ci` after lint; all tests must pass; new code must have ≥80% coverage.
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size:** New/edited code files ≤500 lines; functions ≤50 lines.
6. **JSDoc:** All new public functions have JSDoc comments (params, returns, throws).
7. **Security:** No hardcoded secrets; `aifabrix logs` masks secrets in any env or log output; docs align with ISO 27k where applicable.
8. **Docs:** Back links updated; secrets, README, deploying, running, infrastructure, external-systems updated as specified.
9. **CLI:** `aifabrix logs <appKey>`, `aifabrix down-app <appKey>`, and `aifabrix run <app> --tag <tag>` implemented, tested, and documented.
10. All plan tasks (sections 1–8 and Summary) completed.

## 1. Secrets and config – rewrite ([docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md))

**Goals (align ISO 27k, clarify “secure your secret”):**

- **Why secure your secrets:** Confidentiality, integrity, auditability; never commit `config.yaml` (tokens, controller URLs). You may commit *structure* or examples; never real secrets.
- **ISO 27k:** Frame around access control, secure storage, no secrets in version control, audit trail.
- **Share secrets across team:** Single shared `secrets.local.yaml` (or path from `aifabrix-secrets`); all developers point to same file; no manual per-developer secret setup.
- **Single place:** One `secrets.local.yaml` (local or shared) so everyone uses the same source; document `aifabrix-secrets` in config for custom path.
- **Why use secrets + kv://:** AI Fabrix stores secrets in Azure Key Vault in production; using `kv://` in env.template and resolving via secrets makes your integration/application production-ready with no config change.

**Structure:** Keep existing technical sections (config.yaml, secrets.local.yaml, encryption, no restore) but add an upfront “Why secure your secrets” section and a “Why use secrets and kv://” section that ties to Azure Key Vault and production readiness. Preserve the existing back link to Configuration README.

---

## 2. Back links to README – fix across docs

**Current:** Mixed targets: some pages use “Back to Your Own Applications”, others “Back to Commands Index”, “Back to Configuration”, or “Back to project README”.

**Target:** Every doc should have a consistent primary “back” to the **Documentation index** ([docs/README.md](docs/README.md)), e.g. “← [Documentation index](README.md)” for files under `docs/`, or “← [Documentation index](README.md)” with correct relative path from subfolders. Optionally keep a second link (e.g. “· [Your own applications](your-own-applications.md)”) where it helps.

**Files to update (pattern “almost all pages”):**

- [docs/cli-reference.md](docs/cli-reference.md) – currently “Back to Your Own Applications”; change to Documentation index and optionally keep link to your-own-applications.
- [docs/configuration/README.md](docs/configuration/README.md) – “Back to Your Own Applications” → add/primary to Documentation index (docs/README.md).
- [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md), [env-template.md](docs/configuration/env-template.md), [variables-yaml.md](docs/configuration/variables-yaml.md), [env-config.md](docs/configuration/env-config.md), [external-integration.md](docs/configuration/external-integration.md) – ensure back link goes to Configuration README and that Configuration README links to docs/README.
- [docs/commands/README.md](docs/commands/README.md) and all command docs under `docs/commands/` – primary back to Documentation index (../README.md from commands/), secondary to Commands Index if desired.
- [docs/your-own-applications.md](docs/your-own-applications.md), [docs/deploying.md](docs/deploying.md), [docs/building.md](docs/building.md), [docs/running.md](docs/running.md), [docs/infrastructure.md](docs/infrastructure.md), [docs/external-systems.md](docs/external-systems.md), [docs/developer-isolation.md](docs/developer-isolation.md), [docs/github-workflows.md](docs/github-workflows.md), [docs/configuration.md](docs/configuration.md), [docs/wizard.md](docs/wizard.md), [docs/deployment/environment-first-time.md](docs/deployment/environment-first-time.md).

Define one standard line for top-level docs (e.g. “← [Documentation index](README.md)”) and for subfolders (e.g. “← [Configuration](README.md)” or “← [Documentation index](../README.md)” as appropriate) and apply consistently.

---

## 3. Main repository README – improve perspective ([README.md](README.md))

**Add/emphasize:**

- **Build perspective:** Everything is driven by declarative config and JSON schemas; AI assistant–friendly (schemas, no hidden logic).
- **Industry standards and security:** No hidden logic; follow industry standards and high security (ISO 27k).
- **Full lifecycle in your version control:** Everything versioned with your own VCS (GitHub, GitLab, Azure DevOps).
- **Why use the builder from day one:** Single tool for local infra, app/integration creation, build, run, and deploy; same workflow for apps and integrations.
- **Why build integrations and applications with the builder:** Consistency, schema-driven, deploy to same controller/dataplane, production-ready secrets (kv://, Key Vault).
- **Miso client:** Mention that application development is supported with **miso-client** for TypeScript and Python ([aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client)); link to repo or docs if available. Reference from templates is in [templates/applications/dataplane/README.md](templates/applications/dataplane/README.md) and similar.

Keep existing Goals 1–3 and Install; add a short “Why AI Fabrix Builder?” or “Overview” block that captures the above.

---

## 4. Deploying – rewrite ([docs/deploying.md](docs/deploying.md))

**Problems:** Reads as image-only; “95% is integration deployment”; unclear that the same deployment path applies to web apps, Docker images, and external systems.

**Changes:**

- **Opening:** State clearly that deployment is **unified**: same flow for (1) web apps / Docker images and (2) external systems integration. Most deployments are integration deployments (external systems); image-based app deployment is one path.
- **Structure:** Lead with “What gets deployed” (external systems vs containerized apps), then “Deploying external systems” (e.g. `aifabrix deploy <app> --type external` from `integration/<app>/`), then “Deploying containerized applications” (build → push → deploy). Keep Controller/Dataplane explanation but make integration-first.
- Keep existing technical content (prerequisites, push, deploy, registration, CI/CD, troubleshooting) but reorder and add short intros so integration vs image-based are both first-class and the same “deploy via Controller” story is clear.

---

## 5. External systems – next step wizard link ([docs/external-systems.md](docs/external-systems.md))

- Add a clear **Next step** callout after Quick Start (or after the first workflow): “Next: use the [Wizard](wizard.md) for interactive setup or continue with manual steps below.”
- Ensure the existing wizard link in the Quick Start section is visible; add one more “Next step” link (e.g. at end of Quick Start or start of Step 1) pointing to [wizard.md](docs/wizard.md).

---

## 6. Infrastructure – RAM and disk ([docs/infrastructure.md](docs/infrastructure.md))

- **Current (line ~302–304):** “Initial download: ~1GB (Docker images)”, “Running: ~500MB RAM, minimal CPU”, “Data volumes: Depends on your usage”.
- **Task:** Correct RAM and disk figures. Measure or look up actual Docker resource usage for the stack (Postgres, Redis, optional pgAdmin, Redis Commander, Traefik) and update the “How much disk space does this use?” section with accurate numbers (or remove if not easily verifiable; do not leave wrong values). If exact numbers are unknown, use conservative ranges and label as approximate.

---

## 7. Running – full doc pass ([docs/running.md](docs/running.md))

**Content and wording:**

- **Restart Your App:** Describe that “restart” via the builder means: resolve `env.template` → push env into container (or regenerate .env and recreate/restart) → restart. So it’s “resolve env, update container, restart,” not only “restart.” Prefer `aifabrix run myapp` after editing env.template (full apply) over raw restart.
- **Environment Variables:** Emphasize the workflow: **edit only `env.template**`, then run **one command** (`aifabrix run myapp`) to apply settings—no manual .env editing for normal use.
- **Networking:** Change example from `aifabrix-myapp` to `**myapp**` (or the actual service name used in compose; confirm in [lib/utils/compose-generator.js](lib/utils/compose-generator.js) or run output). User asked “without aifabrix” so container/service name in examples should be `myapp` (or whatever the generator uses).
- **App A calls App B:** State that local app-to-app calls are **without SSL** (e.g. `http://myapp:3000`).
- **Debug Mode:** Say: edit `env.template` (e.g. add DEBUG, NODE_ENV) then run `aifabrix run myapp` (and mention `--debug` if the CLI supports it).
- **Validate full document:** Prefer `aifabrix` over raw `docker` wherever the same outcome can be achieved with the CLI (e.g. “View Logs” → use new `aifabrix logs`; “Stop” → aifabrix down-app or down-infra; “Run Different Version” → aifabrix run with tag). Remove or minimize “normal run” that implies plain `docker run` is equivalent.
- **Main point:** Add a short note that **docker commands do not give the same result as aifabrix**: no compose, no .env resolution, no db-init, etc. So use `aifabrix run` / `aifabrix logs` / `aifabrix down-app` instead of ad-hoc docker commands.

**Run Different Version:** Document `aifabrix run <appKey> --tag <tag>` (or `--tags` if that’s the flag name). If not yet supported, add it in CLI (see below) and then document.

**New command – aifabrix logs appKey:**

- **Behavior:** First print “most important” info from the container (e.g. env vars list, or a one-line summary), then show logs. Default: last 100 lines. Options: `--full` (full logs), `--live` or `-f` (follow/stream). Helps AI tools and developers quickly see env and recent logs.
- **Implementation:** New command in [lib/cli/setup-app.js](lib/cli/setup-app.js) (or setup-infra if preferred), handler that: resolves container name (developer ID + appKey), runs `docker logs` with tail 100 by default, `--full` = no tail limit, `--live`/`-f` = follow. Optional: dump non-sensitive env (e.g. `docker exec <container> env`) at the top; mask secrets.

**New command – aifabrix down-app appKey:**

- **Behavior:** Stop container, remove container, remove the app’s Docker image(s) if no other container uses them (e.g. `docker rmi` after stop/rm, or document that “images if not used” means rmi only when safe). Optionally `--volumes` to remove app volume (align with existing [lib/app/down.js](lib/app/down.js) `downApp(..., { volumes })`).
- **Implementation:** Either add a new command `down-app` that calls existing `downApp` then runs image removal (e.g. get image ID from the stopped container, then `docker rmi`), or extend `down-infra [app]` with an option like `--remove-images`. User asked for a dedicated `aifabrix down-app <appKey>`. Reuse [lib/app/down.js](lib/app/down.js) for stop/remove/volumes; add image removal step (remove image used by the app if no other references).

**aifabrix run --tag:**

- **Current:** [lib/cli/setup-app.js](lib/cli/setup-app.js) `run` has `-p, --port` and `-d, --debug`; no `--tag`.
- **Change:** Add option e.g. `-t, --tag <tag>` to `aifabrix run <app>`. When building the compose/run, override the image tag (from variables.yaml or default `latest`) with the given tag so `aifabrix run myapp --tag v1.0.0` runs that image. Implement in [lib/app/run.js](lib/app/run.js) and compose generation (e.g. [lib/utils/compose-generator.js](lib/utils/compose-generator.js)) so the service image uses the specified tag.

---

## 8. Implementation order (suggested)

1. **Back links** – quick pass across all listed docs so navigation is consistent.
2. **Secrets doc** – rewrite with “Why secure”, “Why kv://”, ISO 27k, shared secrets, production readiness.
3. **README** – add “Why use builder”, build perspective, version control, miso-client.
4. **Deploying** – rewrite with integration-first, same deployment story for web app / image / external.
5. **External systems** – add next-step wizard link.
6. **Infrastructure** – correct RAM/disk.
7. **Running** – full pass (wording, aifabrix-first, networking name, SSL, debug, run different version).
8. **CLI:** Implement `aifabrix logs <appKey>` (with --full, --live), then `aifabrix down-app <appKey>` (with optional --volumes, remove image if unused), then `aifabrix run <app> --tag <tag>`.
9. **Docs:** Update running.md to describe logs, down-app, and run --tag; add anchors in cli-reference and commands/application-development (or utilities/infra as appropriate) for the new commands.

---

## Summary


| Area                                                                                 | Action                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) | Rewrite: why secure secrets, ISO 27k, shared secrets, kv:// and production readiness.                                                                                                                                          |
| Docs back links                                                                      | Standardize primary back link to Documentation index (docs/README.md) across all docs.                                                                                                                                         |
| [README.md](README.md)                                                               | Add build perspective, no hidden logic, version control, why use builder day one, miso-client (TypeScript/Python).                                                                                                             |
| [docs/deploying.md](docs/deploying.md)                                               | Rewrite: same deployment for web app, image, and external systems; integration-first (95% integration).                                                                                                                        |
| [docs/external-systems.md](docs/external-systems.md)                                 | Add next-step wizard link.                                                                                                                                                                                                     |
| [docs/infrastructure.md](docs/infrastructure.md)                                     | Correct RAM and disk space figures.                                                                                                                                                                                            |
| [docs/running.md](docs/running.md)                                                   | Restart = resolve env + apply + restart; env = edit env.template + one command; networking name `myapp`; no SSL for app-to-app; debug via env.template + run; prefer aifabrix over docker; document logs, down-app, run --tag. |
| CLI                                                                                  | Add `aifabrix logs <appKey>` (default 100, --full, --live; optional env summary); add `aifabrix down-app <appKey>` (stop, rm container, rm image if unused; --volumes); add `aifabrix run <app> --tag <tag>`.                  |


---

## Plan Validation Report

**Date:** 2025-02-06  
**Plan:** docs_and_cli_improvements_70a6004d.plan.md  
**Status:** VALIDATED

### Plan Purpose

- **Title:** Documentation and CLI Improvements Plan  
- **Scope:** Documentation (secrets, README, deploying, running, infrastructure, external-systems; back links); CLI (new commands: logs, down-app; run --tag).  
- **Type:** Mixed – Documentation (primary) and Development (CLI commands and run --tag).  
- **Key components:** docs/configuration/secrets-and-config.md, docs/README.md back links, README.md, docs/deploying.md, docs/external-systems.md, docs/infrastructure.md, docs/running.md; lib/cli/setup-app.js, lib/app/run.js, lib/app/down.js, lib/utils/compose-generator.js; new logs and down-app handlers.

### Applicable Rules

- **Quality Gates** – Mandatory checks before commit; build, lint, test, coverage. Applied to entire plan.  
- **Code Quality Standards** – File/function size limits; JSDoc. Applied to new CLI code.  
- **CLI Command Development** – Adding new commands; validation, chalk, UX. Applied to logs, down-app, run --tag.  
- **Testing Conventions** – Jest, tests in tests/, mocks, coverage. Applied to new commands.  
- **Security & Compliance (ISO 27001)** – No secrets in code; mask in logs. Applied to secrets doc and to `aifabrix logs` env/output.  
- **Error Handling & Logging** – Try-catch, chalk, no sensitive data in errors. Applied to new code.

### Rule Compliance

- DoD requirements: Documented (Build, Lint, Test, order BUILD → LINT → TEST, file size, JSDoc, security, all tasks).  
- Quality Gates: Referenced; mandatory sequence and coverage called out.  
- Code Quality: File/function limits and JSDoc in DoD.  
- CLI Command Development: Plan specifies validation, handlers, options; rule reference added.  
- Testing: DoD requires tests and coverage for new code; Testing Conventions referenced.  
- Security: Secrets doc and logs masking explicitly required; Security & Compliance referenced.

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc (Quality Gates, Code Quality Standards, CLI Command Development, Testing Conventions, Security & Compliance, Error Handling & Logging) and key requirements.  
- Added **Before Development** checklist (read rules, confirm CLI layout, RAM/disk verification, run --tag behavior).  
- Added **Definition of Done** with build, lint, test, order, file size, JSDoc, security, docs, CLI implementation, and task completion.  
- Appended this validation report to the plan file.

### Recommendations

- When implementing `aifabrix logs`, use existing app name validation and container naming (e.g. run-helpers or config developerId) so behavior matches `aifabrix run` / `down-infra [app]`.
- For infrastructure RAM/disk: run `docker stats` and measure disk (e.g. `docker system df`) for the infra stack before updating the numbers in docs.
- After adding new commands, register them in docs/commands (e.g. application-development.md or utilities.md) and in docs/cli-reference.md anchor list.

---

## Implementation Validation Report

**Date**: 2025-02-07  
**Plan**: .cursor/plans/47-docs_and_cli_improvements.plan.md  
**Status**: ✅ COMPLETE

### Executive Summary

Plan 47 (sections 1–8 and Summary) is fully implemented. Documentation changes (secrets, back links, README, deploying, external-systems, infrastructure RAM/disk, running) and CLI commands (`aifabrix logs`, `aifabrix down-app`, `aifabrix run --tag`) are in place. Format, lint, and tests all pass (185 suites, 4139 tests).

### Task Completion

- **Total sections**: 8 (plan sections 1–8) + Summary.
- **Fully addressed**: Sections 1–8 and Summary.
- **Completion**: 100%.

| Section | Status | Notes |
|---------|--------|-------|
| 1. Secrets and config | ✅ | Rewritten: "Why secure your secrets", "Why use secrets and kv://", ISO 27k, shared secrets, production readiness |
| 2. Back links | ✅ | Standardized primary back link to Documentation index across all docs |
| 3. README | ✅ | "Why AI Fabrix Builder?", build perspective, version control, miso-client |
| 4. Deploying | ✅ | Unified deployment for web app, image, external systems; integration-first |
| 5. External systems | ✅ | "Next step" wizard link after Quick Start |
| 6. Infrastructure | ✅ | RAM/disk corrected: 256 MB–1 GB RAM, 0.5–1.5 GB initial, 10–15 GB full platform |
| 7. Running | ✅ | Restart = resolve env + apply + restart; env.template workflow; myapp service name; no SSL app-to-app; debug via env.template + run; logs, down-app, run --tag documented |
| 8. CLI | ✅ | logs, down-app, run --tag implemented |

### File Existence Validation

| File / area | Status | Notes |
|-------------|--------|-------|
| docs/configuration/secrets-and-config.md | ✅ | Rewritten with Why secure, Why kv://, ISO 27k |
| docs/ (back links) | ✅ | All docs use "← [Documentation index]" primary back link |
| README.md | ✅ | "Why AI Fabrix Builder?", miso-client, prerequisites |
| docs/deploying.md | ✅ | Unified deployment, integration-first |
| docs/external-systems.md | ✅ | "Next step" wizard link |
| docs/infrastructure.md | ✅ | RAM/disk figures updated |
| docs/running.md | ✅ | Full pass: restart, env, networking, myapp, logs, down-app, run --tag |
| lib/commands/app-logs.js | ✅ | env dump masked, docker logs, --full (tail 0), --live (-f) |
| lib/commands/app-down.js | ✅ | stop, rm container, rm image if unused, --volumes |
| lib/cli/setup-app.js | ✅ | run --tag, logs, down-app registered |
| lib/utils/compose-generator.js | ✅ | options.tag for image override |
| docs/cli-reference.md | ✅ | Anchors for logs, down-app |
| docs/commands/application-development.md | ✅ | Full docs for logs, down-app, run --tag |

### Test Coverage

- **Unit tests**: `tests/lib/commands/app-logs.test.js` (maskEnvLine, runAppLogs), `tests/lib/commands/app-down.test.js` (getContainerImageId, removeImageIfUnused, runDownAppWithImageRemoval). All plan 47 related tests pass.
- **Full suite**: 185 passed, 4139 tests.

### Code Quality Validation

- **Format**: ✅ PASSED (`npm run lint:fix` exit 0).
- **Lint**: ✅ PASSED (`npm run lint` exit 0, zero errors/warnings).
- **Tests**: ✅ PASSED (185 suites, 4139 tests).

### Cursor Rules Compliance

- **Code reuse**: ✅ PASSED (app-logs uses validateAppName, getContainerName; app-down uses downApp).
- **Error handling**: ✅ PASSED (try/catch, meaningful errors in app-logs, app-down).
- **Logging**: ✅ PASSED (secrets masked in app-logs env dump; no sensitive data).
- **Type safety**: ✅ PASSED (JSDoc in app-logs, app-down).
- **Async patterns**: ✅ PASSED (async/await used).
- **File operations**: N/A for new commands.
- **Input validation**: ✅ PASSED (validateAppName in app-logs, app-down).
- **Module patterns**: ✅ PASSED (CommonJS, exports).
- **Security**: ✅ PASSED (maskEnvLine masks secrets; no hardcoded secrets).

### Implementation Completeness

- **Database schema**: N/A for this plan.
- **Services / API**: N/A for this plan.
- **CLI commands**: ✅ COMPLETE – logs, down-app, run --tag.
- **Schemas**: N/A.
- **Documentation**: ✅ COMPLETE – secrets, back links, README, deploying, external-systems, infrastructure, running, cli-reference, application-development.

### Issues and Recommendations

None. All plan requirements are met.

### Final Validation Checklist

- [x] Plan sections 1–8 and Summary completed
- [x] All referenced files exist and implemented
- [x] New CLI commands (logs, down-app, run --tag) implemented
- [x] Tests exist for new code; plan 47 tests pass
- [x] Format and lint pass
- [x] Cursor rules compliance for new code
- [x] Full test suite green

