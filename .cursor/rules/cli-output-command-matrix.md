# CLI output profile matrix (one line per leaf command)

Format: `aifabrix <path> | <output profile>`

Profiles: **layout-blocks** (header/status/list/helpers); **tty-summary** (chalk one-liners / tables); **stream-logs** (tail-style); **json-opt** (`--json` skips TTY layout); **stdout-only** (path/plain for scripts); **delegate** (mostly delegated lib output).

## Manifest roots column (plan 141)

Third column documents **which on-disk trees** a command is expected to use for **`application.yaml` / integration manifest** discovery after [.cursor/plans/141-manifest-location.plan.md](../plans/141-manifest-location.plan.md) lands. Until implementation ships, treat as **spec / contract**.

| Code | Meaning |
| ---- | ------- |
| **141** | Canonical resolver: `cwd/integration/<system>` → `cwd/builder/<app>` → **`(aifabrix-work if set, else aifabrix-home)/builder/<app>`** (resolved **`aifabrix-work`** / **`AIFABRIX_WORK`** first, else **`aifabrix-home`** / **`AIFABRIX_HOME`** / default `~/.aifabrix`, e.g. `/workspace/.aifabrix`) **only** for `keycloak` \| `miso-controller` \| `dataplane`. Emit gray **Manifest:** line when a file is picked (see plan). |
| **141+** | Same as **141** plus auxiliary reads (e.g. deploy JSON, secrets path). **`aifabrix setup`:** when warning about replacing platform apps, list **absolute** paths for each `keycloak` / `miso-controller` / `dataplane` directory under the detected builder root (see plan 141 § Guided setup — today only `builder/<app>/` is shown). |
| **int** | Primary path is **integration/** (external system / datasource); plan 141 Tier 1a emphasis. |
| **cfg** | Config / controller only (`config.yaml`, auth); no app `application.yaml` for primary outcome. |
| **—** | No application manifest disk discovery on the primary path (or delegate / stdout-only with no manifest UX). |

| Command | Profile | Manifest roots (141) |
| ------- | ------- | -------------------- |
| aifabrix login | tty-summary | cfg |
| aifabrix logout | tty-summary | cfg |
| aifabrix auth | tty-summary (`--set-controller [url]`: omit URL to pick from controllers stored under `device` + `controller` in config) | cfg |
| aifabrix auth status | tty-summary | cfg |
| aifabrix setup | tty-summary + stream-logs | 141+ |
| aifabrix teardown | tty-summary + stream-logs | cfg |
| aifabrix up-infra | tty-summary + stream-logs | cfg |
| aifabrix up-platform | tty-summary + stream-logs | 141+ |
| aifabrix up-miso | tty-summary + stream-logs | 141+ |
| aifabrix up-dataplane | tty-summary + stream-logs | 141+ |
| aifabrix down-infra | tty-summary + stream-logs | cfg |
| aifabrix doctor | tty-summary | cfg |
| aifabrix status | tty-summary | cfg |
| aifabrix restart | tty-summary (Restart + `Infra service:` or `Application:` + optional progress + success; builder apps add `docker inspect` `/app` bind hint, then **Reload (config)** from `applications.<app>.reload`) | 141 |
| aifabrix create | tty-summary | 141 |
| aifabrix wizard | delegate | int |
| aifabrix run | tty-summary (header + progress + footer; flags `--reload`, `--proxy` default on / `--no-proxy` → save `applications.<app>.proxy: false`) + stream-logs (health/ora); **integration / `app.type: external`:** warning + **Next actions:** `upload` / `deploy` (not `build`); public URL hints only when user `traefik: true`, app `frontDoorRouting.enabled`, CLI proxy on, and `applications.<app>.proxy` is true (default false; legacy `noProxy` migrated) | 141+ |
| aifabrix build | tty-summary (header + paths + secrets lines) + stream-logs (docker/ora) | 141+ |
| aifabrix logs | stream-logs | — |
| aifabrix down-app | tty-summary + stream-logs | 141 |
| aifabrix stop | tty-summary | 141 |
| aifabrix shell | stream-logs | 141 |
| aifabrix dockerfile | tty-summary | 141 |
| aifabrix push | tty-summary + stream-logs | 141+ |
| aifabrix deploy | tty-summary + stream-logs | 141+ |
| aifabrix test | stream-logs | 141 |
| aifabrix install | stream-logs | 141 |
| aifabrix test-e2e | layout-blocks | int |
| aifabrix lint | stream-logs | — |
| aifabrix download | tty-summary | int |
| aifabrix upload | tty-summary | int |
| aifabrix delete | tty-summary | int |
| aifabrix test-integration | layout-blocks | int |
| aifabrix env deploy | tty-summary + stream-logs | 141+ |
| aifabrix resolve | tty-summary | 141+ |
| aifabrix json | stdout-only / tty-summary | 141 |
| aifabrix split-json | tty-summary | 141 |
| aifabrix repair | tty-summary | 141+ |
| aifabrix convert | tty-summary | 141+ |
| aifabrix show | tty-summary | 141+ |
| aifabrix validate | tty-summary | 141+ |
| aifabrix diff | stdout-only | int |
| aifabrix credential env | tty-summary | cfg |
| aifabrix credential push | tty-summary | cfg |
| aifabrix credential list | tty-summary | cfg |
| aifabrix deployment list | tty-summary | cfg |
| aifabrix integration-client create | tty-summary | cfg |
| aifabrix integration-client list | tty-summary | cfg |
| aifabrix integration-client rotate-secret | tty-summary | cfg |
| aifabrix integration-client delete | tty-summary | cfg |
| aifabrix integration-client update-groups | tty-summary | cfg |
| aifabrix integration-client update-redirect-uris | tty-summary | cfg |
| aifabrix datasource validate | layout-blocks | int |
| aifabrix datasource capability copy | tty-summary | int |
| aifabrix datasource capability remove | tty-summary | int |
| aifabrix datasource capability create | tty-summary | int |
| aifabrix datasource capability validate | layout-blocks | int |
| aifabrix datasource capability diff | stdout-only | int |
| aifabrix datasource capability edit | tty-summary | int |
| aifabrix datasource capability relate | tty-summary | int |
| aifabrix datasource capability dimension | tty-summary | int |
| aifabrix datasource list | tty-summary | int |
| aifabrix datasource diff | stdout-only | int |
| aifabrix datasource upload | layout-blocks | int |
| aifabrix datasource test | layout-blocks | int |
| aifabrix datasource test-integration | layout-blocks | int |
| aifabrix datasource test-e2e | layout-blocks | int |
| aifabrix datasource log-e2e | tty-summary | int |
| aifabrix datasource log-integration | tty-summary | int |
| aifabrix dimension create | tty-summary | cfg |
| aifabrix dimension get | tty-summary | cfg |
| aifabrix dimension list | tty-summary | cfg |
| aifabrix dimension-value create | tty-summary | cfg |
| aifabrix dimension-value list | tty-summary | cfg |
| aifabrix dimension-value delete | tty-summary | cfg |
| aifabrix dev show | tty-summary | cfg |
| aifabrix dev set-id | tty-summary | cfg |
| aifabrix dev set-scoped-resources | tty-summary | cfg |
| aifabrix dev set-home | tty-summary | cfg |
| aifabrix dev set-work | tty-summary | cfg |
| aifabrix dev print-home | stdout-only | cfg |
| aifabrix dev print-work | stdout-only | cfg |
| aifabrix dev shell-env | stdout-only | cfg |
| aifabrix dev set-format | tty-summary | cfg |
| aifabrix dev init | tty-summary + stream-logs | cfg |
| aifabrix dev refresh | tty-summary | cfg |
| aifabrix dev list | tty-summary | cfg |
| aifabrix dev add | tty-summary | cfg |
| aifabrix dev update | tty-summary | cfg |
| aifabrix dev pin | tty-summary | cfg |
| aifabrix dev delete | tty-summary | cfg |
| aifabrix dev down | tty-summary | cfg |
| aifabrix secret list | tty-summary | cfg |
| aifabrix secret set | tty-summary | cfg |
| aifabrix secret remove | tty-summary | cfg |
| aifabrix secret remove-all | tty-summary | cfg |
| aifabrix secret validate | tty-summary | cfg |
| aifabrix secret set-secrets-file | tty-summary | cfg |
| aifabrix secure | tty-summary | cfg |
| aifabrix parameters validate | tty-summary | cfg |
| aifabrix app register | tty-summary | 141+ |
| aifabrix app list | tty-summary | cfg |
| aifabrix app rotate-secret | tty-summary | 141+ |
| aifabrix app show | json-opt | 141+ |
| aifabrix app deployment | tty-summary | cfg |

_**validate** (human TTY): `lib/validation/validate-display.js` + `lib/utils/cli-test-layout-chalk.js` — bold white section titles, datasource rows via `formatDatasourceListRow`, canonical glyphs (✔ ✖ ⚠ ⏭) per [layout.md](./layout.md)._

_Certification-related flags (output profile unchanged): `validate --cert-sync`; `show` / `app show --verify-cert`; `datasource test|test-integration|test-e2e` and `test-integration` / `test-e2e` with `--no-cert-sync`._

_Generated for adoption tracking; see `.cursor/plans/Done/129-cli_layout_adoption.plan.md` and [layout.md](./layout.md)._

**Docker image flags (profiles unchanged):** `build` / `run` support `--base` and single `-t, --tag`; `up-platform`, `up-miso`, and `up-dataplane` default `--base` true (use `--no-base` for dev-first local image preference when running platform apps).

## Layout compliance (helpers + audit)

- **Source of truth:** [layout.md](./layout.md) and [cli-layout.mdc](./cli-layout.mdc) — glyphs **✔ ✖ ⚠ ⏭**, semantic colors, **`formatNextActions`** / **`formatBulletSection`**-style sections where applicable.
- **Manifest line (plan 141):** For rows tagged **141** / **141+** / **int**, when the command reads an app or integration manifest, emit one gray **Manifest:** metadata line (`metadata()` / shared helper) with absolute path + tier — see [.cursor/plans/141-manifest-location.plan.md](../plans/141-manifest-location.plan.md). **json-opt** / **stdout-only**: omit decorative line or add machine field per plan phase.
- **`datasource capability`** (`copy` | `remove` | `create` | `edit` | `validate` slice OK): success sections use **`lib/utils/cli-test-layout-chalk.js`** (`formatBulletSection`, `formatNextActions`, `formatSuccessLine`, `headerKeyValue`, `infoLine`, `metadata`); errors use **`formatBlockingError`**.
- **`datasource capability diff`:** stdout-only structural diff from **`lib/core/diff`** (minimal chalk); unchanged.
- **Backlog (incremental):** Remaining raw **`chalk.green`** success lines (outside `cli-test-layout-chalk`), and any future drift from canonical glyphs (**✔ ✖ ⚠ ⏭**). Wizard (`\\u2713`), `dev-*`, `secure`, guided infra TLS flag, deploy status, and local external test TTY rows have been migrated to shared helpers.
