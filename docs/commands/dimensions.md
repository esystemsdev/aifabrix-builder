# Dimensions

← [Documentation index](../README.md) · [Commands index](README.md)

Manage the **Dimension Catalog** used by ABAC and datasource validation.

The Controller is the **source of truth**. The dataplane becomes consistent after catalog sync; Builder commands do not guarantee when a newly created dimension key becomes visible in dataplane-side validation.

---

## Prerequisites

- **Login required**: If you see an authentication error, run `aifabrix login` and retry.
- **Permissions**: Your account must be allowed to manage the dimension catalog in the target environment.

---

## Dimension commands (`aifabrix dimension …`)

Manage dimension definitions (keys, display names, data types, required flags, and optional static values).

### aifabrix dimension create

Create (idempotent) a dimension in the catalog.

**What:** Creates the dimension if it does not exist. If it already exists, the command succeeds and prints an informational message.

**When:** Use when introducing a new ABAC key or when setting up environments consistently (manual or CI).

**Usage:**

```bash
# Help
aifabrix dimension create -h

# Minimal create
aifabrix dimension create --key customerRegion --display-name "Customer Region" --data-type string

# Mark required
aifabrix dimension create --key dataClassification --display-name "Data Classification" --data-type string --required

# With description
aifabrix dimension create --key sensitivity --display-name "Sensitivity" --data-type string --description "Data sensitivity label"

# Create from a JSON file (useful for CI/CD)
aifabrix dimension create --file ./customer-region.json
```

`customer-region.json` example:

```json
{
  "key": "customerRegion",
  "displayName": "Customer Region",
  "description": "Region binding for customer ABAC",
  "dataType": "string",
  "isRequired": false,
  "values": [
    { "value": "emea", "displayName": "EMEA" },
    { "value": "na", "displayName": "North America" }
  ]
}
```

---

### aifabrix dimension get <keyOrId>

Fetch a dimension by key or id.

**What:** Prints the dimension header plus any configured **values** for static dimensions.

**When:** Use when validating what’s deployed in the catalog or when you need the dimension id for follow-on actions.

**Usage:**

```bash
# Help
aifabrix dimension get -h

# Get by key
aifabrix dimension get customerRegion

# Get by id
aifabrix dimension get clx1234567890abcdef
```

---

### aifabrix dimension list

List dimensions in the catalog (paged).

**What:** Lists dimensions registered in the configured environment.

**When:** Use to browse the catalog, confirm rollout, or find keys/ids.

**Usage:**

```bash
# Help
aifabrix dimension list -h

# List first page
aifabrix dimension list

# List with paging
aifabrix dimension list --page 1 --page-size 50

# List with search
aifabrix dimension list --search region

# Alias
af dimension list
```

---

## Dimension value commands (`aifabrix dimension-value …`)

Dimension values are used for **static** dimensions (enumerations). For **dynamic** dimensions, values come from the source system and are not managed in the catalog.

### aifabrix dimension-value create <dimensionKey> --value <value>

Create a value for a static dimension.

**What:** Adds one allowed value (plus display name/description) to a static dimension.

**When:** Use when your dimension is an enumeration and you want a controlled set of allowed values.

**Usage:**

```bash
aifabrix dimension-value create -h
aifabrix dimension-value create dataClassification --value confidential --display-name "Confidential" --description "Confidential data with access controls"
```

---

### aifabrix dimension-value list <dimensionKey>

List values for a static dimension (paged).

**What:** Lists configured values for one dimension key.

**When:** Use to confirm which values exist or to discover a value id for deletion.

**Usage:**

```bash
aifabrix dimension-value list -h
aifabrix dimension-value list dataClassification

# With paging and search
aifabrix dimension-value list dataClassification --page 1 --page-size 50 --search conf
```

---

### aifabrix dimension-value delete <dimensionValueId>

Delete one dimension value by id.

Delete requires the **dimensionValue id**.

**Usage:**

```bash
aifabrix dimension-value delete -h
aifabrix dimension-value delete clx0987654321fedcba
```

## Troubleshooting

- If dataplane-side validation still warns that a dimension key is unknown right after creation, wait for sync to complete and retry the deploy/validation flow.
- If a value create fails with a conflict, the value likely already exists for that dimension.

