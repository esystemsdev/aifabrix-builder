# CLI output profile matrix (one line per leaf command)

Format: `aifabrix <path> | <output profile>`

Profiles: **layout-blocks** (header/status/list/helpers); **tty-summary** (chalk one-liners / tables); **stream-logs** (tail-style); **json-opt** (`--json` skips TTY layout); **stdout-only** (path/plain for scripts); **delegate** (mostly delegated lib output).

## Execution column (plan 146)

Whether the command needs Docker, only local filesystem/secrets, and/or logged-in controller/dataplane HTTP for its primary outcome.

| Code | Meaning |
| ---- | ------- |
| **local** | No Docker required for primary outcome |
| **docker** | Requires Docker daemon / containers |
| **online** | Requires login + controller/dataplane HTTP |
| **local+docker** | Local files/config then Docker (e.g. build, run) |
| **local+online** | Local manifest/files + authenticated API |

**resolve:** **local** under `integration/<systemKey>/`; **docker** for `keycloak`, `miso-controller`, `dataplane`, and other `builder/<appKey>/`.

## Manifest roots column (plan 141)

Third column documents **which on-disk trees** a command is expected to use for **`application.yaml` / integration manifest** discovery after [.cursor/plans/141-manifest-location.plan.md](../plans/141-manifest-location.plan.md) lands. Until implementation ships, treat as **spec / contract**.

| Code | Meaning |
| ---- | ------- |
| **141** | Canonical resolver: `cwd/integration/<system>` → `cwd/builder/<app>` → **`(aifabrix-work if set, else aifabrix-home)/builder/<app>`** (resolved **`aifabrix-work`** / **`AIFABRIX_WORK`** first, else **`aifabrix-home`** / **`AIFABRIX_HOME`** / default `~/.aifabrix`, e.g. `/workspace/.aifabrix`) **only** for `keycloak` \| `miso-controller` \| `dataplane`. Emit gray **Manifest:** line when a file is picked (see plan). |
| **141+** | Same as **141** plus auxiliary reads (e.g. deploy JSON, secrets path). **`aifabrix setup`:** when warning about replacing platform apps, list **absolute** paths for each `keycloak` / `miso-controller` / `dataplane` directory under the detected builder root (see plan 141 § Guided setup — today only `builder/<app>/` is shown). **Plan 147:** infra-running menu is **three** modes only (re-install, wipe data, update images); all paths run Docker **image pull** before `up-infra`. Persists **`platform-controller`** in `config.yaml` (absolute Miso URL). **Platform Ready** footer **Miso Controller** line uses `platform-controller` / declarative resolve (not localhost-only default). When a stored **device** token matches that URL, setup **`up-platform --force`** skips clearing device tokens and guided auth may skip redundant login (no “cleared N device token(s)” line). |
| **int** | Primary path is **integration/** (external system / datasource); plan 141 Tier 1a emphasis. |
| **cfg** | Config / controller only (`config.yaml`, auth); no app `application.yaml` for primary outcome. |
| **—** | No application manifest disk discovery on the primary path (or delegate / stdout-only with no manifest UX). |

| Command | Profile | Execution (146) | Manifest roots (141) |
| ------- | ------- | ----------------- | -------------------- |
| aifabrix login | tty-summary | local | cfg |
| aifabrix logout | tty-summary | local | cfg |
| aifabrix auth | tty-summary (`--set-controller [url]`: omit URL to pick from controllers stored under `device` + `controller` in config) | local | cfg |
| aifabrix auth status | tty-summary (header + token + dataplane block; plan 142.0 adds version subsection — `Dataplane version`, `Min Builder CLI`, `This CLI`, `Compatibility: ✔ OK / Not enforced / ✖ Upgrade required` — and on mismatch the red blocking line + `Next actions:` block. `--validate` exit codes: `0` ok, `1` not authenticated, `3` CLI < dataplane min) | local | cfg |
| aifabrix setup | tty-summary + stream-logs (3-mode menu when infra up; image pull all paths; **Platform Ready** shows resolved **platform-controller**; session-aware auth — see **141+** plan 147) | local+docker | 141+ |
| aifabrix teardown | tty-summary + stream-logs | local+docker | cfg |
| aifabrix up-infra | tty-summary + stream-logs | docker | cfg |
| aifabrix up-platform | tty-summary + stream-logs | docker | 141+ |
| aifabrix up-miso | tty-summary + stream-logs | docker | 141+ |
| aifabrix up-dataplane | tty-summary + stream-logs | docker | 141+ |
| aifabrix down-infra | tty-summary + stream-logs | docker | cfg |
| aifabrix doctor | tty-summary | local | cfg |
| aifabrix status | tty-summary | local+docker | cfg |
| aifabrix restart | tty-summary (Restart + `Infra service:` or `Application:` + optional progress + success; builder apps add `docker inspect` `/app` bind hint, then **Reload (config)** from `applications.<app>.reload`) | local+docker | 141 |
| aifabrix create | tty-summary | local | 141 |
| aifabrix wizard | delegate | local | int |
| aifabrix run | tty-summary (header + progress + footer; flags `--reload`, `--proxy` default on / `--no-proxy` → save `applications.<app>.proxy: false`) + stream-logs (health/ora); **integration / `app.type: external`:** warning + **Next actions:** `upload` / `deploy` (not `build`); public URL hints only when user `traefik: true`, app `frontDoorRouting.enabled`, CLI proxy on, and `applications.<app>.proxy` is true (default false; legacy `noProxy` migrated) | local+docker | 141+ |
| aifabrix build | tty-summary (header + paths + secrets lines) + stream-logs (docker/ora) | local+docker | 141+ |
| aifabrix logs | stream-logs | docker | — |
| aifabrix down-app | tty-summary + stream-logs | local+docker | 141 |
| aifabrix stop | tty-summary | local+docker | 141 |
| aifabrix shell | stream-logs | local+docker | 141 |
| aifabrix dockerfile | tty-summary | local+docker | 141 |
| aifabrix push | tty-summary + stream-logs | local+docker | 141+ |
| aifabrix deploy | tty-summary + stream-logs | local+docker | 141+ |
| aifabrix test | stream-logs | local+docker | 141 |
| aifabrix install | stream-logs | local+docker | 141 |
| aifabrix test-e2e | layout-blocks | local+online | int |
| aifabrix test-trust | layout-blocks | local+online | int |
| aifabrix test-governance | layout-blocks | local+online | int |
| aifabrix lint | stream-logs | local | — |
| aifabrix download | tty-summary | local+online | int |
| aifabrix upload | tty-summary | local+online | int |
| aifabrix delete | tty-summary | local+online | int |
| aifabrix test-integration | layout-blocks | local+online | int |
| aifabrix env deploy | tty-summary + stream-logs | local+docker | 141+ |
| aifabrix resolve | tty-summary | local† / docker‡ | 141+ |
| aifabrix json | stdout-only / tty-summary | local | 141 |
| aifabrix split-json | tty-summary | local | 141 |
| aifabrix repair | tty-summary | local | 141+ |
| aifabrix convert | tty-summary | local | 141+ |
| aifabrix show | tty-summary | local | 141+ |
| aifabrix validate | tty-summary | local | 141+ |
| aifabrix diff | stdout-only | local | int |
| aifabrix credential env | tty-summary | local | cfg |
| aifabrix credential push | tty-summary | local | cfg |
| aifabrix credential list | tty-summary | local | cfg |
| aifabrix deployment list | tty-summary | local | cfg |
| aifabrix integration-client create | tty-summary | local | cfg |
| aifabrix integration-client list | tty-summary | local | cfg |
| aifabrix integration-client rotate-secret | tty-summary | local | cfg |
| aifabrix integration-client delete | tty-summary | local | cfg |
| aifabrix integration-client update-groups | tty-summary | local | cfg |
| aifabrix integration-client update-redirect-uris | tty-summary | local | cfg |
| aifabrix datasource validate | layout-blocks | local+online | int |
| aifabrix datasource capability copy | tty-summary | local+online | int |
| aifabrix datasource capability remove | tty-summary | local+online | int |
| aifabrix datasource capability create | tty-summary | local+online | int |
| aifabrix datasource capability validate | layout-blocks | local+online | int |
| aifabrix datasource capability diff | stdout-only | local+online | int |
| aifabrix datasource capability edit | tty-summary | local+online | int |
| aifabrix datasource capability relate | tty-summary | local+online | int |
| aifabrix datasource capability dimension | tty-summary | local+online | int |
| aifabrix datasource list | tty-summary | local+online | int |
| aifabrix datasource diff | stdout-only | local+online | int |
| aifabrix datasource upload | layout-blocks | local+online | int |
| aifabrix datasource test | layout-blocks | local+online | int |
| aifabrix datasource test-integration | layout-blocks | local+online | int |
| aifabrix datasource test-e2e | layout-blocks | local+online | int |
| aifabrix datasource verify-audit | layout-blocks | local+online | int |
| aifabrix datasource test-trust | layout-blocks | local+online | int |
| aifabrix datasource load | layout-blocks + json-opt | local+online | int |
| aifabrix datasource export | layout-blocks + json-opt | local+online | int |
| aifabrix datasource log-test | tty-summary | local | int |
| aifabrix datasource log-integration | tty-summary | local | int |
| aifabrix datasource log-e2e | tty-summary | local | int |
| aifabrix datasource log-trust | tty-summary | local | int |
| aifabrix datasource clean-logs | tty-summary + json-opt | local | int |
| aifabrix dimension create | tty-summary | local | cfg |
| aifabrix dimension get | tty-summary | local | cfg |
| aifabrix dimension list | tty-summary | local | cfg |
| aifabrix identity user create | tty-summary | local | cfg |
| aifabrix identity user list | tty-summary | local | cfg |
| aifabrix identity user get | tty-summary | local | cfg |
| aifabrix identity user groups | tty-summary | local | cfg |
| aifabrix identity group create | tty-summary | local | cfg |
| aifabrix identity group list | tty-summary | local | cfg |
| aifabrix identity group get | tty-summary | local | cfg |
| aifabrix identity group members | tty-summary | local | cfg |
| aifabrix identity membership add | tty-summary | local | cfg |
| aifabrix identity membership remove | tty-summary | local | cfg |
| aifabrix identity role list | tty-summary | local | cfg |
| aifabrix identity role set-groups | tty-summary | local | cfg |
| aifabrix identity cache clear | tty-summary | local | cfg |
| aifabrix identity cache invalidate | tty-summary | local | cfg |
| aifabrix identity apply | tty-summary + stdout-only (--dry-run) | local | cfg |
| aifabrix identity sync | tty-summary | local | cfg |
| aifabrix protection validate | layout-blocks + json-opt | local | int |
| aifabrix protection create | tty-summary + stdout-only (--dry-run) | local | int |
| aifabrix protection upload | layout-blocks + tty-summary | local+online | int |
| aifabrix protection list | tty-summary (card list per manifest) + json-opt | local | int |
| aifabrix protection show | tty-summary + json-opt | local | int |
| aifabrix protection delete | tty-summary | local | int |
| aifabrix validate .protection | layout-blocks + json-opt | local | int |
| aifabrix upload .protection | layout-blocks + json-opt | local+online | int |
| aifabrix convert .protection | tty-summary | local | int |
| aifabrix deploy .protection | blocking error | local+docker | int |
| aifabrix dimension value create | tty-summary | local | cfg |
| aifabrix dimension value list | tty-summary | local | cfg |
| aifabrix dimension value delete | tty-summary | local | cfg |
| aifabrix dev show | tty-summary | local | cfg |
| aifabrix dev set-id | tty-summary | local | cfg |
| aifabrix dev set-scoped-resources | tty-summary | local | cfg |
| aifabrix dev set-home | tty-summary | local | cfg |
| aifabrix dev set-work | tty-summary | local | cfg |
| aifabrix dev print-home | stdout-only | local | cfg |
| aifabrix dev print-work | stdout-only | local | cfg |
| aifabrix dev shell-env | stdout-only | local | cfg |
| aifabrix dev set-format | tty-summary | local | cfg |
| aifabrix dev init | tty-summary + stream-logs | local | cfg |
| aifabrix dev refresh | tty-summary | local | cfg |
| aifabrix dev list | tty-summary | local | cfg |
| aifabrix dev add | tty-summary | local | cfg |
| aifabrix dev update | tty-summary | local | cfg |
| aifabrix dev pin | tty-summary | local | cfg |
| aifabrix dev delete | tty-summary | local | cfg |
| aifabrix dev down | tty-summary | local | cfg |
| aifabrix secret list | tty-summary | local | cfg |
| aifabrix secret set | tty-summary | local | cfg |
| aifabrix secret remove | tty-summary | local | cfg |
| aifabrix secret remove-all | tty-summary | local | cfg |
| aifabrix secret validate | tty-summary | local | cfg |
| aifabrix secret set-secrets-file | tty-summary | local | cfg |
| aifabrix secure | tty-summary | local | cfg |
| aifabrix parameters validate | tty-summary | local | cfg |
| aifabrix app register | tty-summary | local+docker | 141+ |
| aifabrix app list | tty-summary | local+online | cfg |
| aifabrix app rotate-secret | tty-summary | local+docker | 141+ |
| aifabrix app show | json-opt | local+docker | 141+ |
| aifabrix app deployment | tty-summary | local+online | cfg |

_**validate** (human TTY): `lib/validation/validate-display.js` + `lib/utils/cli-test-layout-chalk.js` — bold white section titles, datasource rows via `formatDatasourceListRow`, canonical glyphs (✔ ✖ ⚠ ⏭) per [layout.md](./layout.md)._

_Certification-related flags (output profile unchanged): `validate --cert-sync`; `show` / `app show --verify-cert`; `datasource test|test-integration|test-e2e` and `test-integration` / `test-e2e` with `--no-cert-sync`._

_**Datasource log-\*** (local, no dataplane): `log-test` → `test-*.json`; `log-integration` → `test-integration-*.json`; `log-e2e` → `test-e2e-*.json`; `log-trust` → `test-trust-*.json` (from matching `test-*` command with `--debug`). **`clean-logs`** deletes those files (`--type` filter, `--dry-run`, `--all`)._

_Generated for adoption tracking; see `.cursor/plans/Done/129-cli_layout_adoption.plan.md` and [layout.md](./layout.md)._

**Docker image flags (profiles unchanged):** `build` / `run` support `--base` and single `-t, --tag`; `up-platform`, `up-miso`, and `up-dataplane` default `--base` true (use `--no-base` for dev-first local image preference when running platform apps).

## Layout compliance (helpers + audit)

- **Source of truth:** [layout.md](./layout.md) and [cli-layout.mdc](./cli-layout.mdc) — glyphs **✔ ✖ ⚠ ⏭**, semantic colors, **`formatNextActions`** / **`formatBulletSection`**-style sections where applicable.
- **Manifest line (plan 141):** For rows tagged **141** / **141+** / **int**, when the command reads an app or integration manifest, emit one gray **Manifest:** metadata line (`metadata()` / shared helper) with absolute path + tier — see [.cursor/plans/141-manifest-location.plan.md](../plans/141-manifest-location.plan.md). **json-opt** / **stdout-only**: omit decorative line or add machine field per plan phase.
- **`dimension` create/get/list:** TTY must show **`valueType`** when present (`Value type:` on get; **VType** column on list; create success line includes valueType).
- **`identity`*** (405.1): Controller-only (`cfg`); **`apply`** prints phase summary (groups/users/memberships) + optional sync/cache lines; **`--dry-run`** stdout-only plan (no HTTP); **`--purge-cache`** on apply/sync runs cache clear before sync when set.
- **`protection`*** (plan 141 + 145): use **`lib/protection/protection-display.js`** + **`cli-test-layout-chalk`**; `--json` stdout-only; manifests under **`integration/.protection/`** at repo root (legacy `{work}/.protection/` when `AIFABRIX_PROTECTION_LEGACY=1` or empty repo folder).
- **`datasource capability`** (`copy` | `remove` | `create` | `edit` | `validate` slice OK): success sections use **`lib/utils/cli-test-layout-chalk.js`** (`formatBulletSection`, `formatNextActions`, `formatSuccessLine`, `headerKeyValue`, `infoLine`, `metadata`); errors use **`formatBlockingError`**.
- **`datasource capability diff`:** stdout-only structural diff from **`lib/core/diff`** (minimal chalk); unchanged.
- **Backlog (incremental):** Remaining raw **`chalk.green`** success lines (outside `cli-test-layout-chalk`), and any future drift from canonical glyphs (**✔ ✖ ⚠ ⏭**). Wizard (`\\u2713`), `dev-*`, `secure`, guided infra TLS flag, deploy status, and local external test TTY rows have been migrated to shared helpers.
