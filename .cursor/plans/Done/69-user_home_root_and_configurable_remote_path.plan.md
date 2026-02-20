---
name: User home root and configurable remote path
overview: "Two-part change: (1) In aifabrix-setup, set user-mutagen-folder to the per-user home path `/home/devNN`. (2) In aifabrix-builder, support a configurable relative path under that root (e.g. `aifabrix-miso/packages/miso-controller`) for sync and Docker -v, defaulting to `dev/<appKey>` when unset."
todos: []
isProject: false
---

# User home root and configurable remote sync path

## Summary


| Responsibility                     | Repo                 | Change                                                                              |
| ---------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Host path to user's workspace root | **aifabrix-setup**   | Set `user-mutagen-folder` to `/home/dev${id.padStart(2,'0')}` in `getSettings()`    |
| Relative path under that root      | **aifabrix-builder** | Add optional `build.remoteSyncPath`; use it for remote path; default `dev/<appKey>` |


Result for developer 06 and miso-controller: root = `/home/dev06`, remote path = `/home/dev06/aifabrix-miso/packages/miso-controller` when `build.remoteSyncPath` is set; sync and `-v` use that full path.

---

## Part 1: aifabrix-setup (builder-server)

**Scope:** You will implement this in the aifabrix-setup repo (not in this workspace).

In the function that builds the GET `/api/dev/settings` response (e.g. `getSettings()` or equivalent):

- **Current:** `userMutagenFolder = path.join(shareRoot, 'workspace', \`dev-${developerId})`(e.g.`/opt/.../workspace/dev-01`).
- **New:** `userMutagenFolder = '/home/dev' + String(developerId).padStart(2, '0')` (e.g. developer id `6` → `/home/dev06`, `1` → `/home/dev01`).

Ensure `developerId` is the numeric or string id (e.g. `6` or `"6"`); pad to two digits so the segment is always `dev01`, `dev06`, etc. No change is required in aifabrix-builder for this; the CLI already uses whatever `user-mutagen-folder` the server returns.

---

## Part 2: aifabrix-builder (this repo)

### 2.1 Convention change

- **Current:** Remote path = `user-mutagen-folder` + `'/dev/'` + `appKey` (hardcoded segment).
- **New:** Remote path = `user-mutagen-folder` + `'/'` + relative path, where relative path is:
  - `build.remoteSyncPath` from application config when set (e.g. `aifabrix-miso/packages/miso-controller`) - no backward compatible.

Same path is used for Mutagen sync target and for Docker `-v` / Compose `devMountPath` (no change to that contract).

### 2.1b Do not activate Mutagen when already on the server

If the Docker endpoint or the remote/sync host is **localhost** (or 127.0.0.1), the CLI is already running on the dev server — there is no need to sync from a different machine or Remote path is available directly (you are in server via SSH) . In that case:

- **Do not** start a Mutagen session.
- **Return** from `ensureReloadSync` with `null`, so the run flow uses the local `codePath` as `devMountPath` (same as when no remote is configured).

Implementation: in `ensureReloadSync` (or a small helper), treat "already on server" when:

- `docker-endpoint` (e.g. `tcp://localhost:2376`) has a host part that is `localhost` or `127.0.0.1`, or
- `remote-server` URL (e.g. `https://localhost:8443`) has host `localhost` or `127.0.0.1`, or
- `sync-ssh-host` (if used for the check) is `localhost` or `127.0.0.1`.

If any of these indicate localhost, return `null` **before** requiring sync settings or calling Mutagen; the caller will then set `devMountPath = codePath` and Docker will use the local path for the mount.

### 2.2 Code and config changes

**1. Schema — [lib/schema/application-schema.json](lib/schema/application-schema.json)**  

- In `build.properties`, add an optional field, e.g. `remoteSyncPath`:
  - `type`: string
  - `description`: Relative path under user-mutagen-folder for remote sync and Docker -v; when unset, defaults to `dev/<appKey>`.
  - Pattern: allow relative segments with slashes (e.g. `aifabrix-miso/packages/miso-controller`), no leading slash (e.g. `^[^/].`* or allow internal slashes only).

**2. Mutagen — [lib/utils/mutagen.js*](lib/utils/mutagen.js)*  

- Change `getRemotePath(userMutagenFolder, appKey, relativePathOverride)`:
  - If `relativePathOverride` is a non-empty string: normalize (trim, strip leading slashes), then return `userMutagenFolder + '/' + normalized`.
  - Else: return `userMutagenFolder + '/dev/' + appKey` (current behavior).
- Update JSDoc for the new parameter.

**3. Run flow — [lib/app/run.js](lib/app/run.js)**  

- **Localhost guard:** At the start of `ensureReloadSync`, after reading `endpoint` and `serverUrl` (and optionally `syncSshHost`): if the host part of the Docker endpoint, remote-server URL, or sync-ssh-host is localhost or 127.0.0.1, return `null` immediately (do not require sync settings or start Mutagen). Use a small helper e.g. `isLocalhostEndpoint(url)` / `isLocalhostHost(host)` so both `tcp://localhost:2376` and `https://127.0.0.1:8443` are detected.
- Pass the optional relative path from app config into `ensureReloadSync`: add parameter `remoteSyncPath` (e.g. `appConfig.build?.remoteSyncPath` from `prepareAppRun`). Inside `ensureReloadSync` call `mutagen.getRemotePath(userMutagenFolder, appName, remoteSyncPath)`.

**4. Tests**  

- **[tests/lib/utils/mutagen.test.js](tests/lib/utils/mutagen.test.js):** Extend `getRemotePath` tests (no third arg = unchanged; third arg = override path; empty/undefined third arg = default). Adjust callers if signature changes.
- **Run / ensureReloadSync:** Add or extend tests so that when Docker endpoint or remote-server/sync-ssh-host is localhost (e.g. `tcp://localhost:2376`, `https://localhost:8443`), `ensureReloadSync` returns `null` and no Mutagen session is created; when host is non-local, Mutagen is used as today.

**5. Config path tests**  

- [tests/lib/utils/config-paths.test.js](tests/lib/utils/config-paths.test.js) only references `user-mutagen-folder` as a key; no change needed for the new app-level field. If any test hardcodes the full remote path formula, update it to the new default (`dev/<appKey>`) or to the new optional override.

**6. Documentation**  

- [.cursor/plans/builder-cli.md](.cursor/plans/builder-cli.md) (§2 “Remote path formula”): state that remote_path = user-mutagen-folder + `/` + (build.remoteSyncPath from application.yaml if set, else `dev/` + appKey).
- [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md): document optional `build.remoteSyncPath` (relative path under user-mutagen-folder for sync and -v).
- [docs/running.md](docs/running.md) (or developer-isolation): if they describe the remote path formula, add one line that the path can be overridden per app via `build.remoteSyncPath`.

### 2.3 Example usage (miso-controller)

In the application.yaml for miso-controller (e.g. under builder or template):

```yaml
build:
  remoteSyncPath: aifabrix-miso/packages/miso-controller
  # ... context, language, etc.
```

With `user-mutagen-folder` = `/home/dev06` from settings:

- Mutagen sync target: `dev06@host:/home/dev06/aifabrix-miso/packages/miso-controller`
- Docker: `-v /home/dev06/aifabrix-miso/packages/miso-controller:/app`

No change in aifabrix-setup for this path segment; only the builder needs to read and use `build.remoteSyncPath`.

---

## Dependency and order

- aifabrix-setup change is independent; deploy it so GET `/api/dev/settings` returns the new root.
- aifabrix-builder changes are independent of the setup change (builder already uses whatever root the server returns). Implement schema → mutagen → run → tests → docs.

---

## Files to touch (aifabrix-builder only)


| File                                                                                                               | Action                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [lib/schema/application-schema.json](lib/schema/application-schema.json)                                           | Add `build.remoteSyncPath` (optional string)                                                                                                                  |
| [lib/utils/mutagen.js](lib/utils/mutagen.js)                                                                       | `getRemotePath(userMutagenFolder, appKey, relativePathOverride)` and normalization                                                                            |
| [lib/app/run.js](lib/app/run.js)                                                                                   | Localhost guard in `ensureReloadSync` (return null when endpoint/server/host is localhost); pass `remoteSyncPath` into `ensureReloadSync` and `getRemotePath` |
| [tests/lib/utils/mutagen.test.js](tests/lib/utils/mutagen.test.js)                                                 | New and updated `getRemotePath` cases                                                                                                                         |
| [.cursor/plans/builder-cli.md](.cursor/plans/builder-cli.md)                                                       | Document remote path formula with override                                                                                                                    |
| [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md)                                   | Document `build.remoteSyncPath`                                                                                                                               |
| [docs/running.md](docs/running.md) or [docs/commands/developer-isolation.md](docs/commands/developer-isolation.md) | One-line note on override (if formula is mentioned)                                                                                                           |


---

## Implementation Validation Report

**Date:** 2025-02-20  
**Plan:** .cursor/plans/69-user_home_root_and_configurable_remote_path.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

Part 2 (aifabrix-builder) of plan 69 is fully implemented. All required code and config changes, tests, and documentation are in place. Part 1 (aifabrix-setup) is out of scope for this repo. Format, lint, and tests all pass with zero errors and zero warnings.

### Task Completion

- **Total tasks:** Plan uses frontmatter `todos: []`; implementation checklist from §2.2 and “Files to touch” is complete.
- **Completed:** Schema, Mutagen, run flow (localhost guard + remoteSyncPath), tests (mutagen + run-reload-sync), config-paths (no change needed), documentation (builder-cli, application-yaml, running, application-development, building).
- **Completion:** 100% for aifabrix-builder scope.

### File Existence Validation


| File                                     | Status                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| lib/schema/application-schema.json       | ✅ `build.remoteSyncPath` added (optional string, pattern `^[^/].`*)                                                          |
| lib/utils/mutagen.js                     | ✅ `getRemotePath(userMutagenFolder, appKey, relativePathOverride)` with normalization and JSDoc                              |
| lib/app/run.js                           | ✅ `isLocalhostHost`, `isLocalhostEndpoint`; localhost guard in `ensureReloadSync`; `remoteSyncPath` param; exports for tests |
| tests/lib/utils/mutagen.test.js          | ✅ Extended `getRemotePath` (no third arg, override, empty/undefined)                                                         |
| tests/lib/app/run-reload-sync.test.js    | ✅ New: localhost helpers + `ensureReloadSync` (null when localhost, Mutagen when remote, remoteSyncPath passed)              |
| .cursor/plans/builder-cli.md             | ✅ §2 Remote path formula and §4 Summary updated with override                                                                |
| docs/configuration/application-yaml.md   | ✅ `build.remoteSyncPath` documented                                                                                          |
| docs/running.md                          | ✅ Remote path formula + one-line override note                                                                               |
| docs/commands/application-development.md | ✅ Formula + override note                                                                                                    |
| docs/building.md                         | ✅ Formula + override note                                                                                                    |
| tests/lib/utils/config-paths.test.js     | ✅ No change (only references `user-mutagen-folder`; no hardcoded path formula)                                               |


### Test Coverage

- **Unit tests:** ✅ `tests/lib/utils/mutagen.test.js` — getRemotePath (default, override, empty/undefined). ✅ `tests/lib/app/run-reload-sync.test.js` — isLocalhostHost, isLocalhostEndpoint, ensureReloadSync (null when endpoint/server/sync-host is localhost; Mutagen when non-local; remoteSyncPath passed to getRemotePath).
- **Integration tests:** N/A for this plan.
- **Test execution:** All tests pass via `npm test`.

### Code Quality Validation


| Step              | Result                          |
| ----------------- | ------------------------------- |
| Format (lint:fix) | ✅ PASSED                        |
| Lint              | ✅ PASSED (0 errors, 0 warnings) |
| Tests             | ✅ PASSED (all tests pass)       |


### Cursor Rules Compliance


| Rule             | Status                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Code reuse       | ✅ Uses existing mutagen, config, paths, logger                                               |
| Error handling   | ✅ try/catch in URL parsing; meaningful errors for missing sync settings                      |
| Logging          | ✅ logger.log (chalk); debug-only for localhost skip                                          |
| Type safety      | ✅ JSDoc on isLocalhostHost, isLocalhostEndpoint, ensureReloadSync, getRemotePath             |
| Async patterns   | ✅ async/await; ensureReloadSync returns Promise                                              |
| File operations  | ✅ N/A for new logic (path/URL parsing only)                                                  |
| Input validation | ✅ isLocalhostHost/isLocalhostEndpoint guard; ensureReloadSync receives validated app context |
| Module patterns  | ✅ CommonJS; named exports                                                                    |
| Security         | ✅ No hardcoded secrets; no logging of tokens/paths beyond debug                              |


### Implementation Completeness


| Area          | Status                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Schema        | ✅ build.remoteSyncPath optional string, pattern no leading slash                        |
| Mutagen       | ✅ getRemotePath with third param and normalization                                      |
| Run flow      | ✅ Localhost guard; remoteSyncPath from app config to ensureReloadSync and getRemotePath |
| Tests         | ✅ Mutagen + run-reload-sync tests added/extended                                        |
| Documentation | ✅ builder-cli, application-yaml, running, application-development, building updated     |


### Issues and Recommendations

- None. Part 1 (aifabrix-setup) remains to be done in the aifabrix-setup repo when that codebase is available.

### Final Validation Checklist

- All aifabrix-builder tasks completed
- All mentioned files exist and contain expected changes
- Tests exist and pass
- Code quality (format → lint → test) passes
- Cursor rules compliance verified
- Implementation complete for this repo

