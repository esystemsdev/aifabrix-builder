# Quick Start Guide

Get your AI Fabrix application running in 5 minutes.

## Step 1: Install

```bash
npm install -g @aifabrix/builder
```

## Step 2: Start Infrastructure

```bash
aifabrix up
```

**What starts:**
- PostgreSQL at localhost:5432
- Redis at localhost:6379

**First time?** Docker downloads images (takes 2-3 minutes).

→ [What is Infrastructure?](INFRASTRUCTURE.md)

## Step 3: Create Your App

```bash
aifabrix create myapp
```

**You'll be asked:**
- Port? *(default: 3000)*
- Need database? *y/n*
- Need Redis? *y/n*
- Need storage? *y/n*
- Need authentication? *y/n*
- Language? *typescript/python*

**What gets created:**
- `builder/variables.yaml` - App configuration
- `builder/env.template` - Environment variables  
- `builder/rbac.yaml` - Roles & permissions (if authentication=yes)

**Pro tip:** Use flags to skip prompts:
```bash
aifabrix create myapp --port 3000 --database --language typescript
```

**Want GitHub Actions workflows?** Add `--github`:
```bash
aifabrix create myapp --github --main-branch main
```

## Step 4: Review Configuration

### builder/variables.yaml
```yaml
app:
  key: myapp
  displayName: "My App"
  port: 3000

requires:
  database: true
  databases:
    - name: myapp

build:
  language: typescript
```

**What to check:**
- Display name looks good?
- Need more databases? Add them to the list
- Want different local port? Set `build.localPort`

### builder/env.template
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=kv://databases-0-urlKeyVault
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

**What to add:**
- Your app's environment variables
- API keys (use `kv://key-name` for secrets)
- Feature flags

**Have existing .env?** Copy variables here. The SDK converts them to templates.

→ [Configuration Reference](CONFIGURATION.md)

### GitHub Actions Workflows (Optional)

If you used `--github`, you'll also have:
- `.github/workflows/ci.yaml` - CI/CD pipeline
- `.github/workflows/release.yaml` - Release automation  
- `.github/workflows/pr-checks.yaml` - Pull request validation

**What they do:**
- **CI Pipeline** - Runs tests, linting, and security checks on every push/PR
- **Release Pipeline** - Publishes to NPM and creates GitHub releases on version tags
- **PR Checks** - Validates code quality and commit conventions

**Required secrets** (add in GitHub repository settings):
- `NPM_TOKEN` - For publishing packages
- `CODECOV_TOKEN` - For coverage reporting (optional)

→ [GitHub Workflows Guide](GITHUB-WORKFLOWS.md)

## Step 5: Build

```bash
aifabrix build myapp
```

**What happens:**
1. Looks for `Dockerfile` in your app root
2. If not found, generates from template (Node 20 Alpine or Python 3.11 Alpine)
3. Builds Docker image: `myapp:latest`
4. Creates `.env` file from `env.template`

**Want to use your own Dockerfile?**  
Place it in your app root - the SDK will use it.

**Need to regenerate template?**  
```bash
aifabrix build myapp --force-template
```

→ [Building Details](BUILDING.md)

## Step 6: Run

```bash
aifabrix run myapp
```

**What happens:**
- Starts container as `aifabrix-myapp`
- Connects to Postgres and Redis
- Maps port for localhost access

**Access your app:**  
http://localhost:3000 (or your port)

**View logs:**
```bash
docker logs aifabrix-myapp -f
```

**Stop app:**
```bash
docker stop aifabrix-myapp
```

→ [Running Details](RUNNING.md)

## Step 7: Deploy to Azure

```bash
# Push to Azure Container Registry
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0

# Deploy via Miso Controller
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

→ [Deployment Guide](DEPLOYING.md)

---

## Next Steps

### Learn More
- [All CLI Commands](CLI-REFERENCE.md) - Complete command reference
- [Configuration](CONFIGURATION.md) - Detailed config file docs
- [Building](BUILDING.md) - Custom Dockerfiles and templates
- [Running](RUNNING.md) - Local development workflow
- [GitHub Workflows](GITHUB-WORKFLOWS.md) - CI/CD automation setup

### Install Platform Apps
- [Keycloak](INFRASTRUCTURE.md#install-keycloak) - Authentication and user management
- [Miso Controller](INFRASTRUCTURE.md#install-miso-controller) - Azure deployment

### Common Tasks

**Add another database:**
```yaml
# builder/variables.yaml
requires:
  databases:
    - name: myapp
    - name: myapp-analytics  # Add this
```

**Add environment variable:**
```bash
# builder/env.template
MY_API_KEY=kv://my-api-keyKeyVault
```

**Rebuild after code changes:**
```bash
aifabrix build myapp
aifabrix run myapp
```

**Check if everything is working:**
```bash
aifabrix doctor
```

**Set up GitHub Actions (if you used --github):**
1. Push your code to GitHub
2. Add `NPM_TOKEN` secret in repository settings
3. Create a version tag: `git tag v1.0.0 && git push origin v1.0.0`
4. Watch workflows run automatically!

---

## Troubleshooting

**"Docker is not running"**  
→ Start Docker Desktop

**"Port 5432 already in use"**  
→ Stop other Postgres: `docker stop <container>`

**"Infrastructure not running"**  
→ `aifabrix up`

**"Build failed"**  
→ Check Dockerfile syntax  
→ Run `aifabrix doctor` to check Docker

**"Can't connect to database"**  
→ Check `DATABASE_URL` in `.env`  
→ Verify database exists: `docker exec aifabrix-postgres psql -U pgadmin -l`

**"GitHub Actions failing"**  
→ Check repository secrets are configured  
→ Verify NPM token has publish permissions  
→ Review workflow logs in GitHub Actions tab

→ [More Help](CLI-REFERENCE.md)
