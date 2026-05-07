# External Integration: Datasource Capability Commands

← [Documentation index](../../README.md) · [Commands index](../README.md) · [External integration](../external-integration.md) · [Datasource commands](./datasources.md)

Capability commands are for editing **one capability** inside an existing external datasource file (OpenAPI operation mapping + CIP operations + optional `exposed.profiles` entry).

Use these when you already have a working datasource file and want to **create**, **copy**, **remove**, **diff**, **edit**, **validate**, or **relate** a capability without rewriting the whole file by hand.

---

## Recommended workflow

wizard/download integration → `aifabrix datasource validate <file-or-key>` → capability command (try `--dry-run` first) → validate again → upload/publish.

---

## Commands

### aifabrix datasource capability copy <file-or-key> --from <key> --as <key>

**What:** Clones one capability’s slices inside the same datasource file:
- `openapi.operations`
- `execution.cip.operations`
- optional `exposed.profiles.<key>`
- optional `testPayload.scenarios` rows (with `--test`)

**When:** You already have a working capability and want a second one that is “the same shape” with a new key.

**Notes:**
- Operation keys under `openapi.operations` / `execution.cip.operations` are derived from `--as` using a **lowercase** form.
- Keys in `capabilities[]` and `exposed.profiles.<as>` keep the `--as` casing (typically camelCase).

---

### aifabrix datasource capability remove <file-or-key> --capability <key>

**What:** Removes a capability from the datasource file:
- drops it from `capabilities[]`
- removes the matching slices from `openapi.operations` and `execution.cip.operations`
- deletes `exposed.profiles.<key>` when present
- removes matching `testPayload.scenarios` rows

**When:** You want to delete an experimental or deprecated capability cleanly.

---

### aifabrix datasource capability create <file-or-key>

**What:** Creates a capability inside the datasource file. This is the “create/add” command for capability scaffolding.

**When:** You want to create a new capability from an existing source (clone/from operation/template), rather than only duplicating an existing capability verbatim.

> Full behavior is defined by the CLI flags; use `aifabrix datasource capability create --help` for the current source modes.

---

### aifabrix datasource capability validate <file-or-key>

**What:** Validates the datasource file, plus (optionally) confirms that a capability key is present consistently across the capability slices.

**When:** After capability edits, before upload/publish.

---

### aifabrix datasource capability diff <file-a> <file-b>

**What:** Compares one capability between two datasource files and exits non-zero when the slices differ (useful for CI / review).

**When:** Reviewing changes between versions or comparing a local file to a downloaded file.

---

### aifabrix datasource capability edit <file-or-key>

**What:** Interactive editor for capability slices (TTY required). Lets you open JSON in `$VISUAL` / `$EDITOR`.

**When:** You need a precise manual edit but still want guardrails around selecting the capability and section.

---

### aifabrix datasource capability relate <file-or-key>

**What:** Adds or replaces one relationship row (foreign key metadata) for cross-datasource relationships.

**When:** After you have multiple datasources and need to model relations between them (metadata-only).

---

### aifabrix datasource capability dimension <file-or-key>

**What:** Adds or replaces one root `dimensions.<key>` binding (local field or FK traversal). This is metadata only; it does not modify pipeline execution.

**When:** When you want ABAC-facing dimension bindings on a datasource (for example, map a `market` dimension to `country`, or map an `owner` dimension via a foreign key hop).

**Examples:**

```bash
aifabrix datasource capability dimension test-e2e-hubspot-companies --dimension market --type local --field country
aifabrix datasource capability dimension test-e2e-hubspot-companies --dimension owner --type fk --via hubspotOwner:owner --actor email
```

After any mutation, validate the datasource:

```bash
aifabrix datasource validate <file-or-key>
```

---

## Output profiles

Per the CLI output matrix:
- `copy` / `remove` / `create` / `edit` / `relate`: TTY summary output
- `dimension`: TTY summary output
- `validate`: layout blocks output
- `diff`: stdout-only output

