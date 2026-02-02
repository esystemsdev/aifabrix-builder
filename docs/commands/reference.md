# Command Reference

← [Back to Commands Index](README.md) | [Back to Your Own Applications](../your-own-applications.md)

Reference information for CLI commands including common workflows, global options, exit codes, configuration, and getting help.

---

## Common Workflows

### Local Development
```bash
# Start
aifabrix up-infra
aifabrix create myapp
aifabrix build myapp
aifabrix run myapp

# After code changes
aifabrix build myapp
aifabrix run myapp

# View logs
docker logs aifabrix-myapp -f

# Stop
docker stop aifabrix-myapp
```

### Azure Deployment
```bash
# Build and push
aifabrix build myapp
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0

# Deploy (uses controller and environment from config)
aifabrix deploy myapp
```

### Troubleshooting
```bash
# Check everything
aifabrix doctor

# Regenerate files
aifabrix resolve myapp
aifabrix json myapp
aifabrix genkey myapp

# View configuration
cat builder/myapp/variables.yaml
cat builder/myapp/.env
cat builder/myapp/aifabrix-deploy.json
```

---

## Global Options

All commands support:

**`--help`** - Show help
```bash
aifabrix --help
aifabrix build --help
```

**`--version`** - Show version
```bash
aifabrix --version
```

**`--verbose`** - Detailed output
```bash
aifabrix build myapp --verbose
```

---

## Configuration (config.yaml)

Set these keys in `~/.aifabrix/config.yaml`:

- aifabrix-home: Base directory for local files (default `~/.aifabrix`)
  - Example: `aifabrix-home: "/custom/path"`
- aifabrix-secrets: Default secrets file path (default `<home>/secrets.yaml`)
  - Example: `aifabrix-secrets: "/path/to/secrets.yaml"`
- developer-id: Developer ID for port isolation (default: 0)
  - Example: `developer-id: 1` (sets ports to basePort + 100)
  - See [Developer Isolation](../developer-isolation.md) for details

---

## Exit Codes

- **0** - Success
- **1** - General error
- **2** - Invalid arguments
- **3** - Docker not running
- **4** - Configuration invalid
- **5** - Build failed
- **6** - Deployment failed

**Use in scripts:**
```bash
if aifabrix build myapp; then
  echo "Build succeeded"
else
  echo "Build failed with exit code $?"
fi
```

---

## Getting Help

**Command help:**
```bash
aifabrix <command> --help
```

**Check environment:**
```bash
aifabrix doctor
```

**Documentation:**
- [Your Own Applications](../your-own-applications.md)
- [Infrastructure](../infrastructure.md)
- [Configuration](../configuration/README.md)
- [Building](../building.md)
- [Running](../running.md)
- [Deploying](../deploying.md)
- [Developer Isolation](../developer-isolation.md)

