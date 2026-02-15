# External Integration Testing

← [Documentation index](../README.md) · [Commands index](README.md) · [External Integration Commands](external-integration.md)

Single source of truth for testing external integrations: unit tests (`aifabrix test`), integration tests (`aifabrix test-integration`), test payload configuration, list validation, and troubleshooting.

---

## Overview

Testing external integrations happens in two ways:

1. **Unit tests** (`aifabrix test <app>`) – Local validation with no API calls. Validates syntax, schemas, field mappings, metadata schemas, and relationships using test payloads from the datasource configuration.
2. **Integration tests** (`aifabrix test-integration <app>`) – Calls the dataplane pipeline test API. Validates field mappings, metadata schemas, endpoint connectivity, and ABAC dimensions using real API calls.

**When to use each:**

- **Unit tests:** Before deploying, validating configuration locally, or testing field mappings without network access. Run first; no login required.
- **Integration tests:** After unit tests pass, when validating against the real dataplane, or when testing endpoint connectivity. Requires login and dataplane access.

**Prerequisites for integration tests:**

- Logged in: `aifabrix login`
- Dataplane accessible (URL discovered from controller)
- System published to dataplane (e.g. via `aifabrix upload <system-key>`) or ready for testing

---

## Unit tests (`aifabrix test`)

<a id="unit-tests-aifabrix-test"></a>

### What is validated

- **Syntax** – JSON/YAML parsing and structure
- **Schemas** – External system and datasource files against `external-system.schema.json` and `external-datasource.schema.json`
- **Field mappings** – Expression syntax (e.g. `{{path.to.field}} | toUpper | trim`), path wrapping in `{{}}`, transformation names, pipe separator
- **Metadata schema** – Validated against the test payload when `testPayload.payloadTemplate` is present
- **Relationships** – systemKey matches, entityKey consistency
- **Expected result** – If `testPayload.expectedResult` is provided, unit tests compare the transformed output to it

### How test payloads are used

Unit tests use the **datasource** `testPayload.payloadTemplate` (and optional `expectedResult`):

- If `testPayload.payloadTemplate` exists: metadata schema is validated against it, and field mapping expressions are run with a mock transformer (no real API calls). If `expectedResult` is set, the transformed result is compared to it.
- If no test payload is configured: schema and syntax are still validated; field mapping and metadata schema checks are skipped for that datasource.

### Options

- `--datasource <key>` – Test only the specified datasource
- `--verbose` – Show detailed validation output

### Example commands

```bash
# Test entire external system
aifabrix test hubspot

# Test specific datasource only
aifabrix test hubspot --datasource hubspot-company

# Verbose output
aifabrix test hubspot --verbose
```

### Sample output (success)

```yaml
🧪 Running unit tests for 'hubspot'...

✓ Application configuration is valid
✓ System configuration is valid (hubspot-system.yaml)
✓ Datasource configuration is valid (hubspot-datasource-company.yaml)
✓ Datasource configuration is valid (hubspot-datasource-contact.yaml)
✓ Datasource configuration is valid (hubspot-datasource-deal.yaml)

Field Mapping Tests:
  ✓ hubspot-company: All field mappings valid
  ✓ hubspot-contact: All field mappings valid
  ✓ hubspot-deal: All field mappings valid

Metadata Schema Tests:
  ✓ hubspot-company: Metadata schema valid against test payload
  ✓ hubspot-contact: Metadata schema valid against test payload
  ✓ hubspot-deal: Metadata schema valid against test payload

✅ All tests passed!
```

### Sample output (failure)

```yaml
🧪 Running unit tests for 'hubspot'...

✓ Application configuration is valid
✓ System configuration is valid (hubspot-system.yaml)
✗ Datasource configuration has errors (hubspot-datasource-company.yaml):
  • Field mapping expression invalid: '{{properties.name.value | trim' (missing closing brace)
  • Metadata schema validation failed: Field 'country' not found in test payload

Field Mapping Tests:
  ✗ hubspot-company: 1 field mapping error(s)

❌ Tests failed!
```

### Troubleshooting

- **"App name is required"** – Provide the application name as argument.
- **"Application not found"** – Ensure the app exists in `integration/<app>/` (or `builder/<app>/`).
- **"Validation failed"** – Fix errors reported in the test output (syntax, schema, or field mapping).
- **"Test payload not found"** – Add a `testPayload` block to the datasource configuration, or use `--datasource` to run tests for a datasource that has one. For full test payload configuration, see [Test payload configuration](#test-payload-configuration).
- **"Field mapping expression invalid"** – Use valid syntax: `{{path}} | transformation`; ensure path is wrapped in `{{}}` and transformation names are supported (e.g. toUpper, toLower, trim, default, toNumber).

**Next steps:** Fix any validation errors, then run integration tests: `aifabrix test-integration <app>`.

---

## Integration tests (`aifabrix test-integration`)

<a id="integration-tests-aifabrix-test-integration"></a>

### What is validated

- **Pipeline test API** – Dataplane endpoint receives the payload and runs the pipeline test flow
- **Field mappings** – Applied against the supplied payload; results reported (e.g. mapped field count)
- **Metadata schema** – Validated against the payload
- **Endpoint connectivity** – Whether the configured endpoint is reachable
- **ABAC dimensions** – Online validation against the Dimension Catalog (when applicable)

### Where payloads come from

1. **Datasource** – `testPayload.payloadTemplate` from the datasource configuration (same as unit tests)
2. **Custom file** – `--payload <file>` overrides the datasource test payload for that run. File format: a single payload object (JSON or YAML) matching the API response shape.

### Options

- `--datasource <key>` – Test only the specified datasource
- `--payload <file>` – Path to custom test payload file (overrides datasource `testPayload`)
- `--verbose` – Show detailed test output
- `--timeout <ms>` – Request timeout in milliseconds (default: 30000)

### Process

1. Resolve dataplane URL from controller (uses `config.yaml` controller and environment).
2. For each datasource (or the one specified with `--datasource`):
   - Load test payload from datasource `testPayload.payloadTemplate` or from `--payload <file>`
   - Call dataplane: `POST /api/v1/pipeline/{systemKey}/{datasourceKey}/test` with body `{ "payloadTemplate": <testPayload> }`
   - Parse response: validation results, field mapping results, endpoint test results
3. Display results per datasource and aggregate pass/fail.

### Example commands

```bash
# Test entire external system
aifabrix test-integration hubspot

# Test specific datasource
aifabrix test-integration hubspot --datasource hubspot-company

# Use custom test payload file
aifabrix test-integration hubspot --payload ./test-payload.json

# Verbose with custom timeout
aifabrix test-integration hubspot --verbose --timeout 60000
```

### Sample output (success)

```yaml
🧪 Running integration tests for 'hubspot' via dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

Testing datasource: hubspot-company
  ✓ Validation: passed
  ✓ Field mappings: 5 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

Testing datasource: hubspot-contact
  ✓ Validation: passed
  ✓ Field mappings: 8 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

✅ All integration tests passed!
```

### Sample output (failure)

```yaml
🧪 Running integration tests for 'hubspot' via dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

Testing datasource: hubspot-company
  ✗ Validation: failed
    • Field 'country' not found in payload
  ✗ Field mappings: 3 of 5 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✗ Metadata schema: invalid

❌ Integration tests failed!
```

### Troubleshooting

- **"App name is required"** – Provide the application name as argument.
- **"Not logged in"** – Run `aifabrix login` first.
- **"Dataplane URL not found"** – Check controller configuration and that the controller can provide a dataplane URL.
- **"Test payload not found"** – Add `testPayload` to the datasource configuration or use `--payload <file>`. See [Test payload configuration](#test-payload-configuration).
- **"API call failed"** – Check dataplane URL, authentication, and network.
- **"Request timeout"** – Increase timeout with `--timeout` or check network.
- **"Validation failed"** – Fix errors reported in the output (payload shape, field mappings, or metadata schema). Check permissions (e.g. pipeline test endpoint access).

**Next steps:** Fix validation or connectivity errors, re-run unit tests if you changed config, then deploy: `aifabrix deploy <app>`.

**Retry logic:** The command retries transient API failures (e.g. network errors, timeouts, 5xx) with exponential backoff (up to 3 retries).

---

## Test payload configuration

<a id="test-payload-configuration"></a>

### Current format

Test payloads are configured in the **datasource** (YAML or JSON) with a `testPayload` object:

- **`payloadTemplate`** – Required. Sample payload that matches the expected API response structure. Used for field mapping and metadata schema validation.
- **`expectedResult`** – Optional. Expected normalized result after field mapping. Used only in **unit tests** for comparison.

### Inline example (YAML)

```yaml
key: hubspot-company
systemKey: hubspot
entityType: company
fieldMappings:
  dimensions:
    country: metadata.country
  attributes:
    name:
      expression: "{{properties.name.value}} | trim"
      type: string
      indexed: false
    country:
      expression: "{{properties.country.value}} | toUpper | trim"
      type: string
      indexed: false
testPayload:
  payloadTemplate:
    properties:
      name:
        value: Acme Corp
      country:
        value: us
  expectedResult:
    name: Acme Corp
    country: US
```

The payload must match the API response shape your field mappings expect (paths in expressions must resolve against `payloadTemplate`).

### Custom file (integration tests only)

Use `--payload <file>` to supply a single payload object from a file (JSON or YAML). The file should contain one object that matches the same shape as above (e.g. a single item or wrapper your mappings expect). This overrides the datasource `testPayload.payloadTemplate` for that run.

### Future

Planned improvements (to be documented when implemented): test payloads as an array (one per scenario), one entry per capability (list/get/create/update/delete), and/or separate test files in a `tests/` folder (e.g. `tests/<datasource-filename>.yaml`) with the same name as the datasource file.

---

## Validating list responses

<a id="validating-list-responses"></a>

List APIs often return an array or a wrapper like `{ results: [...] }`. Current validators assume a **single object** payload.

**Recommendation for now:** Use a single representative item in `payloadTemplate` for list-style APIs—e.g. the first element of the array or a single item from `results`. That way field mappings and metadata schema are validated against one item.

**Future:** Support for list-shaped payloads (array or wrapper key) and validating each item against the schema and field mappings may be added later.

---

## Capabilities

Datasources declare **capabilities** (e.g. list, get, create, update, delete). Today, tests use **one payload per datasource**; the same `testPayload` is used regardless of capability.

**Future:** The design may tie test cases to capability (e.g. different payloads per operation—create vs update vs delete). The new testing doc will be updated when that is implemented.

---

## See also

- [External Integration Commands](external-integration.md) – Command reference for `aifabrix test`, `aifabrix test-integration`, and related commands
- [Validation Commands](validation.md) – General validation, schemas, and `aifabrix validate`
- [External Systems Guide](../external-systems.md) – External system configuration and test payload overview (including [Test Payloads](../external-systems.md#test-payloads))
