# Quick Start Guide

Get your AI Fabrix application running in 5 minutes.

← [Back to README](../README.md)

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
- Language? *TypeScript/Node.js or Python* (list selector)
- Need database? *y/n*
- Need Redis? *y/n*
- Need storage? *y/n*
- Need authentication? *y/n*
- Need GitHub Actions workflows? *y/n*
- Need Controller deployment workflow? *y/n* (if GitHub=yes)
- Controller URL? *(if Controller=yes)*

**What gets created:**
- `builder/<app>/variables.yaml` - App configuration
- `builder/<app>/env.template` - Environment variables  
- `builder/<app>/rbac.yaml` - Roles & permissions (if authentication=yes)
- `builder/<app>/aifabrix-deploy.json` - Deployment manifest

**Pro tip:** Use flags to skip prompts:
```bash
aifabrix create myapp --port 3000 --database --language typescript
```

**Want GitHub Actions workflows?** Add `--github`:
```bash
aifabrix create myapp --github --main-branch main
```

**Want to use a template?** Add `--template`:
```bash
aifabrix create myapp --template controller --port 3000
```

**Want extra GitHub workflow steps?** Add `--github-steps`:
```bash
aifabrix create myapp --github --github-steps npm
```
**Note:** Step templates must exist in `templates/github/steps/{step}.hbs`. The `npm` step adds NPM publishing to the release workflow.

## Step 4: Review Configuration

### builder/myapp/variables.yaml
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

### builder/myapp/env.template
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

**For deployment (repository level):**
- `AIFABRIX_API_URL` - Controller URL (e.g., `https://controller.aifabrix.ai`)

**For deployment (environment level, e.g., dev):**
- `DEV_AIFABRIX_CLIENT_ID` - Pipeline ClientId from registration
- `DEV_AIFABRIX_CLIENT_SECRET` - Pipeline ClientSecret from registration

**Optional:**
- `NPM_TOKEN` - For publishing packages
- `CODECOV_TOKEN` - For coverage reporting

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

## Step 7: Register Application

Before deploying, register your application to get pipeline credentials:

```bash
# Login to controller
aifabrix login --url https://controller.aifabrix.ai

# Register application
aifabrix app register myapp --environment dev

# Credentials are automatically saved locally
```

## Step 8: Deploy to Azure

### Manual Deployment

```bash
# Push to Azure Container Registry
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0

# Deploy via Miso Controller
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

### Automated CI/CD Deployment

1. **Add secrets in GitHub repository settings:**
   - `AIFABRIX_CLIENT_ID` - From registration
   - `AIFABRIX_CLIENT_SECRET` - From registration
   - `AIFABRIX_API_URL` - Controller URL

2. **Set up GitHub Actions workflow** (see [GitHub Workflows Guide](GITHUB-WORKFLOWS.md))

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
# builder/myapp/variables.yaml
requires:
  databases:
    - name: myapp
    - name: myapp-analytics  # Add this
```

**Add environment variable:**
```bash
# builder/myapp/env.template
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
1. Register application: `aifabrix app register myapp --environment dev`
2. Add secrets in repository settings:
   - Repository level: `AIFABRIX_API_URL` - Your controller URL
   - Environment level (dev): `DEV_AIFABRIX_CLIENT_ID` and `DEV_AIFABRIX_CLIENT_SECRET` - From registration output
3. Push your code to GitHub
4. Watch automatic deployment!

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
