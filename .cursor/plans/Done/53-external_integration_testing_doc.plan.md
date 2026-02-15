---
name: External integration testing doc
overview: Add a dedicated full document for external integration testing and refactor [docs/commands/external-integration.md](docs/commands/external-integration.md) so testing is the single place for test payloads, capabilities, and validation flow; keep external-integration.md as a command-focused reference with links to the new doc.
todos: []
isProject: false
---

# External Integration Testing Documentation Plan

## Goal

- **New:** A full, standalone document that covers how to test external integrations (unit vs integration, test payloads, capabilities, payload files, list validation, troubleshooting).
- **Update:** [docs/commands/external-integration.md](docs/commands/external-integration.md) so it stays command-focused; move detailed testing content to the new doc and replace with concise command descriptions and links.

## Scope

- **In scope:** Documentation only (new testing doc + edits to external-integration.md + doc cross-links).
- **Out of scope for this plan:** Implementation of testPayload-as-array, capabilities-per-test-case, or separate test files (those can be a follow-up plan; the new doc can still describe current behavior and reserve a short “Future” subsection for the intended design).

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit. For documentation-only changes: run `npm run build` after edits to ensure no broken references or regressions; lint and test must still pass (no new code, so no new test files required).
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Documentation Requirements: docs should be clear, consistent, and accurate; use Visual Documentation (Mermaid) from [flows-and-visuals.md](flows-and-visuals.md) only if adding workflow/architecture diagrams. File size limits apply to code; keep new doc focused and within reasonable length.
- **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** – Post-Development: build, lint, test in order after documentation changes to verify repo health.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Visual Documentation: if the new testing doc includes a workflow (e.g. unit vs integration test flow), consider a Mermaid diagram per flows-and-visuals.md; optional for this plan.

**Key requirements:**

- All new and updated docs: consistent breadcrumbs, working internal links and anchors.
- Preserve existing anchors in external-integration.md so cli-reference.md and validation.md links keep working.
- No duplicated long content between external-integration.md and the new testing doc; testing doc is the single source of detail for testing.

---

## Before Development

- Read current [docs/commands/external-integration.md](docs/commands/external-integration.md) sections for `aifabrix test` and `aifabrix test-integration` to identify exact content to move or summarize.
- Check [docs/commands/validation.md](docs/commands/validation.md) and [docs/cli-reference.md](docs/cli-reference.md) for links to external-integration.md (anchors) so they are preserved.
- Confirm path and naming: new file `docs/commands/external-integration-testing.md` and cross-links from README, validation.md, external-systems.md, cli-reference.md.

---

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` (must complete successfully – runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all existing tests must pass). No new code; no new test files required for this documentation plan.
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence).
5. **Documentation:** New testing doc created with structure and content as specified; external-integration.md updated with concise command sections and links to the new doc; cross-links added in README.md, validation.md, and optionally external-systems.md and cli-reference.md.
6. **Links:** All new internal doc links and anchors resolve; existing anchors in external-integration.md retained.
7. **Consistency:** No long duplicated paragraphs; external-integration.md remains command-focused, testing doc is the full testing guide.

---

## 1. New document: full testing guide

**Path:** [docs/commands/external-integration-testing.md](docs/commands/external-integration-testing.md) (new file).

**Purpose:** Single source of truth for “how to test external integrations” so that external-integration.md and [docs/commands/validation.md](docs/commands/validation.md) can point to it instead of duplicating detail.

**Suggested structure:**

1. **Title and nav**
  - “External Integration Testing” with breadcrumb: Documentation index, Commands index, External Integration Commands (link back to external-integration.md).
2. **Overview**
  - What “testing” means here: local unit tests (`aifabrix test`) vs integration tests (`aifabrix test-integration`). When to use each. Prerequisites (e.g. login for integration tests).
3. **Unit tests (`aifabrix test`)**
  - What is validated (syntax, schemas, field mappings, metadata schema, relationships).  
  - How test payloads are used: current `testPayload.payloadTemplate` (and optional `expectedResult`) in datasource.  
  - Options: `--datasource`, `--verbose`.  
  - Example commands and sample output (success and failure).  
  - Troubleshooting: “Test payload not found”, validation errors, next steps (e.g. run test-integration).
4. **Integration tests (`aifabrix test-integration`)**
  - What is validated (pipeline test API, field mappings, metadata schema, endpoint connectivity, ABAC dimensions).  
  - Where payloads come from: datasource `testPayload.payloadTemplate` or `--payload <file>`.  
  - Options: `--datasource`, `--payload`, `--verbose`, `--timeout`.  
  - Process: load payload, call dataplane test endpoint, interpret response.  
  - Example commands and sample output.  
  - Troubleshooting: “Test payload not found”, validation/connectivity failures, permissions.
5. **Test payload configuration**
  - Current format: `testPayload` object in datasource with `payloadTemplate` (and optional `expectedResult`).  
  - Inline example (YAML/JSON) and note that payload must match API response shape.  
  - Custom file: `--payload <file>` for integration tests; file format (single payload object).  
  - Optional short “Future” note: test payloads as array, one entry per capability (list/get/create/update/delete), and/or separate test files in a `tests/` folder with same name as datasource file—to be documented when implemented.
6. **Validating list responses**
  - Current behavior: validators assume a single object; list APIs often return an array or `{ results: [...] }`.  
  - Recommendation for today: use a single representative item in `payloadTemplate` for list (or first element of array).  
  - Optional “Future” note: support list-shaped payloads (array or wrapper key) and validate each item against schema/field mappings.
7. **Capabilities**
  - Brief note: datasource has `capabilities` (list, get, create, update, delete). Tests today use one payload per datasource; future design may tie test cases to capability for different payloads per operation (e.g. update vs create).
8. **See also**
  - [External Integration Commands](external-integration.md), [Validation Commands](validation.md), [External Systems Guide](../external-systems.md) (and any test payload section there).

**Content source:** Migrate and expand the testing-related content from [docs/commands/external-integration.md](docs/commands/external-integration.md) (sections “aifabrix test &lt;app&gt;” and “aifabrix test-integration &lt;app&gt;”, including Test Payload Configuration, Process, Response Handling, Issues, Next Steps). Use the same examples and anchors where helpful (e.g. for deep links from validation.md).

---

## 2. Update existing: external-integration.md

**File:** [docs/commands/external-integration.md](docs/commands/external-integration.md).

**Edits:**

- **Intro:** Add one line after the first paragraph: link to the new testing doc for “testing and test payloads”, e.g. “For detailed testing documentation (unit and integration tests, test payloads, troubleshooting), see [External Integration Testing](external-integration-testing.md).”
- **Section “aifabrix test &lt;app&gt;”:**  
  - Keep: command name, one-sentence “What”, “When”, Usage block, Arguments/Options list, Prerequisites, and a short “Process” (numbered list, 3–5 lines).  
  - Remove or shorten: long Process details, full example output blocks, “Test Payload Configuration” JSON block, long “Issues” and “Next Steps” lists.  
  - Replace removed content with: “For test payload configuration, examples, and troubleshooting, see [External Integration Testing](external-integration-testing.md#unit-tests-aifabrix-test).”
- **Section “aifabrix test-integration &lt;app&gt;”:**  
  - Same approach: keep command-focused summary (What, When, Usage, Options, short Process).  
  - Remove or shorten: detailed Process, Response Handling, long examples and Issues/Next Steps.  
  - Add: “For payload sources, response handling, and troubleshooting, see [External Integration Testing](external-integration-testing.md#integration-tests-aifabrix-test-integration).”
- **Consistency:** Ensure any remaining mentions of `testPayload` or “test payload” in external-integration.md are brief and point to the new doc where detail lives.
- **Anchors:** Keep existing anchors (`<a id="aifabrix-test-app">`, `<a id="aifabrix-test-integration-app">`) so [docs/cli-reference.md](docs/cli-reference.md) and [docs/commands/validation.md](docs/commands/validation.md) continue to work when linking to these sections.

---

## 3. Cross-links and index

- ** [docs/commands/README.md](docs/commands/README.md):** Under “External Integration”, add a bullet: “External Integration Testing – Unit and integration testing, test payloads” linking to [external-integration-testing.md](docs/commands/external-integration-testing.md).
- ** [docs/commands/validation.md](docs/commands/validation.md):** In the “See also” or “External integration validation” part, add a link to [External Integration Testing](external-integration-testing.md) for test commands and test payload behavior; keep existing links to `external-integration.md#aifabrix-test-app` and `#aifabrix-test-integration-app` for command anchors.
- ** [docs/external-systems.md](docs/external-systems.md):** Where test payloads are described (e.g. around line 1056), add a reference to the new testing doc for full detail and keep a short inline summary or example.
- ** [docs/cli-reference.md](docs/cli-reference.md):** No structural change required (anchors remain in external-integration.md). Optionally add a line under External Integration that “Testing details: [External Integration Testing](commands/external-integration-testing.md).”

---

## 4. File summary


| Action | File                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------- |
| New    | [docs/commands/external-integration-testing.md](docs/commands/external-integration-testing.md) |
| Edit   | [docs/commands/external-integration.md](docs/commands/external-integration.md)                 |
| Edit   | [docs/commands/README.md](docs/commands/README.md)                                             |
| Edit   | [docs/commands/validation.md](docs/commands/validation.md)                                     |
| Edit   | [docs/external-systems.md](docs/external-systems.md) (optional reference to new doc)           |
| Edit   | [docs/cli-reference.md](docs/cli-reference.md) (optional one-line link)                        |


---

## 5. Out of scope (future plan)

- Schema/code changes for `testPayload` as array, capabilities per test case, or separate test files in `tests/<datasource-filename>.yaml`. The new doc can include a short “Future” subsection describing this so that a later implementation plan only needs to implement and then update that subsection.

---

## 6. Validation

- Confirm all new links resolve (internal doc links and anchors).
- Confirm [docs/commands/external-integration.md](docs/commands/external-integration.md) retains anchors used by cli-reference.md and validation.md.
- Read-through: no duplicated long paragraphs between external-integration.md and external-integration-testing.md; external-integration.md stays a command reference, testing doc is the full testing guide.

---

## Plan Validation Report

**Date:** 2026-02-11  
**Plan:** .cursor/plans/53-external_integration_testing_doc.plan.md  
**Status:** VALIDATED

### Plan Purpose

Documentation-only plan: add a full standalone document for external integration testing ([docs/commands/external-integration-testing.md](docs/commands/external-integration-testing.md)), refactor [docs/commands/external-integration.md](docs/commands/external-integration.md) to be command-focused with links to the new doc, and add cross-links in README, validation.md, and optionally external-systems.md and cli-reference.md. Scope: docs only; no code or schema changes.

### Applicable Rules

- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test after doc changes; documentation updated. For doc-only: no new test files; existing tests must still pass.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – Documentation Requirements: clear, consistent docs; optional Mermaid for workflows.
- [Development Workflow](.cursor/rules/project-rules.mdc#development-workflow) – Post-Development: build, lint, test in order.
- [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Visual Documentation optional for testing workflow diagram.

### Rule Compliance

- DoD Requirements: Added (Build, Lint, Test order; doc-specific items; link and consistency checks).
- Quality Gates: Addressed for doc-only (build/lint/test to verify repo health; no new code/tests).
- Code Quality Standards: Addressed (documentation requirements, link and anchor preservation).
- Development Workflow: Addressed (post-dev validation order).

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc (Quality Gates, Code Quality Standards, Development Workflow, Architecture Patterns) and key requirements for docs and anchors.
- Added **Before Development** checklist (read existing sections, check validation/cli-reference links, confirm paths).
- Added **Definition of Done** (Build, Lint, Test, validation order, documentation deliverables, links, consistency).

### Recommendations

- When implementing: run `npm run build` after all doc edits to confirm no broken refs and that tests still pass.
- Optional: add a small Mermaid diagram in the new testing doc for "unit test vs integration test" flow per flows-and-visuals.md if it improves clarity.
- Ensure anchor IDs in the new doc (e.g. `#unit-tests-aifabrix-test`) match the links added in external-integration.md.

---

## Implementation Validation Report

**Date:** 2026-02-13  
**Plan:** .cursor/plans/53-external_integration_testing_doc.plan.md  
**Status:** COMPLETE

### Executive Summary

All plan tasks were implemented. New document `docs/commands/external-integration-testing.md` was created as the single source of truth for external integration testing. `docs/commands/external-integration.md` was refactored to be command-focused with links to the new doc. Cross-links were added in `docs/commands/README.md`, `docs/commands/validation.md`, and `docs/external-systems.md`. Build, lint, and tests pass. No code or test file changes were required (documentation-only plan).

### Task Completion

- **Total tasks:** Plan deliverables (new doc, update external-integration.md, cross-links) – all completed.
- **Completed:** New testing doc created; external-integration.md updated; README, validation.md, external-systems.md updated with links.
- **Completion:** 100%.

### File Existence Validation

- **docs/commands/external-integration-testing.md** – Created (new file).
- **docs/commands/external-integration.md** – Updated (intro link, shortened test and test-integration sections, anchors retained).
- **docs/commands/README.md** – Updated (External Integration Testing bullet in TOC and Quick Navigation).
- **docs/commands/validation.md** – Updated (link to External Integration Testing in Related Commands and Related Documentation).
- **docs/external-systems.md** – Updated (reference to new testing doc in Test Payloads section).

### Test Coverage

- No new code; no new test files required per plan (documentation-only).
- Existing tests: all pass (`npm test` as part of `npm run build`).

### Code Quality Validation

- **Format:** N/A (no code changes); `npm run lint` run and passed.
- **Lint:** PASSED (0 errors, 0 warnings).
- **Tests:** PASSED (all existing tests pass via `npm run build`).

### Cursor Rules Compliance

- Documentation-only change: consistent breadcrumbs, internal links, and anchor preservation in external-integration.md (`#aifabrix-test-app`, `#aifabrix-test-integration-app`). No duplicated long content; testing doc is single source for testing detail.

### Implementation Completeness

- **New testing doc:** Complete (Overview, Unit tests, Integration tests, Test payload configuration, Validating list responses, Capabilities, See also).
- **external-integration.md:** Command-focused; long Process/output/payload blocks removed; links to external-integration-testing.md added.
- **Cross-links:** README, validation.md, external-systems.md updated. Note: `docs/cli-reference.md` does not exist; commands index is `docs/commands/README.md`, where External Integration Testing link was added.

### Issues and Recommendations

- None. All links and anchors verified; build succeeds.

### Final Validation Checklist

- [x] All plan deliverables completed
- [x] All files exist and updated as specified
- [x] No new tests required (doc-only)
- [x] Build (lint + test) passes
- [x] Cursor rules compliance (docs, links, anchors)
- [x] Implementation complete

