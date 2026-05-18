# Protection

← [Documentation index](../README.md) · [Commands index](README.md)

Manage **protection manifests** that project principal-to-dimension grants during datasource sync. Manifests live in a shared `{work}/.protection/` folder (not under `integration/<app>/`).

---

## Prerequisites

1. Run `aifabrix login` for the target environment.
2. Deploy the external datasource first: `aifabrix deploy <appKey>` (e.g. HubSpot, SharePoint).
3. Define dimensions in the catalog with the correct **value type** — see [Dimensions](dimensions.md#value-type-valuetype).

---

## Where files live

```text
{work}/.protection/
  hubspot-companies.yaml          # preferred: <datasourceKey>.yaml
  hubspot-protection-deals.yaml   # optional naming pattern
```

Each file protects exactly one **datasource key** (`spec.datasourceKey`). The CLI argument is that key (e.g. `hubspot-companies`), not the integration app key.

---

## Workflow

0. **Create** (optional) — probe deployed datasource + catalog dimension, then write a starter YAML under `{work}/.protection/`  
   `aifabrix protection create hubspot-companies --type country-sales`  
   Uses the same auth as other protection commands: dataplane read for the datasource, Controller read for the dimension. Then run validate → upload.
1. **Validate** — local schema check, then dataplane validation  
   `aifabrix protection validate <datasourceKey>`
2. **Upload** — validate, upload manifest, optional datasource sync  
   `aifabrix protection upload <datasourceKey>`
3. **List** — deployed protection manifests on dataplane (table, like `dimension list`)  
   `aifabrix protection list`
4. **Show** — deployed state from dataplane (effective value types per grant)  
   `aifabrix protection show <datasourceKey>`

**Batch (entire folder):**

- `aifabrix validate .protection`
- `aifabrix upload .protection`
- `aifabrix convert .protection --format yaml|json`

`aifabrix deploy .protection` is **not supported** — use `upload .protection` instead.  
`aifabrix delete .protection` is **not supported** — use `aifabrix protection delete <datasourceKey>`.

---

## Manifest basics

- `metadata.key` — unique protection key on the dataplane
- `spec.datasourceKey` — must match the deployed external datasource key
- `spec.rules[]` — principal resolution and dimension grants
- Optional `when` — group/dimension preconditions on the subject

Grants use `dimensionKey` and `valueExpression`. Omit grant-level `valueType` when the catalog dimension is `static` or `dynamic`; set `valueType: static|dynamic` on the grant only when the dimension catalog mode is **both**.

---

## Commands

### aifabrix protection create

Scaffolds `{work}/.protection/<datasourceKey>.yaml` after **online checks**:

1. **Dataplane** — load the external datasource by key (display name, system key, version, enabled, …).
2. **Controller** — load the dimension from the catalog (`dataType`, **`valueType`**, required flag, optional value list when `-v`).

Then builds a one-rule manifest from the selected preset, datasource `metadataSchema`, datasource `foreignKeys`, and dimension catalog `valueType`. Local **AJV** must pass before writing.

```bash
aifabrix protection create hubspot-companies --type country-sales
aifabrix protection create hr-persons --type department-manager
aifabrix protection create erp-projects --type project-team
aifabrix protection create hubspot-companies --type customer-team
aifabrix protection create hubspot-companies --dimension-key country --fk-name country --dry-run
aifabrix protection create hubspot-companies --dimension-key country --force
```

Preset types: `country-sales`, `department-manager`, `customer-team`, `project-team`, `static-region`, `owner-direct`.

Inference order for preset create: type preset defaults, datasource metadata fields, datasource foreign keys, dimension catalog `valueType`, then explicit overrides when needed.

Optional overrides: `--dimension-key`, `--field`, `--fk-name`, `--protection-key`, `--display-name`, `--rule-key`, `--principal-expression`, `--value-expression`, `--disabled`.

### aifabrix protection validate

```bash
aifabrix protection validate hubspot-companies
aifabrix protection validate hubspot-companies --simulate --warnings-as-errors
aifabrix protection validate hubspot-companies --json
```

### aifabrix protection upload

```bash
aifabrix protection upload hubspot-companies
aifabrix protection upload hubspot-companies --dry-run
aifabrix protection upload hubspot-companies --no-sync
```

### aifabrix protection list

```bash
aifabrix protection list
aifabrix protection list --page 1 --page-size 50
aifabrix protection list --filter enabled:eq:true
aifabrix protection list --json
```

Lists manifests registered on the dataplane (not files under `{work}/.protection/`).

### aifabrix protection show

```bash
aifabrix protection show hubspot-companies
aifabrix protection show hubspot-companies -v --json
```

Shows **effective** grant value types from the dataplane (from catalog `valueType`, not manifest overrides unless dimension mode is `both`).

### aifabrix protection delete

```bash
aifabrix protection delete hubspot-companies
aifabrix protection delete hubspot-companies --yes
```

Removes deployed protection and lineage-generated grants/values. Does not delete datasource records or local files under `.protection/`.

---

## Flags

| Flag | Effect |
| ---- | ------ |
| `--type` | Preset scaffold type for `protection create` |
| `--dimension-key` | Override or supply the dimension for `protection create` |
| `--field` | Metadata field override for preset value templates |
| `--warnings-as-errors` | Dataplane validate/simulate treats WARN as blocking |
| `--simulate` | Run projection sample after validate passes |
| `--dry-run` | Validate only; no upload or delete |
| `--no-sync` | Skip datasource sync after upload (protection still active) |
| `--json` | Machine-readable output on stdout |
| `-v` | Extra task/grant detail |

---

## Troubleshooting

- **Unknown dimension** — create the dimension with the right `valueType` in [dimensions](dimensions.md) before uploading protection.
- **Datasource not found on upload** — run `aifabrix deploy <app>` so the datasource exists on the dataplane.
- **Zero projected grants** — datasource may have no synced records yet; run or wait for a datasource sync after upload.
