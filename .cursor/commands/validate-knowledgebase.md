# validate-knowledgebase

This command validates documentation in the **docs/** directory according to project standards and ensures it is focused on **how to use the aifabrix builder tool** for external users. It can validate all documents mentioned in a plan file, or validate a single document directly.

**Important**: Documentation articles are **related to one or more schemas** in **lib/schema**. Validation ensures that examples and structure described in docs are **correct and based on these existing schemas**.

**Project structure**:
- **docs/** – All external-user documentation (getting started, commands, configuration, building, running, deploying, external systems, etc.)
- **lib/schema/** – Canonical schemas; doc examples and structure must align with them (see [Schema-based validation](#schema-based-validation) below).

## Purpose

The command:
1. Analyzes a plan file (from `.cursor/plans/`) to extract doc paths mentioned, OR accepts a single document path
2. Validates documents against structure and clarity standards for user-facing docs
3. **Validates that examples and structure in docs are correct and based on existing schemas** in `lib/schema` (see [Schema-based validation](#schema-based-validation))
4. Automatically fixes issues where possible (formatting, structure, references)
5. Validates Markdown syntax and structure
6. Checks that docs stay focused on **using the builder** (CLI usage, configuration, workflows) and that cross-references within docs are correct
7. Generates a validation report **and attaches it directly to the plan file** (default behavior) or creates a separate report

## Usage

Run this command in chat with `/validate-knowledgebase [plan-file-path|doc-path] [--attach|--new-report]`

**⚠️ DEFAULT BEHAVIOR**: Validation results are **ALWAYS automatically attached to the plan file itself** unless `--new-report` is explicitly specified. The validation report is added to or updates the `## Validation Report` section in the original plan file.

**Parameters**:
- `plan-file-path|doc-path` (optional):
  - Path to a plan file (e.g., `.cursor/plans/66-docs_and_schema_fixes.plan.md`) – validates all docs mentioned in the plan
  - Path to a single document (e.g., `docs/your-own-applications.md` or `docs/commands/README.md`) – validates only that document
  - If not specified, uses the most recently modified plan file
- `--attach` (default, implicit): Attaches/updates validation results directly in the original plan file. **This is the default behavior** – you can omit this flag.
- `--new-report` (optional, must be explicitly specified): Creates a separate validation report file instead of attaching to the plan. **Only use this if you explicitly need a standalone report file.**

**Examples**:
- `/validate-knowledgebase` – Validates docs from the most recently modified plan file, **automatically attaches results to the plan file**
- `/validate-knowledgebase .cursor/plans/66-docs_and_schema_fixes.plan.md` – Validates all docs mentioned in that plan, **automatically attaches results to the plan file**
- `/validate-knowledgebase docs/your-own-applications.md` – Validates a single document; produces a standalone report (since no plan file)
- `/validate-knowledgebase .cursor/plans/66-docs_and_schema_fixes.plan.md --new-report` – Creates a separate validation report file instead of attaching to the plan

## What It Does

### 1. Document Extraction

**From plan file**:
- Extracts all doc paths mentioned in the plan
- Identifies documents in sections like "Documentation", "Files", "Docs to update", etc.
- Looks for file paths matching `docs/**/*.md`
- Extracts references from markdown links, code blocks, and text

**From single document path**:
- Validates only the specified document
- Creates a standalone validation report

### 2. Document Structure Validation

**Validates structure**:
- Title format (single `#` at top)
- Section hierarchy (`##` for main sections, `###` for subsections)
- Appropriate sections for user docs (e.g. overview/getting started, steps or procedures, examples, troubleshooting where relevant)
- Proper heading levels (no skipped levels)
- Clear navigation back to index (e.g. "← [Documentation index](README.md)" or "← [Commands index](README.md)")

**Validates content focus (external users, builder usage)**:
- Docs explain **how to use the aifabrix builder** (CLI commands, workflows, configuration)
- Code examples use correct CLI invocations (`aifabrix` / `af`)
- **Configuration and config examples (application.yaml, external-system, datasource, infrastructure, etc.) are correct and based on the existing schemas in lib/schema** (see [Schema-based validation](#schema-based-validation))
- No internal-only implementation details in user-facing docs unless explicitly needed
- Mermaid diagrams are valid (if present) and consistent with `.cursor/rules/flows-and-visuals.md` where applicable

### 3. Schema-based validation

Documentation articles are **related to one or more schemas** in **lib/schema**. Validation must ensure that **examples and structure** in docs are correct and based on these existing schemas.

**Schema sources (lib/schema)**:
- **application-schema.json** – Application configuration (application.yaml, deploy JSON). Required fields, property names, enums (e.g. `type`: webapp, functionapp, api, service, external), configuration, healthCheck, frontDoorRouting, etc.
- **external-system.schema.json** – External system configuration. Key, displayName, type (openapi, mcp, custom), authentication, configuration, roles, permissions, endpoints.
- **external-datasource.schema.json** – External data source configuration. key, systemKey, entityType, resourceType, fieldMappings (dimensions, attributes), exposed, sync, openapi, execution (CIP/python), etc.
- **infrastructure-schema.json** – Infrastructure configuration. key, environment, preset, deployment, networking, storage, modules.
- **wizard-config.schema.json** – Wizard configuration (when documented).
- **environment-deploy-request.schema.json** – Environment deploy request payloads (when documented).
- **deployment-rules.yaml** / **env-config.yaml** – Deployment and env rules (YAML; structure and intent must match when docs reference them).

**What to validate**:
- **Code blocks**: YAML or JSON examples (e.g. `application.yaml`, external-system or datasource snippets) must be **valid against the corresponding schema** (required properties, allowed enums, patterns, nested structure). Extract examples from fenced code blocks, parse, and run schema validation (e.g. AJV for JSON schemas; apply same rules for YAML that maps to JSON schema).
- **Structure described in prose**: Required fields, property names, and allowed values mentioned in the doc must match the schema (e.g. doc must not say "type: api" if the schema only allows specific enum values; doc must not omit required fields in examples).
- **Doc–schema mapping**: Identify which doc (or section) relates to which schema(s)—e.g. docs about external systems → external-system.schema.json and external-datasource.schema.json; app config → application-schema.json—and validate only the relevant examples/sections against those schemas.

**Report**: For each validated document, report schema validation results per related schema (e.g. "application-schema.json: ✅ examples valid" or "external-datasource.schema.json: ❌ example at line X invalid: ...").

### 4. Reference Validation

**Validates references**:
- **Cross-references within docs**: Links to other docs use relative paths within `docs/` (e.g. `[Commands index](commands/README.md)`, `[Infrastructure](infrastructure.md)`)
- **Broken links**: Checks for broken internal links (links to non-existent docs or wrong paths)
- **Consistency**: Same document linked the same way (e.g. consistent use of `README.md` vs `../README.md` from subdirs)
- **External links**: External URLs (e.g. GitHub, aifabrix-miso-client) are acceptable; report only if obviously broken or placeholder

### 5. Markdown Validation

**Runs MarkdownLint**:
- Runs `npx markdownlint "docs/**/*.md"` (or the subset being validated)
- Reports linting errors and warnings
- **CRITICAL**: Zero linting errors required
- Auto-fixes where possible using `npx markdownlint --fix`

**Validates Markdown syntax**:
- Proper code block formatting and language tags
- Proper list and table formatting
- Proper link formatting
- No trailing whitespace
- Consistent line endings

### 6. Project Rules Compliance

**Validates against project rules** (where applicable):
- **Visuals** (from `.cursor/rules/flows-and-visuals.md`): Mermaid diagrams use canonical templates and consistent styling when present
- **Documentation focus**: Content is appropriate for **external users** (using the builder), not internal dev-only notes
- **CLI and config**: Command names and options match the actual CLI; config file examples match **lib/schema** and templates

### 7. Automatic Fixes

**Fixes applied automatically**:
- **MarkdownLint auto-fixes**: Runs `npx markdownlint --fix` for auto-fixable issues
- **Formatting**: Trailing whitespace, line endings, spacing
- **References**: Fixes broken relative paths within `docs/` when the target file exists

**Manual fixes required**:
- Content accuracy (wrong command names, outdated options)
- **Examples or described structure that do not match lib/schema** (fix examples to conform to application-schema.json, external-system.schema.json, external-datasource.schema.json, infrastructure-schema.json, etc.)
- Missing or unclear sections (must be added/edited manually)
- Broken links to non-existent documents
- Invalid or inconsistent Mermaid diagrams

### 8. Report Generation

**⚠️ DEFAULT BEHAVIOR**: Validation results are **ALWAYS attached directly to the plan file itself** unless `--new-report` is explicitly specified.

**Mode 1: Attach to plan file (DEFAULT)**:
- Appends or updates a `## Validation Report` section in the original plan file
- No flag required

**Mode 2: Separate report file (`--new-report`)**:
- Creates a separate report file
- For plan files: `.cursor/plans/<plan-name>-DOCS-VALIDATION-REPORT.md`
- For single docs: `<doc-basename>-VALIDATION-REPORT.md` (e.g. `your-own-applications-VALIDATION-REPORT.md`)

## Output

### Validation Report Structure

**When attached to plan (default)**:
Report is in the plan file under `## Validation Report` with date, status (✅ COMPLETE / ⚠️ INCOMPLETE / ❌ FAILED), and the sections below.

**When separate report (`--new-report`)**:
```markdown
# <Plan Name> / <Doc Path> - Documentation Validation Report

**Date**: [YYYY-MM-DD]
**Plan**: [plan path] (if applicable)
**Document(s)**: [doc path(s)]
**Status**: ✅ COMPLETE / ⚠️ INCOMPLETE / ❌ FAILED

## Executive Summary
[Overall status and completion]

## Documents Validated
- Total: [number]
- Passed: [number]
- Failed: [number]
- Auto-fixed: [number]

### Document List
- ✅/❌ [path] - [status]

## Structure Validation
[Per-document: title, hierarchy, required/nice-to-have sections, nav links]

## Reference Validation
[Per-document: cross-refs within docs/, broken links]

## Schema-based Validation
[Per-document: which schemas (lib/schema) the doc relates to; validation result for each code-block example and described structure]
- Example: `docs/configuration/application-yaml.md` → application-schema.json: ✅/❌ (list any invalid examples with line/snippet and schema error)
- Example: `docs/external-systems.md` or external integration docs → external-system.schema.json, external-datasource.schema.json: ✅/❌

## Markdown Validation
[Per-document: MarkdownLint results, auto-fixes]

## Project Rules Compliance
[Focus on builder usage, Mermaid/flow consistency; examples and structure match lib/schema]

## Automatic Fixes Applied
[List by document]

## Manual Fixes Required
[List by document]

## Issues and Recommendations
[Actionable list]

## Final Checklist
- [ ] All documents validated
- [ ] MarkdownLint passes (0 errors)
- [ ] Cross-references within docs/ valid
- [ ] No broken links
- [ ] **Examples and structure in docs are correct and based on schemas in lib/schema** (application-schema, external-system, external-datasource, infrastructure, etc.)
- [ ] Content focused on using the builder (external users)
- [ ] Auto-fixes applied; manual fixes documented
```

## Execution Behavior

- Runs automatically without prompting except when a critical fix needs confirmation
- Shows progress; applies auto-fixes; writes report to plan (default) or separate file
- **Critical requirements**:
  - MarkdownLint must pass (zero errors) after auto-fixes
  - Cross-references within `docs/` must be valid
  - No broken internal links
  - **Examples and structure in docs must be correct and based on schemas in lib/schema** (see [Schema-based validation](#schema-based-validation))
  - Docs remain focused on **how to use the aifabrix builder** for external users

## Notes

- **Plan file detection**: If no plan is given, uses the most recently modified file in `.cursor/plans/`
- **Doc detection**: Collects paths matching `docs/**/*.md` from the plan (links, code blocks, file paths)
- **Schema sources**: Canonical schemas live in **lib/schema/** (application-schema.json, external-system.schema.json, external-datasource.schema.json, infrastructure-schema.json, wizard-config.schema.json, environment-deploy-request.schema.json, deployment-rules.yaml, env-config.yaml). Doc examples and described structure must validate against the relevant schema(s).
- **Rules**: Relevant rules live under `.cursor/rules/` (e.g. `flows-and-visuals.md` for diagrams; `project-rules.mdc` for general standards)
- **MarkdownLint**: Requires `npx markdownlint` (must be installed)
- **Default**: Results are attached to the plan file unless `--new-report` is used

## Integration with Plans

Add this step to any plan that changes user-facing documentation:

```markdown
## Validation

After implementation, run:
/validate-knowledgebase .cursor/plans/<plan-name>.plan.md

This will validate docs mentioned in the plan and attach results to this plan file:
- All listed docs validated
- Examples and structure validated against lib/schema (application, external-system, external-datasource, infrastructure, etc.)
- MarkdownLint passes (0 errors)
- Cross-references within docs/ valid
- Content focused on using the builder (external users)

Use `--new-report` only if you need a standalone report file.
```

## Single Document Validation

To validate one document without a plan:

```
/validate-knowledgebase docs/your-own-applications.md
```

or

```
/validate-knowledgebase docs/commands/README.md
```

This validates only that file and produces a standalone validation report.

## Validation Checklist

Before marking documentation work complete:

- [ ] All validated documents pass MarkdownLint (0 errors)
- [ ] Cross-references within `docs/` are correct (relative paths, no broken links)
- [ ] **All doc examples and described structure are correct and based on schemas in lib/schema** (application-schema.json, external-system.schema.json, external-datasource.schema.json, infrastructure-schema.json, etc., as applicable per doc)
- [ ] Docs focus on **how to use the aifabrix builder** (external users)
- [ ] CLI commands and options match the actual tool (`aifabrix` / `af`)
- [ ] Config examples (application.yaml, external-system, datasource, env.template, etc.) validate against the corresponding schema(s)
- [ ] Mermaid diagrams valid and consistent (if present)
- [ ] Auto-fixes applied; manual fixes documented
