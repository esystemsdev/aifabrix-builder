# External Integration Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for creating, testing, and managing **external system integrations**.

- Commands that call the Dataplane require login and appropriate permissions. See [Online Commands and Permissions](permissions.md).
- For how the CLI refreshes the **`certification`** section in your local system file after upload, deploy, tests, or optional **`validate --cert-sync`**, see [Certification and trust (CLI)](certification-and-trust.md).
- For detailed testing documentation (unit + integration tests, test payloads, troubleshooting), see [External Integration Testing](external-integration-testing.md).

---

## Pages

- [External system lifecycle commands](external-integration/system-lifecycle.md) – wizard, download, upload, delete, test, test-integration, credential helpers
- [Datasource commands](external-integration/datasources.md) – `aifabrix datasource …` (validate/list/diff/upload/test/logs, capability helpers)
- [Datasource capability commands](external-integration/datasource-capabilities.md) – edit one capability inside a datasource (copy/create/remove/diff/edit/validate/relate)

---

## Command stubs (backward-compatible anchors)

## aifabrix wizard

See [External system lifecycle commands](external-integration/system-lifecycle.md#aifabrix-wizard).

## aifabrix download <systemKey>

See [External system lifecycle commands](external-integration/system-lifecycle.md#aifabrix-download-system-key).

<a id="aifabrix-upload-system-key"></a>
## aifabrix upload <systemKey>

See [External system lifecycle commands](external-integration/system-lifecycle.md#aifabrix-upload-system-key).

<a id="aifabrix-delete-system-key"></a>
## aifabrix delete <systemKey>

See [External system lifecycle commands](external-integration/system-lifecycle.md#aifabrix-delete-system-key).

<a id="aifabrix-test-app"></a>
## aifabrix test <app>

See [External system lifecycle commands](external-integration/system-lifecycle.md#aifabrix-test-app).

<a id="aifabrix-test-integration-app"></a>
## aifabrix test-integration <app>

See [External system lifecycle commands](external-integration/system-lifecycle.md#aifabrix-test-integration-app).

<a id="aifabrix-datasource"></a>
## aifabrix datasource

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource).

### aifabrix datasource capability

See [Datasource capability commands](external-integration/datasource-capabilities.md).

<a id="aifabrix-datasource-validate-file"></a>
### aifabrix datasource validate <file>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-validate-file).

<a id="aifabrix-datasource-list"></a>
### aifabrix datasource list [prefix]

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-list).

<a id="aifabrix-datasource-diff-file1-file2"></a>
### aifabrix datasource diff <file1> <file2>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-diff-file1-file2).

<a id="aifabrix-datasource-upload-myapp-file"></a>
### aifabrix datasource upload <file-or-key>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-upload-myapp-file).

<a id="aifabrix-datasource-test-datasourcekey"></a>
### aifabrix datasource test <datasourceKey>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-test-datasourcekey).

<a id="aifabrix-datasource-test-integration-datasourcekey"></a>
### aifabrix datasource test-integration <datasourceKey>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-test-integration-datasourcekey).

<a id="aifabrix-datasource-test-e2e-datasourcekey"></a>
### aifabrix datasource test-e2e <datasourceKey>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-test-e2e-datasourcekey).

<a id="aifabrix-datasource-log-test-datasourcekey"></a>
### aifabrix datasource log-test <datasourceKey>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-log-test-datasourcekey).

<a id="aifabrix-datasource-log-integration-datasourcekey"></a>
### aifabrix datasource log-integration <datasourceKey>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-log-integration-datasourcekey).

<a id="aifabrix-datasource-log-e2e-datasourcekey"></a>
### aifabrix datasource log-e2e <datasourceKey>

See [Datasource commands](external-integration/datasources.md#aifabrix-datasource-log-e2e-datasourcekey).

