---
name: ""
overview: ""
todos: []
isProject: false
---

@.cursor/plans/115-testing-tool.plan.md 
Good — now we translate everything into a **Builder CLI UX plan** that:

- matches your backend model (DatasourceTestRun)
- respects the 3-layer testing model
- avoids black box behavior
- is fast, predictable, and debuggable

Below are **focused recommendations only**, structured for implementation.

---

# 🔥 Core UX Principle

> CLI is not a viewer of JSON
> CLI is a **decision engine for developers**

It must answer:

1. Can I use this datasource?
2. What is broken?
3. What do I fix next?

---

# 1. Command Model (lock this)

Keep commands exactly:

```bash
af test
af test-integration
af test-e2e
```

👉 Do NOT overload or merge them.

---

## Add consistent targeting

```bash
af test <datasource>
af test-integration <datasource>
af test-e2e <datasource> [capability]
```

---

## Add global flags (mandatory)

```bash
--debug[=summary|full|raw]
--json
--summary
--watch
--fail-fast
```

---

# 2. Output Layers (must be consistent across all commands)

Every command must follow the same visual structure:

```text
HEADER
STATUS
CORE RESULT
DETAILS
NEXT ACTIONS
```

---

# 3. `af test` (validation UX)

## Goal

Fast structural feedback

## Recommendations

### 1. Replace metrics with signals

Never show ICC/PDS/DTS.

Show:

```text
Data Readiness: ❌ Not ready
Schema Coverage: ⚠️ Partial
```

---

### 2. Show only blocking issues by default

```text
Issues:
- Missing field mapping: amount → dealAmount
- RBAC permission missing: hubspot.deal.create
```

---

### 3. Add “why this matters”

```text
Impact:
- deal.create will fail
- certification cannot be granted
```

---

### 4. Add direct fix hints

```text
Fix:
- Add fieldMapping: amount → dealAmount
- Add RBAC permission: hubspot.deal.create
```

---

# 4. `af test-integration` (pipeline UX)

## Goal

Show pipeline execution health

---

### 1. Show CIP stages explicitly

```text
Pipeline Execution:

✔ fetch
✔ transform
✔ normalize
✖ policy enforcement
✔ output
```

---

### 2. Collapse success, expand failure

Only failed steps expand:

```text
✖ policy enforcement
  Error: missing access field ownerId
  Hint: add accessField ownerId
```

---

### 3. Add performance hint

```text
Duration: 420ms
```

---

# 5. `af test-e2e` (capability UX)

## Goal

Answer: “Which operations work?”

---

### 1. Capabilities are primary UI

```text
✔ deal.list
✔ deal.get
✖ deal.create
✖ deal.update
✔ deal.delete
```

---

### 2. Group failures

```text
Failures:

deal.create
- Record not found after creation
- Hint: Fix mapping amount → dealAmount

deal.update
- Permission denied
- Hint: Add RBAC permission
```

---

### 3. Enable drill-down

```bash
af test-e2e hubspot.deals deal.create --debug
```

---

# 6. Debug UX (critical)

## Default behavior

```text
Use --debug for execution trace
Trace ID: trace_abc123
```

---

## Debug mode (summary)

```text
TRACE:

✔ fetch deals (120ms)
✔ transform
✖ normalize
  Error: invalid type
```

---

## Debug mode (full)

```text
Step: transform
Input: {...}
Output: {...}
```

---

## Debug mode (raw)

- full payloads
- redacted

---

# 7. JSON output (machine mode)

```bash
af test hubspot.deals --json
```

👉 Must return **DatasourceTestRun exactly**

No formatting layer.

---

# 8. Summary mode (fast CI usage)

```bash
af test hubspot.deals --summary
```

```text
hubspot.deals ❌ FAILED
Validation: ❌
Capabilities: 3/5 passing
```

---

# 9. Fail-fast mode (important)

```bash
--fail-fast
```

Stops after first blocking issue.

---

# 10. Watch mode (developer productivity)

```bash
af test hubspot.deals --watch
```

- reruns on config change
- shows diff

---

# 11. Cross-command consistency (critical)

The same datasource should always render:

- same header
- same naming
- same status semantics

---

# 12. Status standardization

Use ONLY:

```text
✔ OK
⚠ WARN
✖ FAIL
⏭ SKIPPED
```

No variation.

---

# 13. Error display rules

Always:

```text
[CODE] short message
Hint: ...
```

Never:

- stack traces by default
- raw JSON

---

# 14. Remove internal concepts from UX

Do NOT show:

- ICC / PDS / DTS
- “validation engine”
- “metricValue”
- “contract envelope”

👉 These stay in JSON/debug only

---

# 15. Capability UX must align with RBAC

Always include:

```text
✖ deal.create (permission missing)
```

👉 This creates direct connection:
capability ↔ permission

---

# 16. Progressive disclosure (very important)

Default → minimal
Debug → deep
JSON → full

Never mix them.

---

# 17. Suggested CLI flow (ideal experience)

```bash
af test hubspot.deals
```

→ fix structure

```bash
af test-integration hubspot.deals
```

→ fix pipeline

```bash
af test-e2e hubspot.deals
```

→ fix capabilities

---

# 18. Anti-patterns to avoid

### ❌ Dumping full report

Too noisy

### ❌ Mixing validation + E2E in one output

Breaks mental model

### ❌ Showing internal metrics

Confusing

### ❌ No next actions

Kills usability

---

# 🔥 Key Insight

Your CLI is:

> **the primary developer interface to Dataplane**

If CLI is:

- confusing → product feels broken
- slow → product feels heavy
- opaque → product is not trusted

---

# If you want next step

I can:

- Generate **exact CLI renderer spec (TypeScript/Python)**
- Or map this directly to your **DatasourceTestRun → CLI formatting engine**

That’s the final step to make this production-grade.