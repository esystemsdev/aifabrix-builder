# Identity management

← [Documentation index](../README.md) · [Commands index](README.md) · [Governance testing](governance-testing.md)

Manage **users**, **groups**, and **memberships** on the Miso Controller, map **roles to groups** per environment, clear **controller auth/RBAC cache**, and **sync identity to the dataplane** for protection and governance workflows.

The Controller is the **source of truth** for identity. The dataplane receives users, groups, and memberships only after a **full sync** (or platform sync jobs)—not by editing dataplane tables directly from this CLI.

All examples below use **your** paths (`integration/<systemKey>/fixtures/...`) and **docs/** cross-links only. This public documentation does not reference private product repositories or monorepo layouts.

---

## Prerequisites

- **Login:** `aifabrix login` then `aifabrix auth status`.
- **Permissions:** Your operator role needs the scopes listed in [permissions](permissions.md) for the commands you run (typically `users:*`, `groups:*`, `environments:update` for role mapping, `admin:sync` for sync, `cache:admin` for cache purge).

---

## Concepts

| Concept | Meaning |
| --- | --- |
| **User** | Person account on the controller (email, display name, status). |
| **Group** | Named collection; memberships link users to groups. |
| **Role ↔ groups** | Per **environment**, a role value is mapped to one or more **group names** (replaces previous mapping for that role). |
| **Controller cache** | In-memory permission/role cache on the controller. **`identity cache clear`** wipes it platform-wide. Use after membership changes if RBAC looks stale. |
| **Dataplane sync** | Pushes controller identity into the dataplane so protection projection and governance subjects resolve. |

**Not covered:** direct dataplane database edits, protection grant purge, or logging in as scenario subject users ([`test-governance`](governance-testing.md) uses the operator token).

---

## Command reference

Parent command: `aifabrix identity` (alias `af identity`).

### `aifabrix identity user create`

**What:** Creates a user on the controller.

**When:** One-off onboarding or tests.

```bash
aifabrix identity user create --email alice.hr@example.com --first-name Alice --last-name HR
```

| Option | Purpose |
| --- | --- |
| `--email` | Required |
| `--first-name`, `--last-name`, `--display-name`, `--username` | Optional profile fields |

---

### `aifabrix identity user list`

**What:** Lists users (paginated).

```bash
aifabrix identity user list --search alice --json
```

| Option | Purpose |
| --- | --- |
| `--page <n>`, `--page-size <n>` | Pagination |
| `--search <text>` | Filter users |
| `--json` | Machine-readable list |

---

### `aifabrix identity user get <idOrEmail>`

**What:** Fetches one user by controller id or email.

---

### `aifabrix identity user groups <idOrEmail>`

**What:** Lists groups the user belongs to.

---

### `aifabrix identity group create`

**What:** Creates a group (`name` is the stable key used in CSV and role mapping).

```bash
aifabrix identity group create --name <group-name> --display-name "HR"
```

---

### `aifabrix identity group list` / `get` / `members`

List groups, get one by id or name, or list members.

---

### `aifabrix identity membership add` / `remove`

**What:** Adds or removes a membership. Arguments are **controller ids** (from `user get` / `group get`), not CSV ids.

```bash
aifabrix identity membership add <userId> <groupId>
```

---

### `aifabrix identity role list`

**What:** Lists roles and their group mappings in an environment.

```bash
aifabrix identity role list -e dev
```

---

### `aifabrix identity role set-groups <roleValue>`

**What:** Sets which groups are bound to a role in an environment (replaces existing mapping for that role).

```bash
aifabrix identity role set-groups <roleValue> -e dev --groups "Group A,Group B"
```

---

### `aifabrix identity cache clear`

**What:** Clears **all** controller auth/RBAC cache entries. Requires `cache:admin`.

**When:** After bulk membership changes, before sync or governance runs, if permissions look cached.

---

### `aifabrix identity cache invalidate`

**What:** Removes cache entries matching a pattern (narrower than full clear).

```bash
aifabrix identity cache invalidate --pattern "permissions:*"
```

---

### `aifabrix identity apply`

**What:** Reads a **users.csv-shaped** file, upserts groups and users, creates memberships (idempotent). Optional cache clear and dataplane sync.

**When:** Bulk provisioning before [protection](protection.md) or [governance](governance-testing.md) runs.

```bash
aifabrix identity apply \
  --file integration/<systemKey>/fixtures/users.csv \
  --filter-prefix <row-id-prefix> \
  -e dev \
  --sync \
  --purge-cache
```

| Option | Purpose |
| --- | --- |
| `--file` | Required CSV path on **your** machine (under `integration/` or team fixtures) |
| `--filter-prefix` | Only rows whose `Id` column starts with this prefix |
| `--dry-run` | Plan only; no API writes |
| `--sync` | Full dataplane identity sync after apply (`-e` required) |
| `--purge-cache` | `cache clear` before sync |
| `--allow-empty-sync` | Do not fail when sync reports `usersProcessed=0` |
| `--json` | Machine-readable summary |

**CSV columns:** Use the controller **users.csv** layout your platform documents: `Id`, `Email`, `FirstName`, `LastName`, `DisplayName`, `UserPrincipalName`, `GroupId`, `GroupName`, …

**Upsert rules:** Groups by `GroupId` (name); users by email (or existing id if `get` succeeds); duplicate memberships are skipped.

---

### `aifabrix identity sync`

**What:** Runs full identity sync from controller to dataplane for one environment.

```bash
aifabrix identity sync -e dev --purge-cache
```

| Option | Purpose |
| --- | --- |
| `-e, --env` | Environment key (defaults from aifabrix config) |
| `--purge-cache` | Clear controller cache before sync |
| `--allow-empty-sync` | Accept `usersProcessed=0` |
| `--json` | Print sync stats |

---

## Recommended workflows

### Protection + governance setup

Use this order when your integration includes protection manifests and governance scenario packs. Full governance baseline is in [Governance testing](governance-testing.md); dataplane testing in [External integration testing](external-integration-testing.md).

1. `aifabrix auth status`
2. Create subjects: `identity group create`, `identity user create`, `identity membership add` for each **subject user id** in your scenario pack—or bulk-load with `identity apply --file integration/<systemKey>/fixtures/users.csv` and `--filter-prefix` matching CSV `Id` values
3. `identity cache clear` (or `--purge-cache` on apply/sync) and `identity sync -e <env>`
4. **Checkpoint:** `identity user groups <email>`; optionally `test-governance <systemKey> --scenario <id> --no-sync -v`
5. `aifabrix upload <systemKey>` (or your usual publish flow)
6. `aifabrix protection upload <datasourceKey>` then `aifabrix datasource load <datasourceKey>` — see [Protection](protection.md)
7. `aifabrix test-governance <systemKey>` — see [Governance testing](governance-testing.md)

**Two-pass proof (optional):** Run step 2 with granular CLI commands first, checkpoint, then repeat with `identity apply` on the same CSV and confirm idempotent results (`0 created`, memberships skipped) before steps 5–7.

### Single user

1. `identity group create` → note group **id**
2. `identity user create` → note user **id**
3. `identity membership add <userId> <groupId>`
4. `identity sync -e dev`

---

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Validation error, API failure, or sync with zero users (without `--allow-empty-sync`) |

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Not authenticated | `aifabrix login`, `aifabrix auth status` |
| Permission denied on users/groups | Use a role with `users:create` / `groups:create` or platform admin; see [permissions](permissions.md) |
| Permission denied on sync | `admin:sync` on operator role |
| Permission denied on cache | `cache:admin`, or omit `--purge-cache` |
| Sync `usersProcessed=0` | Re-run `identity apply`; check `-e` and CSV path; confirm `--filter-prefix` matches row `Id` values |
| Governance subject not found | User ids in the scenario pack must exist on the controller; run `identity sync` |
| Stale RBAC after membership change | `identity cache clear` or `--purge-cache` |

---

## See also

- [Governance testing](governance-testing.md) — Scenario packs and `test-governance`
- [Protection](protection.md) — Manifests before governed data load
- [External integration testing](external-integration-testing.md) — `datasource load`, E2E, audit verification
- [External Integration Commands](external-integration.md) — Upload and publish
- [Authentication](authentication.md) — Login and tokens
- [Permissions](permissions.md) — `users:*`, `groups:*`, `admin:sync`, `cache:admin`
- [Dimensions](dimensions.md) — Dimension catalog for protection authoring
