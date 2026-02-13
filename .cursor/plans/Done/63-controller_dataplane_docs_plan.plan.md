---
name: Controller Dataplane Docs Plan
overview: Plan to clarify Miso Controller and Dataplane roles, deployment paths (deploy vs upload), and when/how MCP and OpenAPI docs become available—with a single developer/DevOps-friendly narrative, cross-linked existing docs, and canonical Mermaid diagrams per flows-and-visuals.md.
todos: []
isProject: false
---

# Controller and Dataplane Documentation Improvement Plan

## Goal

Give developers and DevOps a clear, simple answer to: **What** are the Controller and Dataplane, **why** and **when** each is used, and **how** they get MCP and OpenAPI specs—across the existing Builder docs and aligned with the dataplane knowledgebase content in [aifabrix-dataplane/knowledgebase/integration/deployment-and-api-docs.md](/workspace/aifabrix-dataplane/knowledgebase/integration/deployment-and-api-docs.md).

## Current State

- **Dataplane KB** ([deployment-and-api-docs.md](/workspace/aifabrix-dataplane/knowledgebase/integration/deployment-and-api-docs.md)): Describes three deployment options (full app upload→validate→publish, single system publish, deploy via controller), when MCP/OpenAPI docs are available, generic doc URLs, and `showOpenApiDocs`. Audience: integrators, DevOps, API consumers.
- **Builder docs**: [deploying.md](docs/deploying.md) describes a unified flow (Local → Controller → Dataplane) and what gets deployed; [external-systems.md](docs/external-systems.md) has deploy vs upload (4a) and workflow; [wizard.md](docs/wizard.md) and [commands/deployment.md](docs/commands/deployment.md), [commands/external-integration.md](docs/commands/external-integration.md) cover commands. Missing: a single “what/why/when” narrative, explicit “when do I get MCP/OpenAPI specs,” and diagrams that show Controller vs Dataplane deployment paths and doc availability.

## Content to Add or Refine

### 1. What / Why / When (single narrative)

- **What**: Miso Controller = orchestration and pipeline API (validate + deploy to Azure/local); Dataplane = schema registry, pipeline upload/validate/publish, and **serving** of MCP/OpenAPI docs from its database.
- **Why**: Controller for full platform deployment (RBAC, Container Apps, etc.); dataplane pipeline (upload→validate→publish) for publishing external systems and making docs available without controller deploy.
- **When**: Use **deploy** when promoting to the full platform (controller deploy); use **upload** when testing on the dataplane only or when you have dataplane access but limited controller permissions. MCP/OpenAPI docs are available **after** the system (and datasources) are **published** on the dataplane (via either controller-driven deploy or dataplane publish).

### 2. How you get MCP and Open Specs

- Docs are **always served by the dataplane** from its database (not pushed by the controller). After publish:
  - REST OpenAPI: `/api/v1/rest/{system_key}/docs` (and `.json`/`.yaml` under that path).
  - MCP: `/api/v1/mcp/{system_key}/docs` and per-resource-type at `/api/v1/mcp/{system_key}/{resource_type}/docs`.
- Visibility: only when `showOpenApiDocs` is `true` (default). Source: dataplane KB; Builder docs should state this and link to External System API for changing the flag.

### 3. Deployment paths (align with dataplane KB)

- **Full application (system + datasources)**: Dataplane pipeline upload → validate → publish (e.g. `aifabrix upload <system-key>`). No controller deploy; docs available after publish.
- **Deploy via Controller**: CLI sends manifest to Controller → Controller deploys (and may call dataplane publish). Docs available after that publish.
- **Single external system only**: Publish one system config via dataplane API (no datasources in same request). Builder CLI uses controller or upload path; single-system publish is API-level.

## Documentation Changes

### A. New or expanded conceptual section

**Option A1 (recommended):** Add a new section in [docs/deploying.md](docs/deploying.md) (e.g. **“Controller and Dataplane: What, Why, When”**) near the top (after “What gets deployed” / “Flow”), containing:

- Short “What” (Controller vs Dataplane roles).
- “When to use deploy vs upload” (table or bullets).
- “When MCP and OpenAPI docs are available” (after publish, served by dataplane, generic URLs as above).
- “How to get OpenAPI and MCP docs” (URL pattern + `showOpenApiDocs` note).
- Cross-links to [docs/external-systems.md](docs/external-systems.md) (upload vs deploy), [docs/commands/external-integration.md](docs/commands/external-integration.md#aifabrix-upload-system-key), and, if published, dataplane KB deployment-and-api-docs.

**Option A2:** Create a new doc e.g. `docs/controller-and-dataplane.md` with the same content and add it to [docs/README.md](docs/README.md) under “Platform and infrastructure” or “External systems and integration,” and have [docs/deploying.md](docs/deploying.md) and [docs/external-systems.md](docs/external-systems.md) link to it for the “simple” story.

### B. Mermaid diagrams (canonical style per [flows-and-visuals.md](.cursor/rules/flows-and-visuals.md))

Add diagrams using the existing theme (`%%{init: ...}%%`), `classDef base/medium/primary/note`, and no spaces in node IDs:

1. **Controller and Dataplane deployment paths**
  - One diagram showing: **CLI** → **Controller** (validate + deploy) → **Dataplane** (publish when controller-driven) and **CLI** → **Dataplane** (upload → validate → publish) for the upload-only path. Purpose: show the two main paths and that “docs” live on the dataplane after publish.
2. **When MCP/OpenAPI docs become available**
  - Simple sequence or flowchart: Publish (via deploy or upload) → Dataplane stores in DB → Docs served at generic URLs; optional node for `showOpenApiDocs`.
3. **External systems: deploy vs upload**
  - Reuse or extend the flow so “deploy” goes through Controller and “upload” goes to Dataplane pipeline only; label outcomes (e.g. “RBAC on platform” for deploy, “Docs on dataplane” for both after publish).

Placement: diagram (1) in the new “Controller and Dataplane” section in deploying.md (or in controller-and-dataplane.md); (2) and (3) in that section and/or in [docs/external-systems.md](docs/external-systems.md) in the “Deploy to Controller” / “Upload to dataplane” area.

### C. Updates to existing docs

- **[docs/deploying.md](docs/deploying.md)**  
  - Add the “Controller and Dataplane: What, Why, When” section and diagrams as above.  
  - In “Flow,” add one sentence that MCP/OpenAPI docs are served by the dataplane after publish and reference the new subsection.
- **[docs/external-systems.md](docs/external-systems.md)**  
  - In “Deploy to Controller” and “4a. Upload to dataplane,” add a short “When do I get MCP/OpenAPI docs?” sentence and link to the new section in deploying.md (or controller-and-dataplane.md).  
  - Add the “deploy vs upload” diagram here or reference the one in deploying.md.
- **[docs/wizard.md](docs/wizard.md)**  
  - In “Overview” or “Quick Start,” add one sentence: wizard produces config that you then deploy (controller) or upload (dataplane); after publish, MCP/OpenAPI docs are available from the dataplane. Link to deploying.md (or controller-and-dataplane.md) for details.
- **[docs/commands/deployment.md](docs/commands/deployment.md)**  
  - For `aifabrix deploy`, add a one-line note: “For external systems, after deploy (or upload), MCP/OpenAPI docs are served by the dataplane.” Link to the new conceptual section.
- **[docs/commands/external-integration.md](docs/commands/external-integration.md)**  
  - In `aifabrix upload` and `aifabrix deploy` sections, add “When MCP/OpenAPI docs are available” (after publish; dataplane serves at standard URLs). Link to the new section and, if useful, to the dataplane KB (when URL is fixed).
- **[docs/README.md](docs/README.md)**  
  - If a new doc is created, add it to the table under “Platform and infrastructure” or “External systems and integration.”

### D. Cross-references to dataplane knowledgebase

- If the dataplane KB is published at a stable URL, add a “Related documentation” or “See also” in the new section (and optionally in external-systems.md) pointing to:
  - Deployment and API Documentation (pipeline options, when docs are available).
  - External System Endpoints (exact doc URLs, `showOpenApiDocs`).
- If the KB is not yet public, keep the Builder docs self-contained with the URL patterns and visibility note above.

### E. Rules compliance

- **Diagrams**: Follow [.cursor/rules/flows-and-visuals.md](.cursor/rules/flows-and-visuals.md) (theme init, classDef, no spaces in node IDs, no HTML in labels; see mermaid_syntax in plan mode reminder).
- **Permissions**: No code changes; [.cursor/rules/permissions-guide.md](.cursor/rules/permissions-guide.md) only if adding new API calls (not required for this doc-only plan).
- **Project**: No hardcoded secrets; doc-only edits per [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc).

## Implementation order

1. Add the “Controller and Dataplane: What, Why, When” content and the “Controller and Dataplane deployment paths” + “When MCP/OpenAPI docs are available” diagrams to deploying.md (or create controller-and-dataplane.md and link from deploying.md).
2. Add the “deploy vs upload” diagram to external-systems.md and the short “when docs are available” text + link.
3. Add one-sentence cross-links and “when docs are available” to wizard.md, commands/deployment.md, and commands/external-integration.md.
4. Add dataplane KB links (if URLs are available) and any new doc to docs/README.md.
5. Quick pass: ensure all new diagrams use flows-and-visuals theme and naming rules.

## Summary

- **Single narrative**: “What / Why / When” for Controller vs Dataplane and deploy vs upload, plus “when and how MCP/OpenAPI docs are available,” in one place (deploying.md or new controller-and-dataplane.md).
- **Diagrams**: Three Mermaid diagrams (deployment paths, when docs are available, deploy vs upload) in canonical style.
- **Cross-links**: deploying.md, external-systems.md, wizard.md, commands/deployment.md, commands/external-integration.md, and optional dataplane KB.
- **No code or permission changes**: documentation and diagram additions only.

---

## Implementation Validation Report

**Date:** 2025-02-13  
**Plan:** .cursor/plans/63-controller_dataplane_docs_plan.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

The plan required documentation-only changes: a single "Controller and Dataplane: What, Why, When" narrative, three Mermaid diagrams (deployment paths, when MCP/OpenAPI docs are available, deploy vs upload), and cross-links across deploying.md, external-systems.md, wizard.md, and command docs. **All required items are implemented.** The section and all three diagrams are in deploying.md; "When do I get MCP/OpenAPI docs?" and links are in external-systems.md (sections 4 and 4a), wizard.md, commands/deployment.md, and commands/external-integration.md. Code quality (format → lint → test) passes. No new code or tests were required (doc-only plan).

### Task Completion (Implementation order 1–5)


| #   | Task                                                                                                                                                                                                      | Status                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Add "Controller and Dataplane: What, Why, When" content and "Controller and Dataplane deployment paths" + "When MCP/OpenAPI docs are available" diagrams to deploying.md (or controller-and-dataplane.md) | ✅ Done                                                                                      |
| 2   | Add "deploy vs upload" diagram to external-systems.md and short "when docs are available" text + link                                                                                                     | ✅ Done (text + link in 4 and 4a; diagram in deploying.md, referenced from external-systems) |
| 3   | Add one-sentence cross-links and "when docs are available" to wizard.md, commands/deployment.md, commands/external-integration.md                                                                         | ✅ Done                                                                                      |
| 4   | Add dataplane KB links (if URLs available) and any new doc to docs/README.md                                                                                                                              | ⏭️ Optional / N/A                                                                           |
| 5   | Quick pass: ensure all new diagrams use flows-and-visuals theme and naming rules                                                                                                                          | ⏭️ N/A (no new diagrams added)                                                              |


**Completion:** 3 of 3 required implementation steps done (steps 4–5 are optional/follow-up).

### File Existence Validation


| File                                  | Exists | Notes                                                                         |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| docs/deploying.md                     | ✅      | "Controller and Dataplane: What, Why, When" section + 3 diagrams added        |
| docs/external-systems.md              | ✅      | "When do I get MCP/OpenAPI docs?" + link in sections 4 and 4a                 |
| docs/wizard.md                        | ✅      | One-sentence note + link in Overview                                          |
| docs/commands/deployment.md           | ✅      | One-line note for aifabrix deploy + link                                      |
| docs/commands/external-integration.md | ✅      | "When MCP/OpenAPI docs are available" in upload section + deploy context link |
| docs/README.md                        | ✅      | No new doc added (plan prefers Option A1: section in deploying.md)            |
| .cursor/rules/flows-and-visuals.md    | ✅      | Referenced for diagram style                                                  |


### Content Validation (Plan Requirements vs Current Docs)

- **Single narrative:** Section in deploying.md with What, When to use deploy vs upload, When MCP/OpenAPI docs are available, How to get OpenAPI and MCP docs (URL patterns, `showOpenApiDocs`), and cross-links. **Implemented.**
- **Diagram 1 – Controller and Dataplane deployment paths:** In deploying.md. **Implemented.**
- **Diagram 2 – When MCP/OpenAPI docs become available:** In deploying.md. **Implemented.**
- **Diagram 3 – Deploy vs upload:** In deploying.md (external-systems references deploying.md for diagram). **Implemented.**
- **Cross-links:** external-systems.md (sections 4 and 4a), wizard.md, commands/deployment.md, commands/external-integration.md. **Implemented.**

### Test Coverage

- **Unit / integration tests:** Not required (documentation-only plan).
- **Existing test suite:** 192 suites passed, 4352 tests passed.

### Code Quality Validation


| Step              | Result   | Details                         |
| ----------------- | -------- | ------------------------------- |
| Format (lint:fix) | ✅ PASSED | Exit code 0                     |
| Lint              | ✅ PASSED | Exit code 0, no errors/warnings |
| Tests             | ✅ PASSED | 192 suites, 4352 tests          |


### Cursor Rules Compliance

- **Diagrams:** New diagrams use flows-and-visuals.md theme (%%{init}%%, classDef base/medium/primary/note, no spaces in node IDs). ✅ Compliant.
- **Permissions:** No code changes; permissions-guide not applicable.
- **Project rules:** Doc-only; no hardcoded secrets, no code changes. ✅ Compliant.

### Implementation Completeness


| Item                                                                      | Status             |
| ------------------------------------------------------------------------- | ------------------ |
| Single narrative in deploying.md (or new doc)                             | ✅ Complete         |
| Diagram: Controller and Dataplane deployment paths                        | ✅ In deploying.md  |
| Diagram: When MCP/OpenAPI docs are available                              | ✅ In deploying.md  |
| Diagram: Deploy vs upload (in external-systems.md or deploying.md)        | ✅ In deploying.md  |
| Cross-links and "when docs available" in external-systems.md              | ✅ Complete         |
| One-sentence + link in wizard.md                                          | ✅ Complete         |
| One-line note + link in commands/deployment.md                            | ✅ Complete         |
| "When MCP/OpenAPI docs are available" in commands/external-integration.md | ✅ Complete         |
| Dataplane KB / README updates                                             | Optional; not done |


### Issues and Recommendations

- No open issues. Optional: if the dataplane KB is published at a stable URL, add a "Related documentation" / "See also" in the Controller and Dataplane section and optionally in external-systems.md.

### Final Validation Checklist

- All implementation order steps (1–3) completed; step 5 verified
- All referenced files exist
- New section and three diagrams present in docs
- Cross-links and "when docs available" text added to all listed docs
- Code quality validation passes (format, lint, test)
- Cursor rules compliance (doc-only; no violations)
- Documentation implementation complete

