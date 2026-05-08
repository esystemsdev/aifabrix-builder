# CLI output profile matrix (one line per leaf command)

Format: `aifabrix <path> | <output profile>`

Profiles: **layout-blocks** (header/status/list/helpers); **tty-summary** (chalk one-liners / tables); **stream-logs** (tail-style); **json-opt** (`--json` skips TTY layout); **stdout-only** (path/plain for scripts); **delegate** (mostly delegated lib output).

| Command | Profile |
| ------- | ------- |
| aifabrix login | tty-summary |
| aifabrix logout | tty-summary |
| aifabrix auth | tty-summary |
| aifabrix auth status | tty-summary |
| aifabrix setup | tty-summary + stream-logs |
| aifabrix teardown | tty-summary + stream-logs |
| aifabrix up-infra | tty-summary + stream-logs |
| aifabrix up-platform | tty-summary + stream-logs |
| aifabrix up-miso | tty-summary + stream-logs |
| aifabrix up-dataplane | tty-summary + stream-logs |
| aifabrix down-infra | tty-summary + stream-logs |
| aifabrix doctor | tty-summary |
| aifabrix status | tty-summary |
| aifabrix restart | tty-summary + stream-logs |
| aifabrix create | tty-summary |
| aifabrix wizard | delegate |
| aifabrix run | stream-logs |
| aifabrix build | stream-logs |
| aifabrix logs | stream-logs |
| aifabrix down-app | tty-summary + stream-logs |
| aifabrix stop | tty-summary |
| aifabrix shell | stream-logs |
| aifabrix dockerfile | tty-summary |
| aifabrix push | tty-summary + stream-logs |
| aifabrix deploy | tty-summary + stream-logs |
| aifabrix test | stream-logs |
| aifabrix install | stream-logs |
| aifabrix test-e2e | layout-blocks |
| aifabrix lint | stream-logs |
| aifabrix download | tty-summary |
| aifabrix upload | tty-summary |
| aifabrix delete | tty-summary |
| aifabrix test-integration | layout-blocks |
| aifabrix env deploy | tty-summary + stream-logs |
| aifabrix resolve | tty-summary |
| aifabrix json | stdout-only / tty-summary |
| aifabrix split-json | tty-summary |
| aifabrix repair | tty-summary |
| aifabrix convert | tty-summary |
| aifabrix show | tty-summary |
| aifabrix validate | tty-summary |
| aifabrix diff | stdout-only |
| aifabrix credential env | tty-summary |
| aifabrix credential push | tty-summary |
| aifabrix credential list | tty-summary |
| aifabrix deployment list | tty-summary |
| aifabrix integration-client create | tty-summary |
| aifabrix integration-client list | tty-summary |
| aifabrix integration-client rotate-secret | tty-summary |
| aifabrix integration-client delete | tty-summary |
| aifabrix integration-client update-groups | tty-summary |
| aifabrix integration-client update-redirect-uris | tty-summary |
| aifabrix datasource validate | layout-blocks |
| aifabrix datasource capability copy | tty-summary |
| aifabrix datasource capability remove | tty-summary |
| aifabrix datasource capability create | tty-summary |
| aifabrix datasource capability validate | layout-blocks |
| aifabrix datasource capability diff | stdout-only |
| aifabrix datasource capability edit | tty-summary |
| aifabrix datasource capability relate | tty-summary |
| aifabrix datasource capability dimension | tty-summary |
| aifabrix datasource list | tty-summary |
| aifabrix datasource diff | stdout-only |
| aifabrix datasource upload | layout-blocks |
| aifabrix datasource test | layout-blocks |
| aifabrix datasource test-integration | layout-blocks |
| aifabrix datasource test-e2e | layout-blocks |
| aifabrix datasource log-e2e | tty-summary |
| aifabrix datasource log-integration | tty-summary |
| aifabrix dimension create | tty-summary |
| aifabrix dimension get | tty-summary |
| aifabrix dimension list | tty-summary |
| aifabrix dimension-value create | tty-summary |
| aifabrix dimension-value list | tty-summary |
| aifabrix dimension-value delete | tty-summary |
| aifabrix dev show | tty-summary |
| aifabrix dev set-id | tty-summary |
| aifabrix dev set-scoped-resources | tty-summary |
| aifabrix dev set-home | tty-summary |
| aifabrix dev set-work | tty-summary |
| aifabrix dev print-home | stdout-only |
| aifabrix dev print-work | stdout-only |
| aifabrix dev set-format | tty-summary |
| aifabrix dev init | tty-summary + stream-logs |
| aifabrix dev refresh | tty-summary |
| aifabrix dev list | tty-summary |
| aifabrix dev add | tty-summary |
| aifabrix dev update | tty-summary |
| aifabrix dev pin | tty-summary |
| aifabrix dev delete | tty-summary |
| aifabrix dev down | tty-summary |
| aifabrix secret list | tty-summary |
| aifabrix secret set | tty-summary |
| aifabrix secret remove | tty-summary |
| aifabrix secret remove-all | tty-summary |
| aifabrix secret validate | tty-summary |
| aifabrix secret set-secrets-file | tty-summary |
| aifabrix secure | tty-summary |
| aifabrix parameters validate | tty-summary |
| aifabrix app register | tty-summary |
| aifabrix app list | tty-summary |
| aifabrix app rotate-secret | tty-summary |
| aifabrix app show | json-opt |
| aifabrix app deployment | tty-summary |

_**validate** (human TTY): `lib/validation/validate-display.js` + `lib/utils/cli-test-layout-chalk.js` — bold white section titles, datasource rows via `formatDatasourceListRow`, canonical glyphs (✔ ✖ ⚠ ⏭) per [layout.md](./layout.md)._

_Certification-related flags (output profile unchanged): `validate --cert-sync`; `show` / `app show --verify-cert`; `datasource test|test-integration|test-e2e` and `test-integration` / `test-e2e` with `--no-cert-sync`._

_Generated for adoption tracking; see `.cursor/plans/Done/129-cli_layout_adoption.plan.md` and [layout.md](./layout.md)._

## Layout compliance (helpers + audit)

- **Source of truth:** [layout.md](./layout.md) and [cli-layout.mdc](./cli-layout.mdc) — glyphs **✔ ✖ ⚠ ⏭**, semantic colors, **`formatNextActions`** / **`formatBulletSection`**-style sections where applicable.
- **`datasource capability`** (`copy` | `remove` | `create` | `edit` | `validate` slice OK): success sections use **`lib/utils/cli-test-layout-chalk.js`** (`formatBulletSection`, `formatNextActions`, `formatSuccessLine`, `headerKeyValue`, `infoLine`, `metadata`); errors use **`formatBlockingError`**.
- **`datasource capability diff`:** stdout-only structural diff from **`lib/core/diff`** (minimal chalk); unchanged.
- **Backlog (incremental):** **`wizard*`** (Unicode **`\\u2713`** vs canonical **✔**), **`dev-*`**, **`secure`**, and remaining raw **`chalk.green`** success lines — migrate to **`formatSuccessLine`** / **`successGlyph`** when touching those files.
