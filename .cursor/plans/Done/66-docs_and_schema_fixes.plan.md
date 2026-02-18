---
name: Docs and schema fixes
overview: Plan to update README, application-yaml, external-systems, wizard, github-workflows, building, and running docs per the user's requirements; fix doc/schema references for entityType, recordRef, groups, BASEURL/credentials, and controller URL; and optionally add a dedicated external-systems deployment doc.
todos: []
isProject: false
---

# Documentation and Schema Alignment Plan

## Rules and Standards

This plan must comply with the following from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, test, coverage; applies when any code or schema is changed.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File size (≤500 lines, ≤50 lines per function), JSDoc for public functions; applies if schema/validators or generator code are modified.
- **[Documentation Requirements](.cursor/rules/project-rules.mdc#code-quality-standards)** – Visual docs use canonical Mermaid from flows-and-visuals.md; doc updates must be accurate and consistent with code/schemas.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Schema validation (AJV, JSON Schema); applies if `external-datasource.schema.json` or validators are changed.
- **[Generated Output (integration/ and builder/)](.cursor/rules/project-rules.mdc#architecture-patterns)** – Fixes to generated content must be made in the generator/templates, not only in generated artifacts.
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in docs or examples; credential/configuration guidance must align with secure usage.

**Key requirements**

- Doc-only edits: ensure existing `npm run build` / lint / test still pass (no regressions).
- If schema or validator code is changed: add/update tests as needed; keep files ≤500 lines; maintain JSDoc where applicable.
- Use consistent naming (recordRef, entityType documentStorage, groups) across docs and, if touched, schemas.

## Before Development

- Read the relevant doc files and schemas listed in "File and schema touch points".
- Confirm standard variable list (e.g. in `lib/generator/wizard.js` and external-systems.md) before aligning wizard and external-systems docs.
- If changing schema or validators: review [lib/schema/external-datasource.schema.json](lib/schema/external-datasource.schema.json) and [lib/utils/external-system-validators.js](lib/utils/external-system-validators.js).

## Definition of Done

Before marking this plan complete:

1. **Build** – Run `npm run build` first; it must succeed (runs lint + test:ci).
2. **Lint** – Run `npm run lint`; must pass with zero errors/warnings.
3. **Test** – Run `npm test` or `npm run test:ci` after lint; all tests must pass; ≥80% coverage for any new or modified code (schema/validators/generator).
4. **Validation order** – BUILD → LINT → TEST (mandatory sequence; do not skip).
5. **File size** – Any modified or new code files: ≤500 lines, functions ≤50 lines.
6. **Documentation** – All doc changes accurate and consistent with code/schemas; no hardcoded secrets or sensitive data in examples.
7. **Security** – Credential/configuration guidance aligns with ISO 27001 and project security rules.
8. **Tasks** – All planned doc edits (and optional schema/validator/generator updates) completed and verified.

## Summary of requested changes

Updates span seven doc files plus optional new doc and schema/code checks. Key themes: correct repo link, remove redundant/incorrect mentions, credential vs configuration model, standard variables (BASEURL from credentials), naming (recordRef, entityType documentStorage, groups), controller public URL, local deploy wording, and external systems workflow clarity.

---

## 1. README ([README.md](README.md))

- **Add real Miso TypeScript repo URL.**  
Current link is [aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client) (TypeScript and Python). If the "real" Miso TypeScript repo is a different URL, replace or add it (e.g. a dedicated TypeScript SDK repo). If the same repo is intended, add an explicit "Miso TypeScript" label or second sentence pointing to the TypeScript usage in that repo.

---

## 2. application.yaml ([docs/configuration/application-yaml.md](docs/configuration/application-yaml.md))

- **Remove or minimize mention of variables.yaml.**  
Line 7: "Legacy **variables.yaml** is automatically renamed to application.yaml on first use." Either remove this sentence or shorten to a single short note (e.g. "Legacy variables.yaml is renamed to application.yaml on first use.") so the doc does not emphasize "variables" or "yaml" in a way that suggests configuring variables in this file.

---

## 3. External systems ([docs/external-systems.md](docs/external-systems.md))

### 3.1 environment.baseUrl

- **Remove relevance of environment.baseUrl.**  
Search for "environment.baseUrl" and "schema does not support environment.baseUrl" and similar. Remove or rephrase so it is clear this property is irrelevant (do not suggest it as an option). Keep only the guidance to use configuration (or credentials) for base URL.

### 3.2 internal: true note (Step 5 / Troubleshooting)

- **Clarify context for "internal: true".**  
The note says: "If the controller requires a Docker image, use internal: true in application.yaml (externalIntegration) so the system deploys on dataplane startup; see Troubleshooting."  
Clarify that customers do not add internal integrations manually—they use the template system. Rephrase to: when an external integration is deployed and the controller expects a Docker image, the platform can use `internal: true` so the system deploys on dataplane startup (template/maintained integrations); link to Troubleshooting and avoid implying that end customers add internal integrations by editing YAML.

### 3.3 PRODUCTION_URL / DEV_URL and single URL key

- **Use one URL key and controller promotion.**  
Remove or replace guidance that suggests separate PRODUCTION_URL and DEV_URL with `portalInput.field: "text"`. State that URL variables are not set dynamically per environment in config; use a single key (e.g. `MY_URL` or `BASE_URL`) and let the Miso Controller promote different values per environment (dev/tst/pro). Update the "Production and dev URLs" paragraph and any examples that show PRODUCTION_URL/DEV_URL.

### 3.4 BASEURL as standard variable from credentials

- **Add BASEURL (or BASE_URL) as a standard variable from credentials (mandatory).**  
In the Standard Environment Variables table (and any list of credential-backed variables), add BASEURL (or document the chosen name, e.g. BASE_URL) as a standard variable whose value comes from credentials and is mandatory where applicable. Ensure the doc states it is provided at runtime from the selected credential, not from the configuration section.

### 3.5 Credential standard variables not in configuration section

- **Clarify: credential variables are not listed in configuration.**  
Standard variables (CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD, and BASEURL) are defined in credentials; the credential is selected per environment (and per datasource if needed for security). Their values are injected at runtime. They do not need to be repeated in the `configuration` array. Update the "Configuration Array" and "Standard Environment Variables" sections and examples so that configuration is for custom/non-credential variables only; credential-backed variables are referenced in auth blocks (e.g. `{{CLIENTID}}`) and resolved from the selected credential.

### 3.6 Groups parameter name

- **Use "groups" (lowercase) consistently.**  
In RBAC / roles, the parameter name is `groups` (optional array of Azure AD groups mapped to the role). Replace any "Groups" (capital G) with "groups" in doc text and examples (schema already uses `groups` in [lib/schema/external-system.schema.json](lib/schema/external-system.schema.json)).

### 3.7 Primary key / link: recordRef

- **Document primary key / link and use camelCase "recordRef".**  
Add a short subsection explaining how links between entities are defined (primary key / record reference). Name the concept **recordRef** (camelCase). Document that the expression syntax uses the prefix `record_ref:<entityType>` (e.g. `record_ref:customer`) to define the link; optionally note that the schema accepts `record_ref:` (snake_case) in expressions. If product decision is to support `recordRef:` in the schema as well, add a todo to extend [lib/schema/external-datasource.schema.json](lib/schema/external-datasource.schema.json) and validators to accept `recordRef:` alongside `record_ref:`.

### 3.8 entityType "document" → "documentStorage"

- **Fix wrong entityType name.**  
The schema enum does not include `"document"`; it has `"document-storage"` and `"documentStorage"`. Replace any doc or example that says `entityType="document"` or `entityType: document` with `entityType: documentStorage` (or `document-storage` where kebab-case is preferred). Locations to fix: [docs/external-systems.md](docs/external-systems.md) (e.g. around line 569 in "Document Storage" and in "Advanced Datasource Features").

---

## 4. Wizard ([docs/wizard.md](docs/wizard.md))

- **Align standard variables with code and external-systems.md.**  
Cross-check the list of standard variables in the wizard doc against [docs/external-systems.md](docs/external-systems.md) and against generator/code (e.g. [lib/generator/wizard.js](lib/generator/wizard.js)). Ensure BASEURL (or BASE_URL) is included as a standard variable from credentials where applicable.
- **Clarify that variables are not set in the configuration section.**  
State explicitly that standard variables are supplied at runtime from the selected credential; they are not added to the configuration section. Adjust "Configuration Generation" and "Environment Variables" so they do not imply that credential variables are configured in the integration YAML configuration block.

---

## 5. GitHub workflows ([docs/github-workflows.md](docs/github-workflows.md))

- **Dataplane external systems deployment.**  
State that dataplane external systems deployment uses the dataplane application client id/secret, and that all such deployment can be done via GitHub Actions. Add recommendations for more secure pipelines: GitHub protected branches, Azure DevOps approval gates, Miso Controller promotion pipeline.
- **Use public controller URL.**  
Specify that public (not private) controller URL addresses should be used (e.g. in MISO_CONTROLLER_URL and examples).
- **Local Deployment (CLI) wording.**  
Replace "aifabrix deploy —local" (em dash) with correct flag: `aifabrix deploy <app> --local`. Ensure all "Local Deployment" callouts use the correct command and describe behavior (send manifest to controller, then run app locally or restart dataplane as appropriate).
- **Separate document for external systems.**  
Add a dedicated section or a new doc (e.g. `docs/github-workflows-external-systems.md` or a section in [docs/github-workflows.md](docs/github-workflows.md)) that covers external system deployment via GitHub Actions (validate, upload/deploy, credentials, controller URL). Link to it from the main github-workflows doc.

---

## 6. Building ([docs/building.md](docs/building.md))

- **Environment names dev, tst, pro.**  
Confirm in code/docs that the builder does not require environment-specific Dockerfiles for dev/tst/pro. Add a short note that environment (dev, tst, pro) is a deploy-time concern (controller/environment selection); the same Dockerfile can be used and the builder supports building without an environment name in the Dockerfile. If any code path uses environment in the build context, document or align it.

---

## 7. Running ([docs/running.md](docs/running.md))

- **Run only uses builder; external systems in integration/.**  
Keep the point that `aifabrix run <app>` only runs apps in `builder/<app>/`. Update the sentence about external systems in `integration/` to: they are not run as Docker containers; use `aifabrix validate <integration-name>` and then upload or deploy via the controller (e.g. `aifabrix upload <system-key>` or `aifabrix deploy <app>`), then test via OpenAPI endpoints. Use the exact command names the CLI supports.

---

## 8. Validation and code references (optional but recommended)

- **Wizard + external-systems standard variables.**  
In [lib/generator/wizard.js](lib/generator/wizard.js) (and any generator that emits credential or config variables), ensure emitted variable names match the documented standard list (including BASEURL/BASE_URL). Add a comment or small constant listing standard variable names for consistency.
- **Schema recordRef.**  
If supporting camelCase `recordRef:` in expressions is desired, extend [lib/schema/external-datasource.schema.json](lib/schema/external-datasource.schema.json) expression pattern and [lib/utils/external-system-validators.js](lib/utils/external-system-validators.js) to accept both `record_ref:` and `recordRef:`.

---

## File and schema touch points


| Area              | Files                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README            | [README.md](README.md)                                                                                                                                                                              |
| application.yaml  | [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md)                                                                                                                    |
| External systems  | [docs/external-systems.md](docs/external-systems.md)                                                                                                                                                |
| Wizard            | [docs/wizard.md](docs/wizard.md)                                                                                                                                                                    |
| GitHub workflows  | [docs/github-workflows.md](docs/github-workflows.md); optional new [docs/github-workflows-external-systems.md](docs/github-workflows-external-systems.md)                                           |
| Building          | [docs/building.md](docs/building.md)                                                                                                                                                                |
| Running           | [docs/running.md](docs/running.md)                                                                                                                                                                  |
| Schema/validators | [lib/schema/external-datasource.schema.json](lib/schema/external-datasource.schema.json), [lib/utils/external-system-validators.js](lib/utils/external-system-validators.js) (if adding recordRef:) |
| Generator         | [lib/generator/wizard.js](lib/generator/wizard.js) (standard variables comment/constant)                                                                                                            |


---

## Execution order

1. application-yaml.md (small edit).
2. external-systems.md (all subsections above).
3. wizard.md (standard variables and "not in configuration").
4. README (Miso TypeScript repo link).
5. github-workflows.md (dataplane deploy, public URL, --local, external systems section or doc).
6. building.md (environment note).
7. running.md (integration validate → upload/deploy).
8. Optional: schema/validator recordRef:, wizard.js standard variables list.

---

## Plan Validation Report

**Date**: 2025-02-15  
**Plan**: .cursor/plans/66-docs_and_schema_fixes.plan.md  
**Status**: VALIDATED

### Plan Purpose

Documentation and light schema/code alignment: update README, application-yaml, external-systems, wizard, github-workflows, building, and running docs; fix references for entityType, recordRef, groups, BASEURL/credentials, and controller URL; optionally add an external-systems deployment doc and optional schema/validator/generator updates.

**Scope**: Docs (primary), optional schema/validators/generator.  
**Type**: Documentation with optional Refactoring (schema/naming).

### Applicable Rules

- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test required; applies when any code/schema is changed.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File size, JSDoc; applies if code/schema is modified.
- [Documentation Requirements](.cursor/rules/project-rules.mdc#code-quality-standards) – Docs accurate and consistent; Mermaid from flows-and-visuals when adding diagrams.
- [Validation Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Schema validation; applies if external-datasource schema or validators are touched.
- [Generated Output](.cursor/rules/project-rules.mdc#architecture-patterns) – Fixes in generator/templates when changing generated behavior.
- [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – No secrets in docs; credential guidance secure.

### Rule Compliance

- DoD requirements: Documented (build first, then lint, then test; validation order; coverage for new code).
- Quality Gates: Referenced; build/lint/test and coverage called out in DoD.
- Code Quality: Referenced; file size and JSDoc apply to any code/schema changes.
- Documentation: Plan is doc-centric; rule applied for accuracy and consistency.
- Security: Referenced; no secrets and secure credential guidance.

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc (Quality Gates, Code Quality Standards, Documentation, Validation Patterns, Generated Output, Security).
- Added **Before Development** checklist (read docs/schemas, confirm standard variables, review schema/validators if changing).
- Added **Definition of Done** (build → lint → test order, file size, docs accuracy, security, all tasks complete).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing optional schema/validator changes (recordRef:, wizard.js standard variables), add or update tests and run full build/lint/test before marking done.
- After doc edits, run `npm run build` to confirm no broken links or repo issues.
- If adding a new doc (e.g. github-workflows-external-systems.md), add it to [docs/README.md](docs/README.md) or the main github-workflows doc TOC so it is discoverable.

