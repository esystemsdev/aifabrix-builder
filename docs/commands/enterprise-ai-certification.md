# Enterprise AI Certification (CLI)

← [Documentation index](../README.md) · [Commands index](README.md) · [External Integration Testing](external-integration-testing.md)

Product-facing commands that prove an external integration is **operationally ready**, **agent-trustworthy**, and **governed**, then print an **Enterprise AI certification report**. Use these after `aifabrix upload <systemKey>` and before promoting via `aifabrix deploy`.

**Recommended order:**

```bash
aifabrix upload <systemKey>
aifabrix verify-operations <systemKey>
aifabrix verify-trust <systemKey>
aifabrix verify-governance <systemKey>
aifabrix lifecycle <systemKey>
```

Low-level commands (`validate`, `test`, `test-integration`, `test-e2e`) remain for step-by-step debugging.

---

## Shared conventions

| Flag | Meaning |
| --- | --- |
| `-e, --env <env>` | Environment label: `dev`, `tst`, or `pro` (default `dev`) |
| `-v, --verbose` | Extra breakdown in human output (and richer JSON when combined with `--json`) |
| `-d, --debug` | Write debug logs under `integration/<systemKey>/logs/` where supported |
| `--no-sync` | Skip publishing local integration files before the run (default is sync-on-run) |
| `--force` | With default sync, pass `--force` to upload (same as `aifabrix upload --force`) |
| `--json` | Machine-readable envelope on stdout (no decorative TTY layout) |

**Sync behavior:** `verify-operations`, `verify-trust`, and `verify-governance` publish local files before their dataplane steps unless you pass **`--no-sync`**. With **`lifecycle --run`**, sync runs by default before missing verify steps; use **`--no-sync`** to skip. Report-only **`lifecycle`** (without `--run`) never uploads.

**Verbose vs upload detail:** `-v` on verify commands controls **final report output**, not upload banners or sidecar logs. For upload server validation warnings, use **`aifabrix upload -v`**.

---

<a id="aifabrix-verify-operations-systemkey"></a>
## aifabrix verify-operations `<systemKey>`

**What:** Orchestrates **validate → test → test-integration → test-e2e** for every datasource under `integration/<systemKey>/`.

**When:** First certification pillar — proves connectivity, dataplane acceptance, and live external behavior.

**Usage:**

```bash
aifabrix verify-operations hubspot
aifabrix verify-operations hubspot -v
aifabrix verify-operations hubspot -v -d
aifabrix verify-operations hubspot --no-sync
aifabrix verify-operations hubspot --json
```

**Options:**

- `-v, --verbose` — Operational readiness breakdown and verification step checklist at the end
- `-d, --debug` — Debug logs under `integration/<systemKey>/logs/` for failing steps
- `--no-sync` — Skip pre-run upload
- `--force` — With default sync, force upload republish
- `--continue` — Continue after a failed step (verdict still reports FAILED)
- `--json` — Product envelope with optional breakdown when `-v` is set

**Done when:** TTY shows **OPERATIONS VERIFIED** (or you can name the failing sub-step from `-v` output).

---

<a id="aifabrix-verify-trust-systemkey"></a>
## aifabrix verify-trust `<systemKey>`

**What:** Semantic **business metadata** trust for AI agents on every datasource. Does **not** call vendor APIs.

**When:** After local structure passes and before or alongside E2E when agent metadata matters.

**Usage:**

```bash
aifabrix verify-trust hubspot
aifabrix verify-trust hubspot -v --revalidate
aifabrix verify-trust hubspot --no-sync
aifabrix datasource verify-trust hubspot-companies --app hubspot -v
```

**Options:** Shared flags above plus **`--revalidate`**, **`--timeout <ms>`** (default 120000). See [Semantic trust](external-integration-testing.md#semantic-trust-aifabrix-verify-trust) for trust-specific flags (`--strict`, `--warnings-as-errors`, `--summary`).

---

<a id="aifabrix-verify-governance-systemkey"></a>
## aifabrix verify-governance `<systemKey>`

**What:** Governance scenario acceptance — ABAC visibility per subject (record keys only). Default path uses scenario packs on the dataplane after **`aifabrix upload`**.

**When:** After identity sync, protection upload, and fixture load for your scenario pack.

**Usage:**

```bash
aifabrix verify-governance hubspot
aifabrix verify-governance hubspot -v
aifabrix verify-governance hubspot --no-sync
aifabrix verify-governance hubspot --pack scenarios/custom.yaml -v
```

**Options:** Shared flags above plus **`--pack`**, **`--scenario <id>`** (repeatable), **`-a, --app`**. See [Governance testing](governance-testing.md).

---

<a id="aifabrix-lifecycle-systemkey"></a>
## aifabrix lifecycle `<systemKey>`

**What:** **Certification report** — executive summary of operations, trust, and governance pillars from persisted dataplane results.

**When:** Default is **report only** (read persisted results). Use **`--run`** to execute missing verify steps, then print the report.

**Usage:**

```bash
# Report only (GET persisted results)
aifabrix lifecycle hubspot
aifabrix lifecycle hubspot -v

# Run missing verify steps, sync local files, then report
aifabrix lifecycle hubspot --run
aifabrix lifecycle hubspot --run --no-sync
aifabrix lifecycle hubspot --run -v -d
aifabrix lifecycle hubspot --json
```

**Options:**

- `-v, --verbose` — Per-datasource breakdown in the report
- `-d, --debug` — Debug logs under `integration/<systemKey>/logs/` when **`--run`** invokes verify steps
- `--run` — Run missing verify pillars, then print certification report
- `--no-sync` — With **`--run`**, skip publish before verify (default sync when `--run` is set)
- `--force` — With default sync on **`--run`**, force upload republish
- `--json` — Certification envelope; includes `datasources` when `-v` is set

**Not a validator by default:** Without **`--run`**, `lifecycle` does not re-execute tests — it reads what is already stored. Tier is never inflated; incomplete pillars show **NOT VERIFIED** with actionable recommendations.

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Pillar NOT VERIFIED | Run the matching `verify-*` command; fix findings; re-run `lifecycle -v` |
| Stale dataplane config | Omit **`--no-sync`** so local files upload first |
| Governance NOT VERIFIED | Upload scenario packs (`aifabrix upload`); run identity sync and protection upload per your pack README |
| Operations sub-step failed | `verify-operations -v` names the step; rerun that low-level command with `-d -v` |
| Report-only gaps after manual fixes | `lifecycle --run -v` to fill missing pillars and refresh |

---

## Related topics

- [External Integration Testing](external-integration-testing.md) — Unit, integration, E2E, and semantic trust layers
- [Governance testing](governance-testing.md) — Scenario packs and `verify-governance`
- [Certification and trust (CLI)](certification-and-trust.md) — Local `certification` section sync in system files
- [Online Commands and Permissions](permissions.md) — Scopes for verify and lifecycle commands
- [External system lifecycle commands](external-integration/system-lifecycle.md) — Wizard, upload, download, delete
