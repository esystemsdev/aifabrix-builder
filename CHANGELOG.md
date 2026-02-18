## [2.41.0] - 2026-02-17

### Added
- **Remote Docker development (plan 65)**: Full remote dev flow for dev/tst/pro with certificate (mTLS) authentication. **Config:** `~/.aifabrix/config.yaml` supports `aifabrix-workspace-root`, `remote-server`, and `docker-endpoint`; when `remote-server` is set, Docker commands use the remote endpoint. **Onboarding:** `aifabrix init` (or `aifabrix dev init`) with `--dev-id`, `--server`, `--pin` — generates CSR, calls `POST /api/dev/issue-cert`, stores certificate in `~/.aifabrix/certs/<dev-id>/`, fetches settings via `GET /api/dev/settings`, and registers SSH public key via `POST /api/dev/users/{id}/ssh-keys` so Mutagen works without username/password (ed25519 key generation on Windows/Mac). **Dev API (cert-authenticated):** Users — `GET/POST/PATCH/DELETE /api/dev/users`, `POST /api/dev/users/{id}/pin`; SSH keys — `GET/POST/DELETE /api/dev/users/{id}/ssh-keys`; Secrets — when `aifabrix-secrets` is an http(s) URL, `GET/POST/DELETE /api/dev/secrets` for shared secrets (values never stored on disk). **Run:** `aifabrix run <app> --reload` (dev) uses Mutagen sync (local ↔ remote path), then container with `-v <remote_path>:/app`; `--env tst`/`pro` run immutable image on the same per-developer network. **Infra:** One Docker network per developer; dev/tst/pro share that network. Mutagen binary under `~/.aifabrix/bin/` (auto-download if missing). Backend contract: `.cursor/plans/swagger.json`.
- **Local Docker and single .env (plan 66)**: `aifabrix run <appKey> --reload` with **local** Docker (Windows/Mac, local HDD). **Content mapping:** `build.context` in `application.yaml` is the canonical app code directory for both local and remote — local run mounts resolved `build.context`; remote run uses it as Mutagen local path. **Single .env:** Secrets resolved in memory; .env is written **only** to `build.envOutputPath` (code folder). No .env under `builder/<appKey>/` or `integration/<appKey>/`; compose `env_file` uses that single path (or temp when envOutputPath unset). **Port:** `build.localPort` removed from schema and code; app port comes only from `port` in `application.yaml` (developer offset for multi-dev unchanged).

### Changed
- **Run flow:** `prepareAppRun` and `ensureReloadSync` use resolved `build.context` for local mount path and (when remote) Mutagen local path. Compose generator accepts explicit `envFilePath` for `env_file`. Port resolution and compose use `port` only (no `localPort`).
- **Secrets/core:** `generateEnvFile` and run flow no longer write .env to builder or integration; resolve via `generateEnvContent` in memory and write only to `envOutputPath` or temp. `processEnvVariables` (env-copy) simplified to single-path write when used.
- **Schema and config:** `build.localPort` removed from `application-schema.json`; `port-resolver`, `secrets-helpers`, `env-copy`, and compose-generator use `port` only.
- **Docs:** application-yaml, developer-isolation, running, building updated for single .env, `build.context` as content mapping, and removal of `build.localPort`.

### Technical
- **Remote dev:** `lib/api/dev.api.js`, `lib/commands/dev-init.js`, `lib/commands/dev-down.js`, `lib/commands/dev-cli-handlers.js`; `lib/utils/remote-dev-auth.js`, `lib/utils/remote-docker-env.js`, `lib/utils/remote-secrets-loader.js`, `lib/utils/mutagen.js`, `lib/utils/ssh-key-helper.js`, `lib/utils/dev-cert-helper.js`; config keys and GET /api/dev/settings usage; Mutagen session lifecycle and path formula (user-mutagen-folder + `/dev/` + appKey).
- **Local run + single .env:** `lib/app/run.js`, `lib/app/run-helpers.js` — codePath from resolved `build.context`, `devMountPath` for local/remote; `lib/core/secrets.js` — resolve-and-write only to envOutputPath/temp; `lib/utils/compose-generator.js` — `envFilePath`; `lib/utils/port-resolver.js`, `lib/utils/secrets-helpers.js`, `lib/utils/env-copy.js` — localPort removed.
- **Tests:** `tests/lib/api/dev.api.test.js`, `tests/lib/commands/dev-*.test.js`, `tests/lib/commands/secrets-list.test.js`, `tests/lib/commands/secrets-remove.test.js`, `tests/lib/utils/remote-*.test.js`, `tests/lib/utils/mutagen.test.js`, `tests/lib/utils/dev-cert-helper.test.js`, `tests/lib/utils/ssh-key-helper.test.js`; updates for localPort removal and single .env behaviour across run, config-paths, docker-build, secrets.

---

## [2.40.2] - 2026-02-16

### Added
- **Manual tests (real API)**: New `tests/manual/` suite for tests that call **real** Controller and Dataplane APIs (no mocks). Excluded from default `npm test` and CI; run with `npm run test:manual`. Prerequisite: user must be logged in (`aifabrix login` or client credentials); setup runs `aifabrix auth status --validate` before any test and exits with the full error if auth fails. New `jest.config.manual.js`, script `test:manual`, and docs in `tests/manual/README.md` and `tests/README.md`. **Auth**: `aifabrix auth status` supports `--validate` (exit code 1 when not authenticated, for scripted use). **Coverage**: Every `lib/api` module is covered—auth, applications, environments, deployments, pipeline, credentials, external-systems, datasources-core, datasources-extended, wizard—with 39 tests making real HTTP calls to verify connectivity and API usage when logged in.
- **External Integration Testing (docs)**: New standalone document `docs/commands/external-integration-testing.md` as the single source of truth for testing external integrations. Covers unit tests (`aifabrix test`), integration tests (`aifabrix test-integration`), test payload configuration (`payloadTemplate`, `expectedResult`, `--payload <file>`), validating list responses, capabilities, and troubleshooting. Cross-links from `docs/commands/README.md`, `docs/commands/validation.md`, and `docs/external-systems.md` (Test Payloads section).

### Changed
- **External Integration Commands (docs)**: `docs/commands/external-integration.md` refactored to stay command-focused. Intro links to the new testing doc. Sections for `aifabrix test <app>` and `aifabrix test-integration <app>` shortened (What, When, Usage, Options, short Process); long Process details, example output blocks, Test Payload Configuration, and long Issues/Next Steps moved to [External Integration Testing](docs/commands/external-integration-testing.md). Existing anchors `#aifabrix-test-app` and `#aifabrix-test-integration-app` retained for cli-reference and validation links.
- **Documentation and schema alignment (plan 66)**: **README** — Miso TypeScript repo link clarified. **application-yaml** — variables.yaml mention minimized (legacy rename only). **external-systems** — environment.baseUrl removed as option; internal:true clarified (template/maintained integrations, not customer-edited); single URL key + controller promotion (no PRODUCTION_URL/DEV_URL in config); BASEURL as standard credential variable; credential variables (CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD, BASEURL) not in configuration section; groups (lowercase) throughout; recordRef (camelCase) and record_ref/entityType documentStorage documented. **wizard** — standard variables aligned with external-systems and code; variables from credentials not in configuration. **github-workflows** — dataplane external systems deployment (client id/secret, secure pipeline recommendations); public controller URL; correct `aifabrix deploy <app> --deployment=local` wording; external systems deployment section. **building** — environment (dev, tst, pro) as deploy-time concern, same Dockerfile. **running** — `aifabrix run` only builder; integration apps use validate then upload/deploy.

## [2.40.0] - 2026-02-13

### Added
- **Upload to dataplane**: `aifabrix upload <system-key>` – upload full external system (system + all datasources + RBAC) directly to the dataplane via pipeline **upload → validate → publish**; no controller deploy. Controller is used only to resolve dataplane URL and auth. Options: `--dry-run` (validate and build payload only; no API calls), `--dataplane <url>` to override dataplane URL. Use when testing the full system on the dataplane without promoting, or when you have only dataplane access. RBAC stays in the dataplane until you promote via `aifabrix deploy <app> --type external` or the web UI. Documented in `docs/commands/external-integration.md`, `docs/commands/README.md`, `docs/external-systems.md` (subsection “Upload to dataplane”), `docs/wizard.md`, and `docs/commands/permissions.md`.
- **App show (online/offline)**: Source line shows 🟢 for online and 🔴 for offline. For external apps, Application section uses **🧷 Application - external** with Key, Display name, Description, Deployment, Status (and Version for offline). **🧩 Dataplane** block follows with Version, Credential, Status, API docs, MCP server, OpenAPI spec when dataplane data is available; when not available, shows "🧩 Dataplane: not available". External integration block appears after Dataplane. Option `--online` is accepted on `aifabrix app show <appKey>` for UX parity with `aifabrix show <appKey> --online`.
- **App show dataplane**: For external apps when showing online, the CLI calls dataplane `GET /api/v1/external/systems/{systemIdOrKey}` (in addition to config and OpenAPI lists) and surfaces credentialId, status, version, showOpenApiDocs, mcpServerUrl, apiDocumentUrl, openApiDocsPageUrl in the Dataplane block and in JSON output. Response shape is normalized (body.data ?? body; config.type/config.version used when top-level missing); null URL/credential values are omitted so display shows "—". Documented in `docs/commands/application-management.md`.
- **Config format and path resolution**: Application config can be **YAML or JSON** on disk (`application.yaml`, `application.yml`, or `application.json`). Single entry point `resolveApplicationConfigPath(appPath)` resolves path (prefers `application.yaml`/`application.json`; renames legacy `variables.yaml` to `application.yaml` if present). Config format converter layer in `lib/utils/config-format.js`: `yamlToJson`, `jsonToYaml`, `loadConfigFile`, `writeConfigFile`—all config loaders and writers use this layer; internal code works with JSON object and JSON Schema only. System and datasource definitions (`*-system.*`, `*-datasource-*.*`) may be `.yaml` or `.json`; deployment manifest remains **JSON only**.
- **Convert format utility**: `aifabrix convert <app> --format json | yaml` converts integration/external system and datasource config files between JSON and YAML, updates `externalIntegration.systems` and `externalIntegration.dataSources` in application config to the new filenames, and removes old files only after validation and (unless `--force`) confirmation. Process: validate first → prompt "Are you sure?" (or skip with `-f, --force`) → write new files → update app config links → delete old files. Does not convert `*-deploy.json`, env.template, README, or rbac. Documented in `docs/commands/utilities.md` and `docs/commands/README.md`.
- **Docs**: `docs/configuration/application-yaml.md` (replaces variables-yaml.md)—application config format, YAML/JSON choice, deployment manifest JSON-only; single-version docs updated across configuration, commands, external-systems, deploying, running, building, wizard, infrastructure.
- **Diff type matching and schema validation**: `aifabrix diff <file1> <file2>` now requires both files to be the **same config type** (app, system, or datasource); type is auto-detected from content and filename. If types differ, the command exits with a clear "Type mismatch" error. Both files are validated against the appropriate schema by default; use `--no-validate` to skip schema validation. Type detection works with YAML via `detectSchemaTypeFromParsed` in schema-loader. Documented in `docs/commands/validation.md` and `docs/commands/external-integration.md`.
- **Docs (Controller and Dataplane)**: New section in `docs/deploying.md` — **"Controller and Dataplane: What, Why, When"** (roles, when to use deploy vs upload, when MCP/OpenAPI docs are available, how to get OpenAPI and MCP docs, `showOpenApiDocs`). Three Mermaid diagrams: deployment paths (CLI → Controller/Dataplane), when MCP/OpenAPI docs become available, deploy vs upload. Cross-links and "when docs available" in `docs/external-systems.md`, `docs/wizard.md`, `docs/commands/deployment.md`, and `docs/commands/external-integration.md`.

### Changed
- **Path resolution (no `--type` override)**: The `--type app` and `--type external` options are **removed** from deploy, json, validate, convert, split-json, and delete. Path resolution is **fixed**: the CLI always checks **`integration/<app>`** first, then **`builder/<app>`**; if neither exists, it errors. There is no option to override this order. Commands such as `aifabrix json hubspot`, `aifabrix validate my-hubspot`, `aifabrix deploy hubspot`, `aifabrix delete hubspot` resolve the app path automatically.
- **Create keeps `--type`**: The create command still accepts `--type` for **application kind** only: `webapp`, `api`, `service`, `functionapp`, or `external` (e.g. `aifabrix create test-hubspot --type external`). This specifies what is being created, not which path to use for existing apps.
- **Create validation**: Create fails with a clear error if `integration/<name>` or `builder/<name>` already exists; use a different name or remove the existing directory. Documented in application-development, your-own-applications, and plan 58.
- **Delete**: `aifabrix delete <system-key>` has no `--type` option; path is resolved (integration first, then builder).
- **split-json**: No `--type` option; uses the same resolution order (integration first, then builder, then error).
- **split-json README**: Generated README now uses the shared templates `templates/applications/README.md.hbs` (app type) or `templates/external-system/README.md.hbs` (external type). Variables (displayName, description, appName, port, image, etc.) are taken from the deployment JSON. The dedicated `templates/applications/split-readme.md.hbs` template was removed.
- **split-json application.yaml**: Roles and permissions are written only to **rbac.yml**; they are no longer included in application.yaml. The **configuration** section in application.yaml contains only **portal input** definitions (entries that have `portalInput`), each as `{ name, portalInput }`. Actual values, location, and required flag remain in **env.template** and are not duplicated in application.yaml.
- **Application config filename**: All loaders and writers use `application.yaml` or `application.json` (legacy `variables.yaml` is supported via auto-rename on first resolve). Templates emit `application.yaml` (e.g. `templates/applications/dataplane/application.yaml`, keycloak, miso-controller). Fixtures and integration/hubspot use `application.yaml`.

### Fixed
- **split-json for external systems – README**: When splitting deploy JSON that has a top-level `system` (external format), the generated README now uses `templates/external-system/README.md.hbs` (Quick Start, Create External System, integration path, etc.) instead of the generic application README.
- **split-json for external systems – application.yaml**: Splitting external deploy JSON now produces a valid `application.yaml` with the required `app` block (key, displayName, description, type: external) and the required **externalIntegration** block (schemaBasePath, systems, dataSources, autopublish, version). Previously only `configuration` was written, causing validation errors: "Missing required property externalIntegration" and "externalIntegration block is required when app.type is external".
- **split-json for external systems – system and datasource files**: For external format, split-json now writes `{systemKey}-system.yaml` and `{systemKey}-datasource-{suffix}.yaml` from `deployment.system` and `deployment.dataSources`, so the directory is complete and `aifabrix validate <app>` can pass. The CLI logs the system and datasource file paths in the success message.
- **README and externalIntegration use .yaml**: The external-system README template and `application.yaml` externalIntegration now reference **.yaml** (not .json) for system and datasource files. Split generates and references `.yaml` files. The application schema allows `.yaml` and `.yml` in addition to `.json` for `externalIntegration.systems` and `dataSources`.
- **Validator and YAML external files**: When validating external system/datasource files, the validator now parses `.yaml`/`.yml` with js-yaml instead of JSON, so validation succeeds for the generated system and datasource YAML files.
- **README datasource file names**: The README "Files" section now lists correct, unique datasource filenames (e.g. `test-hubspot-datasource-companies-data.yaml`, `test-hubspot-datasource-data.yaml`) by aligning the suffix logic with the split filename derivation; previously it could show duplicate or incorrect names.
- **App show external dataplane fetch**: When the controller returns application type only in `configuration.type` (not on `appData.type`), the CLI now still treats the app as external and fetches dataplane data, so the Dataplane section shows values instead of "not available".

### Technical
- **Upload**: `lib/commands/upload.js` – `uploadExternalSystem`, `buildUploadPayload`, `resolveDataplaneAndAuth`, `runUploadValidatePublish`; uses `validateExternalSystemComplete`, `generateControllerManifest`, and `lib/api/pipeline.api.js` (uploadApplicationViaPipeline, validateUploadViaPipeline, publishUploadViaPipeline). CLI: `lib/cli/setup-external-system.js` – `upload <system-key>` with `--dry-run`, `--dataplane`. Tests: `tests/lib/commands/upload.test.js`.
- **Convert**: `lib/commands/convert.js` – `runConvert`, `promptConfirm`, `targetFileName`, `convertOneFile`; validate first, then prompt (unless `--force`), convert with `loadConfigFile`/`writeConfigFile`, update application config links, delete old files. Registered in `lib/cli/setup-utility.js` with `--format`, `-f, --force`, `--type`. Tests: `tests/lib/commands/convert.test.js`.
- **Config**: `lib/utils/app-config-resolver.js` – `resolveApplicationConfigPath`; `lib/utils/config-format.js` – `yamlToJson`, `jsonToYaml`, `loadConfigFile`, `writeConfigFile`. All config I/O in lib (generator, validation, app, external-system, commands, utils) uses resolver + converter; no raw `yaml.load`/`JSON.parse` for config outside config-format.
- **Paths**: `lib/utils/paths.js` – `detectAppType(appName)` (no `options.type`): resolution order is integration first, then builder; if neither exists, throws. `checkIntegrationFolder` / `checkBuilderFolder` unchanged; `resolveExternalOnly` and type override branches removed.
- **Create validation**: `lib/app/helpers.js` – `validateAppOrExternalNameNotExists(appName)` checks `integration/<name>` and `builder/<name>` before create; called from `validateAppCreation`. Clear error when either exists.
- **CLI**: `lib/cli/setup-utility.js` – `--type` removed from json, split-json, convert, validate; `resolveSplitJsonApp(appName)` uses `detectAppType(appName)` only. `lib/cli/setup-app.js` – `--type` removed from deploy. `lib/cli/setup-external-system.js` – delete has no `--type` option. `logOfflinePathWhenType(appPath)` (cli-utils) logs "Using: &lt;path&gt;" whenever appPath is set (no type check).
- **Schemas**: application and external schemas allow `.yaml`/`.yml`/`.json` for config file references; validation operates on object from converter.
- **Docs**: deployment, utilities, validation, README, application-development, application-management, external-integration, external-systems, wizard, your-own-applications, deploying – removed `--type app` / `--type external` from deploy, json, validate, convert, split-json, delete; documented fixed resolution order (integration first, then builder, then error) and create validation (fails if name exists in integration/ or builder/). Config format (YAML/JSON for config, JSON only for deploy manifest) unchanged.
- **Tests**: `tests/lib/utils/config-format.test.js`, `tests/lib/utils/resolve-application-config-path.test.js`; `tests/lib/utils/paths-detect-app-type.test.js` – detectAppType (real fs) for resolution order; validator, generator, env-generation for resolver + application.yaml. Plan 58: app-deploy (path resolution without options.type), app-helpers (validateAppCreation calls validateAppOrExternalNameNotExists; 3× fs.access), app.test (create conflict message), app-display (validate step without --type external), app-run-uncovered (detectAppType mocked for canRunApp).
- **Split (external)**: `lib/generator/split.js` – `buildReadmeConfigFromDeployment` detects external format via `deployment.system` and builds config for external-system README; `extractVariablesYamlForExternal` and `getExternalDatasourceFileName` produce app, configuration, and externalIntegration with `.yaml` references; `writeExternalSystemAndDatasourceFiles` writes system and datasource YAML. `lib/app/readme.js` uses real `config.datasources` when present for external README. `lib/utils/external-readme.js` – `normalizeDatasources` suffix aligned with split for unique README filenames. `templates/external-system/README.md.hbs` – system file listed as `-system.yaml`. `lib/validation/validate.js` – `parseJsonFileContent` parses `.yaml`/`.yml` with js-yaml. `lib/schema/application-schema.json` – externalIntegration systems/dataSources items pattern allows `.(json|yaml|yml)$` Tests: generator-split (external format app + externalIntegration + .yaml, README from external-system template).
- **Split (app)**: `lib/generator/split.js` – roles/permissions removed from optional sections so they appear only in rbac.yml; `extractPortalInputConfiguration()` returns only configuration entries with `portalInput` as `{ name, portalInput }` (values stay in env.template); README from `generateReadmeMd()` using shared applications or external-system template. `lib/app/readme.js` – `buildReadmeContext()` uses `config.displayName` when present. Removed `templates/applications/split-readme.md.hbs`. Tests: application.yaml has no roles/permissions; configuration only portalInput entries; no configuration when no portalInput; README from applications/external-system templates.
- **App show**: `lib/commands/app.js` – `--online` option on `app show <appKey>`. `lib/app/show.js` – `getExternalSystem` called for external apps; `normalizeExternalSystemResponse(systemResponse)` for dataplane response (body.data ?? body); `buildExternalSystemResult` uses res.config for type/version when top-level missing, omits null credentialId/URLs; external app detection uses `appData.type === 'external' || cfg.type === 'external'`. `lib/app/show-display.js` – 🟢/🔴 in source line; 🧷 Application - external (online: Key, Display name, Description, Deployment, Status; offline: + Version); 🧩 Dataplane compact block (Version, Credential, Status, API docs, MCP server, OpenAPI spec); "🧩 Dataplane: not available" when no data; External integration after Dataplane. Tests: show.test.js (getExternalSystem, compact output, --online option); show-display.test.js (external layout, source emoji).
- **Diff (type and schema)**: `lib/core/diff.js` – type detection for both files via `detectSchemaTypeFromParsed`, type-matching (app/system/datasource), schema validation (application, external-system, external-datasource) unless `--no-validate`. `lib/utils/schema-loader.js` – `detectSchemaTypeFromParsed(parsed, filePath)` exported for YAML-aware type detection. `lib/cli/setup-utility.js` – `--no-validate` on diff command. Docs: validation.md (type requirement, type mismatch error, schema validation, Process), external-integration.md (datasource diff note). Tests: diff.test.js (type mismatch, same-type, validation on/off), schema-loader tests for `detectSchemaTypeFromParsed`.

## [2.39.3] - 2026-02-11

### Added
- **CLI logs level filter**: `aifabrix logs <app> --level <level>` (or `-l`) to show only logs at the given level or above (debug, info, warn, error). Examples: `aifabrix logs dataplane -l error`, `aifabrix logs miso-controller -l warn`. Level is parsed from line prefixes (e.g. `INFO:`, `ERROR:`, `error:`, `info:` for miso-controller/pino) or from JSON `"level"` field in the line. Both docker stdout and stderr are read and filtered so no lines are missed. Documented in `docs/commands/application-development.md` and `docs/running.md`.

### Fixed
- **App register display**: "Application Details" after registration now shows the actual display name (e.g. from `application.yaml` `app.name` or `--name`) instead of the application key when the controller returns the key as `displayName`. Introduced `resolveDisplayName(application, requestedDisplayName)` and pass registration `displayName` into the display so output shows "Display Name: AI Fabrix Dataplane" rather than "Display Name: dataplane".

### Changed
- **Docs**: Deploying (simplified flow, added `--deployment local`, manifest naming `<appKey>-deploy.json`, controller-owned deployment key, register/rotate-secret require login); single Configuration reference in index; external-systems (BASE_URL, portalInput for prod/dev URLs, environment promotions link); wizard (removed 404 link, deployment.controller, Known Platforms from dataplane); miso-client/example app links; manifest naming in commands/utilities/reference/your-own-applications.

### Technical
- **App register display**: `lib/utils/app-register-display.js` – `resolveDisplayName(application, requestedDisplayName)`; `displayRegistrationResults(..., requestedDisplayName)`; `lib/app/register.js` passes `registrationData.displayName` into display. Tests: requested display name when API echoes key; `resolveDisplayName` unit tests.

## [2.39.2] - 2026-02-11

### Added
- **External system template**: `configuration` array with BASE_URL (portal input, validation); generator passes `baseUrl` and normalizes role `groups`; tests for configuration and baseUrl override.
- **Dynamic README generation**: When using template apps or `aifabrix up-miso` / `up-platform` / `up-dataplane`, `README.md` is now generated from `templates/applications/README.md.hbs` using the app’s `application.yaml`. Generated after copying from `templates/applications/<appName>` and refreshed on every ensure so docs stay in sync with config (port, image, registry, services).

### Changed
- **Template copy**: `ensureTemplateAtPath` (up-common) generates README at the target path after copying template files.
- **ensureAppFromTemplate**: Calls `ensureReadmeForApp(appName)` at the end so keycloak, miso-controller, and dataplane get READMEs created or updated whenever the command runs.

### Technical
- **lib/app/readme.js**: `generateReadmeMdFile(..., options)` supports `options.force` to overwrite existing README; new `ensureReadmeForAppPath(appPath, appName)` (loads application.yaml, writes README); new `ensureReadmeForApp(appName)` (primary and cwd builder paths).
- **Tests**: app-readme (force overwrite, ensureReadmeForAppPath when vars exist/missing/overwrite, ensureReadmeForApp at builder path); up-common mock of readme and assertions that ensureReadmeForAppPath/ensureReadmeForApp are called.

## [2.39.1] - 2026-02-10

### Fixed
- **Deploy lint**: Use strict equality (`===`/`!==`) in `lib/app/deploy.js` (eqeqeq); reduce cyclomatic complexity of status URL display

### Technical
- **Deploy**: Extracted status URL display into `lib/app/deploy-status-display.js` (`buildAppUrlFromControllerAndPort`, `parseUrlAndPortFromStatusBody`, `displayAppUrlFromController`) to satisfy max-lines and complexity limits

## [2.39.0] - 2026-02-09

### Added
- **Deploy --deployment flag**: `aifabrix deploy <app> --deployment=local` runs the app locally (same as `aifabrix run <app>`); `--deployment=cloud` (default) deploys via Miso Controller
- **Service user CLI**: `aifabrix service-user create` – create service user via controller API with group assignment; returns one-time secret with clear “save now” warning; OpenAPI spec in `templates/applications/miso-controller/openapi/service-user.openapi.yaml`
- **API**: `lib/api/service-users.api.js` and `lib/api/types/service-users.types.js` for create service user; `@requiresPermission` and docs in `docs/commands/permissions.md`
- **Permissions docs**: `docs/commands/permissions.md` – reference for all online (controller/dataplane) API methods and required permissions; JSDoc `@requiresPermission` in `lib/api` modules

### Changed
- **Manifest generic (no env-specific URLs)**: Removed `deployment.controllerUrl` from application schema, generators (`lib/generator/builders.js`), variable-transformer, and templates; removed `external-system.environment` (baseUrl, region) from external-system schema. Controller URL, dataplane URL, and external baseUrl are resolved outside the manifest (user config, controller config, runtime).
- **App registration**: `lib/utils/app-register-config.js` no longer extracts URL from system JSON (`extractUrlFromSystemJson` is a no-op); registration payload and URL resolution handled by controller/config.
- **Docs**: Infrastructure – all `up-xxx` and `down-xxx` commands documented as Docker/local development only; up-dataplane explicitly “always local deployment”
- **Docs**: Deployment – `--deployment` flag documented (local vs cloud); commands README notes up/down are Docker/development only
- **Docs**: deployment-key.md, variables-yaml.md, deploying.md – removed references to `deployment.controllerUrl` and `externalSystem.environment`

### Technical
- **Display**: Refactored `logApplicationOptional` in `lib/app/show-display.js` to reduce cyclomatic complexity (array-driven optional fields)
- **Schemas**: application-schema.json (deployment block removed/controllerUrl removed), external-system.schema.json (environment property removed); integration fixtures (hubspot-system.json, hubspot-deploy.json) and tests updated for removed fields
- Tests: deploy command `--deployment=local`/`cloud` and invalid value; service-user create (API and CLI), permissions docs; generator, variable-transformer, app-register-config, hubspot integration for manifest generic changes

## [2.38.0] - 2026-02-08

### Added
- **CLI**: `aifabrix app show <appKey> --permissions` – show only list of permissions (human-readable or `--json`); useful for scripting RBAC checks
- **Central deployment mapping**: `lib/schema/deployment-rules.yaml` – single source of truth for deployment key computation and value merge rules. Replaces scattered `x-triggersDeployment` / `x-valueOverridable` schema annotations with `triggerPaths` and `overridablePaths` per schema (application, externalSystem, externalDataSource). Schemas remain clean; Controller reads rules from this file.
- **CLI**: `aifabrix credential list` – list credentials from controller/dataplane (`GET /api/v1/credential`)
- **CLI**: `aifabrix deployment list` – list last N deployments for environment; `aifabrix app deployment <appKey>` for app-scoped deployments
- **CLI**: `aifabrix logs <appKey>` – show app logs (default 100 lines; `--full`, `--live`/`-f`); optional env dump with masked secrets
- **CLI**: `aifabrix down-app <appKey>` – stop container, remove container and image if unused; `--volumes` for volume removal
- **CLI**: `aifabrix run <app> --tag <tag>` – run app with specified image tag override
- **Version resolution**: `lib/utils/image-version.js` – resolve version from Docker image (OCI label `org.opencontainers.image.version` or semver tag); `updateAppVersionInVariablesYaml` updates builder when running image; `resolveVersionForApp` for regular and external apps
- **API**: `lib/api/credentials.api.js` for credential list; `getApplicationStatus` in applications.api.js for Application Status API
- **Docs**: Application Status API (`GET /api/v1/environments/{envKey}/applications/{appKey}/status`); deployment key (`docs/configuration/deployment-key.md`) – canonical manifest JSON, deterministic hash, same key in Controller and Dataplane; "Central mapping" section; "When Controller does the job" references central mapping; Path reference to `deployment-rules.yaml`

### Changed
- **Controller-owned deployment key**: Builder no longer generates or sends `deploymentKey`. Miso Controller Pipeline REST API computes the key from manifest properties (via central mapping). Builder and Dataplane send manifest only.
- **CLI**: Removed `aifabrix genkey <app>` command entirely. Use `aifabrix json <app>` to generate deployment manifest.
- **Documentation**: Rewrote `docs/configuration/deployment-key.md` for CLI perspective; added "Central mapping" section; updated "When Controller does the job" to reference central mapping; updated deploying, utilities, validation, deployment docs; removed genkey references; replaced genkey with json in templates; prerequisites (Node.js, Azure/Docker), secrets before up-platform, back links to docs/README.md; environment-first-time (full params, why/where); deploying (manifest naming, flow, prereqs, rollback, version vs deployment key); secrets-and-config (why secure, ISO 27k, kv:// production readiness); integration-first, same flow for web app/image/external; running (restart = resolve env + apply + restart; prefer aifabrix over docker); infrastructure (RAM/disk); external-systems (next-step wizard link)
- **Version in application.yaml**: `app.version` optional; defaults to `1.0.0`; for regular apps, auto-resolved from image when running or deploying; external apps use `app.version` or `externalIntegration.version`; syncs to external manifest top-level in `external-controller-manifest.js`
- **Run-helpers**: Version resolution from image when running; `updateBuilder: true` updates builder/application.yaml with discovered version
- **Templates**: dataplane, keycloak, miso-controller application.yaml; `app.version` in generator context

### Technical
- **Generator**: Removed deploymentKey generation from `lib/generator/index.js` and `lib/generator/external-controller-manifest.js`
- **Validator**: Removed deploymentKey from required in `lib/validation/external-manifest-validator.js`
- **Variable transformer**: Removed `addPlaceholderDeploymentKey`; deploymentKey no longer added for validation
- **Schema loader**: `detectFromApplicationFields` no longer requires deploymentKey for application detection
- **Integration fixtures**: Removed deploymentKey from `integration/hubspot/hubspot-deploy.json`
- **Tests**: Schema validation tests now validate `deployment-rules.yaml` structure (application, externalSystem, externalDataSource with triggerPaths and overridablePaths) instead of schema custom properties; image-version (getVersionFromImage, compareSemver, resolveVersionForApp, updateAppVersionInVariablesYaml); credential-list, deployment-list, app-logs, app-down; app run --tag
- **Tests**: image-version tests use unique temp directories via `fs.mkdtempSync` to avoid parallel test collisions

## [2.37.9] - 2026-02-04

### Changed
- **Documentation and plans**: Enhanced deployment and credential documentation; plan updates for docs, CLI credentials, and deploy flows
- **Secrets**: Config file secrets are merged into user secrets (user wins); `mergeUserWithConfigFile` and `loadMergedConfigAndUserSecrets` used in the loadSecrets cascade; returns null when config path is missing or config is empty

## [2.37.5] - 2026-02-03

### Fixed
- **Environment deploy**: Config file is now loaded and sent to the API when using `--config`; previously the request body omitted `environmentConfig`, causing "expected object, received undefined" from the controller
- **Environment deploy polling**: Polling now uses GET deployment-by-ID (`/api/v1/pipeline/{envKey}/deployments/{deploymentId}` with fallback to `/api/v1/environments/{envKey}/deployments/{deploymentId}`) and treats `status === 'completed'` as done (and `failed`/`error` as failure); previously the CLI polled GET environment status and never saw completion, so it polled until timeout

### Added
- **Environment deploy config**: `--config <file>` is required for `aifabrix environment deploy`; JSON file must contain `environmentConfig` (object with `key`, `environment`, `preset`, `serviceName`, `location`) and optional `dryRun`; schema `lib/schema/environment-deploy-request.schema.json`; clear errors for missing file, invalid JSON, missing `environmentConfig`, and schema validation failures
- **Environment deploy polling**: Status line per attempt: `Attempt N/60... Status: <status> (progress%)`; completion when deployment record has `status: 'completed'`

### Changed
- **Deploy**: `aifabrix deploy <app>` falls back to external deployment when only `integration/<app>` exists (no `builder/<app>`); deploy command option `--type external` documented in CLI
- **App list**: External apps show 🔗 icon; hint added for `aifabrix app show <appKey>`
- **Documentation**: Deployment docs updated to clarify external system deployment (README, deployment, external-integration, reference, deploying, external-systems, wizard, your-own-applications)
- **Paths**: `getIntegrationPath` and `getBuilderPath` use project root when cwd is inside project so deploy works when run from `integration/<app>` (e.g. `node deploy.js`); new `getIntegrationBuilderBaseDir()`
- **Secrets**: `findMissingSecretKeys` and `collectMissingSecrets` skip commented and empty lines when scanning env.template for `kv://` references
- **Deployer**: Bearer-only auth supported when no client credentials; external manifests sent as-is via `transformExternalManifestForPipeline`
- **External system test-auth**: Dataplane URL discovered from controller (`resolveDataplaneUrl`); optional `options.dataplane` override for tests
- **Wizard**: Entity-type keys normalized to schema-valid segments via `toKeySegment` (e.g. camelCase → kebab-case)

### Technical
- Tests: external-system-test-auth (dataplane resolution, options.dataplane override); environment-deploy (config loading, schema validation, deployment-by-ID polling, pipeline then environments fallback), fixture `tests/fixtures/environment-deploy-config.json`, mocks for deployments.api and pipeline.api

## [2.37.0] - 2026-02-02

### Added
- **CLI restructure**: Commands moved into `lib/cli/` with dedicated setup modules (setup-app, setup-auth, setup-dev, setup-environment, setup-external-system, setup-infra, setup-secrets, setup-utility)
- **Infra and platform commands**: `up` → `up-infra` (start Postgres, Redis, optional Traefik); `down [app]` → `down-infra [app]`; new `up-platform` (runs up-miso then up-dataplane; infra must be up)
- **Docs Quick Start**: `docs/README.md` as single entrypoint (install, up-infra → up-platform, build integrations)
- **Configuration docs**: New `docs/configuration/` (env-config, env-template, external-integration, secrets-and-config, variables-yaml)
- **Deployment docs**: `docs/deployment/environment-first-time.md`; deployment/environment split
- **External system template**: `templates/external-system/deploy.js.hbs` for Node deploy script generation
- **Encryption key**: `lib/core/ensure-encryption-key.js` for secure key generation and storage

### Changed
- **CLI**: Main CLI delegates to `lib/cli/index.js`; infra commands in `lib/cli/setup-infra.js`; help-builder lists up-infra, up-platform, down-infra
- **Docs**: Lowercase filenames (building.md, deploying.md, cli-reference.md, etc.); quick-start content moved to `docs/your-own-applications.md`; infrastructure, wizard, github-workflows, external-systems, configuration, running, developer-isolation updated
- **Display and run-helpers**: Messages reference `aifabrix up-infra`; up-miso error suggests `up-infra` first
- **Templates**: dataplane and miso-controller application.yaml; applications README.hbs
- **Infrastructure helpers**: Docstring references down-infra/up-infra for re-init

### Technical
- Tests: cli, cli-comprehensive, cli-error-handling, cli-error-paths, cli-command-actions, up-miso, wizard-generator, app-display, app-readme; integration step-07-run

## [2.36.2] - 2026-02-01

### Changed
- **Pipeline API**: Pipeline API validation and error handling improvements
- **Auth status**: Auth-status command behavior and output refinements
- **App list**: App list command updates
- **Token manager**: Token manager utility adjustments
- **External system schema**: Schema updates for external-system validation
- **Documentation**: application-management, authentication, external-systems docs

### Technical
- Tests: pipeline.api, app-list, auth-status, token-manager

## [2.36.1] - 2026-02-01

### Changed
- **HubSpot integration**: Removed deprecated wizard configuration from wizard.yaml; updated wizard-hubspot-e2e.yaml

### Fixed
- **Lint**: integration/hubspot/test-dataplane-down.js — removed unused CONTROLLER_URL, added JSDoc return description for cleanupTempConfig

### Technical
- Deleted integration/test-hubspot/wizard.yaml

## [2.36.0] - 2026-01-31

### Added
- **`aifabrix show <appKey>`**: New top-level command to display app info; default (offline) loads from builder/ or integration/ (application.yaml); `--online` fetches from controller; `--json` for machine output; clear Source label (offline/online); roles, permissions, authentication, portal input configs, databases; for external type online, External system (dataplane) section with dataSources and OpenAPI
- **Wizard improvements**: `wizard [appName]` positional; mode-first flow (Create new | Add datasource); load/save `integration/<appKey>/wizard.yaml`; known platforms from dataplane (`getWizardPlatforms`); add-datasource validation via `getExternalSystem`; credential step selection (`promptForCredentialAction`); error.log helper (`appendWizardError`) and resume instructions; removed "Edit configuration manually" from review step

### Changed
- **Wizard**: Flow reorder (Step 1 = mode), config path resolution; documentation (wizard.md, cli-reference, external-integration)
- **Documentation**: application-management.md (show command), wizard.md (flow, wizard.yaml, error.log, resume)

### Technical
- New modules: lib/app/show.js, lib/app/show-display.js; lib/commands/wizard-helpers.js, wizard-core-helpers.js; getWizardPlatforms in wizard.api.js; appendWizardError in cli-utils; writeWizardConfig in wizard-config-validator
- Tests: show.test.js, show-display.test.js; wizard-core, wizard-headless, wizard-helpers, cli-utils

## [2.33.6] - 2026-01-30

### Fixed
- **Error formatters**: Improved HTTP status and permission error formatting and user-facing messages
- **Auth status**: Enhanced auth-status command behavior and output
- **Wizard**: Wizard and wizard-core improvements and robustness
- **up-miso**: Refinements to up-miso command and options
- **Datasource list**: Datasource list command and error handling updates
- **Infra status**: Infra status and infra-containers behavior and messaging
- **App run/register**: Run-helpers, run, and app-register-auth updates for consistency

### Changed
- **CLI**: CLI option and help updates
- **Documentation**: Wizard docs and Hubspot QUICK_START updates

### Technical
- **Tests**: Auth-status, wizard, wizard-core, up-miso, datasource list, error formatters, infra-status, and CLI test updates

## [2.33.5] - 2026-01-29

### Fixed
- **Docker public ports**: `*_PUBLIC_PORT` now uses base port from env-config when available so the value is canonical (e.g. `KEYCLOAK_PUBLIC_PORT` = 8082 + devId×100 for dev 6, not 8080 + offset from overrides)

### Technical
- **env-map**: `calculateDockerPublicPorts()` now accepts optional `baseVars` from env-config and uses it for port base when present

## [2.33.3] - 2026-01-29

### Added
- **`aifabrix up-miso`**: New command to bring up Miso Controller locally with Docker
- **`aifabrix up-dataplane`**: New command to bring up Dataplane locally with Docker
- **Up commands shared logic**: `lib/commands/up-common.js` for shared options and behavior
- **Dataplane application template**: New template set under `templates/applications/dataplane/` (Dockerfile, env.template, rbac.yaml, application.yaml, README)
- **Secrets Docker env**: `lib/core/secrets-docker-env.js` for resolving secrets into Docker env format
- **Image reference parser**: `lib/utils/parse-image-ref.js` for parsing image references
- **Keycloak and Miso Controller READMEs**: Application-specific READMEs for keycloak and miso-controller templates

### Changed
- **Documentation**: Updated README, CLI reference, commands README, infrastructure docs, quick start
- **App deploy/register/run-helpers**: Updates for compatibility with up-miso and up-dataplane flows
- **Infrastructure**: Helpers and compose generator updates; `templates/infra/compose.yaml.hbs` changes
- **Secrets and config**: Core secrets, config, secrets-generator, secrets-helpers, env-config schema
- **Templates**: Keycloak and Miso Controller Dockerfiles, variables, env.template, rbac; removed miso-controller test.yaml

### Technical
- New tests: `up-common.test.js`, `up-dataplane.test.js`, `up-miso.test.js`
- Updated tests for config, secrets, app run-helpers, secrets-generator, env-generation
- Updated test wrapper script

## [2.33.1] - 2026-01-26

### Fixed
- **API Client URL Validation**: Enhanced base URL validation in API client constructor
  - Improved null/undefined handling for baseUrl parameter
  - Added URL trimming and empty string validation
  - Better error messages for invalid or empty URLs
- **Datasource List Command Error Handling**: Improved error handling and user feedback
  - Enhanced dataplane URL resolution with proper error messages
  - Added dataplane URL validation and empty URL checks
  - Improved error display with endpoint URL context
  - Better handling of controller URL validation
  - Enhanced datasource listing display with dataplane URL in header
- **Datasource Deploy Command Error Handling**: Enhanced error messages and validation
  - Improved dataplane URL resolution error handling with actionable messages
  - Added dataplane URL validation before deployment
  - Enhanced error display with endpoint URL and system key context
  - Better debugging information in error responses

### Changed
- **GitHub Workflow Templates**: Updated CI and release workflow templates
  - Enhanced GitHub Actions workflows for better CI/CD integration
  - Improved release workflow configuration
- **Documentation Updates**: Updated command documentation
  - Enhanced datasource command documentation
  - Updated deployment and validation command docs
  - Improved GitHub workflows documentation

### Technical
- Enhanced API client: `lib/api/index.js` with improved URL validation
- Improved datasource commands: `lib/datasource/list.js`, `lib/datasource/deploy.js` with better error handling
- Enhanced API utilities: `lib/utils/api.js` with improved error formatting
- Updated network error formatters: `lib/utils/error-formatters/network-errors.js`
- Comprehensive test coverage: Updated test files for datasource commands and API client
- Updated GitHub workflow templates: `templates/github/ci.yaml.hbs`, `templates/github/release.yaml.hbs`

## [2.35.0] - 2026-01-23

### Added
- **CLI alias `af`**: `af` is available as a shortcut for `aifabrix` in all commands (e.g. `af up`, `af create myapp`). Documented in [Your Own Applications](docs/your-own-applications.md) and [CLI Reference](docs/cli-reference.md).
- **`aifabrix up --no-traefik`**: Exclude Traefik and persist `traefik: false` to `~/.aifabrix/config.yaml`. When neither `--traefik` nor `--no-traefik` is passed, the value is read from config.
- **Centralized Port Resolution**: Single source of truth for resolving application port from `application.yaml`
  - `lib/utils/port-resolver.js` with `getContainerPort`, `getLocalPort`, `getContainerPortFromPath`, `getLocalPortFromPath`
  - Container port: `build.containerPort` → `port` → default 3000
  - Local port: `build.localPort` (if > 0) → `port` → default 3000
  - `tests/lib/utils/port-resolver.test.js` for port-resolver module
- **Unified External System Validation Flow**: Complete validation system for external systems
  - New `validateExternalSystemComplete()` function that validates components + full deployment manifest
  - Step-by-step validation: Application config → Individual components → Full manifest generation → Manifest validation
  - Enhanced validation display with step-by-step results (Application, External Integration Files, Dimensions, RBAC, Deployment Manifest)
  - Validates system files against `external-system.schema.json`
  - Validates datasource files against `external-datasource.schema.json`
  - Validates full deployment manifest against `application-schema.json`
  - Comprehensive error aggregation across all validation steps
- **Controller-Compatible Manifest Generator**: New manifest generation for external systems
  - `lib/generator/external-controller-manifest.js` - Generates controller deployment format
  - Inline system and dataSources format (self-contained deployment manifest)
  - Generates `<systemKey>-deploy.json` with controller-compatible structure
  - Includes deploymentKey generation from complete manifest JSON
- **External Manifest Validator**: New validator for full deployment manifests
  - `lib/validation/external-manifest-validator.js` - Validates controller manifest structure
  - Validates inline system against external-system schema
  - Validates each datasource against external-datasource schema
  - Schema validation using AJV with proper error formatting
- **Simplified Authentication Configuration**: Streamlined authentication and configuration management
  - Controller URL and environment stored in root-level `config.yaml` after login (dataplane is **not** stored; it is always discovered from the controller)
  - New `auth config` commands for managing configuration values:
    - `aifabrix auth config --set-controller <url>` - Set default controller URL with validation
    - `aifabrix auth config --set-environment <env>` - Set default environment with validation
  - Command header display utility showing active controller/environment at top of commands
  - Dataplane health check utility extracted and made reusable across codebase
  - Dataplane URL always discovered from the controller (never stored in config)
- **Configuration Management Functions**: New core configuration functions in `lib/core/config.js`
  - `setControllerUrl(controllerUrl)` - Save controller URL to config
  - `getControllerUrl()` - Get controller URL from config
  - `setCurrentEnvironment(environment)` - Set environment in config
- **Validation Helpers**: New authentication configuration validation utilities
  - `lib/utils/auth-config-validator.js` - URL validation, environment validation, login checking
  - `lib/utils/dataplane-health.js` - Dataplane health check utility (extracted from integration tests)
  - `lib/utils/dataplane-resolver.js` - Dataplane URL resolution with config priority
  - `lib/utils/command-header.js` - Command header display utility

### Changed
- **`aifabrix up --traefik`**: Description updated to "Include Traefik reverse proxy and save to config". Both `--traefik` and `--no-traefik` persist to `config.yaml`; when omitted, `traefik` is read from config.
- **Infrastructure and configuration docs**: Documented `--traefik` / `--no-traefik` persistence and config fallback.
- **Centralized Port Resolution (refactor)**: All port reads from `application.yaml` now use `lib/utils/port-resolver.js`
  - `app register` uses `variables.port` and `build.containerPort` (and `--port` override); `build.port` no longer used
  - `env-ports.updateContainerPortInEnvFile` uses `build.localPort` when set
  - Refactored: `app-register-config`, `dockerfile`, `env-copy`, `secrets-helpers`, `lib/core/secrets`, `env-ports`, `compose-generator`, `variable-transformer`, `builders`, `secrets-utils`
  - `getContainerPortFromVariables` in `lib/core/secrets.js` removed; `getPortFromVariablesFile` delegates to `getLocalPortFromPath`
- **File Naming Standardization**: Consistent file naming pattern for external systems
  - **Deployment Manifest**: `application-schema.json` → `<systemKey>-deploy.json` (e.g., `my-hubspot-deploy.json`)
    - Contains full deployment manifest with inline system + dataSources
    - This is what gets deployed to controller
  - **System File**: `<systemKey>-deploy.json` (system) → `<systemKey>-system.json` (e.g., `my-hubspot-system.json`)
    - Contains external system configuration
    - Referenced in application.yaml
  - **Datasource Files**: `<systemKey>-deploy-<entityType>.json` → `<systemKey>-datasource-<dataSourceKey>.json` (e.g., `my-hubspot-datasource-record-storage.json`)
    - Contains datasource configuration
    - Referenced in application.yaml
  - Updated all generators, validators, and file resolvers to use new naming convention
  - Updated wizard to generate files with new names
  - Migration support: Code handles both old and new names during transition
- **Unified Validation Command**: Enhanced `aifabrix validate <app> --type external` command
  - Now validates complete external system workflow (components + full manifest)
  - Shows step-by-step validation results with clear error grouping
  - Enhanced display format with Dimensions (ABAC), RBAC Configuration, and Deployment Manifest sections
  - Improved error messages with file context and validation step information
- **Simplified Deployment Flow**: External systems now use unified controller pipeline
  - **Removed**: All direct dataplane API calls (~200 lines of code removed)
  - **Removed**: `buildExternalSystem()`, `deploySystem()`, `deployAllDatasources()`, `deploySingleDatasource()` functions
  - **Removed**: `getDataplaneUrlForDeployment()`, `discoverDataplaneUrl()` usage
  - **Added**: Pre-deployment validation (same validation as `validate` command)
  - **Added**: Unified deployment via `deployToController()` (same as regular apps)
  - External systems now deploy exactly like regular apps - unified code path
  - Deployment flow: Validate → Generate manifest → Deploy via controller → Controller routes to dataplane
- **JSON Generation Command**: Updated `aifabrix json <app> --type external` command
  - Now generates `<systemKey>-deploy.json` with controller format (not dataplane format)
  - Format: `{key, displayName, type: "external", system, dataSources, deploymentKey}`
  - Consistent with deployment-ready format
- **Datasource List Command**: Fixed `aifabrix datasource list` command (uses environment from config)
  - Fixed API endpoint handling and response format parsing
  - Improved error messages with controller URL context
  - Enhanced authentication flow for datasource listing
- **Validation Display**: Enhanced validation output formatting
  - Step-by-step results display (Application, External Integration Files, Dimensions, RBAC, Deployment Manifest)
  - Color-coded validation status (✓, ✗, ⚠️)
  - Grouped errors by validation step for better clarity
  - Warnings section for non-critical issues (missing rbac.yaml, no dimensions, etc.)
- **Removed All Configuration Flags**: Simplified command interface by removing all configuration flags
  - **Removed**: All `--controller <url>` flags from all commands
  - **Removed**: All `--environment <env>` flags from all commands
  - **Removed**: All `--dataplane <url>` flags from all commands
  - Commands now use `config.yaml` values only (set via `aifabrix login` or `aifabrix auth config`)
  - Simplified command usage - no need to specify controller/environment/dataplane on every command
- **Login Commands Enhanced**: Login commands now save configuration automatically
  - `aifabrix login` - Saves controller URL and environment to `config.yaml` after successful login
  - `aifabrix login --device` - Saves controller URL to `config.yaml` after device code authentication
  - `aifabrix login --credentials` - Saves controller URL to `config.yaml` after credentials authentication
  - Environment already saved via existing `setCurrentEnvironment()` function
- **Simplified Resolution Priority**: Streamlined configuration resolution logic
  - **Controller URL**: `config.controller` → device tokens lookup → developer ID-based default
  - **Environment**: `config.environment` → default: `'dev'`
  - **Dataplane URL**: Always discovered from the controller when needed (never stored in config)
  - Removed all flag-based resolution (no `options.controller`, `options.environment`, `options.dataplane`)
  - Removed `application.yaml` → `deployment.controllerUrl` lookup
- **Updated All Commands**: All commands now use config defaults only
  - `wizard`, `deploy`, `datasource deploy`, `download`, `delete`, `test-integration`, `environment deploy`
  - All commands use `resolveControllerUrl()`, `resolveEnvironment()`, `resolveDataplaneUrl()` from config
  - Removed all `options.controller`, `options.environment`, `options.dataplane` usage
  - Commands display active configuration via command header utility
- **Controller URL Resolution**: Simplified `lib/utils/controller-url.js`
  - Updated `resolveControllerUrl()` - Removed all flag/options support
  - Removed `application.yaml` → `deployment.controllerUrl` lookup code
  - Uses only: `config.controller` → device tokens → developer default
  - Added `getControllerFromConfig()` helper function

### Removed
- **application.yaml Controller URL Support**: Removed `application.yaml` → `deployment.controllerUrl` usage for CLI controller resolution
  - **Removed**: All `application.yaml` → `deployment.controllerUrl` lookup code
  - **Removed**: Support for `config.deployment?.controllerUrl` references
  - Controller URL must now be set via `config.yaml` (saved during login or via `auth config`)

### Technical
- New modules: `lib/generator/external-controller-manifest.js`, `lib/validation/external-manifest-validator.js`, `lib/commands/auth-config.js`, `lib/utils/auth-config-validator.js`, `lib/utils/dataplane-resolver.js`, `lib/utils/dataplane-health.js`, `lib/utils/command-header.js`, `lib/utils/port-resolver.js`
- Centralized port resolution: `lib/utils/port-resolver.js`; refactored `app-register-config`, `dockerfile`, `env-copy`, `secrets-helpers`, `lib/core/secrets`, `env-ports`, `compose-generator`, `variable-transformer`, `lib/generator/builders`, `secrets-utils` to use it; `tests/lib/utils/port-resolver.test.js`
- Updated modules: `lib/generator/wizard.js`, `lib/generator/external.js`, `lib/generator/external-schema-utils.js`, `lib/generator/index.js`
- Updated validation: `lib/validation/validate.js`, `lib/validation/validate-display.js`
- Updated file resolution: `lib/utils/schema-resolver.js`, `lib/external-system/deploy-helpers.js`
- Simplified deployment: `lib/external-system/deploy.js` (removed ~200 lines of dataplane code)
- Fixed datasource list: `lib/datasource/list.js`, `lib/api/environments.api.js`
- Updated core config: `lib/core/config.js` - Added controller URL storage (dataplane is not stored; discovered from controller)
- Updated controller resolution: `lib/utils/controller-url.js` - Removed flag support, removed application.yaml lookup
- Updated login commands: `lib/commands/login.js`, `lib/commands/login-device.js`, `lib/commands/login-credentials.js` - Save controller URL
- Updated CLI: `lib/cli.js` - Removed all `--controller`, `--environment`, `--dataplane` flags from all commands
- Updated all command handlers: `wizard`, `datasource`, `deploy`, `external-system`, `deployment` - Use config defaults only
- Comprehensive test coverage: New tests for validation flow, deployment validation, file naming changes, auth config commands, config storage, dataplane resolution, validation helpers
- Updated all command tests: Removed flag tests, added config-based tests
- Updated integration tests: HubSpot integration examples use new file naming
- Updated documentation: 14 documentation files updated with new file names and validation display format, all command documentation files updated (removed flags, added config.yaml usage)
- Configuration docs: `docs/configuration.md` - Updated with new config structure and resolution priority
- Authentication docs: `docs/commands/authentication.md` - Added auth config commands documentation
- Code simplification: Removed complex dataplane deployment logic, using unified controller pipeline
- ISO 27001 compliant implementation maintained throughout

## [2.34.0] - 2026-01-21

### Added
- **Delete External System Command**: New `aifabrix delete <system-key> --type external` command
  - Deletes external system from dataplane including all associated datasources
  - Interactive confirmation prompt with datasource warnings
  - Supports `--yes`/`--force` flags to skip confirmation for automation
  - Requires `-e, --environment <env>` and `-c, --controller <url>` options
  - Proper authentication and dataplane URL resolution
  - Comprehensive error handling with user-friendly messages
- **External System README Template**: New dedicated template for external systems
  - `templates/external-system/README.md.hbs` with external system-specific documentation
  - Auto-generated README includes external system workflow (create, validate, deploy)
  - No Docker build/run commands (external systems are config-only)
  - References to external system files (application.yaml, system JSON, datasource JSONs)
  - Testing and deployment commands specific to external systems
  - Template used in: `lib/utils/external-readme.js`, `lib/generator/external-schema-utils.js`, `lib/external-system/download-helpers.js`, `lib/generator/wizard.js`, `lib/app/readme.js`
- **External System Type Flag**: New `--type external` flag for validate and json commands
  - `aifabrix validate <app> --type external` - Only checks `integration/` folder
  - `aifabrix json <app> --type external` - Generates `application-schema.json` for external systems
  - When flag not set, checks `builder/` folder first, then `integration/` folder (existing behavior)
  - Uses `detectAppType(appName, options)` for forced type detection

### Changed
- **Validation Error Messages**: Improved error messages for schema validation errors
  - `formatAdditionalPropertiesError` function in `lib/utils/error-formatter.js`
  - Error messages now show invalid properties, allowed properties, and examples
  - Special handling for `portalInput.validation` errors with example format
  - Example: "Invalid property: 'min' (not allowed). Allowed properties: minLength, maxLength, pattern, required"
- **HubSpot Integration Example**: Fixed validation error in `integration/hubspot/hubspot-deploy.json`
  - Changed `min`/`max` to `minLength`/`maxLength` in `portalInput.validation` (lines 83-84)
  - Validation now passes successfully against schema requirements
- **External System JSON Generation**: Fixed `json` command for external systems
  - `generateDeployJson` now calls `generateExternalSystemApplicationSchema` for external systems
  - Correctly generates `application-schema.json` file for deployment
  - `generateDeployJsonWithValidation` handles external systems properly
- **Documentation Validation**: All external system documentation validated and verified
  - `docs/quick-start.md` - All examples use `--type external` flag correctly
  - `docs/external-systems.md` - Step 2 (Authentication) and Step 3 (Datasources) examples verified
  - All JSON examples use correct schema properties (`minLength`/`maxLength`, not `min`/`max`)

### Technical
- New module: `lib/external-system/delete.js` (153 lines) for delete command implementation
- New template: `templates/external-system/README.md.hbs` for external system README generation
- Updated `lib/cli.js` with `--type external` flags for validate and json commands, plus delete command (lines 568-570, 637-639, 816-834)
- Updated `lib/validation/validate.js` to handle `--type external` flag via `detectAppType`
- Updated `lib/generator/index.js` to handle `--type external` flag and generate application-schema.json
- Updated `lib/utils/error-formatter.js` with `formatAdditionalPropertiesError` function (lines 68-85)
- Updated `integration/hubspot/test.js` with `testDownloadAndSplit` function for complete workflow testing
- New test file: `tests/lib/external-system/external-system-delete.test.js` for delete command tests
- All 3918 tests passing across 170 test suites
- ISO 27001 compliant implementation maintained throughout

## [2.33.0] - 2026-01-21

### Added
- **Traefik Infrastructure Support**: New `--traefik` flag for `aifabrix up` command
  - Automatically includes Traefik reverse proxy service in infrastructure setup
  - Supports wildcard certificate configuration via environment variables (`TRAEFIK_CERT_STORE`, `TRAEFIK_CERT_FILE`, `TRAEFIK_KEY_FILE`)
  - Works seamlessly with developer isolation (separate Traefik instances per developer ID)
  - Traefik connects to the same Docker network as other infrastructure services
  - Certificate validation ensures files exist before starting services
  - New infrastructure modules: `lib/infrastructure/compose.js`, `lib/infrastructure/services.js`, `lib/infrastructure/helpers.js`
- **Automatic Traefik Label Generation**: Builder now generates Traefik labels automatically from `frontDoorRouting` configuration
  - Docker Compose files automatically include Traefik labels when `frontDoorRouting.enabled` is true
  - Uses same `frontDoorRouting` configuration for both Azure Front Door (production) and Traefik (local development)
  - Supports `${DEV_USERNAME}` variable interpolation in host field for developer-specific domains
  - Automatic path prefix stripping middleware when path is not root (`/`)
  - Environment variables (`BASE_PATH`, `X_FORWARDED_PREFIX`) automatically added for path-based routing
  - TLS/HTTPS support via `frontDoorRouting.tls` configuration
  - Enhanced `frontDoorRouting` schema with optional Traefik fields (`enabled`, `host`, `tls`)
- **Wizard Headless Mode**: Non-interactive wizard execution via YAML configuration files
  - New `--config wizard.yaml` option for `aifabrix wizard` command
  - Supports environment variable interpolation (`${VAR_NAME}` syntax) in configuration files
  - Path traversal protection for file paths in configuration
  - Schema validation via `lib/schema/wizard-config.schema.json`
  - Config validator module: `lib/validation/wizard-config-validator.js`
  - Headless handler: `lib/commands/wizard-headless.js`
- **Wizard API Enhancements**: Additional wizard API functions for complete workflow support
  - `deleteWizardSession` - DELETE /api/v1/wizard/sessions/{sessionId}
  - `getWizardProgress` - GET /api/v1/wizard/sessions/{sessionId}/progress
  - `credentialSelection` - POST /api/v1/wizard/credential-selection
  - `validateAllSteps` - GET /api/v1/wizard/sessions/{sessionId}/validate
  - `validateStep` - POST /api/v1/wizard/sessions/{sessionId}/validate-step
  - `getPreview` - GET /api/v1/wizard/preview/{sessionId}
  - `generateConfigStream` - POST /api/v1/wizard/generate-config-stream
- **Wizard Configuration Normalizer**: New utility for normalizing wizard configurations
  - `lib/commands/wizard-config-normalizer.js` for consistent config format handling
  - Supports environment variable resolution and path validation
- **HubSpot Integration Test Suite**: Comprehensive end-to-end testing for external system wizard
  - New integration test suite: `integration/hubspot/test.js` (1,078 lines)
  - Test artifacts for various wizard scenarios (valid/invalid inputs, error cases)
  - HubSpot platform configuration examples
  - E2E test configuration files

### Changed
- **Infrastructure Module Refactoring**: Improved code organization and maintainability
  - Split large infrastructure module into focused modules (`compose.js`, `services.js`, `helpers.js`)
  - Enhanced compose file generation with Traefik support
  - Improved service management and container operations
- **Compose Generator Enhancements**: Enhanced Docker Compose generation with Traefik label support
  - `buildTraefikConfig()` function extracts Traefik configuration from `frontDoorRouting`
  - Automatic Traefik label generation in docker-compose templates
  - Developer username resolution for host field (`${DEV_USERNAME}` interpolation)
  - Path extraction and prefix stripping middleware generation
- **Wizard API Fixes**: Fixed API parameter misalignments
  - `createWizardSession`: Fixed parameter name from `systemId` to `systemIdOrKey`
  - `detectType`: Fixed body property name from `openApiSpec` to `openapiSpec`
  - `generateConfig`: Added support for all parameters (openapiSpec, detectedType, intent, mode, systemIdOrKey, credentialIdOrKey, fieldOnboardingLevel, enableOpenAPIGeneration, userPreferences)
- **Infrastructure Status Display**: Enhanced status command to show Traefik service
  - Traefik service appears in infrastructure status output
  - Port information for Traefik HTTP (80) and HTTPS (443) displayed
  - Developer-specific port calculation for Traefik services
- **Developer Configuration**: Extended with Traefik port support
  - `getDevPorts()` now includes `traefikHttp` and `traefikHttps` port calculations
  - Traefik ports follow developer isolation pattern

### Technical
- New infrastructure modules: `lib/infrastructure/compose.js`, `lib/infrastructure/services.js`, `lib/infrastructure/helpers.js`
- Enhanced compose generator: `lib/utils/compose-generator.js` with Traefik label generation
- Wizard headless mode: `lib/commands/wizard-headless.js`, `lib/commands/wizard-config-normalizer.js`
- Wizard config validator: `lib/validation/wizard-config-validator.js`
- Wizard config schema: `lib/schema/wizard-config.schema.json`
- Updated infrastructure template: `templates/infra/compose.yaml.hbs` with conditional Traefik service
- Updated docker-compose templates: `templates/typescript/docker-compose.hbs`, `templates/python/docker-compose.hbs` with Traefik labels
- Enhanced wizard API: `lib/api/wizard.api.js` with additional API functions
- Comprehensive test coverage: New test files for infrastructure compose, wizard headless mode, and wizard config validation
- Updated documentation: `docs/commands/infrastructure.md`, `docs/running.md`, `docs/infrastructure.md`, `docs/wizard.md` with Traefik and wizard enhancements
- ISO 27001 compliant implementation maintained throughout

## [2.32.3] - 2026-01-19

### Added
- **Auth Status Command**: New `aifabrix auth status` command to display authentication status
  - Shows current token validity and expiration
  - Displays controller URL being used
  - Uses `getAuthUser` API for reliable token validation
  - Added `status` command alias for quick access
- **Controller URL Utility Module**: New shared utility for controller URL resolution
  - `lib/utils/controller-url.js` with `getDefaultControllerUrl()` and `resolveControllerUrl()` functions
  - Developer ID-based default calculation: `http://localhost:${3000 + (developerId * 100)}`
  - Consistent fallback chain: explicit option → config → developer ID default

### Changed
- **Controller URL Display**: Enhanced visibility of controller URLs across all commands
  - `app list` shows controller URL in output
  - `app rotate-secret` shows controller URL in success message
  - `app register` displays controller URL in registration success
  - External system commands (`deploy`, `download`, `test-auth`) show controller URL
- **Wizard Command Improvements**: Refactored to use shared controller URL utility
- **External Datasource Schema Updates**: Enhanced schema to version 2.1.0
  - Added error semantics (`onError` object) to all CIP step types with error classification, retry, compensation, and `failPipeline`
  - Added idempotency configuration to CIP definition for execution-level replay guarantees
  - Added lineage configuration to field mappings for field-level explainability and compliance
  - Added contract versioning configuration to datasource root for CI/CD safety and agent stability
  - Added `stepId` property to CIP step types for unique step identification

### Technical
- Updated `lib/commands/login.js` to use `getDefaultControllerUrl()`
- Updated `lib/commands/wizard.js` to use `resolveControllerUrl()`
- Updated `lib/external-system/*.js` modules to use `resolveControllerUrl()`
- Updated `lib/app/prompts.js` to calculate default port dynamically based on developer ID
- New test files: `tests/lib/utils/controller-url.test.js`, `tests/lib/commands/auth-status.test.js`
- Updated documentation: `docs/commands/authentication.md`, `docs/configuration.md`, `docs/developer-isolation.md`
- ISO 27001 compliant implementation maintained throughout

## [2.32.2] - 2026-01-18

### Changed
- **External Datasource Schema Updates**: Minor enhancements to external datasource schema
  - Updated schema metadata timestamp to 2026-01-18
  - Updated description to reflect dimension-first data model approach (replaced "ABAC access fields" with "data dimensions")
  - Enhanced HTTP method support in OpenAPI operations configuration
  - Schema version updated to 2.0.0 in `lib/schema/external-datasource.schema.json` (internal schema version)

## [2.32.1] - 2026-01-17

### Changed
- **External System Schema Validation**: Enhanced endpoint validation patterns
  - Added pattern validation for endpoint paths (must start with `/`) to prevent path traversal attacks
  - Added pattern validation for endpoint type identifiers (`^[a-z0-9-]+$`) for consistency
  - Added pattern validation for router module paths (`^[a-z0-9_.]+$`) for Python module format
  - Updated schema version to 1.3.0 in `lib/schema/external-system.schema.json`
  - Improved descriptions for endpoint properties to clarify format requirements

## [2.32.0] - 2026-01-14

### Added
- **External System Wizard CLI Integration**: New interactive `aifabrix wizard` command for creating external systems
  - Interactive guided workflow for creating external systems from OpenAPI specifications
  - Support for multiple source types: OpenAPI file/URL, MCP server, known platforms
  - Automatic API type detection and configuration generation via dataplane wizard API
  - AI-powered configuration generation with validation
  - File upload support for OpenAPI specifications
  - Progress indicators for long-running operations (parsing, generating, validating)
  - Integration with `aifabrix create --type external --wizard` command
  - Creates complete file structure: `application.yaml`, system JSON, datasource JSONs, `env.template`, `README.md`, `application-schema.json`
  - Comprehensive wizard documentation in `docs/wizard.md`
- **Wizard API Client Module**: New API client for dataplane wizard endpoints
  - `lib/api/wizard.api.js` with typed API functions for wizard operations
  - `lib/api/types/wizard.types.js` with JSDoc type definitions for all wizard request/response types
  - Support for mode selection, source selection, OpenAPI parsing, type detection, config generation, and validation
  - MCP connection testing support
- **Wizard File Generator**: New file generation module for wizard-created configurations
  - `lib/generator/wizard.js` for generating files from dataplane-generated configurations
  - `lib/generator/wizard-prompts.js` for interactive prompts throughout wizard flow
  - File upload utility `lib/utils/file-upload.js` for handling multipart/form-data uploads

### Changed
- **Architecture Reorganization**: Complete reorganization of `lib/` directory into domain-specific folders
  - Files organized into logical subfolders: `app/`, `build/`, `deployment/`, `external-system/`, `datasource/`, `generator/`, `validation/`, `infrastructure/`, `core/`
  - Improved code organization and maintainability
  - Test structure mirrors new source structure in `tests/lib/`
  - All import paths updated across codebase
  - Backward compatibility maintained (all exports remain the same)
- **Datasource Schema Updates**: Updated to dimensions-first access model (Plans 210, 211, 212)
  - `dimensions` (array) → `dimensions` (object mapping dimension keys to attribute paths)
  - `fields` → `attributes` with `indexed` property support
  - `resourceType` (free-form string pattern: `^[a-z0-9-]+$`)
  - `entityKey` → `entityType`
  - `exposed.fields` → `exposed.attributes`
  - Support for `record_ref:` prefix in field mapping expressions for cross-datasource record references
  - Updated generators, validators, templates, and integration examples to use new format
  - Updated JSDoc type definitions in `lib/api/types/datasources.types.js`
- **Documentation File Naming**: All documentation files renamed from uppercase to lowercase
  - `docs/CLI-REFERENCE.md` → `docs/cli-reference.md`
  - `docs/EXTERNAL-SYSTEMS.md` → `docs/external-systems.md`
  - `docs/QUICK-START.md` → `docs/quick-start.md`
  - `docs/CONFIGURATION.md` → `docs/configuration.md`
  - `docs/DEPLOYING.md` → `docs/deploying.md`
  - `docs/BUILDING.md` → `docs/building.md`
  - `docs/RUNNING.md` → `docs/running.md`
  - `docs/INFRASTRUCTURE.md` → `docs/infrastructure.md`
  - `docs/GITHUB-WORKFLOWS.md` → `docs/github-workflows.md`
  - `docs/DEVELOPER-ISOLATION.md` → `docs/developer-isolation.md`
  - All internal documentation links updated to use lowercase filenames

### Technical
- **Code Quality Refactoring**: Continued improvements to code quality and maintainability
  - Helper function extraction for complex functions
  - Parameter object conversions for functions with many parameters
  - Statement count and complexity reductions
  - Improved error handling and validation patterns
- **Test Structure**: Test files reorganized to mirror new source structure
  - All test imports updated to match new module locations
  - Brittle tests moved to `tests/local/` directory (excluded from CI)
  - CI tests passing (127 test suites)
- **Schema Validation**: Enhanced validation for new datasource schema format
  - Updated `lib/utils/external-system-validators.js` to validate dimensions and attributes
  - Support for `record_ref:` expression validation
  - Backward compatibility support for reading old format during migration
- **Template Updates**: Updated Handlebars templates for new schema format
  - `templates/external-system/external-datasource.json.hbs` updated to generate dimensions-first format
  - Integration examples updated: `integration/hubspot/*.json` files use new format
- **Import Path Updates**: All `require()` statements updated to use new folder structure
  - Cross-references updated across all modules
  - Wizard-related imports properly routed to new locations
  - ISO 27001 compliant implementation maintained throughout

## [2.31.1] - 2026-01-08

### Fixed
- **App Rotate Secret Response Format Handling**: Fixed credential extraction to handle multiple API response formats
  - Added support for both wrapped format (`response.data.data.credentials`) and direct format (`response.data.credentials`)
  - Enhanced response validation with better error messages and debugging output
  - Improved credential validation with dedicated `isValidCredentials()` function
  - Refactored authentication token handling with extracted helper functions (`getTokenFromUrl()`, `validateAuthToken()`)
  - Better error context and logging for troubleshooting authentication and credential extraction failures
  - Updated `lib/app-rotate-secret.js` with improved response format handling and error handling

### Technical
- **Test Refactoring**: Improved app-run branch coverage tests to use real filesystem operations
  - Ensured the 'fs' module is not mocked for specific tests requiring actual filesystem interactions, improving test accuracy
  - Updated comments for clarity on the use of real filesystem methods when creating and verifying .env files
  - Simplified file existence checks and read operations to enhance reliability and maintainability of the tests
  - Updated `tests/local/lib/app-run-branch-coverage.test.js` with real filesystem operations

## [2.31.0] - 2026-01-03

### Added
- **Dynamic Public Port Support for Docker Context**: Automatic calculation of `*_PUBLIC_PORT` variables for all services
  - Any `*_PORT` variable automatically gets a corresponding `*_PUBLIC_PORT` calculated in docker context
  - Calculation: `*_PUBLIC_PORT = *_PORT + (developer-id * 100)` (only when developer-id > 0)
  - Internal `*_PORT` values remain unchanged for container-to-container communication
  - Public `*_PUBLIC_PORT` values enable developer-specific host access ports
  - Pattern applies automatically to all services (MISO, KEYCLOAK, DB, REDIS, etc.)
  - Example: `MISO_PORT=3000` (internal) → `MISO_PUBLIC_PORT=3100` (for developer-id 1)
  - Manual override support: Manually set `*_PUBLIC_PORT` values are preserved (not recalculated)
  - No public ports calculated when developer-id is 0 (uses base ports)

### Changed
- **Environment Variable Mapping**: Enhanced `lib/utils/env-map.js` to calculate public ports for docker context
  - Added dynamic public port calculation after local context port adjustment
  - Public ports only calculated for docker context when developer-id > 0
  - Local context behavior unchanged (no public ports needed)

### Technical
- Updated `lib/utils/env-map.js` with public port calculation logic (dynamic pattern for all `*_PORT` variables)
- Updated `lib/schema/env-config.yaml` with documentation comments explaining public port pattern
- Comprehensive test coverage: New test file `tests/lib/utils/env-map.test.js` with 20+ test cases
- Updated `tests/lib/utils/env-generation.test.js` with public port interpolation tests
- Updated documentation: `docs/developer-isolation.md` and `docs/configuration.md` with public port examples
- ISO 27001 compliant implementation maintained throughout

## [2.30.1] - 2026-01-02

### Changed
- **Developer Configuration Command Structure**: Refactored `dev config` command to use command group structure
  - Changed from standalone command to subcommand under `dev` command group
  - Improved command organization and consistency with other command groups
  - Enhanced developer configuration display with better formatting and structure
  - Maintains backward compatibility with existing functionality

### Technical
- Updated `lib/cli.js` to use command group pattern for developer commands
- Improved code organization and maintainability
- ISO 27001 compliant implementation maintained throughout

## [2.30.0] - 2025-12-31

### Added
- **Logout Command**: New `aifabrix logout` command for clearing authentication tokens
  - Clear all device tokens: `aifabrix logout`
  - Clear device token for specific controller: `aifabrix logout --controller <url>`
  - Clear all client tokens: `aifabrix logout` (when no specific options provided)
  - Clear client tokens for specific environment: `aifabrix logout --environment <env>`
  - Clear client token for specific app: `aifabrix logout --environment <env> --app <app>`
  - Provides clear feedback on tokens cleared or not found
  - Validates controller URL and environment key formats
  - ISO 27001 compliant token clearing with proper error handling
- **Enhanced Token Management**: Improved token management utilities in `lib/utils/config-tokens.js`
  - New functions for clearing device tokens: `clearDeviceToken()`, `clearAllDeviceTokens()`
  - New functions for clearing client tokens: `clearClientToken()`, `clearAllClientTokens()`, `clearClientTokensForEnvironment()`
  - Controller URL normalization for consistent token storage and lookup
  - Support for encrypted token storage and clearing
  - Comprehensive token management with proper validation

### Changed
- **Token Management Architecture**: Enhanced token management system with granular control
  - Token clearing operations now support selective clearing by controller, environment, or app
  - Improved token storage structure in config.yaml for better organization
  - Enhanced error handling and validation for token operations
- **Documentation Updates**: Updated CLI reference documentation
  - Added comprehensive logout command documentation
  - Updated authentication flow documentation
  - Enhanced examples for token management

### Technical
- New `lib/commands/logout.js` module (152 lines) for logout command implementation
- Enhanced `lib/utils/config-tokens.js` with token clearing functions
- Updated `lib/cli.js` to register logout command
- Updated `lib/utils/auth-headers.js` for improved token handling
- Updated `lib/utils/token-manager.js` for better token management integration
- Comprehensive test coverage: New test files for logout command and token management
- Updated existing tests for token management improvements
- ISO 27001 compliant implementation maintained throughout

## [2.22.2] - 2025-12-29

### Fixed
- **Force Flag Path Resolution Bug**: Fixed critical bug where `--force` flag generated random values for existing secrets
  - Fixed path resolution mismatch between `generateMissingSecrets()` and `loadSecrets()` functions
  - `loadUserSecrets()` now uses `paths.getAifabrixHome()` instead of `os.homedir()` directly to respect config.yaml `aifabrix-home` override
  - `loadDefaultSecrets()` now uses `paths.getAifabrixHome()` for consistency
  - `generateMissingSecrets()` fallback now uses `paths.getAifabrixHome()` instead of `os.homedir()`
  - `generateEnvContent()` ensures path consistency between write and read operations
  - Existing secrets are now preserved when using `--force` flag
  - Path resolution is consistent between write and read operations throughout secret management

### Technical
- Updated `lib/utils/secrets-utils.js` to use `paths.getAifabrixHome()` for path resolution
- Updated `lib/utils/secrets-generator.js` to use `paths.getAifabrixHome()` in fallback path resolution
- Updated `lib/secrets.js` to ensure path consistency in `generateEnvContent()` function
- Added missing `os` import in `lib/utils/secrets-generator.js` for backward compatibility
- Fixed unused import in `lib/utils/environment-checker.js`
- Comprehensive test coverage: Added 232+ lines of tests for path resolution consistency and force flag behavior
- ISO 27001 compliant implementation maintained throughout

## [2.22.1] - 2025-12-28

### Fixed
- **Force Flag Path Resolution Bug**: Fixed critical bug where `--force` flag generated random values for existing secrets
  - Fixed path resolution mismatch between `generateMissingSecrets()` and `loadSecrets()` functions
  - `loadUserSecrets()` now uses `paths.getAifabrixHome()` instead of `os.homedir()` directly to respect config.yaml `aifabrix-home` override
  - `loadDefaultSecrets()` now uses `paths.getAifabrixHome()` for consistency
  - `generateMissingSecrets()` fallback now uses `paths.getAifabrixHome()` instead of `os.homedir()`
  - `generateEnvContent()` ensures path consistency between write and read operations
  - Existing secrets are now preserved when using `--force` flag
  - Path resolution is consistent between write and read operations throughout secret management

### Technical
- Updated `lib/utils/secrets-utils.js` to use `paths.getAifabrixHome()` for path resolution
- Updated `lib/utils/secrets-generator.js` to use `paths.getAifabrixHome()` in fallback path resolution
- Updated `lib/secrets.js` to ensure path consistency in `generateEnvContent()` function
- Added missing `os` import in `lib/utils/secrets-generator.js` for backward compatibility
- Comprehensive test coverage: Added 232+ lines of tests for path resolution consistency and force flag behavior
- ISO 27001 compliant implementation maintained throughout

## [2.23.0] - 2025-12-28

### Added
- **External System RBAC Support**: Adding full RBAC (roles and permissions) support for external systems
  - External system schema updated to v1.1.0 with `roles` and `permissions` properties
  - Support for `rbac.yaml` files in external system directories (`builder/` and `integration/`)
  - RBAC validation for external systems matching regular application validation patterns
  - Template generation with optional roles/permissions support in `external-system.json.hbs`
  - JSON generation merges `rbac.yaml` into external system deployment JSON
  - Split-JSON operations extract `rbac.yaml` from external system JSON with roles/permissions
  - Backward compatible: external systems without `rbac.yaml` continue to work unchanged
- **Controller Parameter Support for App Commands**: Added `--controller` option to all app management commands
  - `app register` now accepts `-c, --controller <url>` option to override controller URL from application.yaml
  - `app list` now accepts `-c, --controller <url>` option to specify controller URL
  - `app rotate-secret` now accepts `-c, --controller <url>` option to specify controller URL
  - Controller URL resolution follows priority: `--controller` flag > `application.yaml` > device tokens
  - Enables explicit controller URL specification for CI/CD workflows and multi-controller environments
- **Enhanced Error Messages with Controller URL Context**: All error messages now display the controller URL used or attempted
  - Authentication errors prominently show which controller URL failed
  - Network errors display which controller URL couldn't be reached
  - API errors include controller URL context for better debugging
  - Multiple controller URL attempts are shown when applicable
  - Error messages guide users to all available resolution methods

### Changed
- **External System Schema**: Updated `lib/schema/external-system.schema.json` from v1.0.0 to v1.1.0
  - Added `roles` property: array of role objects with `name`, `value`, `description`, optional `Groups`
  - Added `permissions` property: array of permission objects with `name`, `roles` array, `description`
  - Role `value` pattern: `^[a-z-]+$`
  - Permission `name` pattern: `^[a-z0-9-:]+$`
- **External System JSON Generation**: Enhanced `generateExternalSystemDeployJson()` to merge `rbac.yaml`
  - Loads `rbac.yaml` from app directory (supports both `builder/` and `integration/` paths)
  - Merges roles/permissions into system JSON before writing
  - Priority: roles/permissions in system JSON > `rbac.yaml` (if both exist, prefer JSON)
- **RBAC Validation**: Updated `validateRbac()` to support external systems
  - Supports both `builder/` and `integration/` directories for external systems
  - Uses `detectAppType()` utility to find correct app path
  - Validates roles/permissions structure against updated schema
- **External System Template**: Updated `templates/external-system/external-system.json.hbs`
  - Added optional roles/permissions section using Handlebars conditionals
  - Supports roles/permissions from template context
  - Format matches schema structure with proper JSON formatting
- **Error Handling Improvements**: Enhanced error formatters to display controller URL context
  - Updated `formatAuthenticationError()` to show controller URL and attempted URLs
  - Updated `formatServerError()`, `formatNotFoundError()`, `formatConflictError()`, and `formatGenericError()` to show controller URL
  - Updated `formatNetworkError()` to prominently display controller URL
  - Updated `formatApiError()` to accept and pass controller URL to all formatters
- **Controller URL Resolution**: Improved controller URL resolution priority across app commands
  - `app register`: `--controller` flag > `application.yaml` → `deployment.controllerUrl` > device tokens
  - `app list` / `app rotate-secret`: `--controller` flag > device tokens
  - All commands track and display the actual controller URL used for better debugging

### Technical
- Schema updates: `lib/schema/external-system.schema.json` updated to v1.1.0 with roles/permissions
- JSON generation: `lib/generator.js` enhanced to merge `rbac.yaml` into external system JSON
- Validation: `lib/validator.js` and `lib/validate.js` updated to support external system RBAC validation
- Template generation: `lib/external-system-generator.js` updated to support roles/permissions in templates
- Split-JSON: `lib/generator-split.js` verified to work with external system JSON containing roles/permissions
- Schema loader: `lib/utils/schema-loader.js` ensures updated schema is loaded and cached
- Updated `lib/app-register.js` to use `options.controller` with proper priority resolution
- Updated `lib/app-list.js` to use `options.controller` and include controller URL in error messages
- Updated `lib/app-rotate-secret.js` to use `options.controller` and include controller URL in error messages
- Updated `lib/utils/app-register-auth.js` to track attempted URLs and return controller URL
- Updated `lib/utils/error-formatters/http-status-errors.js` to show controller URL in all error formatters
- Updated `lib/utils/error-formatters/network-errors.js` to show controller URL prominently
- Updated `lib/utils/api-error-handler.js` to accept and pass controller URL
- Updated `lib/utils/app-register-api.js` to pass controller URL to error handlers
- Updated `lib/utils/device-code.js` to enhance error handling for validation scenarios
- Comprehensive test coverage: New test files for external system RBAC functionality
- Documentation updates: `docs/cli-reference.md`, `docs/external-systems.md`, `docs/configuration.md`
- Updated test expectations to match new error message format with controller URL context
- ISO 27001 compliant implementation maintained throughout

## [2.21.1] - 2025-12-27

### Added
- **PortalInput Support in application.yaml**: New configuration section for portal UI customization
  - Added `configuration` section to `application.yaml` for defining `portalInput` settings
  - PortalInput settings merge with environment variables parsed from `env.template` during deployment JSON generation
  - Supports all portalInput field types: `text`, `password`, `textarea`, `select`
  - Validates portalInput structure against application schema before merging
  - Enables portal UI configuration for environment variables without modifying `env.template`
  - Backward compatible: existing files without configuration section continue to work
- **Deployment JSON Split Functionality**: Reverse operation to extract component files from deployment JSON
  - New `splitDeployJson()` function in `lib/generator-split.js` to split deployment JSON into component files
  - Extracts `env.template` from configuration array
  - Extracts `application.yaml` from deployment metadata
  - Extracts `rbac.yml` from roles and permissions arrays
  - Generates `README.md` from deployment JSON structure
  - New CLI command: `aifabrix split-json <app>` with optional `-o, --output <dir>` option
  - Supports external systems with documented information loss limitations
  - Comprehensive test coverage: 37 tests with 97.95% coverage
- **HubSpot Integration Test Suite**: Comprehensive integration tests for HubSpot CRM integration
  - New integration test suite: `tests/integration/hubspot/hubspot-integration.test.js` (1,009 lines)
  - 103 comprehensive tests covering all aspects of HubSpot integration
  - Tests file structure, JSON/YAML syntax validation, schema validations, field mapping validations
  - Tests metadata schema validations, relationship validations, configuration consistency
  - Tests deployment JSON generation and split operations for HubSpot external system
  - Tests run in <0.5 seconds without requiring server connections, Docker, or network access
  - Validates complete HubSpot integration workflow end-to-end

### Changed
- **Documentation Style Improvements**: Enhanced visual clarity and consistency across all documentation files
  - Updated color styles in flowcharts and diagrams for improved readability and accessibility
  - Applied consistent color scheme across `README.md`, `BUILDING.md`, `CONFIGURATION.md`, `DEPLOYING.md`, `EXTERNAL-SYSTEMS.md`, `GITHUB-WORKFLOWS.md`, `INFRASTRUCTURE.md`, `QUICK-START.md`, and `RUNNING.md`
  - Improved contrast and visual hierarchy in documentation diagrams
  - Enhanced accessibility of visual elements in documentation
- **Environment Variable Parsing**: Enhanced to support portalInput merging
  - `parseEnvironmentVariables()` function now accepts optional `variablesConfig` parameter
  - Merges portalInput settings from `application.yaml` with configuration parsed from `env.template`
  - Validates portalInput structure before merging with clear error messages
  - Maintains backward compatibility with existing `env.template` parsing

### Technical
- New `lib/generator-split.js` module (342 lines) for deployment JSON splitting functionality
- New `validatePortalInput()` function in `lib/generator.js` for portalInput validation
- Enhanced `parseEnvironmentVariables()` to support portalInput merging
- Comprehensive test coverage: 20+ new portalInput tests, 37 split function tests, 103 HubSpot integration tests
- Documentation cleanup and style standardization
- Improved documentation maintainability with consistent styling
- ISO 27001 compliant implementation maintained throughout

## [2.20.0] - 2025-12-23

### Added
- **Centralized API Client Architecture**: New unified API client structure for all API interactions
  - New `lib/api/` directory with centralized API client implementation
  - Base API client class (`lib/api/index.js`) with authentication, error handling, and request/response processing
  - Domain-specific API modules for organized API calls:
    - `lib/api/auth.api.js` - Authentication API functions
    - `lib/api/applications.api.js` - Application management API functions
    - `lib/api/deployments.api.js` - Deployment API functions
    - `lib/api/environments.api.js` - Environment management API functions
    - `lib/api/pipeline.api.js` - Pipeline API functions
  - Type definitions in `lib/api/types/` directory with JSDoc `@typedef` for all request/response types
  - Consistent error handling and response formatting across all API calls
  - Automatic token management and refresh for authenticated requests
- **Comprehensive Error Path Testing**: Extensive test coverage for error scenarios
  - New error path test suites for all major modules:
    - `tests/lib/build-error-paths.test.js` - Build command error scenarios
    - `tests/lib/cli-error-paths.test.js` - CLI error handling
    - `tests/lib/commands/login-error-paths.test.js` - Login command error paths
    - `tests/lib/deployer-error-paths.test.js` - Deployment error scenarios
    - `tests/lib/external-system-test-error-paths.test.js` - External system test errors
    - `tests/lib/generator-error-paths.test.js` - Generator error handling
    - `tests/lib/push-error-paths.test.js` - Push command error scenarios
    - `tests/lib/utils/device-code-error-paths.test.js` - Device code flow errors
    - `tests/lib/utils/health-check-error-paths.test.js` - Health check errors
  - `tests/lib/validate-display.test.js` - Validation display formatting tests
  - Improved test coverage for edge cases and error conditions

### Changed
- **API Call Migration**: Migrated all direct HTTP calls to use centralized API client
  - `lib/app-list.js` - Now uses centralized applications API
  - `lib/app-rotate-secret.js` - Migrated to centralized API client
  - `lib/commands/login.js` - Uses centralized auth API for authentication
  - `lib/datasource-list.js` - Migrated to centralized API client
  - `lib/deployer.js` - Refactored to use centralized deployments and pipeline APIs
  - `lib/environment-deploy.js` - Uses centralized environments API
  - `lib/external-system-deploy.js` - Migrated to centralized API client
  - `lib/external-system-download.js` - Uses centralized API client
  - `lib/external-system-test.js` - Migrated to centralized API client
  - `lib/utils/app-register-api.js` - Updated to use centralized applications API
- **API Client Structure**: Standardized API call patterns across all modules
  - Consistent error handling with formatted error messages
  - Unified authentication token management
  - Standardized request/response processing
  - Better separation of concerns between API calls and business logic

### Technical
- New centralized API client architecture with domain-specific modules
- Comprehensive type definitions using JSDoc `@typedef` for all API request/response types
- Extensive error path test coverage (2,000+ new test lines)
- Improved code organization with clear separation between API layer and business logic
- Enhanced testability through centralized API client with mockable interfaces
- ISO 27001 compliant implementation maintained throughout
- All API calls now use consistent error handling and response formatting

## [2.11.0] - 2025-12-22

### Changed
- **Application Registration Code Refactoring**: Significant code organization improvements for application registration
  - Split `lib/app-register.js` (473 lines) into focused utility modules following single responsibility principle
  - Created `lib/utils/app-register-api.js` for API call utilities
  - Created `lib/utils/app-register-auth.js` for authentication handling
  - Created `lib/utils/app-register-config.js` for configuration extraction
  - Created `lib/utils/app-register-display.js` for display utilities
  - Created `lib/utils/app-register-validator.js` for validation logic
  - Improved code maintainability and testability with modular architecture
- **Error Handling Refactoring**: Enhanced error handling with specialized formatters
  - Split `lib/utils/api-error-handler.js` (464 lines) into focused error formatter modules
  - Created `lib/utils/error-formatters/` directory with specialized formatters:
    - `error-parser.js` - Core error parsing utilities
    - `http-status-errors.js` - HTTP status code error handling
    - `network-errors.js` - Network error handling
    - `permission-errors.js` - Permission error handling
    - `validation-errors.js` - Validation error handling
  - Improved error message clarity and user guidance
  - Better separation of concerns for error handling logic

### Technical
- Code quality improvements: All modules now comply with file size limits (≤500 lines) and function size limits (≤50 lines)
- Improved code organization following single responsibility principle
- Enhanced test coverage for refactored modules
- Better error handling with specialized formatters for different error types
- ISO 27001 compliant implementation maintained throughout

## [2.10.1] - 2025-12-16

### Fixed
- **External System Environment Template Generation**: Fixed missing `env.template` generation for external systems
  - External systems now properly generate `env.template` files based on authentication type (OAuth2, API Key, Basic Auth)
  - Template includes appropriate environment variables with Key Vault references (`kv://`) for each auth type
  - Previously, external systems skipped `env.template` generation entirely
- **External System Variables Configuration**: Fixed hardcoded values in `application.yaml` generation for external systems
  - Now properly uses `systemKey`, `systemDisplayName`, and `systemDescription` from configuration
  - Falls back to app name and generated display name when config values are not provided
  - Ensures consistent configuration across external system creation workflow

### Technical
- Added `generateExternalSystemEnvTemplate()` function in `lib/app-config.js` for auth-type-specific template generation
- Updated `generateEnvTemplateFile()` to handle external system type with proper template generation
- Updated `generateVariablesYaml()` in `lib/templates.js` to use config values for external system metadata
- Added comprehensive test coverage for external system configuration file generation
- ISO 27001 compliant implementation maintained throughout

## [2.10.0] - 2025-12-15

### Added
- **Language-Specific Environment Variables**: Automatic generation of language-specific environment variables
  - Python apps automatically get `PYTHONUNBUFFERED`, `PYTHONDONTWRITEBYTECODE`, and `PYTHONIOENCODING` variables
  - Variables use `${VAR}` interpolation pattern and are resolved from `env-config.yaml` based on docker/local context
  - TypeScript apps use `${NODE_ENV}` interpolation (resolves to `production` for docker, `development` for local)
- **Automatic Environment Variables**: New variables automatically added to all `env.template` files
  - `ALLOWED_ORIGINS=http://localhost:*,` - My application public address (added to APPLICATION ENVIRONMENT section)
  - `WEB_SERVER_URL=http://localhost:${PORT},` - Miso public address (added to APPLICATION ENVIRONMENT section)
  - `MISO_WEB_SERVER_URL=kv://miso-controller-web-server-url` - Miso web server URL (added to MISO Controller Configuration section when controller is enabled)

### Changed
- **Environment Variable Generation**: Enhanced template generation with language-aware variables
  - `NODE_ENV` now uses `${NODE_ENV}` interpolation instead of hardcoded `development` value
  - Python-specific variables are automatically included for Python applications
  - Variables are resolved from `lib/schema/env-config.yaml` based on deployment context (docker/local)
- **MISO Controller URL**: Updated to use template format for environment-specific resolution
  - `MISO_CONTROLLER_URL` now uses `http://${MISO_HOST}:${MISO_PORT}` template format
  - Replaces hardcoded controller URLs in `updateEnvTemplate` function
  - Allows environment-specific resolution during `.env` file generation
- **Template Generation**: Automatic addition of application and monitoring variables
  - `ALLOWED_ORIGINS` and `WEB_SERVER_URL` automatically added to APPLICATION ENVIRONMENT section
  - `MISO_WEB_SERVER_URL` automatically added to MISO Controller Configuration section when controller is enabled

### Technical
- New `buildPythonEnv()` function in `lib/templates.js` for Python-specific variables
- Updated `buildCoreEnv()` to use `${NODE_ENV}` interpolation
- Updated `addCoreVariables()` to include `ALLOWED_ORIGINS` and `WEB_SERVER_URL`
- Updated `addMonitoringSection()` to include `MISO_WEB_SERVER_URL`
- Updated `updateEnvTemplate()` in `lib/utils/env-template.js` to use template format for `MISO_CONTROLLER_URL`
- Updated `lib/schema/env-config.yaml` with Python variables for both docker and local contexts
- Comprehensive test coverage for all new functionality
- ISO 27001 compliant implementation maintained throughout

## [2.9.0] - 2025-12-09

### Added
- **Validate Implementation Command**: New `validate-implementation` command for validating plan implementations
  - Analyzes plan files from `.cursor/plans/` to extract implementation requirements
  - Validates that all tasks are completed
  - Verifies that all mentioned files exist and are implemented
  - Checks that tests exist for new/modified code
  - Runs code quality validation (format → lint → test)
  - Validates against cursor rules
  - Generates comprehensive validation reports in `.cursor/plans/` with `-VALIDATION-REPORT.md` suffix
  - Command documentation in `.cursor/commands/validate-implementation.md`
- **External Systems Documentation**: New comprehensive guide for external system integration
  - New `docs/external-systems.md` documentation file
  - Complete guide for creating and deploying external systems
  - Integration examples and best practices
  - Step-by-step instructions for HubSpot and other third-party API integrations
- **HubSpot Integration Example**: Complete integration example in `integration/hubspot/`
  - Example external system configuration files
  - HubSpot datasource deployment configurations
  - Environment template and application.yaml examples
  - README with integration instructions

### Changed
- **External System Workflows**: Enhanced external system creation and deployment workflows
  - Improved external system generator with better validation
  - Enhanced external system deployment process
  - Updated CLI commands to better support external system handling
  - Improved schema validation for external systems and datasources
- **Documentation Updates**: Updated multiple documentation files
  - Updated `docs/building.md` with external system build information
  - Updated `docs/cli-reference.md` with new command references
  - Updated `docs/quick-start.md` with external system quick start guide
- **Code Quality**: Enhanced validation and error handling
  - Improved CLI utilities for better error formatting
  - Enhanced schema resolver for external system files
  - Updated validator to support external system validation
  - Improved generator builders for external system schemas

### Technical
- New command handler for validate-implementation validation workflow
- Enhanced external system generator with improved file structure
- Updated generator builders module for external system application schema generation
- Comprehensive test coverage for new features and enhancements
- Updated integration tests for external system workflows
- ISO 27001 compliant implementation maintained throughout

## [2.8.0] - 2025-12-03

### Added
- **Environment Deployment Command**: New `aifabrix environment deploy <env>` command for deploying/setting up environments
  - Deploys environment infrastructure (dev, tst, pro, miso) to Miso Controller
  - Uses device token authentication (not app-specific credentials)
  - Validates environment key and controller URL
  - Polls deployment status to verify environment readiness
  - Command alias: `aifabrix env deploy <env>`
  - Documentation added to CLI-REFERENCE.md and DEPLOYING.md
  - Implementation in `lib/environment-deploy.js`
  - Follows same patterns as `app deploy` command

### Documentation
- Added comprehensive documentation for `environment deploy` command
- Updated deployment workflow: environment deploy → app deploy
- Added environment deployment section to DEPLOYING.md before app deployment

## [2.7.0] - 2025-11-24

### Added
- **External Integration Validation and Deployment**: Complete system for managing external systems and datasources
  - New validation system for external integration files (external-system.json and external-datasource.json)
  - Schema-based validation using JSON Schema (draft-07 for systems, draft-2020-12 for datasources)
  - Automatic schema type detection from file content and naming
  - Support for `externalIntegration` block in `application.yaml` with `schemaBasePath` configuration
  - Path resolution for external files (absolute and relative paths supported)
- **New CLI Commands**:
  - `aifabrix validate <appOrFile>` - Validate applications or external integration files
    - Supports app name validation (includes externalIntegration block validation)
    - Supports direct file validation (auto-detects schema type)
    - Aggregates validation results for applications and external files
    - Clear error messages with file context
  - `aifabrix diff <file1> <file2>` - Compare two configuration files
    - Deep object comparison with nested field detection
    - Breaking changes detection (removed fields, type changes)
    - Version comparison and change tracking
    - Formatted output with color-coded differences
    - Summary statistics (added, removed, changed, breaking changes)
- **Datasource Command Group**: New `aifabrix datasource` command group for datasource management
  - `aifabrix datasource validate <file>` - Validate external datasource JSON files
    - Validates against external-datasource.schema.json
    - Clear validation error messages with field paths
  - `aifabrix datasource list` - List datasources from environment
    - Lists all datasources in specified environment via controller API
    - Displays key, display name, system key, version, and status
    - Formatted table output with color-coded status
    - Requires `-e, --environment <env>` option
  - `aifabrix datasource diff <file1> <file2>` - Compare two datasource configuration files
    - Specialized comparison for dataplane deployment validation
    - Highlights dataplane-relevant changes (fieldMappings, exposed fields, sync config, OpenAPI, MCP)
    - Uses standard diff engine with dataplane-specific filtering
  - `aifabrix datasource deploy <myapp> <file>` - Deploy datasource to dataplane
    - Validates datasource file before deployment
    - Gets dataplane URL from controller via application details API
    - Deploys to dataplane pipeline endpoint
    - Requires `--controller <url>` and `-e, --environment <env>` options
    - Uses deployment authentication (device token or client credentials)
- **Schema Resolution Utilities**: New utility modules for schema management
  - `lib/utils/schema-resolver.js` - Path resolution for external integration schemas
    - `resolveSchemaBasePath(appName)` - Resolves schema base path from application.yaml
    - `resolveExternalFiles(appName)` - Resolves all external system and datasource files
    - Supports absolute and relative paths
    - Validates file existence and directory structure
  - `lib/utils/schema-loader.js` - Schema loading and type detection
    - `loadExternalSystemSchema()` - Loads and compiles external-system schema
    - `loadExternalDataSourceSchema()` - Loads and compiles external-datasource schema
    - `detectSchemaType(filePath, content)` - Auto-detects schema type from file
    - Cached compiled validators for performance
- **File Comparison Utilities**: New `lib/diff.js` module for configuration file comparison
  - Deep object comparison with nested field tracking
  - Breaking changes identification (removed fields, type changes)
  - Version change detection
  - Formatted output with chalk color coding
  - Summary statistics generation

### Changed
- **Validation System**: Enhanced application validation to support external integration
  - `lib/validator.js` now integrates with external file validation
  - Validation results aggregate application and external file validations
  - Clear separation between application validation and external file validation
- **CLI Command Structure**: Extended command registration system
  - New `validate` and `diff` commands registered in `lib/cli.js`
  - New `datasource` command group registered in `bin/aifabrix.js`
  - Command error handling unified across all new commands
- **API Integration**: Enhanced API utilities for datasource operations
  - `lib/datasource-list.js` uses controller API for datasource listing
  - `lib/datasource-deploy.js` integrates with controller and dataplane APIs
  - Response format handling for multiple API response structures
  - Error handling with formatted API error messages

### Technical
- New modules: `lib/validate.js`, `lib/diff.js`, `lib/datasource-validate.js`, `lib/datasource-list.js`, `lib/datasource-diff.js`, `lib/datasource-deploy.js`, `lib/commands/datasource.js`
- New utilities: `lib/utils/schema-resolver.js`, `lib/utils/schema-loader.js`
- Comprehensive test coverage: Unit tests for all new modules (validate, diff, datasource commands, schema utilities)
- Integration tests for end-to-end validation and deployment flows
- ISO 27001 compliant implementation maintained throughout
- All functions follow project patterns (CommonJS, JSDoc, error handling, file size limits)
- Schema validation uses AJV with proper error formatting
- Path resolution handles edge cases (absolute, relative, missing files)
- API calls use existing authentication patterns (device tokens, client credentials)

## [2.6.3] - 2025-11-23

### Added
- **Proactive Token Refresh**: New `shouldRefreshToken()` function to prevent Keycloak session timeouts
  - Tokens are now refreshed proactively when within 15 minutes of expiry
  - Helps keep Keycloak SSO sessions alive by refreshing before the SSO Session Idle timeout (30 minutes)
  - Prevents authentication failures due to session expiration during long-running operations
  - Available in both `lib/config.js` and `lib/utils/token-manager.js` modules

### Changed
- **Token Refresh Logic**: Enhanced device token refresh to use proactive refresh
  - `getOrRefreshDeviceToken()` now checks if token should be refreshed proactively (15 minutes before expiry)
  - Previously only refreshed when token was expired (5 minutes before expiry)
  - Ensures tokens are refreshed before Keycloak session timeout occurs
- **Error Handling**: Improved authentication error messages
  - Enhanced error messages in `lib/utils/api.js` when token refresh fails
  - Provides clear guidance to users: "Please login again using: aifabrix login"
  - Better error context when refresh token is expired or invalid
  - Improved error handling for 401 Unauthorized responses with user-friendly messages
- **Code Quality**: Code refactoring and simplification
  - Simplified conditional statements in `lib/config.js` for better readability
  - Used object shorthand syntax where appropriate
  - Improved code consistency across token management functions

### Technical
- New `shouldRefreshToken()` function in `lib/config.js` with 15-minute buffer for proactive refresh
- Enhanced `getOrRefreshDeviceToken()` in `lib/utils/token-manager.js` to use proactive refresh logic
- Improved error handling in `authenticatedApiCall()` with better user guidance
- Comprehensive test coverage: Added 133+ lines of tests for proactive refresh and error handling scenarios
- Tests cover proactive refresh timing, refresh token expiry, and 401 error handling

## [2.6.2] - 2025-11-20

### Added
- **Secrets Set Command**: New `aifabrix secret set <key> <value> [--shared]` command
  - Dynamically set secret values in secrets files without manual file editing
  - Supports saving to user secrets file (`~/.aifabrix/secrets.local.yaml`) or general secrets file (from `config.yaml` `aifabrix-secrets`)
  - `--shared` flag saves to general secrets file for shared configuration across projects
  - Supports both full URLs (e.g., `https://mydomain.com/keycloak`) and environment variable interpolation (e.g., `https://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}`)
  - Automatically creates secrets file and directory structure if they don't exist
  - Merges with existing secrets without overwriting other keys
  - Sets proper file permissions (0o600 - owner read/write only) for ISO 27001 compliance
- **Extended Local Secrets Utilities**
  - New `saveSecret(key, value, secretsPath)` function in `lib/utils/local-secrets.js` for flexible path support
  - Supports both absolute and relative paths for general secrets files
  - Maintains backward compatibility with existing `saveLocalSecret()` function

### Changed
- **Secrets Management**: Enhanced secret management capabilities
  - Command handler in `lib/commands/secrets-set.js` with comprehensive validation
  - Path resolution for general secrets files (absolute vs relative paths)
  - Improved error handling with user-friendly messages

### Technical
- New command handler module: `lib/commands/secrets-set.js`
- Extended `lib/utils/local-secrets.js` with `saveSecret()` function
- Comprehensive test coverage: 19 test cases covering validation, path resolution, error handling, and edge cases
- Full JSDoc documentation for all public functions
- ISO 27001 compliant implementation with proper file permissions and secure handling

## [2.6.0] - 2025-11-19

### Added
- **JSON-Based Deployment Key Generation**
  - Deployment keys are now generated from the complete deployment manifest JSON (excluding the `deploymentKey` field itself)
  - New `generateDeploymentKeyFromJson()` function in `lib/key-generator.js` for manifest-based key generation
  - Deterministic JSON stringification with sorted keys ensures consistent hashing across environments
  - Enables Miso Controller to validate deployments by regenerating and comparing the key
  - Keys are SHA256 hashes of the complete deployment configuration for integrity verification
- **Deployment Key Validation**
  - New `validateDeploymentKey()` function to verify key format (64-character lowercase hex SHA256)
  - Key validation ensures proper format before deployment operations
- **Deployment Key Schema Requirement**
  - `deploymentKey` is now a required field in the application schema (`lib/schema/application-schema.json`)
  - Schema enforces 64-character lowercase hexadecimal pattern: `^[a-f0-9]{64}$`
  - All generated deployment JSON files must include a valid `deploymentKey`

### Changed
- **Deployment Key Generation Flow**
  - `aifabrix genkey` command now generates `aifabrix-deploy.json` first, then extracts the `deploymentKey` from it
  - Deployment key is computed from the complete manifest object rather than just `application.yaml` content
  - Key generation uses deterministic JSON serialization (sorted keys, no whitespace) for consistency
  - Updated command output to show source file: "Generated from: builder/myapp/aifabrix-deploy.json"
- **Deployment JSON Generation**
  - `lib/generator.js` now builds the complete manifest first, then generates `deploymentKey` from it
  - `deploymentKey` is added to the manifest after generation, ensuring it's excluded from the hash calculation
  - Manifest validation occurs after `deploymentKey` is added to ensure schema compliance
- **Key Generator Module**
  - Enhanced `lib/key-generator.js` with JSON-based key generation capabilities
  - Added `sortObjectKeys()` helper function for deterministic object serialization
  - Maintains backward compatibility with `generateDeploymentKey()` and `generateDeploymentKeyFromContent()` functions
  - New `generateDeploymentKeyFromJson()` function for manifest-based generation

### Technical
- Deterministic JSON stringification ensures consistent deployment keys across different systems
- Recursive key sorting for nested objects and arrays maintains hash consistency
- Deployment key excludes itself from hash calculation to prevent circular dependencies
- Schema validation enforces deployment key format and presence in all deployment manifests
- Improved deployment integrity verification through manifest-based key generation

## [2.5.3] - 2025-11-19

### Added
- **Automatic Server Registration for pgAdmin4**
  - PostgreSQL server automatically registered in pgAdmin4 on first launch
  - New `templates/infra/servers.json.hbs` template for pgAdmin4 server configuration
  - Automatic generation of `servers.json` and `pgpass` files during infrastructure startup
  - Files are copied into pgAdmin4 container using `docker cp` to avoid Docker bind mount issues
  - Server appears as "PostgreSQL (pgvector)" in pgAdmin4 interface
  - Uses `PassFile` for secure password storage (ISO 27001 compliant)
- **Automatic Server Registration for Redis Commander**
  - Redis server automatically registered in Redis Commander on startup
  - Updated `REDIS_HOST` format to include database number: `local:redis:6379:0:`
  - Redis connection appears as "local" in Redis Commander interface
  - No manual configuration required

### Changed
- **Infrastructure File Generation**
  - `lib/infra.js` now generates `servers.json` and `pgpass` files before starting containers
  - Files are generated from Handlebars templates with PostgreSQL password from admin-secrets.env
  - Added `generatePgAdminConfig()` helper function for cleaner code organization
  - Files are automatically copied into containers after startup to ensure they're available
- **Redis Commander Configuration**
  - Updated `lib/secrets.js` to use correct `REDIS_HOST` format: `local:redis:6379:0:`
  - Format includes database index (0) for proper Redis Commander registration
- **Docker Compose Template**
  - Updated `templates/infra/compose.yaml.hbs` with pgAdmin4 environment variables
  - Added `PGADMIN_SERVER_JSON_FILE` and `PGPASSFILE` environment variables
  - Mounts infra directory to `/host-config` for file access
  - Command override to copy files into container on startup

### Fixed
- **File Size Compliance**
  - Reduced `lib/infra.js` from 523 lines to 478 lines (under 500 line limit)
  - Extracted `generatePgAdminConfig()` helper function
  - Consolidated comments and removed unnecessary blank lines
  - All files now comply with code quality standards

### Technical
- New `generatePgAdminConfig()` function in `lib/infra.js` for pgAdmin4 file generation
- Automatic file copying using `docker cp` after container startup
- Handlebars template for pgAdmin4 server configuration
- Improved error handling for file copy operations
- ISO 27001 compliant password handling using `PassFile` instead of plaintext passwords

## [2.5.0] - 2025-11-16

### Added
- **New CLI Command: `aifabrix down [app] --volumes`**
  - Stop and remove a specific application container: `aifabrix down myapp`
  - Optionally remove the app's named Docker volume: `aifabrix down myapp --volumes`
  - Preserves `builder/<app>` and `apps/<app>` files (no file deletions)
  - Handles developer-specific volume naming (dev0 vs dev{id} patterns)
  - New module: `lib/app-down.js` with comprehensive container and volume management
- **Environment Configuration System**
  - New `lib/utils/env-config-loader.js` utility for loading and merging environment configurations
  - Supports base config from `lib/schema/env-config.yaml` with user overrides from `~/.aifabrix/config.yaml`
  - Deep merging of environment variables for `local` and `docker` contexts
  - Configurable via `aifabrix-env-config` key in `config.yaml`
- **Environment Port Management**
  - New `lib/utils/env-ports.js` utility for updating container PORT values
  - Automatic developer-id offset calculation: `finalPort = basePort + (developerId * 100)`
  - Supports both environment variable and config file developer-id sources
  - Updates `.env` files in running containers with correct port values
- **Environment Endpoint Rewriting**
  - Enhanced `lib/utils/env-endpoints.js` with `rewriteInfraEndpoints()` function
  - Dynamic service endpoint rewriting based on environment context (local vs docker)
  - Infrastructure ports (Postgres, Redis) automatically adjusted for developer-id
  - Uses `getEnvHosts()` to get service values from env-config system
  - Supports config.yaml overrides for environment-specific endpoints
- **Token Management System**
  - New `lib/utils/token-manager.js` module for centralized token management
  - Device token management with automatic refresh via refresh tokens
  - Client token management with automatic refresh using client credentials
  - Priority-based authentication: Device token → Client token → Client credentials
  - Token expiration checking and automatic refresh on 401 errors
  - Client credentials loading from `~/.aifabrix/secrets.local.yaml`
  - Token storage in `~/.aifabrix/config.yaml` with expiration tracking
- **Image Name Utilities**
  - New `lib/utils/image-name.js` utility for developer-scoped Docker image names
  - Format: `<base>-dev<developerId>` for developer builds
  - Special handling for dev0: uses `<base>-extra` format
  - Ensures consistent local build naming across developer environments
- **Secrets Helpers Enhancement**
  - New `lib/utils/secrets-helpers.js` with comprehensive secrets and environment processing
  - Port offset handling for local and docker environments
  - Environment variable interpolation with `${VAR}` syntax support
  - Missing secrets detection and reporting
  - URL port resolution for Docker environment context
  - Hostname-to-service mapping for container-to-container communication
- **Comprehensive Test Coverage**
  - New test suite: `tests/lib/utils/env-generation.test.js` (1,454+ lines)
  - New test suite: `tests/lib/utils/env-ports.test.js` (444+ lines)
  - New test suite: `tests/lib/utils/env-config-loader.test.js` (202+ lines)
  - New test suite: `tests/lib/utils/token-manager.test.js` (252+ lines)
  - New test suite: `tests/lib/utils/image-name.test.js` (35+ lines)
  - New test suite: `tests/lib/utils/secrets-helpers.port-offset.test.js` (152+ lines)
  - New test suite: `tests/lib/utils/secrets-helpers.test.js` (117+ lines)
  - Expanded tests for environment generation, port handling, and token management

### Changed
- **Environment Generation Flow**
  - Fixed local `.env` file generation to use correct PORT from `build.localPort` or `port` in `application.yaml`
  - Fixed local `.env` file to use correct infrastructure endpoints (e.g., `redis://dev.aifabrix:6379` instead of `redis://redis:6379`)
  - Implemented clear override chain for environment variables:
    1. Base config from `lib/schema/env-config.yaml`
    2. User config from `~/.aifabrix/config.yaml` → `aifabrix-env-config` file
    3. Application config from `application.yaml`
    4. Developer-id adjustment: `finalPort = basePort + (developerId * 100)`
  - Local environment: Uses `build.localPort` (or `port` fallback) with developer-id offset
  - Docker environment: Uses `port` from `application.yaml` with developer-id offset
  - Infrastructure ports (Postgres, Redis) now correctly use base ports + developer-id offset
- **Secrets Resolution**
  - Enhanced `lib/secrets.js` with improved environment transformations
  - `updatePortForDocker()` now follows proper override chain: env-config → config.yaml → application.yaml → developer-id
  - `adjustLocalEnvPortsInContent()` correctly reads `build.localPort` with fallback to `port`
  - Improved port resolution for URLs in Docker environment context
- **Build and Template Pipeline**
  - Enhanced `lib/build.js` with improved environment file generation
  - Updated `lib/templates.js` for better template rendering
  - Improved `lib/env-reader.js` for environment variable processing
  - Enhanced `lib/utils/build-copy.js` for file operations
  - Updated `lib/utils/paths.js` for path resolution
- **Infrastructure Templates**
  - Updated `templates/infra/compose.yaml.hbs` with improved developer-id handling
  - Generated `templates/infra/compose.yaml` now correctly uses numeric devId
- **Application Templates**
  - Updated `templates/applications/miso-controller/env.template` with correct environment variables
- **API Authentication**
  - Enhanced `lib/utils/api.js` with automatic token refresh on 401 errors
  - `authenticatedApiCall()` now automatically refreshes device tokens when expired
  - Improved error handling for authentication failures
- **Configuration Management**
  - Extended `lib/config.js` to support environment config file paths
  - Added `getAifabrixEnvConfigPath()` for loading user env-config files
  - Enhanced token storage with expiration tracking for device and client tokens
- **Documentation Updates**
  - Updated `docs/building.md` with environment generation details
  - Updated `docs/configuration.md` with env-config system documentation
  - Updated `docs/developer-isolation.md` with port handling clarifications
  - Updated `docs/cli-reference.md` with `down` command documentation
  - Updated `docs/deploying.md` with token management and authentication details
  - Updated `docs/infrastructure.md`, `docs/running.md`, `docs/github-workflows.md`, and `docs/quick-start.md`
- **Test Suite Updates**
  - Expanded and updated tests across `tests/lib/*.test.js` modules
  - Updated `tests/lib/utils/*.test.js` with new utility test coverage
  - Enhanced test fixtures for environment generation scenarios
  - Improved test coverage for secrets resolution and port handling

### Technical
- **78 files changed** with 6,453 insertions and 1,700 deletions
- Modular architecture improvements with focused utility modules
- Improved separation of concerns for environment generation, port management, and token handling
- Enhanced error handling and validation throughout the codebase
- Comprehensive test coverage for all new features and improvements
- ISO 27001 compliant implementation maintained throughout

## [2.4.0] - 2025-11-14

### Changed
- Centralized configuration for home and secrets paths in `config.yaml`:
  - New keys: `aifabrix-home` (base directory), `aifabrix-secrets` (default secrets file)
  - All path resolution now derives from `config.yaml` (single source of truth)
- Secrets resolution precedence clarified and enforced:
  1) User-local: `<home>/secrets.local.yaml` (highest)
  2) App build secrets: `builder/<app>/application.yaml` → `build.secrets` (fills only missing keys)
  3) Default fallback: `<home>/secrets.yaml`

### Removed
- Environment variable overrides `AIFABRIX_HOME` and `AIFABRIX_SECRETS`

### Deprecated
- Legacy `secrets-path` in `config.yaml` is still read for backward compatibility
  - Prefer `aifabrix-secrets`; `secrets-path` will be removed in a future release

### Technical
- `lib/utils/paths.js` now reads `aifabrix-home` directly from `~/.aifabrix/config.yaml`
- `lib/utils/secrets-path.js` uses config for defaults and updated precedence
- `lib/secrets.js` uses configured home for admin secrets file locations
- Updated tests for new precedence and config-based resolution

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.5] - 2025-11-13

### Fixed
- Infrastructure health detection for developer ID "0"/"01"
  - Compose generation now passes a numeric `devId` into templates to avoid misnamed containers/networks for dev0
  - `aifabrix up` no longer times out waiting for health due to dev0 container name mismatches
- Container discovery collisions
  - Exact container-name matching prevents `redis` from being confused with `redis-commander`
  - Doctor/status now correctly report health instead of "unknown" for running services

### Changed
- Developer ID handling
  - Preserve string form in config (e.g., "01") while consistently using numeric form for Docker resource naming and port calculations

### Technical
- Updated `lib/infra.js` to send numeric `devId` into `templates/infra/compose.yaml.hbs`
- Hardened lookup in `lib/utils/infra-containers.js`:
  - Prefer exact-name match, safe fallback to `aifabrix-dev0-*` for dev0
  - Deterministic selection when multiple names are returned

## [2.3.2] - 2025-11-12

### Fixed
- **Comment Preservation in Secure Command**: Fixed `aifabrix secure` command to preserve all comments and formatting
  - Replaced YAML load/dump approach with line-by-line parsing
  - All comments (inline and block) are now preserved during encryption
  - Blank lines and indentation are maintained
  - Original file structure is kept intact
- **URL Exclusion**: Enhanced secure command to skip encrypting URLs
  - Values starting with `http://` or `https://` are not encrypted (URLs are not secrets)
  - Works for both quoted and unquoted URL values
  - Prevents accidental encryption of service endpoints and API URLs

### Changed
- **Secure Command Implementation**: Improved encryption process
  - Line-by-line YAML parsing preserves all formatting and comments
  - Skips YAML primitives (numbers, booleans, null) - only encrypts string values
  - Better handling of quoted strings (preserves quote style)
  - More robust handling of edge cases (multiline values, special characters)

### Technical
- New `lib/utils/yaml-preserve.js` module for line-by-line YAML encryption
- Enhanced `shouldEncryptValue()` function to detect URLs and YAML primitives
- Comprehensive test coverage for comment preservation and URL exclusion

## [2.3.0] - 2025-11-11

### Added
- **Secrets Encryption Command**: New `aifabrix secure` command for ISO 27001 compliance
  - Encrypts all secrets in `secrets.local.yaml` files using AES-256-GCM encryption
  - Supports user secrets file (`~/.aifabrix/secrets.local.yaml`) and app build secrets
  - Finds and encrypts secrets from all applications configured with `build.secrets` in `application.yaml`
  - Encryption key management stored in `~/.aifabrix/config.yaml`
  - Interactive prompts for encryption key if not provided
  - Validates encryption key format (32 bytes, hex or base64)
  - Preserves YAML structure and comments during encryption
  - Skips already encrypted values (detected by `secure://` prefix)
- **AES-256-GCM Encryption Implementation**: ISO 27001 compliant encryption
  - New `lib/utils/secrets-encryption.js` module for encryption/decryption utilities
  - AES-256-GCM algorithm with 96-bit IV and 128-bit authentication tag
  - Encrypted values use `secure://<iv>:<ciphertext>:<authTag>` format
  - All components base64 encoded for safe storage in YAML files
  - Encryption key validation (64 hex characters or 44 base64 characters = 32 bytes)
  - Secure key normalization from hex or base64 format
- **Automatic Secret Decryption**: Seamless decryption during secret resolution
  - `lib/secrets.js` automatically detects and decrypts `secure://` prefixed values
  - Decryption uses encryption key from `config.yaml`
  - Transparent to applications - secrets are decrypted before use
  - Error handling for invalid keys or corrupted encrypted data
  - Graceful fallback if encryption key is not configured

### Changed
- **Secrets Loading**: Enhanced to support encrypted secrets
  - `loadSecrets()` function now automatically decrypts `secure://` prefixed values
  - `decryptSecretsObject()` function added to handle decryption of all encrypted values
  - Encryption key retrieved from config using `getSecretsEncryptionKey()`
  - Only attempts decryption if encrypted values are detected
  - Maintains backward compatibility with plaintext secrets
- **Configuration Management**: Extended to support encryption keys
  - `lib/config.js` now includes `getSecretsEncryptionKey()` and `setSecretsEncryptionKey()` functions
  - Encryption key stored in `~/.aifabrix/config.yaml` as `secrets-encryption-key`
  - Key persisted across CLI sessions for automatic decryption
  - Key validation before storage to ensure proper format

### Security
- **ISO 27001 Compliance**: Enhanced secrets protection
  - All secrets can now be encrypted at rest in YAML files
  - AES-256-GCM provides authenticated encryption (confidentiality and integrity)
  - Encryption keys stored separately from encrypted data
  - File permissions set to 0o600 (read/write for owner only) after encryption
  - No plaintext secrets in version control when using encryption

### Technical
- New `lib/commands/secure.js` module for secure command implementation
- Encryption utilities in `lib/utils/secrets-encryption.js` with comprehensive validation
- Integration with existing secrets resolution pipeline
- Support for multiple secrets files (user secrets and per-app build secrets)
- YAML structure preservation during encryption/decryption operations

## [2.2.0] - 2025-11-09

### Added
- **Developer Isolation System**: Complete isolation for multiple developers running applications simultaneously
  - Developer-specific numeric IDs (1, 2, 3, etc.) stored in `~/.aifabrix/config.yaml`
  - Automatic port calculation: `basePort + (developer-id * 100)` for all infrastructure services
  - Developer-specific Docker containers, networks, and volumes
  - Separate Docker Compose projects per developer (`infra-dev{id}`)
  - No conflicts between developers running the same applications
- **Port Management**: Intelligent port offsetting based on developer ID
  - Base ports: app=3000, postgres=5432, redis=6379, pgadmin=5050, redisCommander=8081
  - Developer 1: app=3100, postgres=5532, redis=6479, pgadmin=5150, redisCommander=8181
  - Developer 2: app=3200, postgres=5632, redis=6579, pgadmin=5250, redisCommander=8281
  - `localPort` in `application.yaml` remains unchanged (only Docker host ports are offset)
  - Dockerfile container ports remain unchanged (internal container ports)
- **Developer Configuration Command**: New `aifabrix dev config` command
  - `aifabrix dev config` - Display current developer ID and calculated ports
  - `aifabrix dev config --set-id <id>` - Set developer ID in configuration
  - Shows all calculated ports for current developer
- **Enhanced Status Command**: Now displays both infrastructure services and running applications
  - Infrastructure services: postgres, redis, pgadmin, redisCommander
  - Running applications: Shows app name, container name, port mapping, and status
  - Developer-specific container discovery and status reporting
- **Developer Flag for Infrastructure**: `--developer <id>` option for `up` command
  - `aifabrix up --developer 1` - Sets developer ID and starts infrastructure
  - Automatically saves developer ID to configuration
  - Sets environment variable `AIFABRIX_DEVELOPERID` for current process
- **Developer Config Utility**: New `lib/utils/dev-config.js` module
  - `getDevPorts(developerId)` - Calculates all ports based on developer ID
  - Centralized port calculation logic
  - Returns object with all calculated ports for infrastructure and applications
- **API Error Handling System**: Comprehensive error handling with user-friendly messages
  - New `lib/utils/api-error-handler.js` module for structured error parsing and formatting
  - Support for RFC 7807 Problem Details format (detail, title, errors array)
  - Error type detection: permission (403), validation (400), authentication (401), network, server (500+), conflict (409), not found (404)
  - User-friendly formatted error messages with actionable guidance
  - Correlation ID tracking for error tracing
  - Context-aware error messages (e.g., "application already exists" for 409 conflicts)
  - Missing and required permissions display for permission errors
  - Field-level validation error details with path information
- **Two-Step Deployment Process**: Validate then deploy workflow
  - Step 1: Validate deployment via `/api/v1/pipeline/{env}/validate` endpoint
  - Step 2: Deploy using `validateToken` from validation step
  - Validation includes retry logic with exponential backoff
  - Draft deployment ID tracking during validation
  - Image server credentials returned from validation endpoint
  - Clear separation between validation and deployment phases
- **API Performance Logging**: Comprehensive audit logging for all API calls
  - All API calls logged to audit log with duration, status code, and success/failure
  - Error information including error type, message, and correlation ID
  - Performance metrics tracking for troubleshooting
  - Network error detection and logging
  - Automatic logging in `lib/utils/api.js` for all API calls
  - New `logApiCall()` function in `lib/audit-logger.js` for structured API logging

### Changed
- **Configuration System**: Extended `lib/config.js` to support developer IDs
  - `getConfig()` now returns `{ apiUrl, token, developerId }` (defaults to 1)
  - `saveConfig()` accepts and saves `developerId` alongside `apiUrl` and `token`
  - New helper functions: `getDeveloperId()` and `setDeveloperId(id)`
  - Config structure: `developer-id: 1` in `~/.aifabrix/config.yaml`
- **Infrastructure Management**: Complete isolation with developer-specific resources
  - Container names: `aifabrix-dev{id}-postgres`, `aifabrix-dev{id}-redis`, etc.
  - Network name: `infra-dev{id}-aifabrix-network`
  - Volume names: `dev{id}_postgres_data`, `dev{id}_redis_data`
  - Docker Compose project name: `infra-dev{id}`
  - All infrastructure functions now use developer-specific configuration
- **Application Running**: Developer-specific container naming and port mapping
  - Container names: `aifabrix-dev{id}-{appName}`
  - Docker host port uses dev-specific offset, container port uses config value (unchanged)
  - Port conflict detection with infrastructure ports
- **Docker Compose Generation**: Developer-specific network integration
  - Applications connect to developer-specific network: `infra-dev{id}-aifabrix-network`
  - Host port mapping uses dev-specific port, container port uses config value
- **Environment File Generation**: Developer-specific infrastructure ports for local context
  - Docker context (container-to-container): Uses service names (unchanged)
  - Local context (host machine): Uses `localhost` with dev-specific ports
  - `PORT` variable still uses `localPort` from `application.yaml` (unchanged)
- **Infrastructure Template**: Converted to Handlebars template with developer variables
  - `templates/infra/compose.yaml.hbs` - Parameterized template
  - Variables: `{{devId}}`, `{{postgresPort}}`, `{{redisPort}}`, etc.
  - Dynamic generation with developer-specific values
- **Deployment Error Handling**: Unified error handling across all deployment operations
  - All deployment errors now use unified error handler from `lib/utils/api-error-handler.js`
  - Deployment errors automatically parsed and formatted with user-friendly messages
  - Error types properly categorized (permission, validation, network, server, etc.)
  - Correlation IDs included in error messages for troubleshooting
  - Audit logging integrated with error handling (prevents double-logging)
  - Network errors detected and handled separately from HTTP errors
- **API Error Handling**: Enhanced error handling in all API calls
  - `lib/utils/api.js` now uses unified error handler for all API calls
  - All API errors automatically parsed and formatted before returning
  - Error responses include `formattedError` field for direct CLI display
  - Network errors properly detected and categorized
  - RFC 7807 Problem Details format fully supported (detail, title, errors array)
  - Error data structure normalized for consistent handling
- **Deployment Process**: Two-step validation and deployment workflow
  - `lib/deployer.js` now implements validate-then-deploy pattern
  - `validateDeployment()` function validates configuration before deployment
  - `sendDeployment()` orchestrates validation and deployment steps
  - Validation errors caught early before deployment attempt
  - Retry logic with exponential backoff for both validation and deployment
  - Clear progress messages for each step (validation, deployment, polling)

### Documentation
- **Developer Isolation Guide**: New `docs/developer-isolation.md`
  - Explains developer isolation concept and benefits
  - Port calculation examples for different developer IDs
  - Configuration instructions and usage examples
  - Clarifies that `localPort` and Dockerfile ports remain unchanged
  - Complete isolation explanation (separate Docker Compose projects)

### Technical
- Infrastructure template generation now uses Handlebars for dynamic composition
- All Docker operations use developer-specific project names (`-p infra-dev{id}`)
- Developer-specific network and volume management
- Container discovery and status reporting for applications
- Port calculation utility for consistent port management across all commands
- Unified error handling architecture with `lib/utils/api-error-handler.js` as central error processing module
- All API calls automatically log performance metrics and errors to audit log
- Error parsing supports multiple response formats (RFC 7807, legacy formats, nested structures)
- Deployment validation endpoint integration with proper error handling and retry logic
- Correlation ID tracking throughout error handling chain for better troubleshooting
- Network error detection separated from HTTP error handling for better user experience

## [2.1.7] - 2025-11-07

### Fixed
- Fixed Keycloak port configuration for Docker containers
  - URLs in `.env` files now automatically resolve ports based on environment context
  - Docker environment uses `containerPort` from service's `application.yaml` (e.g., `http://keycloak:8080`)
  - Local environment uses `localPort` or original port (e.g., `http://localhost:8082`)
  - Resolves connection failures when services try to connect to Keycloak in Docker containers
  - Port resolution works for all services (keycloak, miso-controller, dataplane, etc.)

### Changed
- Refactored `lib/secrets.js` to comply with code quality standards
  - Reduced file size from 595 lines to 367 lines (under 500 line limit)
  - Split large functions into smaller, focused helper functions (all under 50 lines)
  - Created `lib/utils/secrets-utils.js` utility module for secrets loading and port resolution
  - Improved code organization and maintainability
  - All functions now comply with cursor rules (≤50 lines per function, ≤500 lines per file)

### Added
- `lib/utils/secrets-utils.js` utility module with helper functions:
  - `loadSecretsFromFile()` - Loads secrets from file
  - `loadUserSecrets()` - Loads user secrets from ~/.aifabrix/secrets.local.yaml
  - `loadBuildSecrets()` - Loads build secrets from application.yaml
  - `loadDefaultSecrets()` - Loads default secrets from ~/.aifabrix/secrets.yaml
  - `buildHostnameToServiceMap()` - Builds hostname to service name mapping
  - `resolveUrlPort()` - Resolves port for URLs in Docker environment

## [2.1.4] - 2025-11-06

### Fixed
- Fixed PostgreSQL database initialization to support database names with hyphens (e.g., `miso-logs`)
  - Added `pgQuote` Handlebars helper to properly quote PostgreSQL identifiers in SQL commands
  - Added `pgUser` Handlebars helper to generate properly quoted PostgreSQL user names
  - Database and user names with hyphens are now correctly quoted in CREATE DATABASE and CREATE USER commands
- Fixed password handling security issue in Docker Compose generation
  - Changed from parsing passwords from DATABASE_URL or generating random passwords to requiring explicit `DB_PASSWORD` or `DB_0_PASSWORD` variables in `.env` files
  - Passwords must now be explicitly set in `.env` files (typically resolved from `kv://` references)
  - Improved password validation to distinguish between missing password variables and empty password values
  - Provides clear error messages when required password variables are missing or empty

### Changed
- Database password resolution now requires `DB_PASSWORD` (single database) or `DB_0_PASSWORD`, `DB_1_PASSWORD`, etc. (multiple databases) to be set in `.env` files
- Password validation now uses key existence checks (`in` operator) instead of truthiness checks to properly handle empty values
- Docker Compose templates now use environment variables (`DB_0_PASSWORD`, `DB_1_PASSWORD`) for database passwords instead of hardcoded values

### Security
- Eliminated hardcoded database passwords from Docker Compose templates
- Database passwords must now be explicitly provided via `.env` files (resolved from secure key vaults)
- Improved password validation prevents accidental use of empty passwords

## [2.1.3] - 2025-11-06

### Fixed
- Fixed `aifabrix status` command showing ❌ for running services (normalized status value to handle quotes and whitespace)
- Fixed `aifabrix push` command to use correct image name from `application.yaml` instead of app name
  - Now correctly resolves image name from `image.name`, `app.key`, or falls back to app name
  - Matches the same logic used by `aifabrix build` command
- Improved authentication error handling in push command:
  - Detects authentication errors and provides clear login instructions
  - Automatically retries authentication if push fails with auth error
  - Shows helpful error messages with `az acr login` command

### Changed
- Enhanced push error messages to include authentication troubleshooting steps
- Status command now normalizes Docker container status values before comparison

## [2.1.2] - 2025-11-06

### Fixed
- Authentication validation now allows `enableSSO: false` without requiring `type` and `requiredRoles` fields
- Fixed validation error when using authentication section with only `enableSSO: false` (e.g., in keycloak template)
- Authentication fields are now conditionally required based on `enableSSO` value:
  - When `enableSSO: false`: only `enableSSO` field is required
  - When `enableSSO: true`: `type`, `enableSSO`, and `requiredRoles` are required

### Changed
- Updated authentication schema to use conditional validation with `allOf` rules
- Updated `buildAuthenticationConfig()` to default `type: 'none'` and `requiredRoles: []` when `enableSSO: false`
- Updated variable transformer to handle partial authentication objects correctly

## [2.1.1] - 2025-11-06

### Added
- `--debug` flag for `aifabrix run` command to output detailed container information
- Debug logging for port detection, container status, Docker commands, and health check details
- Health check response format documentation in application schema
- Health check response format validation documentation in CONFIGURATION.md

### Changed
- Enhanced health check validation to support multiple response formats:
  - `status: "UP"` (Keycloak format)
  - `status: "ok"` (standard format with optional database connection check)
  - `status: "healthy"` (alternative format)
  - `success: true` (success-based format)
  - Non-JSON responses with HTTP 200 status code

### Documentation
- Added health check response format documentation to application schema JSON
- Added health check response format examples to CONFIGURATION.md
- Added `--debug` flag documentation to CLI-REFERENCE.md

## [2.1.0] - 2025-11-06

### Added
- Automatic README.md generation for applications during `aifabrix create`
- Application-specific README template with build instructions, prerequisites, and troubleshooting
- Conditional README sections based on application configuration (database, redis, storage, authentication)
- README.md generation only if file doesn't already exist (non-destructive)

## [2.0.2] - 2025-10-27

### Changed
- Updated documentation to reflect pipeline API authentication model (ClientId/ClientSecret + JWT)
- Updated GitHub Actions workflow examples to use correct pipeline API endpoints
- Clarified deployment authentication: pipeline uses ClientId/Secret, regular APIs use Keycloak tokens
- Fixed MisoClient configuration example typo in CONFIGURATION.md (process.APPLICATION_KEY → process.env.APPLICATION_KEY)

### Added
- Azure Marketplace deployment documentation
- External registry support in push command with --registry-type flag
- Deployment configuration section in application-schema.json
- Application registration documentation (aifabrix app register)
- Deployment logs documentation
- Pipeline environment variables documentation
- Support for Docker Hub, GitHub Container Registry, and other external registries
- authenticateExternalRegistry function for external registry authentication

### Fixed
- Incorrect pipeline API examples showing bearer tokens (now uses ClientId/Secret)
- Incorrect response field names (acrToken → validateToken, deploymentServer → acrServer)
- Missing tenantId parameter documentation (handled internally by controller)
- Incorrect environment variables for pipeline deployment (removed CONTROLLER_API_KEY, TENANT_ID, CLIENT_ID as env ID)

## [2.0.0] - 2025-01-25

### Added
- Initial release of AI Fabrix Builder SDK
- Infrastructure management commands (up, down, doctor, status, restart)
- Application creation command with interactive prompts
- Secrets management with kv:// references
- JSON deployment manifest generation
- Comprehensive documentation suite
- GitHub Actions workflow generation
- Environment file conversion and template generation
- RBAC configuration generation
- Comprehensive test suite with 90%+ coverage

### Security
- ISO 27001 compliant implementation
- No hardcoded secrets or sensitive data
- Proper access controls and authentication mechanisms
- Input validation and sanitization
- Audit logging for all operations
- Sensitive value detection and conversion to kv:// references

### Features
- **Create Command**: Interactive application scaffolding with configuration files
- **Infrastructure Management**: Docker-based local development environment
- **Secrets Management**: Secure handling of sensitive configuration values
- **GitHub Integration**: Automated CI/CD workflow generation
- **Environment Conversion**: Automatic .env file to template conversion
- **Multi-language Support**: TypeScript and Python application templates
- **Service Integration**: Database, Redis, Storage, and Authentication support

### Technical
- Node.js 18+ support
- Comprehensive error handling and validation
- Modular architecture with clear separation of concerns
- Extensive test coverage with Jest
- ESLint configuration for code quality
- Handlebars templating for configuration generation
- YAML configuration management

### Documentation
- CLI Reference Guide
- Quick Start Guide
- Configuration Guide
- Infrastructure Guide
- Building and Deployment Guides
- GitHub Workflows Documentation

## [Unreleased]

### Planned
- Build command implementation
- Run command implementation
- Push command for Azure Container Registry
- Deploy command for Miso Controller API
- Additional language support (Go, Rust, Java)
- Advanced templating options
- Plugin system for custom templates
