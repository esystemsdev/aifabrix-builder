# Protection

← [Documentation index](../README.md) · [Commands index](README.md)

Manage **protection manifests** that project principal-to-dimension grants during datasource sync. Manifests live in **`integration/.protection/`** at the repo root (sibling to `integration/<systemKey>/`, intended for git).

---

## Prerequisites

1. **Authentication** — Run `aifabrix login` for the target environment, **or** configure app client credentials for CI/CD (see [CI/CD](#cicd-non-interactive) below).
2. Deploy the external datasource first: `aifabrix deploy <appKey>` (e.g. HubSpot, SharePoint).
3. Define dimensions in the catalog with the correct **value type** — see [Dimensions](dimensions.md#value-type-valuetype).

---

## CI/CD (non-interactive)

<a id="cicd-non-interactive"></a>

Protection commands that call the dataplane use the **same deployment auth** as `aifabrix upload` and `aifabrix datasource test-e2e`: the CLI never sends raw client id/secret to the dataplane. It sends either:

- a **user token** from `aifabrix login` (`Authorization: Bearer`), or
- an **application token** obtained by exchanging the integration app’s client credentials (`x-client-token` header).

That makes protection suitable for pipelines and automation without an interactive login on the runner.

### What works in CI/CD

| Command | Dataplane | Controller |
| ------- | --------- | ------------ |
| `protection validate` | Yes | — |
| `protection upload` | Yes | — |
| `upload .protection` / `validate .protection` | Yes | — |
| `protection list` / `show` / `delete` | Yes | — |
| `protection create` | Yes (datasource probe) | Yes (dimension probe) |

Required scopes are listed in [Permissions](permissions.md) (`external-system:read`, `external-system:publish`, `external-system:delete` as applicable).

### Configure credentials on the runner

1. Register the dataplane (or integration) app in the target environment if needed: `aifabrix app register <appKey>`.
2. Store **client id** and **client secret** where the CLI can read them:
   - `~/.aifabrix/secrets.local.yaml` keys `<appKey>-client-idKeyVault` and `<appKey>-client-secretKeyVault`, or
   - environment variables `CLIENTID` / `CLIENTSECRET` (or `CLIENT_ID` / `CLIENT_SECRET`) when the job loads an integration `.env`.
3. Set **controller** and **environment** in `~/.aifabrix/config.yaml` (or pass `-e` / use the same config the job copies into the workspace).
4. Run protection commands; the CLI exchanges credentials for an application token and calls the dataplane with **x-client-token**.

For token lifecycle and login alternatives, see [Authentication](authentication.md) and [Deployment](deployment.md) (token-only auth for dataplane calls).

### Example pipeline steps

Validate and upload one datasource after the external system is already deployed:

```bash
aifabrix protection validate hubspot-companies --warnings-as-errors
aifabrix protection upload hubspot-companies --no-sync
```

Batch upload every manifest under `integration/.protection/`:

```bash
aifabrix validate .protection --warnings-as-errors
aifabrix upload .protection
```

Use `--json` on validate/list/show when the job must parse results. Use `--dry-run` on upload to fail the job on validation errors without mutating deployed protection.

---

## Where files live

```text
integration/.protection/
  hubspot-companies.yaml          # preferred: <datasourceKey>.yaml|.json
  hubspot-companies.json          # same key; format from `aifabrix dev set-format` on create
  hubspot-protection-deals.yaml   # optional naming pattern
```

Each file protects exactly one **datasource key** (`spec.datasourceKey`). The CLI argument is that key (e.g. `hubspot-companies`), not the integration app key. Manifests may be **YAML or JSON** (no secrets in git — use expressions only).

---

## Workflow

0. **Create** (optional) — probe deployed datasource + catalog dimension, then write a starter manifest under `integration/.protection/`  
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

Scaffolds `integration/.protection/<datasourceKey>.{yaml|json}` after **online checks** (extension follows CLI config format preference):

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

Lists manifests registered on the dataplane (not on-disk files under `integration/.protection/`).

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

## Environment overrides

| Variable | Effect |
| -------- | ------ |
| `AIFABRIX_PROTECTION_ROOT` | Force an absolute protection manifest directory (overrides default resolution). |
| `AIFABRIX_PROTECTION_LEGACY=1` | Use legacy `{work}/.protection/` under the materialization parent instead of `integration/.protection/`. |

When the repo `integration/.protection/` folder is empty but legacy `{work}/.protection/` still has manifests, the CLI uses legacy and prints a migration hint. Move files into `integration/.protection/` to version them with your integration repo.

---

## See also

- [Permissions](permissions.md) — scopes per protection command and auth options.
- [Authentication](authentication.md) — login, client tokens, and secrets layout.
- [Dimensions](dimensions.md) — catalog `valueType` for grants and `protection create`.

---

## Troubleshooting

- **Invalid token / 401 in CI** — ensure client credentials are present (`secrets.local.yaml` or `CLIENTID`/`CLIENTSECRET`), controller URL and environment match the job, and the app is registered in that environment. See [CI/CD](#cicd-non-interactive).
- **Unknown dimension** — create the dimension with the right `valueType` in [dimensions](dimensions.md) before uploading protection.
- **Datasource not found on upload** — run `aifabrix deploy <app>` so the datasource exists on the dataplane.
- **Zero projected grants** — datasource may have no synced records yet; run or wait for a datasource sync after upload.
