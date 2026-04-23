# Certification and trust (CLI)

← [Documentation index](../README.md) · [Commands index](README.md)

How the CLI keeps the **`certification`** section of your external **system file** (`integration/<systemKey>/<systemKey>-system.json` or `.yaml`) aligned with the **active integration certificate** on the dataplane you are logged into.

---

## What the certification section is

For external integrations, the system file may include a **`certification`** object with public trust metadata (for example enabled flag, public verification material, algorithm, issuer, version, and optional **status** and **tier level** when the CLI has synced from the dataplane). **Private keys never** belong in this file. The exact shape is validated by the external system JSON schema shipped with the CLI.

---

## When the CLI refreshes it

After **successful** operations, the CLI may **read** the active certificate material from the dataplane and **rewrite only** the `certification` key in the local system file, preserving other keys:

- **`aifabrix upload`** for an external system — unless **`--no-cert-sync`**.
- **`aifabrix deploy`** for an external app — unless **`--no-cert-sync`**.
- **`aifabrix validate`** for an external integration — only when you pass **`--cert-sync`** (off by default so validate stays offline-first).
- **`aifabrix datasource test`**, **`datasource test-integration`**, **`datasource test-e2e`**, and the matching top-level **`test-integration` / `test-e2e`** flows for external apps — unless **`--no-cert-sync`**, and only when the run finishes successfully enough for the sync hook to run.

If you are **not logged in** or the dataplane cannot return usable certificate metadata, the CLI **skips** the refresh and may log a short message; upload, deploy, and tests can still succeed without updating `certification`.

---

## Skipping refresh

Use **`--no-cert-sync`** on commands that support it when you **do not** want the local system file touched after a successful run (for example in CI that must not mutate the workspace, or when debugging schema-only issues).

---

## Viewing trust state and optional verify

- **`aifabrix show <app>`** and **`aifabrix app show <app>`** for external apps: the CLI can show local certification summary material. With **`--verify-cert`**, it may also ask the dataplane to **verify** the stored certificate and print result rows when you are logged in and have the right access.
- Unified datasource tests (**`datasource test`**, **`test-integration`**, **`test-e2e`**) print a **Certification** block in human output when the dataplane returns certificate tier information on the envelope.

---

## Prerequisites

- **Login:** `aifabrix login` (or another supported auth path) so the CLI can call the dataplane when a refresh or verify is requested.
- **Permissions:** Dataplane operations that read active certificates require scopes such as **`external-system:read`**; publishing and test flows keep their existing requirements. See [Online Commands and Permissions](permissions.md).

---

## Related topics

- [External Integration Commands](external-integration.md) — upload, download, deploy.
- [External Integration Testing](external-integration-testing.md) — datasource tests, **`--require-cert`**, watch modes.
- [Validation Commands](validation.md) — `validate` and **`--cert-sync`** for external integrations.
