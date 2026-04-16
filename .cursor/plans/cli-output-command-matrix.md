# CLI output profile matrix (one line per leaf command)

Format: `aifabrix <path> | <output profile>`

Profiles: **layout-blocks** (header/status/list/helpers); **tty-summary** (chalk one-liners / tables); **stream-logs** (tail-style); **json-opt** (`--json` skips TTY layout); **stdout-only** (path/plain for scripts); **delegate** (mostly delegated lib output).

| Command | Profile |
| ------- | ------- |
| aifabrix login | tty-summary |
| aifabrix logout | tty-summary |
| aifabrix auth | tty-summary |
| aifabrix auth status | tty-summary |
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
| aifabrix service-user create | tty-summary |
| aifabrix service-user list | tty-summary |
| aifabrix service-user rotate-secret | tty-summary |
| aifabrix service-user delete | tty-summary |
| aifabrix service-user update-groups | tty-summary |
| aifabrix service-user update-redirect-uris | tty-summary |
| aifabrix datasource validate | layout-blocks |
| aifabrix datasource list | tty-summary |
| aifabrix datasource diff | stdout-only |
| aifabrix datasource upload | layout-blocks |
| aifabrix datasource test | layout-blocks |
| aifabrix datasource test-integration | layout-blocks |
| aifabrix datasource test-e2e | layout-blocks |
| aifabrix datasource log-e2e | tty-summary |
| aifabrix datasource log-integration | tty-summary |
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

_Generated for adoption tracking; see [129-cli_layout_adoption.plan.md](./129-cli_layout_adoption.plan.md) and [layout.md](./layout.md)._
