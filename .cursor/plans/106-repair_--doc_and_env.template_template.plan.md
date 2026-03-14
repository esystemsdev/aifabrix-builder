---
name: Repair --doc and env.template template
overview: Add a repair --doc option to regenerate integration README.md, and introduce a Handlebars-based env.template for external systems (create, download, split, repair) with Authentication and Configuration sections and inline comments.
todos: []
isProject: false
---

# Repair --doc and external-system env.template improvements

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Adding `--doc` to repair; option definition, error handling, chalk output.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** – New Handlebars template in `templates/external-system/`, context building, `.hbs` extension.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File ≤500 lines, functions ≤50 lines, JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build → lint → test before commit; no hardcoded secrets.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, mock external deps, 80%+ coverage for new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – Secret management (kv:// in env.template), no secrets in code or logs.
- **[Generated Output (integration/)](.cursor/rules/project-rules.mdc#generated-output-integration-and-builder)** – Fix at generator/template source; create, download, split, repair all produce env.template from same template.

**Key requirements:** Use Handlebars for env.template; try/catch for async; validate inputs; JSDoc on new functions; tests for repair --doc and external env.template generation.

## Before Development

- Read CLI Command Development and Template Development sections from project-rules.mdc.
- Review `lib/generator/wizard.js` (generateEnvTemplate, generateConfigFilesForWizard) and `lib/generator/split.js` (splitDeployJson, writeEnvTemplateToDir).
- Review `lib/commands/repair-env-template.js` (buildEffectiveConfiguration, createEnvTemplateIfMissing).
- Confirm `lib/utils/credential-secrets-env.js` for KV_* and path-style kv://.

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` FIRST (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` AFTER lint (all tests pass; ≥80% coverage for new code).
4. **Order:** BUILD → LINT → TEST (mandatory; do not skip).
5. **File size:** New/edited files ≤500 lines; functions ≤50 lines.
6. **JSDoc:** All new public functions have JSDoc (params, returns, throws).
7. **Security:** No hardcoded secrets; kv:// only in template output; no secrets in logs.
8. **All tasks completed:** Repair --doc, env.template.hbs, context/generator, create/download/split/repair wired, docs and tests updated.

## 1. Add `--doc` option to repair command

**Goal:** Allow regenerating `integration/<app>/README.md` from the current deployment manifest.

**Implementation:**

- **CLI:** In [lib/cli/setup-utility.js](lib/cli/setup-utility.js), add `.option('--doc', 'Regenerate README.md from deployment manifest')` to the `repair` command (around line 162).
- **Repair flow:** In [lib/commands/repair.js](lib/commands/repair.js):
  - Accept `options.doc` in `repairExternalIntegration(appName, options)`.
  - After `persistChangesAndRegenerate` (so that the deploy JSON is up to date when other repairs ran), if `options.doc` is true:
    - Resolve deploy JSON path via `getDeployJsonPath(appName, 'external', true)` (from [lib/utils/paths.js](lib/utils/paths.js)).
    - If the file exists: load it, call `generateReadmeFromDeployJson(deployment)` (from [lib/generator/split-readme.js](lib/generator/split-readme.js)), write to `appPath/README.md`, append a change message, and set a result flag (e.g. `readmeRegenerated: true`).
    - If the file does not exist and we need to support “doc only” runs: run manifest generation first (e.g. call the same logic that builds and writes the deploy JSON) so README can be generated from it; then generate and write README as above.
  - Return the new flag in the result so callers and tests can assert on it.

**Behavior:** `aifabrix repair <app> --doc` ensures the integration README is regenerated from the current deploy JSON; it can be used together with other repair options or alone (with “doc only” behavior when implemented).

---

## 2. New template: `templates/external-system/env.template.hbs`

**Goal:** Replace the plain key=value env.template for external systems with a structured file that documents secure vs normal parameters and lists Authentication and Configuration with comments.

**Template structure:**

- **Intro (top):** Short instructions: use `kv://` (or `aifabrix secret set`) for sensitive values; plain values for non-sensitive configuration.
- **Section `# Authentication`:**  
  - One line stating auth type (e.g. `# Type: oauth2`).  
  - List **secure** variables: one `KEY=value` per line (value = `kv://systemKey/var` or path form used today).  
  - Optional: a comment line listing **non-secure** variable names (from `authentication.variables`, e.g. baseUrl, tokenUrl) so users know what is not secret.
- **Section `# Configuration`:**  
  - For each entry in the system’s `configuration` array:  
    - Comment line: human-readable label + hint (e.g. “HubSpot API Version - enum v1,v2,v3”, “Maximum Page Size - 1-1000”).  
    - Next line: `NAME=value` (default from system config).

**Context shape the template will receive:**

- `authMethod` – string (e.g. `oauth2`).
- `authSecureVars` – array of `{ name, value }` (env key and kv path or path-style value).
- `authNonSecureVarNames` – array of variable names from `authentication.variables` (for the comment only).
- `configuration` – array of `{ name, value, comment }` where `comment` is the label + hint (e.g. from `portalInput.label` + “ - enum v1,v2,v3” or “ - min-max”).

**Hint derivation (in code):**

- From `portalInput.options`: “enum a,b,c”.
- From `portalInput.validation`: if `minLength`/`maxLength` or numeric min/max exist, “min-max”; if `pattern` exists, optional short hint (e.g. “pattern”) or omit for brevity.
- Fallback: `portalInput.label` only.

---

## 3. Context builder and generator for external env.template

**Goal:** Build template context from the system object (and optionally deployment) and render the new env.template.

**Location:** New module [lib/utils/external-env-template.js](lib/utils/external-env-template.js) (or extend [lib/utils/external-readme.js](lib/utils/external-readme.js); a dedicated module keeps env.template logic separate).

**Functions:**

- `**buildExternalEnvTemplateContext(system)`**  
  - Input: `system` = full system object (e.g. `deployment.system` or parsed system file).  
  - Output:  
    - `authMethod`: `system.authentication?.method` (or `auth.type`).  
    - `authSecureVars`: from `system.authentication.security`; each entry `{ name: 'KV_PREFIX_VAR', value: 'kv://systemKey/var' }` using [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) (`systemKeyToKvPrefix`, `securityKeyToVar`, path building).  
    - `authNonSecureVarNames`: `Object.keys(system.authentication?.variables || {})`.  
    - `configuration`: from `system.configuration`; each item `{ name, value, comment }` with `comment` built from `portalInput.label` and hint (options → “enum …”, validation min/max → “min-max”, etc.).
- `**generateExternalEnvTemplateContent(system)`**  
  - Load [templates/external-system/env.template.hbs](templates/external-system/env.template.hbs), compile with Handlebars, run with `buildExternalEnvTemplateContext(system)`, return string.

**Edge cases:** Missing `authentication` or `configuration` → empty arrays; ensure no duplicate keys and same key order as current effective config (auth first, then configuration) so validation and merge behavior stay correct.

---

## 4. Use the new env.template when generating for external systems

**Create (`aifabrix create my-external-system`):**

- In [lib/generator/wizard.js](lib/generator/wizard.js), when generating files for a new external system, env.template must be produced with the new format.
  - Replace the current `generateEnvTemplate` implementation (or its call from `generateConfigFilesForWizard`) so it uses `generateExternalEnvTemplateContent(systemConfig)` from the new module ([lib/utils/external-env-template.js](lib/utils/external-env-template.js)) instead of building lines manually (`addAuthenticationLines`, `addBaseUrlLines`, etc.).
  - The system config passed in already has `authentication` and optionally `configuration`; ensure the new generator receives that object and produces the same variable set (KV_* from auth.security, plus configuration entries) so validation and resolve still work.

**Split (and thus download):**

- In [lib/generator/split.js](lib/generator/split.js), inside `splitDeployJson`:
  - When the deployment has a `system` object (external format), do **not** use `extractEnvTemplate(configArray)` for the initial env.template content.
  - Instead: call `generateExternalEnvTemplateContent(deployment.system)` and use that string as `envTemplate` for `writeComponentFiles`.
  - The deployment’s `configuration` array (used for merge and validation) is still built the same way; only the **presentation** of the written env.template changes. If merge is needed (existing env.template), keep using `mergeEnvTemplateWithExisting` with a key→line map derived from the same effective config (e.g. from `configArray` or from the same logic that builds auth + config entries) so added/updated lines stay consistent.

**Repair:**

- In [lib/commands/repair-env-template.js](lib/commands/repair-env-template.js), when **creating** env.template from scratch (`createEnvTemplateIfMissing`), generate content via `generateExternalEnvTemplateContent(systemParsed)` instead of building plain lines from `expectedByKey`. So the first-time created file uses the new sectioned format. Existing merge/repair logic (preserving existing lines, fixing KV_* and path-style) can stay as-is; only the “create when missing” path uses the new template.

**Consistency:** Ensure the set of variable names and values produced by the new template matches what `buildEffectiveConfiguration` / `configArray` expect, so validation (e.g. auth kv coverage) and resolve still pass.

---

## 5. Documentation and tests

- **Docs:** In [docs/commands/external-integration.md](docs/commands/external-integration.md) (or the repair section): mention `--doc` for regenerating README. In docs that describe env.template (e.g. external-integration, wizard, or external-systems): briefly note that env.template for external systems includes Authentication and Configuration sections and inline comments.
- **Tests:**  
  - Repair: add a test that `repairExternalIntegration(..., { doc: true })` (and/or `aifabrix repair <app> --doc`) regenerates `README.md` from the deploy JSON and returns the new flag.  
  - External env.template: unit test `buildExternalEnvTemplateContext` and `generateExternalEnvTemplateContent` with a system payload similar to hubspot-test (auth method, security vars, configuration with portalInput options/validation); assert sections and comment lines and that key=value lines match expected names/values.

---

## Summary


| Item                | Action                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repair `--doc`      | Add option; after repair (and manifest if needed), load deploy JSON, generate README via `generateReadmeFromDeployJson`, write to `integration/<app>/README.md`.         |
| `env.template.hbs`  | New Handlebars template with intro, `# Authentication` (auth type, secure vars, optional non-secure names), `# Configuration` (comment + KEY=value per config item).     |
| Context + generator | New (or extended) module: build context from system (auth + configuration + portalInput hints), render template.                                                         |
| Create (external)   | In wizard.js, use `generateExternalEnvTemplateContent(systemConfig)` for env.template when running `aifabrix create my-external-system`.                                 |
| Split / download    | When `deployment.system` exists, use `generateExternalEnvTemplateContent(deployment.system)` for env.template content; keep merge behavior using same effective key set. |
| Repair create       | When creating env.template from scratch, use the new template content.                                                                                                   |
| Docs + tests        | Document `--doc` and new env.template structure; add tests for repair --doc and for external env.template context/generation.                                            |

---

## Plan Validation Report

**Date:** 2026-03-14  
**Plan:** .cursor/plans/106-repair_--doc_and_env.template_template.plan.md  
**Status:** VALIDATED

### Plan Purpose

- **Title:** Repair --doc and external-system env.template improvements.
- **Scope:** CLI (repair --doc), Handlebars template (env.template.hbs), generator/wizard/split/repair-env-template, create command for external systems.
- **Type:** Development (CLI option + template + generator); touches Template Development and Generated Output (integration/).

### Applicable Rules

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New repair option; command pattern, options, error handling.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** – New Handlebars template, context, `.hbs` in templates/external-system/.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File/function size, JSDoc.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build, lint, test before commit.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, mocks, coverage ≥80%.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – kv:// and secret handling in env.template.
- **[Generated Output (integration/)](.cursor/rules/project-rules.mdc#generated-output-integration-and-builder)** – Single template used by create, download, split, repair.

### Rule Compliance

- DoD requirements: Documented (build first, then lint, then test; file size; JSDoc; security; all tasks).
- CLI: Compliant (option, flow, result flag).
- Template: Compliant (context shape, hint derivation, Handlebars).
- Create command: Added so env.template is generated with the new format for `aifabrix create my-external-system`.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc (CLI, Template, Code Quality, Quality Gates, Testing, Security, Generated Output).
- Added **Before Development** checklist (read rules, review wizard/split/repair-env-template, credential-secrets-env).
- Added **Definition of Done** (build → lint → test order, file size, JSDoc, security, all tasks).
- Added **Create (`aifabrix create my-external-system`)** to section 4 and a row in the Summary table so env.template is generated with the new template on create.
- Appended this validation report.

### Recommendations

- When implementing, ensure wizard.js uses the shared `generateExternalEnvTemplateContent(systemConfig)` so create and split/download produce identical structure.
- Add a test that `aifabrix create <name>` (external) writes env.template with Authentication and Configuration sections when the system has auth and configuration.

