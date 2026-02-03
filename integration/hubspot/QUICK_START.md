# Quick Start: Create New HubSpot Integration

This guide shows you how to create a new HubSpot integration using the wizard, then continue with manual coding.

## Prerequisites

1. **Authentication**: Make sure you're logged in to the controller
   ```bash
   node bin/aifabrix.js login --controller http://localhost:3110 --method device --environment miso
   ```

2. **OpenAPI File**: Ensure you have the HubSpot OpenAPI file available
   - Default location: `integration/hubspot/companies.json` (relative to workspace root)
   - Or set `HUBSPOT_OPENAPI_FILE` environment variable

3. **Environment Variables** (optional):
   ```bash
   export CONTROLLER_URL=http://localhost:3010
   export ENVIRONMENT=miso
   export DATAPLANE_URL=http://localhost:3011  # Optional, will be auto-discovered
   ```

## Step 1: Create HubSpot Integration

### Option 1: Using the Helper Script (Recommended)

```bash
# Create a new HubSpot integration
node integration/hubspot/create-hubspot.js --name my-hubspot

# With custom output directory
node integration/hubspot/create-hubspot.js \
  --name my-hubspot \
  --output integration/my-hubspot

# With custom OpenAPI file
node integration/hubspot/create-hubspot.js \
  --name my-hubspot \
  --openapi /path/to/openapi.json
```

This will:
1. ✅ Create wizard configuration
2. ✅ Run the wizard to generate all files
3. ✅ Copy files to your output directory
4. ✅ Show you what was created

### Option 2: Manual Steps

#### Create Wizard Config

Create `wizard-my-hubspot.yaml`:

```yaml
appName: my-hubspot
mode: create-system
source:
  type: openapi-file
  filePath: integration/hubspot/companies.json
credential:
  action: skip
preferences:
  intent: "HubSpot CRM integration"
  fieldOnboardingLevel: full
  enableOpenAPIGeneration: true
  enableABAC: true
  enableRBAC: false
deployment:
  controller: http://localhost:3110
  environment: miso
```

#### Run Wizard

```bash
node bin/aifabrix.js wizard \
  --config wizard-my-hubspot.yaml \
  --controller http://localhost:3110 \
  --environment miso
```

## Step 2: Generated Files

The wizard creates files in `integration/my-hubspot/`:

```yaml
integration/my-hubspot/
├── hubspot-system.json              ← External system definition
├── hubspot-datasource-company.json  ← Companies datasource
├── hubspot-datasource-contact.json  ← Contacts datasource
├── hubspot-datasource-deal.json     ← Deals datasource
├── hubspot-deploy.json              ← Deployment manifest (generated)
├── variables.yaml                   ← App config with externalIntegration block
├── env.template                     ← Environment variables template
├── README.md                        ← Generated documentation
└── deploy.js                        ← Node deployment script (run `node deploy.js`)
```

## Step 3: Understanding the Files

### `hubspot-deploy.json` (External System Definition)
This is the **main external system definition**. It contains:
- System metadata (key, displayName, description)
- Authentication configuration (OAuth2)
- Environment configuration
- Configuration variables
- OpenAPI document reference

**Important**: This file is NOT split into components. It's the external system definition itself. The wizard already generates separate files:
- System file: `hubspot-system.json`
- Datasource files: `hubspot-datasource-company.json`, etc.
- Deployment manifest: `hubspot-deploy.json` (generated)
- Config files: `variables.yaml`, `env.template`, `README.md`

### `variables.yaml` (Application Configuration)
Contains the `externalIntegration` block that references all datasource files:

```yaml
app:
  key: hubspot
  displayName: "HubSpot CRM Integration"
  description: "HubSpot CRM external system integration"
  type: external

externalIntegration:
  schemaBasePath: ./
  systems:
    - hubspot-system.json
  dataSources:
    - hubspot-datasource-company.json
    - hubspot-datasource-contact.json
    - hubspot-datasource-deal.json
  autopublish: true
  version: 1.0.0
```

### `env.template` (Environment Variables)
Template for environment variables with Key Vault references:

```yaml
CLIENTID=kv://hubspot-clientidKeyVault
CLIENTSECRET=kv://hubspot-clientsecretKeyVault
TOKENURL=https://api.hubapi.com/oauth/v1/token
```

### Datasource Files (`*-deploy-*.json`)
Each datasource file contains:
- Datasource key and metadata
- Entity type and resource type
- Field mappings and transformations
- ABAC/RBAC configuration
- OpenAPI operations

## Step 4: Validate Configuration

After the wizard generates files, validate your configuration:

```bash
# Validate the entire integration
node bin/aifabrix.js validate my-hubspot --type external

# Validate specific files
node bin/aifabrix.js validate integration/my-hubspot/hubspot-system.json
node bin/aifabrix.js validate integration/my-hubspot/hubspot-datasource-company.json
```

**Note**: Use `--type external` flag to ensure validation checks the `integration/` folder. Without the flag, it checks `builder/` folder first.

## Step 5: Manual Editing

After validation, you can manually edit the files:

1. **Edit `hubspot-system.json`**: Modify system configuration, authentication, or configuration variables
2. **Edit datasource files**: Modify field mappings, transformations, or add new datasources
3. **Edit `variables.yaml`**: Update application metadata or add new datasources to the list
4. **Edit `env.template`**: Add or modify environment variables

**Adding a new datasource:**
1. Create a new `*-deploy-*.json` file following the same structure
2. Add it to `variables.yaml` under `externalIntegration.dataSources`

## Step 6: Generate Deployment JSON

Before deploying, generate the application schema:

```bash
# Generate deployment manifest (hubspot-deploy.json) for deployment
node bin/aifabrix.js json my-hubspot --type external
```

**Note**: Use `--type external` flag to ensure it processes the `integration/` folder correctly.

## Step 7: Deploy

When ready, deploy your integration:

```bash
# Register the application (if not already registered)
node bin/aifabrix.js app register my-hubspot --environment miso

# Deploy the entire system
node bin/aifabrix.js deploy my-hubspot \
  --controller http://localhost:3110 \
  --environment miso

# Or deploy individual datasources
node bin/aifabrix.js datasource deploy hubspot-company \
  --environment miso \
  --file integration/my-hubspot/hubspot-datasource-company.json
```

## Step 8: Delete HubSpot Integration

### Delete Local Files

```bash
# Remove the integration directory
rm -rf integration/my-hubspot

# Or if using a different name
rm -rf integration/my-hubspot-integration
```

### Delete from Controller/Dataplane (if deployed)

**Via Miso Controller UI** (Recommended):
1. Navigate to your controller URL
2. Go to External Systems section
3. Find your HubSpot integration
4. Delete the system (this will also remove all associated datasources)

**Via CLI** (when available):
```bash
# Delete external system via CLI
node bin/aifabrix.js delete my-hubspot --type external --environment miso
```

**Important Notes:**
- Deleting the external system will remove all associated datasources
- Make sure to back up any important configuration before deletion
- If you're testing, deleting local files is usually sufficient

## Troubleshooting

### Wizard fails with "Dataplane service not found"
- Set `DATAPLANE_URL` environment variable
- Or ensure dataplane service is deployed in your environment

### Script hangs when dataplane is down
If the dataplane service is down, the script will now:
1. Check dataplane connectivity before running the wizard (5 second timeout)
2. Fail fast with a clear error message if dataplane is unreachable
3. Use a reduced timeout (2 minutes) for the wizard command to fail faster

**Important**: The health check tests basic connectivity. If the dataplane is partially down (responds to health checks but hangs on API calls), the wizard may still hang. In this case:
- The wizard will timeout after 2 minutes with an error message
- Ensure the dataplane service is fully operational before running the script

**Solution**: Ensure the dataplane service is running before executing the script:
```bash
# Check if dataplane is running
curl http://localhost:3200/health

# Or start the dataplane service
# (depends on your setup)
```

**If the script still hangs**:
- The dataplane may be partially down (health endpoint works but API calls hang)
- Wait for the 2-minute timeout, then check dataplane logs
- Restart the dataplane service if needed

### Files not generated
- Check wizard output for errors
- Ensure you have write permissions in `integration/` directory
- Check that OpenAPI file exists and is valid JSON

### Validation errors
- Check JSON syntax in all `-deploy.json` files
- Check YAML syntax in `variables.yaml`
- Ensure all referenced files exist
- Use `--type external` flag when validating external systems

### Cannot create new integration (name already exists)
- Delete the existing integration first (see "Delete HubSpot Integration" above)
- Or use a different app name

### Validation shows wrong file type
- Use `--type external` flag: `node bin/aifabrix.js validate my-hubspot --type external`
- This ensures validation checks the `integration/` folder instead of `builder/` folder

## Common Questions

**Q: How do I split deployment manifest into separate files?**  
A: The files are already separated! The wizard generates:
- System file: `hubspot-system.json`
- Datasource files: `hubspot-datasource-*.json`
- Deployment manifest: `hubspot-deploy.json` (generated)
- Config files: `variables.yaml`, `env.template`, `README.md`

**Q: Can I split an existing deployment manifest?**  
A: For external systems, the structure uses separate component files. The system file (`hubspot-system.json`) is the external system definition itself. Datasources are in separate files (`hubspot-datasource-*.json`). The deployment manifest (`hubspot-deploy.json`) is generated from these component files.

**Q: How do I add a new datasource?**  
A: Create a new `*-deploy-*.json` file following the same structure, then add it to `variables.yaml` under `externalIntegration.dataSources`.

**Q: How do I delete a HubSpot integration to start fresh?**  
A: Delete local files with `rm -rf integration/my-hubspot`. If deployed, delete via Controller UI or CLI command.

**Q: Why do I need `--type external` flag?**  
A: The flag tells the CLI to check the `integration/` folder instead of the `builder/` folder. Without it, commands may look in the wrong location.

## Next Steps

After creating your integration:
1. Review generated field mappings in datasource files
2. Customize transformations as needed
3. Add additional datasources if required
4. Configure ABAC/RBAC rules
5. Test with real HubSpot credentials
6. Deploy to your environment

## See Also

- [README.md](./README.md) - HubSpot integration documentation
- [Wizard Documentation](../../docs/wizard.md) - Complete wizard reference
- [External Systems Guide](../../docs/external-systems.md) - Complete guide with examples
