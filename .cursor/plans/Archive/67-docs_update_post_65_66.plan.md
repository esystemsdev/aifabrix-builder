---
name: Docs update post 65 66
overview: Update all docs under `docs/` to reflect the completed Plan 65 (remote Docker, dev init, dev users, secrets API, Mutagen, one network per developer) and Plan 66 (local run --reload, single .env at envOutputPath only, build.context as content mapping, removal of build.localPort). This plan only specifies what documentation should be updated; it does not implement code changes.
todos: []
isProject: false
---

# Documentation Update Plan (post Plan 65 and Plan 66)

After completing [65-remote-docker-validated](.cursor/plans/Done/65-remote-docker-validated.plan.md) and [66-local_docker_and_single_.env](.cursor/plans/Done/66-local_docker_and_single_.env.plan.md), the following documentation must be updated so that docs match current behaviour.

---

## 1. Configuration docs

### 1.1 [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md)

- **build.context:** Document that `build.context` is the **canonical app code directory** for both local and remote: local run --reload uses it as the mount path; remote run --reload uses it as the Mutagen local path. Resolved relative to the directory containing the config file.
- **build.envOutputPath:** Clarify that the **only** persisted `.env` is written here (or to a temp path when not set for run). No `.env` under `builder/<app>/` or `integration/<app>/`.
- **build.localPort:** Confirm it is **removed** (not mentioned). If any remnant exists, remove it; port comes only from `port` in application.yaml.
- **Optional:** In the "Optional" list, ensure `build.context` and `build.envOutputPath` are clearly described; remove any reference to `build.localPort`.

### 1.2 [docs/configuration/env-config.md](docs/configuration/env-config.md)

- **PORT:** State that `${PORT}` is resolved from `application.yaml` → `port` (with developer-id adjustment when applicable). No separate "local port" or localPort.
- **Optional:** Align any "docker vs local" wording with the single-.env model (env written only at envOutputPath or temp for run).

### 1.3 [docs/configuration/env-template.md](docs/configuration/env-template.md)

- **Generation:** Clarify that `aifabrix resolve` and run/build write `.env` only to `build.envOutputPath` when set (or temp for run); never to `builder/<app>/.env` or `integration/<app>/.env`.

### 1.4 [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md)

- **config.yaml:** Document **remote development** keys when `remote-server` is set: `aifabrix-workspace-root`, `remote-server`, `docker-endpoint`, and that certificate (mTLS) is used for all dev APIs.
- **aifabrix-secrets:** Document **remote vs local** behaviour:
  - When `aifabrix-secrets` is an **http(s)://** URL: shared secrets are served by the remote API; `secrets list --shared`, `secrets set --shared`, `secrets remove --shared` call the API; shared values are never stored on disk; resolution for `.env` fetches from API at resolution time.
  - When it is a file path: use project secret file as today.
- **Optional:** Mention that `GET /api/dev/settings` (cert-authenticated) provides sync/Docker parameters; reference dev init and config.

### 1.5 [docs/configuration/README.md](docs/configuration/README.md)

- Add a short pointer to **remote development** config (remote-server, docker-endpoint, aifabrix-workspace-root) and link to secrets-and-config for remote vs local secrets. Optionally link to a new or existing "developer isolation" or "remote Docker" section.

---

## 2. Developer isolation and running

### 2.1 [docs/developer-isolation.md](docs/developer-isolation.md)

- **One network per developer:** State explicitly that **dev, tst, and pro share the same developer's network** (one network per developer on the host); they do not have separate networks per environment. Align with Plan 65 §10.
- **Port:** Remove any mention of `build.localPort`. Port is from `application.yaml` → `port` only (developer offset applies).
- **.env location:** Replace "For docker context (builder/.env)" and "Docker Context (builder/.env)" with the single-.env model: `.env` is written only at `build.envOutputPath` (or temp for run); no `.env` under `builder/` or `integration/`. Update tables and examples that reference `builder/.env` to say "env at envOutputPath" or "single .env (envOutputPath or temp)".
- **Remote:** If this doc is the right place, add a short subsection on remote Docker (when `remote-server` is set): one network per developer, cert auth for dev APIs, no dev user management when there is no remote server.

### 2.2 [docs/running.md](docs/running.md)

- **Run behaviour:** Document `aifabrix run <app> --reload` (dev only): local Docker mounts resolved `build.context`; remote Docker uses Mutagen (local = resolved build.context, remote = user-mutagen-folder + `/dev/` + appKey). Document `--env dev|tst|pro` for run.
- **.env:** Replace "Generates .env file" and any "builder/myapp/.env" with: env is resolved in memory and written only to `build.envOutputPath` (or temp for run); no `.env` in `builder/` or `integration/`. Update "View environment" / troubleshooting that say `cat builder/myapp/.env` to use the actual .env path (envOutputPath or "see logs/env summary").
- **Prerequisites:** Change "`.env` file must exist in `builder/<app>/`" to requiring `build.envOutputPath` set for run (or document temp-file behaviour) and that env is generated at run time.
- **Live reload:** Update "Live Reload" to recommend `aifabrix run myapp --reload` (and explain local vs remote behaviour briefly).
- **Optional:** Add a one-line note that with remote Docker configured, run/build use the remote Docker endpoint and Mutagen for dev --reload.

### 2.3 [docs/building.md](docs/building.md)

- **.env output:** Remove or replace all references to **Docker `.env` at `builder/myapp/.env**`. Plan 66: no .env in builder/. State that:
  - Secrets are resolved in memory; the only persisted `.env` is written to `build.envOutputPath` when set (for run, compose uses this path or a temp path).
  - For container runtime, compose's `env_file` points to that single path (envOutputPath or temp).
- Update the "What Happens" list and mermaid diagram: remove "Docker .env at builder/myapp/.env"; show "Single .env at envOutputPath (or temp for run)".
- **"What Gets Created" / ".env Files":** Replace "Docker .env file – Location: builder/myapp/.env" and "View: cat builder/myapp/.env" with the single-file model and viewing at envOutputPath (or note that run uses envOutputPath/temp).
- **Build context:** Emphasize that `build.context` is also used for **run --reload** (local mount path and Mutagen local path).

---

## 3. Commands documentation

### 3.1 [docs/commands/application-development.md](docs/commands/application-development.md)

- **aifabrix run app:** Add options `--reload` (dev only; mount/sync code) and `--env \<dev|tst|pro\>`. Update prerequisites: `.env` is generated at run time to `build.envOutputPath` (or temp); no requirement for "`.env` file in builder/".
- **aifabrix build app:** Under "Creates", remove "`.env` file in builder/"; state that env is resolved and written only to envOutputPath when configured (and that run uses the same single .env).
- **New: aifabrix shell app:** Add a section for `aifabrix shell <app> [--env dev|tst]` (exec into the running or ephemeral container; no SSH).
- **New: aifabrix test app (builder apps):** Add a section for `aifabrix test <app> [--env dev|tst]` for **builder** applications (run tests inside container; dev = running container, tst = ephemeral container). Distinguish from external-system `aifabrix test <app>` in external-integration docs.

### 3.2 [docs/commands/developer-isolation.md](docs/commands/developer-isolation.md)

- **New: aifabrix dev init:** Document `aifabrix init` or `aifabrix dev init` with `--dev-id`, `--server`, `--pin`: issue-cert, then GET /api/dev/settings, then POST ssh-keys so Mutagen works without password. Only when a remote server exists.
- **New: aifabrix dev add / update / pin / delete / list:** Document that these exist **only when remote-server is set** (no dev user API without remote). Brief description: add (create developer), update (patch profile), pin (one-time PIN for onboarding), delete (remove developer), list (list developers). Admin/secret-manager for add/update/pin/delete.
- **New: aifabrix dev down:** Document stopping sync sessions (and optionally app containers); align with down-infra / down-app naming.
- **aifabrix dev config:** Extend to mention that when remote and cert is available, config can be refreshed from GET /api/dev/settings.
- **Configuration variables:** Add remote-development variables: `aifabrix-workspace-root`, `remote-server`, `docker-endpoint` (and that cert auth is used for dev APIs).

### 3.3 [docs/commands/infrastructure.md](docs/commands/infrastructure.md)

- **up-infra:** Clarify **one network per developer** (dev/tst/pro share that developer's network). Optional: when `remote-server` is set, infra may be on the remote host (brief note).
- **Optional:** Cross-link to developer-isolation commands for dev init and remote setup.

### 3.4 [docs/commands/utilities.md](docs/commands/utilities.md)

- **aifabrix resolve app:** Change "Creates: builder/myapp/.env" to: writes `.env` only to `build.envOutputPath` when set (or document temp/run-only behaviour so it's consistent with run).
- **New: aifabrix secrets list / set / remove:** Document:
  - `aifabrix secrets list` – list user's local secrets (project file).
  - `aifabrix secrets list --shared` – list shared secrets (when aifabrix-secrets is file path: from project file; when http(s) URL: from GET /api/dev/secrets, cert required).
  - `aifabrix secrets set <key> <value>` – local; `aifabrix secrets set <key> <value> --shared` – shared (file path vs POST /api/dev/secrets when URL; admin/secret-manager for shared when remote).
  - `aifabrix secrets remove <key>` – local; `aifabrix secrets remove <key> --shared` – shared (file path vs DELETE /api/dev/secrets/{key} when URL).
- **Security note:** When aifabrix-secrets is a URL, shared secret values are never stored on disk; they are fetched at resolution time.

### 3.5 [docs/commands/application-management.md](docs/commands/application-management.md)

- No mandatory changes from 65/66. Optional: ensure "register/rotate" and any env-update wording do not imply writing .env to builder/.

### 3.6 [docs/commands/reference.md](docs/commands/reference.md)

- **Troubleshooting / "View configuration":** Replace `cat builder/myapp/.env` with viewing .env at envOutputPath or using `aifabrix logs myapp` for env summary.
- **Common Workflows:** Optionally add `aifabrix run myapp --reload` for dev and `aifabrix dev init` for remote onboarding.

### 3.7 [docs/commands/README.md](docs/commands/README.md)

- Ensure **Developer isolation** section lists: `dev config`, `dev init`, `dev add` / `dev update` / `dev pin` / `dev delete` / `dev list`, `dev down` (with note: dev user commands and dev down only when remote).
- Ensure **Application development** lists: `run` (with --reload, --env), `shell`, `test` (builder app tests).
- Ensure **Utilities** (or Secrets) lists: `secrets list`, `secrets list --shared`, `secrets set`, `secrets remove` and reference remote vs local behaviour.

---

## 4. Top-level and index docs

### 4.1 [docs/README.md](docs/README.md)

- **Developer isolation:** Update description from "Port isolation for multiple developers" to include remote Docker and one network per developer (and optionally link to dev init / remote setup).
- **Optional:** Add a short "Remote development" or "Dev server" line in Platform and infrastructure or Applications (if you add a dedicated remote-dev page later).

### 4.2 [docs/your-own-applications.md](docs/your-own-applications.md)

- **Run / Build steps:** Ensure any mention of ".env in builder/" is removed; state that .env is written only at envOutputPath (or temp for run).
- **Optional:** Add a step or tip for `aifabrix run myapp --reload` for local or remote dev, and that remote requires `aifabrix dev init` first.

---

## 5. Summary table (what to change where)


| Doc                                 | Plan 65 (remote Docker, dev, secrets API)                  | Plan 66 (single .env, local run --reload, no localPort)               |
| ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| configuration/application-yaml.md   | —                                                          | build.context as content source; envOutputPath only; remove localPort |
| configuration/env-config.md         | —                                                          | PORT from port only                                                   |
| configuration/env-template.md       | —                                                          | .env only at envOutputPath / temp                                     |
| configuration/secrets-and-config.md | remote-server, docker-endpoint, remote vs local secrets    | —                                                                     |
| configuration/README.md             | Remote config pointer                                      | —                                                                     |
| developer-isolation.md              | One network per developer; remote note                     | No localPort; .env only at envOutputPath/temp                         |
| running.md                          | run --env; optional remote note                            | run --reload; single .env; no builder/.env                            |
| building.md                         | —                                                          | No builder/.env; single .env; build.context for run                   |
| commands/application-development.md | run --env; shell; test (builder)                           | run --reload; prerequisites (.env at envOutputPath)                   |
| commands/developer-isolation.md     | dev init, dev add/update/pin/delete/list, dev down, config | —                                                                     |
| commands/infrastructure.md          | One network per developer                                  | —                                                                     |
| commands/utilities.md               | secrets list/set/remove (remote vs local)                  | resolve creates at envOutputPath only                                 |
| commands/reference.md               | Optional: dev init, run --reload                           | View .env at envOutputPath / logs                                     |
| commands/README.md                  | List dev *, shell, test (builder), secrets *               | —                                                                     |
| docs/README.md                      | Developer isolation description                            | —                                                                     |
| your-own-applications.md            | Optional: dev init, run --reload                           | No .env in builder/; envOutputPath                                    |


---

## 6. Out of scope for this plan

- **66-docs_and_schema_fixes.plan.md** (Done) covered external-systems, wizard, github-workflows, application-yaml (variables.yaml, etc.), and other schema/doc fixes. This plan does not duplicate those items.
- **New dedicated "Remote development" page:** Optional; if added later, it would centralize remote-server, docker-endpoint, init, Mutagen, and cert auth; then other docs can link to it.
- **Code or schema changes:** None; documentation only.

---

## 7. Definition of done (for doc updates)

- All sections above are updated so that:
  - No doc implies `.env` exists in `builder/<app>/` or `integration/<app>/`; only at envOutputPath or temp.
  - No doc references `build.localPort`; port is from `port` only.
  - Remote Docker, dev init, dev add/update/pin/delete/list, dev down, run --reload/--env, shell, builder test, and secrets list/set/remove (with remote vs local) are documented where listed.
  - One network per developer (dev/tst/pro share it) and cert auth for dev APIs are stated in developer-isolation and config docs.
- Build/lint/test still pass (no code changes; optional link-check or doc lint if the project has it).

---

## Validation Report

**Date:** 2025-02-17  
**Plan:** .cursor/plans/67-docs_update_post_65_66.plan.md  
**Document(s):** All docs listed in plan (configuration, developer-isolation, running, building, commands, README, your-own-applications)  
**Status:** ✅ COMPLETE (Plan 67 content updates applied 2025-02-17)

### Executive Summary

Validation was run for all 17 documents referenced in Plan 67. All referenced docs exist and have valid structure and navigation. **Schema alignment:** `application-schema.json` defines `build.context`, `build.envOutputPath`, `build.containerPort`; `**build.localPort` is not in the schema** (removed per Plan 66). Several docs still describe the old behaviour (e.g. `.env` in `builder/myapp/`, no `run --reload`, no `dev init`/secrets API). Those gaps are expected and are the subject of Plan 67’s doc updates. MarkdownLint is not a project dependency; no MarkdownLint run was performed.

### Documents Validated

- **Total:** 17
- **Passed (structure + references):** 17
- **Failed:** 0
- **Auto-fixed:** 1 (broken link in application-management.md)

#### Document List

- ✅ docs/configuration/application-yaml.md
- ✅ docs/configuration/env-config.md
- ✅ docs/configuration/env-template.md
- ✅ docs/configuration/secrets-and-config.md
- ✅ docs/configuration/README.md
- ✅ docs/developer-isolation.md
- ✅ docs/running.md
- ✅ docs/building.md
- ✅ docs/commands/application-development.md
- ✅ docs/commands/developer-isolation.md
- ✅ docs/commands/infrastructure.md
- ✅ docs/commands/utilities.md
- ✅ docs/commands/application-management.md
- ✅ docs/commands/reference.md
- ✅ docs/commands/README.md
- ✅ docs/README.md
- ✅ docs/your-own-applications.md

### Structure Validation

- **Title:** All docs have a single `#` title at top.
- **Hierarchy:** Section levels are consistent (##, ###).
- **Navigation:** Configuration docs link back to Documentation index and Configuration README; commands docs link to Documentation index and Commands index. developer-isolation.md links to `(README.md)` which from `docs/` correctly points to docs/README.md.

### Reference Validation

- **Cross-references:** Links within `docs/` use relative paths; targets exist for spot-checked links (README.md, configuration/README.md, env-template.md, building.md, running.md, deploying.md, etc.).
- **Broken link (fixed):** In `docs/commands/application-management.md`, the link `[Configuration](configuration/README.md)` was used in three places. From `docs/commands/`, that resolved to `docs/commands/configuration/README.md`, which does not exist. **Fixed:** Replaced with `../configuration/README.md`.
- **External links:** GitHub (e.g. aifabrix-miso-client) and schema path to lib/schema are acceptable.

### Schema-based Validation

- **application-schema.json (lib/schema):**  
  - `build` object includes: `envOutputPath`, `containerPort`, `language`, `context`, `dockerfile`. **No `localPort**` (correctly removed).
  - docs/configuration/application-yaml.md: Optional list mentions `build.context`, `build.envOutputPath`; no `build.localPort` → ✅ aligned.
  - docs/configuration/env-config.md: References `${PORT}` from `application.yaml` `port` or `build.containerPort` → ✅ schema has `port` and `build.containerPort`.
- **Doc examples:** The minimal YAML example in application-yaml.md (app, image, port, build.language) is valid when mapped to the schema (key, displayName, description, type, port, build.language, etc.). No invalid enum or required-field issues found in the reviewed examples.

### Markdown Validation

- **MarkdownLint:** Not run (markdownlint is not listed in package.json). Consider adding it as a devDependency and running `npx markdownlint "docs/**/*.md"` for zero-error policy.
- **Code blocks:** Fenced blocks use correct language tags (yaml, bash, etc.).
- **Tables and lists:** Formatting is consistent in the checked docs.

### Project Rules Compliance

- **Focus:** Docs are user-facing and describe how to use the builder (CLI, configuration, workflows).
- **CLI:** Commands use `aifabrix` (and mention `af` alias where appropriate).
- **Config examples:** application.yaml examples and described structure match application-schema.json (build.context, build.envOutputPath, no localPort).

### Gaps vs Plan 67 (expected; to be fixed by implementing the plan)

These are content gaps that Plan 67 is intended to fix (not validation failures):

1. **Single .env / no builder/.env:** Several docs still say or imply `.env` in `builder/<app>/` (e.g. running.md “Generates .env file”, building.md “Docker .env at builder/myapp/.env”, developer-isolation.md “Docker Context (builder/.env)”, commands/utilities.md “Creates: builder/myapp/.env”, commands/reference.md “cat builder/myapp/.env”). Plan 67 specifies single .env at envOutputPath or temp only.
2. **run --reload / --env:** application-development.md and running.md do not yet document `--reload` (dev only; mount/sync) or `--env dev|tst|pro`.
3. **shell / test (builder):** application-development.md does not yet document `aifabrix shell <app>` or `aifabrix test <app>` for builder apps.
4. **dev init, dev add/update/pin/delete/list, dev down:** commands/developer-isolation.md and commands/README.md do not yet list these; config and secrets-and-config do not yet document remote-server, docker-endpoint, aifabrix-workspace-root, or remote vs local aifabrix-secrets (http(s) URL vs file).
5. **secrets list/set/remove (including --shared):** commands/utilities.md documents `secrets set` but not `secrets list` or `secrets remove`, or --shared/API behaviour.
6. **One network per developer:** developer-isolation.md and commands/infrastructure.md do not yet state that dev/tst/pro share the same developer network.
7. **build.context:** application-yaml.md and building.md do not yet state that build.context is the canonical app code directory for run --reload (local mount and Mutagen local path).

### Automatic Fixes Applied

- **Reference fix:** In `docs/commands/application-management.md`, updated three Configuration links from `(configuration/README.md)` to `(../configuration/README.md)` so they resolve correctly from docs/commands/.
- MarkdownLint was not run (not in package.json).

### Manual Fixes Required

1. **Plan 67 implementation:** Apply all content updates described in Plan 67 sections 1–4 so that docs match single-.env, no localPort, run --reload/--env, shell, test (builder), dev init/add/update/pin/delete/list/down, secrets list/remove and --shared, one network per developer, and remote config/secrets.

### Final Checklist

- All documents validated (structure, references, schema alignment)
- MarkdownLint passes (0 errors) — *tool not run; not in package.json*
- Cross-references within docs/ valid (broken link fixed in application-management.md)
- No broken links — *fixed*
- Examples and structure in docs aligned with lib/schema (application-schema.json)
- Content focused on using the builder (external users)
- Auto-fixes applied — *link fix in application-management.md*
- Manual fixes documented — *Plan 67 content updates in "Gaps vs Plan 67" and "Manual Fixes Required"*

---

## Implementation Validation Report

**Date:** 2025-02-17  
**Plan:** .cursor/plans/67-docs_update_post_65_66.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

Plan 67 is a **documentation-only** plan. All 17 target documents have been updated per sections 1–4. Content checks confirm: single .env (envOutputPath/temp), no `build.localPort` in docs, run --reload/--env, shell, test (builder), dev init/add/update/pin/delete/list/down, secrets list/set/remove (remote vs local), one network per developer, and remote config/secrets are documented. Format and lint pass; one pre-existing lint warning (complexity in compose-generator.js, unrelated to this plan). All tests pass.

### Task Completion

- **Plan type:** Documentation update (no checkboxes in plan; requirements are section-based).
- **Requirements:** All items in sections 1–4 implemented (configuration docs, developer-isolation/running/building, commands docs, top-level docs).
- **Definition of done:** Met — no doc implies .env in builder/ or integration/; no doc references build.localPort; remote Docker, dev commands, run --reload/--env, shell, test (builder), secrets list/set/remove, one network per developer, and cert auth are documented where listed.

### File Existence Validation

All 17 documents exist and contain the expected Plan 67 content:


| File                                     | Status                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| docs/configuration/application-yaml.md   | ✅ build.context, envOutputPath, port only                                 |
| docs/configuration/env-config.md         | ✅ PORT from port, single .env                                             |
| docs/configuration/env-template.md       | ✅ .env only at envOutputPath/temp                                         |
| docs/configuration/secrets-and-config.md | ✅ remote-server, docker-endpoint, remote vs local secrets                 |
| docs/configuration/README.md             | ✅ Remote development pointer                                              |
| docs/developer-isolation.md              | ✅ One network per developer, .env at envOutputPath, remote note           |
| docs/running.md                          | ✅ run --reload, --env, single .env, prerequisites                         |
| docs/building.md                         | ✅ Single .env, build.context for run --reload                             |
| docs/commands/application-development.md | ✅ run --reload/--env, shell, test (builder), prerequisites                |
| docs/commands/developer-isolation.md     | ✅ dev init, dev add/update/pin/delete/list, dev down, config, remote vars |
| docs/commands/infrastructure.md          | ✅ One network per developer, remote note                                  |
| docs/commands/utilities.md               | ✅ resolve at envOutputPath, secrets list/set/remove, --shared             |
| docs/commands/application-management.md  | ✅ (no mandatory changes; optional .env wording)                           |
| docs/commands/reference.md               | ✅ View .env at envOutputPath/logs, run --reload, dev init                 |
| docs/commands/README.md                  | ✅ dev *, shell, test (builder), secrets *                                 |
| docs/README.md                           | ✅ Developer isolation description                                         |
| docs/your-own-applications.md            | ✅ No .env in builder/, envOutputPath, run --reload tip                    |


### Test Coverage

- **Plan scope:** Documentation only; no new code or test files required by this plan.
- **Existing tests:** Unchanged by Plan 67; test suite passes.

### Code Quality Validation


| Step              | Result       | Notes                                                                                                       |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| Format (lint:fix) | ✅ PASSED     | Exit code 0                                                                                                 |
| Lint              | ⚠️ 1 warning | 0 errors; 1 pre-existing warning: `compose-generator.js` complexity 16 (max 15). Not introduced by Plan 67. |
| Tests             | ✅ PASSED     | All tests pass (exit code 0)                                                                                |


### Cursor Rules Compliance

- **Documentation:** User-facing docs follow project conventions (CLI name, config examples, no localPort documented).
- **No code changes:** Plan 67 does not modify lib/ or schema; cursor rules for code apply to existing codebase (lint warning is pre-existing).

### Implementation Completeness

- **Configuration docs:** Complete (application-yaml, env-config, env-template, secrets-and-config, configuration/README).
- **Developer isolation and running:** Complete (developer-isolation, running, building).
- **Commands documentation:** Complete (application-development, developer-isolation, infrastructure, utilities, application-management, reference, commands/README).
- **Top-level docs:** Complete (docs/README, your-own-applications).
- **Database/Services/API/Schema/Migrations:** N/A (documentation-only plan).

### Issues and Recommendations

1. **Lint warning:** Consider reducing complexity of `generateDockerCompose` in `lib/utils/compose-generator.js` in a future change (outside Plan 67).
2. **MarkdownLint:** Not in package.json; optional to add for doc linting.

### Final Validation Checklist

- All plan requirements (sections 1–4) implemented in docs
- All 17 target files exist and contain expected content
- No doc implies .env in builder/ or integration/; no doc references build.localPort
- Format (lint:fix) passes
- Lint passes (0 errors; 1 pre-existing warning)
- Tests pass
- Implementation complete for documentation scope

