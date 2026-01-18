# Validation Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Commands for validating and comparing configuration files.

---

## aifabrix validate <appOrFile>

Validate application or external integration file.

**What:** Validates application configurations or external integration files (external-system.json, external-datasource.json) against their schemas. Supports both app name validation (including externalIntegration block and rbac.yaml for external systems) and direct file validation. For external systems, validates rbac.yaml if present and checks role references in permissions.

**When:** Before deployment, when troubleshooting configuration issues, validating external integration schemas, or checking configuration changes.

**Usage:**
```bash
# Validate application by name (includes externalIntegration files if present)
aifabrix validate myapp

# Validate external system file directly
aifabrix validate ./schemas/hubspot.json

# Validate external datasource file directly
aifabrix validate ./schemas/hubspot-deal.json
```

**Arguments:**
- `<appOrFile>` - Application name or path to configuration file

**Process:**
1. Detects if input is app name or file path
2. If app name:
   - Validates application configuration (variables.yaml)
   - If external system, validates rbac.yaml (if present) and checks role references in permissions
   - If `externalIntegration` block exists in variables.yaml:
     - Resolves schema base path
     - Finds all external-system.json and external-datasource.json files
     - Validates each file against its schema (including roles/permissions validation)
   - Aggregates all validation results
3. If file path:
   - Detects schema type (application, external-system, external-datasource)
   - Loads appropriate schema
   - Validates file against schema (for external-system, also validates role references in permissions)

**Output (app validation with external files):**
```yaml
✓ Validation passed!

Application:
  ✓ Application configuration is valid

External Integration Files:
  ✓ hubspot.json (system)
  ✓ hubspot-deal.json (datasource)
```

**Output (validation failed):**
```yaml
✗ Validation failed!

Application:
  ✗ Application configuration has errors:
    • Missing required field 'app.key'

External Integration Files:
  ✗ hubspot.json (system):
    • Missing required field 'key'
    • Field 'version' must match pattern ^[0-9]+\.[0-9]+\.[0-9]+$
```

**Output (file validation):**
```yaml
✓ Validation passed!

File: ./schemas/hubspot.json
Type: external-system
  ✓ File is valid
```

**Issues:**
- **"App name or file path is required"** → Provide application name or file path
- **"File not found"** → Check file path is correct
- **"Invalid JSON syntax"** → Fix JSON syntax errors in file
- **"externalIntegration block not found"** → Add externalIntegration block to variables.yaml or validate file directly
- **"schemaBasePath not found"** → Add schemaBasePath to externalIntegration block
- **"File not found: <path>"** → Check that external system/datasource files exist at specified paths
- **"Unknown schema type"** → File must be application, external-system, or external-datasource JSON

**Next Steps:**
After validation:
- Fix any errors reported
- For external integrations, ensure all referenced files exist
- Use `aifabrix diff` to compare configuration versions
- Deploy validated configuration: `aifabrix deploy <app>`

---

<a id="aifabrix-diff-file1-file2"></a>
## aifabrix diff <file1> <file2>

Compare two configuration files.

**What:** Performs deep comparison of two JSON configuration files, identifying added, removed, and changed fields. Categorizes changes as breaking or non-breaking. Used for deployment pipeline validation and schema migration detection.

**When:** Before deploying configuration changes, comparing schema versions, validating migrations, or reviewing configuration differences.

**Usage:**
```bash
# Compare two external system files
aifabrix diff ./schemas/hubspot-v1.json ./schemas/hubspot-v2.json

# Compare two datasource files
aifabrix diff ./schemas/hubspot-deal-v1.json ./schemas/hubspot-deal-v2.json

# Compare deployment configurations
aifabrix diff ./old-config.json ./new-config.json
```

**Arguments:**
- `<file1>` - Path to first configuration file
- `<file2>` - Path to second configuration file

**Process:**
1. Reads and parses both JSON files
2. Performs deep object comparison
3. Identifies:
   - Added fields (present in file2, not in file1)
   - Removed fields (present in file1, not in file2)
   - Changed fields (different values)
   - Version changes
4. Categorizes breaking changes:
   - Removed fields (potentially breaking)
   - Type changes (breaking)
5. Displays formatted diff output

**Output (identical files):**
```yaml
Comparing: hubspot-v1.json ↔ hubspot-v2.json

✓ Files are identical
```

**Output (different files):**
```yaml
Comparing: hubspot-v1.json ↔ hubspot-v2.json

Files are different

Version: 1.0.0 → 2.0.0

⚠️  Breaking Changes:
  • Field removed: apiKey.path (string)
  • Type changed: timeout (number → string)

Added Fields:
  + authentication.type: "oauth2"
  + rateLimit: 100

Removed Fields:
  - apiKey.path: "config.apiKey"

Changed Fields:
  ~ timeout:
    Old: 30
    New: "30s"
  ~ baseUrl:
    Old: "https://api.hubspot.com"
    New: "https://api.hubspot.com/v3"

Summary:
  Added: 2
  Removed: 1
  Changed: 2
  Breaking: 2
```

**Breaking Changes:**
- **Removed fields** - Fields present in file1 but not in file2
- **Type changes** - Fields with different types between files

**Non-Breaking Changes:**
- **Added fields** - New fields in file2
- **Value changes** - Same type, different values

**Exit Codes:**
- **0** - Files are identical
- **1** - Files are different

**Issues:**
- **"First file path is required"** → Provide path to first file
- **"Second file path is required"** → Provide path to second file
- **"File not found: <path>"** → Check file paths are correct
- **"Failed to parse <file>"** → Fix JSON syntax errors in file

**Next Steps:**
After comparing:
- Review breaking changes before deployment
- Update configuration if needed
- Use `aifabrix validate` to ensure new configuration is valid
- Deploy updated configuration: `aifabrix deploy <app>`

