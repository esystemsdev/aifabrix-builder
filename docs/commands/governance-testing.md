# Governance scenario acceptance

← [Documentation index](../README.md) · [Commands index](README.md) · [External integration testing](external-integration-testing.md)

Run **governance scenario packs** to prove ABAC and protection visibility without logging in as every subject user or printing record payloads in the terminal.

This command is **separate from** [`test-e2e`](external-integration-testing.md): `test-e2e` exercises vendor connectivity, sync, and CIP; **`test-governance`** proves which record **keys** each subject can see after ABAC.

---

## Prerequisites

- Log in: `aifabrix login` (or valid token in config).
- Operator role with **governance:evaluate** (platform admin, security admin, or developer — see [permissions](permissions.md)). After adding this permission to RBAC, re-login or use a role that includes it.
- External system folder on disk: `integration/<systemKey>/`, published to the dataplane (e.g. `aifabrix upload <systemKey>`).

### Baseline data (you run this; not part of `test-governance`)

The command does **not** load fixtures or identity for you. Complete this order using **only** builder CLI docs:

1. [Identity management](identity-management.md) — create or `identity apply` users/groups for every **subject user id** named in your scenario pack, then `identity sync -e <env>`.
2. [Protection](protection.md) — `protection upload <datasourceKey>` (upload protection **before** or re-run load **after** upload so dimension grants project).
3. [External integration testing](external-integration-testing.md) — `aifabrix datasource load <datasourceKey>` for seed records referenced in scenarios.
4. Optional: `aifabrix test` / `aifabrix datasource test-e2e` to confirm connectivity before governance.

Keep scenario packs and fixture CSV under **your** `integration/<systemKey>/` tree (e.g. `scenarios/`, `fixtures/`). Do not depend on paths inside other product repositories.

---

## Command

```bash
aifabrix test-governance <systemKey> [options]
```

### Options

| Flag | Purpose |
| ---- | ------- |
| `--pack <path>` | Scenario pack YAML under the integration folder (default: `scenarios/default.yaml` or `scenarios/<systemKey>-v1.yaml`) |
| `-a, --app <path>` | Override integration folder |
| `-e, --env <env>` | Environment (`dev`, `tst`, `pro`) |
| `--scenario <id>` | Repeatable; run only these scenario ids |
| `--no-sync` | Skip upload before run (same idea as `test-e2e`) |
| `-v, --verbose` | Per-scenario verdict, subject, counts; still no record bodies |
| `--json` | Redacted JSON only (keys, counts, verdict, fixHint, auditRef) |

### Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | All scenarios passed |
| 1 | One or more scenario failures |
| 3 | Auth failure, dataplane unreachable, or invalid/missing pack |

---

## Examples

```bash
aifabrix test-governance <systemKey>
aifabrix test-governance <systemKey> --pack scenarios/<systemKey>-v1.yaml -v
aifabrix test-governance <systemKey> --no-sync --scenario <scenario-id>
aifabrix test-governance <systemKey> --json
```

---

## Scenario packs

Packs live under `integration/<systemKey>/scenarios/` as versioned acceptance contracts. Each scenario names a **subject user id**, datasource scope, and **must include / must exclude** sync record keys.

To author a new pack:

1. Create `integration/<systemKey>/scenarios/<name>.yaml`.
2. Copy structure from an existing pack in the same folder after `aifabrix download <systemKey>`, or from a teammate’s integration repo (not from private monorepo paths in documentation).
3. Align subject ids with users you provisioned via [Identity management](identity-management.md).

---

## What this does not do

- Does **not** merge with `test-e2e` or `test-trust`.
- Does **not** auto-run `datasource load` (run baseline load explicitly in CI or locally).
- Does **not** print full record metadata in TTY or `--json` output.

For explain traces or MCP parity, use operator-only diagnostics your platform exposes, or future `--debug` on this command—not the default CLI surface.

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Not authenticated | `aifabrix login`, `aifabrix auth status` |
| Permission denied | Role needs `governance:evaluate`; see [permissions](permissions.md) |
| No scenario pack found | Add `scenarios/default.yaml` or `scenarios/<systemKey>-v1.yaml`, or pass `--pack` |
| Subject not found | User id in pack must exist on controller; run [identity sync](identity-management.md) |
| All scenarios fail visibility | Re-check protection upload, `datasource load`, and record keys in the pack |
| Stale config on dataplane | Omit `--no-sync` so local `integration/<systemKey>/` uploads before the run |

---

## See also

- [External integration testing](external-integration-testing.md) — `test`, `test-integration`, `test-e2e`, audit verification
- [Identity management](identity-management.md) — Users, groups, CSV apply, dataplane sync
- [Protection](protection.md) — Manifests and upload
- [Permissions](permissions.md) — `governance:evaluate` and related scopes
- [External Integration Commands](external-integration.md) — Upload and datasource commands
