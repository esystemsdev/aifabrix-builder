# API Permissions Guide

How to update and document permissions for Builder's online (Controller/Dataplane) API methods.

## When to Update

- Adding a new function in `lib/api/*.api.js` that calls Controller or Dataplane
- OpenAPI specs change (permissions/scopes in miso-controller or dataplane)
- Adding a new CLI command that uses online APIs

## What to Update

1. **lib/api** – Add `@requiresPermission {Controller}|{Dataplane} <scope>` JSDoc to each function that calls an online endpoint.
2. **docs/commands/permissions.md** – Add the CLI command to the Command → Service → Permissions table (if user-facing).
3. **Command docs** – For commands that use online APIs, add a one-line permission note and link to [docs/commands/permissions.md](../../docs/commands/permissions.md).

## JSDoc Pattern

```javascript
/**
 * List applications
 * GET /api/v1/applications
 * @requiresPermission {Controller} applications:read
 * @async
 * @function listApplications
 */
```

- **{Controller}** – Miso Controller base URL; scopes from `miso-controller/openapi/openapi-complete.yaml`
- **{Dataplane}** – Dataplane base URL; scopes from `dataplane/openapi/openapi.yaml`
- If no scope: use `Client credentials`, `Public`, or `Authenticated (oauth2: [])`

## Sources of Truth

- **Controller**: `aifabrix-miso/packages/miso-controller/openapi/openapi-complete.yaml` (security.oauth2 per path)
- **Dataplane**: `aifabrix-dataplane/openapi/openapi.yaml` (security.oauth2 per path)

## Files to Touch

| Change | Files |
|--------|--------|
| New lib/api function | `lib/api/<module>.api.js` – add @requiresPermission |
| New CLI command (online) | `docs/commands/permissions.md` – add row; update relevant command doc |
| Scope change in OpenAPI | Re-check lib/api and docs/commands/permissions.md for affected endpoints |

## Quick Reference

- **User-facing permissions**: [docs/commands/permissions.md](../../docs/commands/permissions.md)
- **lib/api modules**: `lib/api/*.api.js` (grep for `@requiresPermission` to audit)
