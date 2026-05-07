# External Integration: System Lifecycle Commands

← [Documentation index](../../README.md) · [Commands index](../README.md) · [External integration](../external-integration.md)

Commands for creating and managing an external system end-to-end (wizard → download → upload/publish → test → delete), plus credential helpers.

For detailed testing documentation (payloads, troubleshooting, debug output), see [External Integration Testing](../external-integration-testing.md).

---

## aifabrix wizard

Interactive wizard for creating external systems.

**What:** Provides an interactive guided workflow for creating external system integrations. The first step is **mode** (Create new external system | Add datasource to existing system), then app name or system key, then source and the remaining steps.

**When:** Use when creating a new external system or adding a datasource to an existing system.

**Usage:**
```bash
# Interactive wizard (mode first, then prompts)
aifabrix wizard

# Wizard for an app (loads/saves integration/<systemKey>/wizard.yaml and error.log)
aifabrix wizard my-integration

# Headless from a config file
aifabrix wizard --config path/to/wizard.yaml

# With debug output
aifabrix wizard hubspot-test-v2 --debug
```

**Resume:** After an error, if the system key is known, state is saved to `integration/<systemKey>/wizard.yaml` and the error is appended to `integration/<systemKey>/error.log`. Run `aifabrix wizard <systemKey>` to resume.

**Options:**
- `-a, --app <app>` - Application name (if not provided, will prompt)
- `--config <file>` - Run headless from a wizard config file
- `--silent` - Run headless using `integration/<systemKey>/wizard.yaml` only (no prompts)
- `--debug` - Enable debug output and save debug manifests on validation failure

---

<a id="aifabrix-download-system-key"></a>
## aifabrix download <systemKey>

Download an external system from the dataplane into `integration/<systemKey>/`.

**What:** Downloads the running system configuration (system + all datasources), writes `<systemKey>-deploy.json`, then splits it into component files (application/system/datasources/env.template/README.md).

**When:** Use when setting up local development for an existing external system or cloning config between environments.

**Usage:**
```bash
aifabrix download hubspot
aifabrix download hubspot --dry-run
aifabrix download hubspot --format json
```

**Options:**
- `--format <format>` - `json` | `yaml` (default: `yaml` or your config default)
- `--dry-run` - Show what would be downloaded without writing files
- `--force` - Overwrite existing `README.md` without prompting

---

<a id="aifabrix-upload-system-key"></a>
## aifabrix upload <systemKey>

Upload full external system (system + all datasources + RBAC) to the dataplane for the current environment.

**What:** Validates and publishes the full external system. This is optimized for fast iteration during development (it does not trigger controller-driven platform deployment).

**When:** Use during external integration development to publish config to the dataplane for validation and testing. Promote to full platform with `aifabrix deploy <app>` when ready.

**Usage:**
```bash
aifabrix upload my-hubspot
aifabrix upload my-hubspot --dry-run
aifabrix upload my-hubspot --verbose
aifabrix upload my-hubspot --probe
```

> **Warning:** Before publishing, the CLI displays a warning that configuration will be sent to the dataplane. Confirm you are targeting the correct environment.

**Options:**
- `--dry-run` – Validate and build payload only; no network calls
- `-v, --verbose` – Print server-side validation warnings before publish
- `--probe` – After publish, run runtime checks for all datasources
- `--probe-timeout <ms>` – Timeout for `--probe`
- `--minimal` – Print a short readiness summary only

---

<a id="aifabrix-credential-env-system-key"></a>
## aifabrix credential env <systemKey>

Prompt for `KV_*` credential values and write `integration/<systemKey>/.env`.

**What:** Reads `env.template`, prompts for each `KV_*` secret value, and writes `.env` (secrets masked in prompts).

**When:** After creating/downloading an integration, before `credential push` or `upload`.

**Usage:**
```bash
aifabrix credential env hubspot
```

---

<a id="aifabrix-credential-push-system-key"></a>
## aifabrix credential push <systemKey>

Push credential secrets from `.env` to the dataplane (no upload/validate/publish).

**What:** Pushes `KV_*` values from `integration/<systemKey>/.env` into the dataplane secret store so online validation and E2E runs can use them.

**When:** When only secrets changed and you don't need to re-upload the whole system.

**Usage:**
```bash
aifabrix credential push hubspot
```

---

<a id="aifabrix-delete-system-key"></a>
## aifabrix delete <systemKey>

Delete an external system from the dataplane (also deletes associated datasources).

**What:** Permanently removes the system and all its datasources from the dataplane.

**When:** Clean up test systems or remove deprecated integrations.

**Usage:**
```bash
aifabrix delete hubspot
aifabrix delete hubspot --yes
```

---

<a id="aifabrix-test-app"></a>
## aifabrix test <app>

Run unit tests for an external system (local validation, no API calls).

**What:** Runs offline validation against the files on disk (schemas, expressions, relationships). No dataplane calls.

**When:** Before publishing or when iterating on mappings locally.

**Usage:**
```bash
aifabrix test hubspot
aifabrix test hubspot -v
aifabrix test hubspot -e tst -d
```

---

<a id="aifabrix-test-integration-app"></a>
## aifabrix test-integration <app>

Run integration tests via the dataplane (requires authentication).

**What:** Validates the external system against the dataplane (rollup across datasources).

**When:** After `aifabrix test` passes, or when verifying behavior against a real environment.

**Usage:**
```bash
aifabrix test-integration hubspot
aifabrix test-integration hubspot --env tst
aifabrix test-integration hubspot -v
aifabrix test-integration hubspot --debug
```

