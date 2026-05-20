# Governance scenario acceptance

← [Commands index](README.md)

Run **governance scenario packs** to prove ABAC and protection visibility without logging in as every subject user or printing record payloads in the terminal.

This command is **separate from** [`test-e2e`](external-integration-testing.md): `test-e2e` exercises vendor connectivity, sync, and CIP; **`test-governance`** proves which record **keys** each subject can see after ABAC.

## Prerequisites

- Log in: `aifabrix login` (or valid token in config).
- Operator role with **governance:evaluate** (platform admin, security admin, or developer — see [permissions](permissions.md)). After adding this permission to RBAC, re-login or use a role that includes it.
- External system published to the dataplane (`integration/<systemKey>/`).
- **Baseline data loaded** (not performed by this command): see [protection-test README](../../../aifabrix-dataplane/integration/protection-test/README.md) — upload system, **protection upload before or re-load after upload** (so dimension grants project), `datasource load`, identity sync for scenario subject users.

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
| `--no-sync` | Skip upload before run (same idea as test-e2e) |
| `-v, --verbose` | Per-scenario verdict, subject, counts; still no record bodies |
| `--json` | Redacted JSON only (keys, counts, verdict, fixHint, auditRef) |

### Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | All scenarios passed |
| 1 | One or more scenario failures |
| 3 | Auth failure, dataplane unreachable, or invalid/missing pack |

## Examples

```bash
aifabrix test-governance protection-test
aifabrix test-governance protection-test --pack scenarios/protection-test-v1.yaml -v
aifabrix test-governance protection-test --no-sync --scenario country-isolation-maria-fi
aifabrix test-governance protection-test --json
```

## Scenario packs

Packs live under `integration/<systemKey>/scenarios/` as versioned acceptance contracts. Each scenario names a **subject user id**, datasource scope, and **must include / must exclude** sync record keys.

Copy `integration/protection-test/scenarios/` as a template when authoring packs for your system.

## What this does not do

- Does **not** merge with `test-e2e` or `test-trust`.
- Does **not** auto-run `datasource load` (run baseline load explicitly in CI or locally).
- Does **not** print full record metadata in TTY or `--json` output.

For explain traces or MCP parity, use dataplane internal tests or future `--debug` (operator-only), not the default CLI surface.
