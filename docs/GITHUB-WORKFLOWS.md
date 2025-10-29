# GitHub Workflows Documentation

→ [Back to Quick Start](QUICK-START.md)

Complete guide to GitHub Actions workflow generation and customization.

---

## Overview

The AI Fabrix Builder can automatically generate GitHub Actions workflows for your application, providing:

- **CI/CD Pipeline** - Automated testing, linting, and building
- **Release Management** - Automated publishing and GitHub releases
- **Pull Request Checks** - Code quality and convention validation
- **Security Auditing** - Dependency vulnerability scanning

---

## Generating Workflows

### Basic Generation

Generate workflows during application creation:

```bash
aifabrix create myapp --github
```

This creates:
- `.github/workflows/ci.yaml` - Main CI/CD pipeline
- `.github/workflows/release.yaml` - Release and publishing
- `.github/workflows/pr-checks.yaml` - Pull request validation

### Custom Configuration

```bash
aifabrix create myapp --github --main-branch develop
```

**Options:**
- `--github` - Enable workflow generation
- `--main-branch <branch>` - Set main branch name (default: main)
- `--github-steps <steps>` - Extra GitHub workflow steps (comma-separated, e.g., `npm`). Step templates must exist in `templates/github/steps/{step}.hbs`

### Adding Custom Workflow Steps

You can include custom step templates in your workflows using `--github-steps`:

```bash
aifabrix create myapp --github --github-steps npm
```

**What happens:**
1. Loads step template from `templates/github/steps/npm.hbs`
2. Renders the template with application context
3. Injects the rendered content into workflow files (e.g., `release.yaml`)

**Available step templates:**
- `npm` - Adds NPM publishing job to release workflow

**Creating custom step templates:**
1. Create a file: `templates/github/steps/{your-step}.hbs`
2. Write Handlebars template with workflow YAML content
3. Use available template variables: `{{appName}}`, `{{language}}`, `{{port}}`, etc.
4. Include it: `aifabrix create myapp --github --github-steps your-step`

**Step template example (`templates/github/steps/npm.hbs`):**
```yaml
  publish-npm:
    name: Publish to NPM
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build package
        run: npm run build
      - name: Publish to NPM
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Workflow Templates

### CI/CD Pipeline (`ci.yaml`)

**Triggers:**
- Push to main/develop branches
- Pull requests to main branch

**Jobs:**
1. **Lint** - ESLint code quality checks
2. **Test** - Jest test suite with coverage
3. **Security** - npm audit for vulnerabilities
4. **Build** - Package building (if build command specified)

**Features:**
- Node.js 18 and 20 matrix testing
- Codecov integration for coverage reporting
- Security vulnerability scanning
- Conditional build job

### Release Pipeline (`release.yaml`)

**Triggers:**
- Push of version tags (`v*.*.*`)

**Jobs:**
1. **Validate** - Pre-release validation
2. **Publish NPM** - Package publishing (if `npm` step is included via `--github-steps`)
3. **Create Release** - GitHub release creation

**Features:**
- Version tag validation
- NPM publishing with authentication (conditional, based on included steps)
- GitHub release with changelog
- Conditional NPM publishing (if `npm` step template is included)
- Custom workflow steps (injected from step templates specified via `--github-steps`)

### Pull Request Checks (`pr-checks.yaml`)

**Triggers:**
- Pull request events (opened, synchronized, reopened)

**Checks:**
- File size validation (≤500 lines)
- TODO detection in modified files
- Conventional commit message validation

---

## Pipeline Deployment Setup

Before using automated pipeline deployment in GitHub Actions, you must register your application.

### Prerequisites

1. AI Fabrix CLI installed and authenticated
2. Application variables.yaml configured
3. Access to controller environment (dev/tst/pro)

### Step 1: Login to Controller

```bash
aifabrix login --url https://controller.aifabrix.ai
```

This authenticates you via Keycloak OIDC flow.

### Step 2: Register Application

```bash
aifabrix app register myapp --environment dev
```

**What happens:**
1. Reads configuration from `builder/myapp/variables.yaml` automatically
2. Creates minimal configuration if file doesn't exist
3. Registers with controller
4. Saves credentials to `~/.aifabrix/secrets-dev.yaml`
5. Displays setup instructions

**Output:**
```
✓ Application registered successfully!

📋 Application Details:
   Key:          myapp
   Display Name: My Application
   Environment:  dev

🔑 Credentials saved to: ~/.aifabrix/secrets-dev.yaml

📝 Add to GitHub Secrets:
   Repository level:
     AIFABRIX_API_URL = https://controller.aifabrix.ai
   
   Environment level (dev):
     DEV_AIFABRIX_CLIENT_ID = ctrl-dev-myapp
     DEV_AIFABRIX_CLIENT_SECRET = xyz-abc-123...
```

**Important:** Credentials are automatically saved locally. Copy them to GitHub Secrets.

### Step 3: Add to GitHub Secrets

1. Go to repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add repository-level secret:
   - **Name:** `AIFABRIX_API_URL` **Value:** `https://controller.aifabrix.ai`
4. Add environment-level secrets (for dev environment):
   - **Name:** `DEV_AIFABRIX_CLIENT_ID` **Value:** `ctrl-dev-myapp`
   - **Name:** `DEV_AIFABRIX_CLIENT_SECRET` **Value:** (from registration output)
   
**Note:** For other environments (staging/production), use `TST_` or `PRO_` prefixes.

### Step 4: Set Up Workflow

Create `.github/workflows/deploy.yaml` with pipeline API calls (see [Integration with AI Fabrix](#integration-with-ai-fabrix)).

### Secret Rotation

To rotate your ClientSecret (expires after 90 days):

```bash
aifabrix app rotate-secret --app myapp --environment dev
```

**Output:**
```
⚠️  This will invalidate the old ClientSecret!

✓ Secret rotated successfully!

📋 Application Details:
   Key:         myapp
   Environment: dev

🔑 NEW CREDENTIALS:
   Client ID:     ctrl-dev-myapp
   Client Secret: xyz-new-secret-789

⚠️  Old secret is now invalid. Update GitHub Secrets!
```

This updates credentials in `~/.aifabrix/secrets-dev.yaml`. Then update `DEV_AIFABRIX_CLIENT_SECRET` in GitHub Secrets.

→ [See CLI Reference for `app register` command](CLI-REFERENCE.md#app-register)

---

## Template Variables

Workflows use Handlebars templating with these variables:

### Application Variables
- `{{appName}}` - Application name
- `{{language}}` - Runtime language (typescript/python)
- `{{port}}` - Application port
- `{{fileExtension}}` - File extension (js/py)
- `{{sourceDir}}` - Source directory (lib/src)

### Service Variables
- `{{database}}` - Database enabled (true/false)
- `{{redis}}` - Redis enabled (true/false)
- `{{storage}}` - Storage enabled (true/false)
- `{{authentication}}` - Authentication enabled (true/false)

### Workflow Variables
- `{{mainBranch}}` - Main branch name
- `{{buildCommand}}` - Build command
- `{{uploadCoverage}}` - Enable coverage upload
- `{{publishToNpm}}` - Enable NPM publishing

### Step Template Variables
When creating custom step templates (`templates/github/steps/*.hbs`), you have access to:
- All application variables above
- `{{githubSteps}}` - Array of step names specified via `--github-steps`
- `{{stepContent}}` - Object mapping step names to their rendered content (access via `{{lookup ../stepContent "step-name"}}`)
- `{{hasSteps}}` - Boolean indicating if any steps were provided
- `{{hasNpmStep}}` - Boolean indicating if `npm` step was included

---

## Customization

### Modifying Generated Workflows

After generation, workflows are standard GitHub Actions files that can be edited:

```yaml
# .github/workflows/ci.yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Your custom jobs here
  custom-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Custom step
        run: echo "Custom workflow step"
```

### Adding Custom Steps

Add additional steps to existing jobs:

```yaml
jobs:
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      # Add custom step
      - name: Custom test
        run: npm run test:custom
```

### Environment-Specific Workflows

Create environment-specific workflows:

```yaml
# .github/workflows/deploy-staging.yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          echo "Deploying {{appName}} to staging"
          # Your deployment commands
```

---

## Required Secrets

### NPM Publishing

For NPM package publishing, add these secrets to your repository:

1. **NPM_TOKEN** - NPM authentication token
   - Generate at: https://www.npmjs.com/settings/tokens
   - Required scopes: `publish`, `read`

### Codecov Integration

For coverage reporting:

1. **CODECOV_TOKEN** - Codecov upload token (optional)
   - Generate at: https://codecov.io/settings/tokens

### AI Fabrix Pipeline Deployment

For automated deployment via pipeline API:

**Repository level:**
1. **AIFABRIX_API_URL** - Controller API endpoint (e.g., `https://controller.aifabrix.ai`)

**Environment level (dev/staging/production):**
2. **DEV_AIFABRIX_CLIENT_ID** - Pipeline ClientId from application registration
3. **DEV_AIFABRIX_CLIENT_SECRET** - Pipeline ClientSecret from application registration

**Getting Pipeline Credentials:**
```bash
# Login to controller
aifabrix login --url https://controller.aifabrix.ai

# Register application
aifabrix app register myapp --environment dev

# Credentials saved to ~/.aifabrix/secrets-dev.yaml
# Copy them to GitHub Secrets!
```

See [Application Registration](#pipeline-deployment-setup) for details.

### Custom Secrets

Add custom secrets for your application:

```yaml
# In your workflow
- name: Use custom secret
  run: echo "Using secret: ${{ secrets.CUSTOM_SECRET }}"
```

---

## Language-Specific Configurations

### TypeScript/Node.js Projects

**Default configuration:**
- Source directory: `lib/`
- File extension: `js`
- Build command: `npm run build`
- Test command: `npm test`

**Custom package.json scripts:**
```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "lint": "eslint . --ext .js"
  }
}
```

### Python Projects

**Default configuration:**
- Source directory: `src/`
- File extension: `py`
- Build command: `python -m build`
- Test command: `pytest`

**Custom workflow for Python:**
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.8, 3.9, '3.10', '3.11']
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Run tests
        run: pytest
```

---

## Best Practices

### Workflow Organization

1. **Keep workflows focused** - One workflow per purpose
2. **Use matrix strategies** - Test multiple Node.js/Python versions
3. **Cache dependencies** - Speed up builds with caching
4. **Fail fast** - Stop on first error to save resources

### Security

1. **Use secrets for sensitive data** - Never hardcode tokens
2. **Limit secret scopes** - Use minimal required permissions
3. **Review dependencies** - Regularly update action versions
4. **Enable branch protection** - Require status checks

### Performance

1. **Parallel jobs** - Run independent jobs in parallel
2. **Conditional steps** - Skip unnecessary steps
3. **Artifact caching** - Cache build artifacts between runs
4. **Resource optimization** - Use appropriate runner sizes

---

## Troubleshooting

### Common Issues

**Workflow not triggering:**
- Check branch names match `mainBranch` setting
- Verify workflow file syntax
- Ensure workflow files are in `.github/workflows/`

**Build failures:**
- Check Node.js/Python version compatibility
- Verify package.json/requirements.txt dependencies
- Review build command configuration

**Permission errors:**
- Verify repository secrets are configured
- Check NPM token permissions
- Ensure GitHub token has required scopes

**Coverage upload failures:**
- Verify Codecov token (if using private repos)
- Check coverage file paths
- Ensure coverage reports are generated

### Debugging

**Enable debug logging:**
```yaml
- name: Debug step
  run: echo "Debug information"
  env:
    ACTIONS_STEP_DEBUG: true
```

**View workflow logs:**
1. Go to repository Actions tab
2. Click on failed workflow run
3. Expand job steps to see detailed logs

---

## Examples

### Complete TypeScript Project

```bash
# Create with GitHub workflows
aifabrix create my-ts-app --port 3000 --database --authentication --github

# Generated structure:
# .github/workflows/
#   ├── ci.yaml
#   ├── release.yaml
#   └── pr-checks.yaml
# builder/my-ts-app/
#   ├── variables.yaml
#   ├── env.template
#   ├── rbac.yaml
#   └── aifabrix-deploy.json
```

### Python Project with Custom Workflow

```bash
# Create Python app
aifabrix create my-python-app --language python --port 8000 --github

# Add custom Python workflow
cat > .github/workflows/python-specific.yaml << 'EOF'
name: Python Specific Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  python-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.8, 3.9, '3.10', '3.11']
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Run tests
        run: pytest --cov=src
EOF
```

---

## Integration with AI Fabrix

### Pipeline Deployment Integration

Use the Pipeline API for automated deployments with proper authentication.

**Note:** The `/api/pipeline/validate` endpoint returns a **one-time use token** (`validateToken`) that expires after deployment. This is designed for CI/CD pipeline flows only - there's no standalone `aifabrix validate` CLI command because the token is only valid during a single deployment sequence.

**Response from validate endpoint:**
```json
{
  "valid": true,
  "validateToken": "eyJhbGciOiJSUzI1NiIs...",               // One-time use token for this deployment
  "imageServer": "myacr.azurecr.io",                        // Registry server (ACR, Docker Hub, GitHub, etc.)
  "imageUsername": "00000000-0000-0000-0000-000000000000",  // Registry username
  "imagePassword": "password123...",                        // Registry password
  "expiresAt": "2024-01-01T12:00:00Z",
  "draftDeploymentId": "draft-123",
  "errors": []
}
```

Use the Pipeline API for automated deployments:

```yaml
# .github/workflows/deploy.yaml
name: Deploy to AI Fabrix

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Image
        run: |
          docker build -t myapp:${{ github.sha }} .
      
      - name: Validate and Get Registry Credentials
        id: validate
        run: |
          RESPONSE=$(curl -X POST "${{ secrets.AIFABRIX_API_URL }}/api/pipeline/validate" \
            -H "Content-Type: application/json" \
            -d '{
              "clientId": "${{ secrets.DEV_AIFABRIX_CLIENT_ID }}",
              "clientSecret": "${{ secrets.DEV_AIFABRIX_CLIENT_SECRET }}",
              "repositoryUrl": "${{ github.server_url }}/${{ github.repository }}",
              "applicationConfig": $(cat application.json)
            }')
          echo "validateToken=$(echo $RESPONSE | jq -r '.validateToken')" >> $GITHUB_OUTPUT
          echo "imageServer=$(echo $RESPONSE | jq -r '.imageServer')" >> $GITHUB_OUTPUT
          echo "imageUsername=$(echo $RESPONSE | jq -r '.imageUsername')" >> $GITHUB_OUTPUT
          echo "imagePassword=$(echo $RESPONSE | jq -r '.imagePassword')" >> $GITHUB_OUTPUT
      
      - name: Push to Registry
        run: |
          echo ${{ steps.validate.outputs.imagePassword }} | docker login ${{ steps.validate.outputs.imageServer }} -u ${{ steps.validate.outputs.imageUsername }} --password-stdin
          docker tag myapp:${{ github.sha }} ${{ steps.validate.outputs.imageServer }}/myapp:${{ github.sha }}
          docker push ${{ steps.validate.outputs.imageServer }}/myapp:${{ github.sha }}
      
      - name: Deploy Application
        run: |
          curl -X POST "${{ secrets.AIFABRIX_API_URL }}/api/pipeline/deploy" \
            -H "Content-Type: application/json" \
            -d '{
              "validateToken": "${{ steps.validate.outputs.validateToken }}",
              "imageTag": "${{ github.sha }}"
            }'
```

### Environment-Specific Deployments

```yaml
# .github/workflows/deploy-environments.yaml
name: Deploy to Environments

on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: 
      name: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and Deploy
        run: |
          docker build -t myapp:${{ github.sha }} .
          
          # Get environment-specific credentials
          RESPONSE=$(curl -X POST "${{ secrets.AIFABRIX_API_URL }}/api/pipeline/validate" \
            -H "Content-Type: application/json" \
            -d '{
              "clientId": "${{ secrets.DEV_AIFABRIX_CLIENT_ID }}",
              "clientSecret": "${{ secrets.DEV_AIFABRIX_CLIENT_SECRET }}",
              "repositoryUrl": "${{ github.server_url }}/${{ github.repository }}",
              "applicationConfig": $(cat application.json)
            }')
          
          # Push and deploy...
          # (same as above)
```

**Important notes about the validate endpoint:**

1. **One-time use token**: The `validateToken` expires after a single deployment is completed. It cannot be reused.

2. **Generic registry support**: The `imageServer`, `imageUsername`, and `imagePassword` fields work with any container registry (Azure Container Registry, Docker Hub, GitHub Container Registry, etc.).

3. **CI/CD only**: The validate endpoint is designed for automated pipeline use. For local CLI deployments, use `aifabrix deploy` which handles everything automatically.

4. **No standalone CLI**: There's no `aifabrix validate` command because the validate token is consumed during the deployment workflow.

---

## Advanced Features

### Custom Templates

Create custom workflow templates:

```bash
# Create custom template directory
mkdir -p templates/github/custom

# Add custom template
cat > templates/github/custom/custom-workflow.yaml.hbs << 'EOF'
name: Custom Workflow for {{appName}}

on:
  push:
    branches: [{{mainBranch}}]

jobs:
  custom-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Custom step for {{appName}}
        run: echo "Running custom workflow for {{appName}}"
EOF
```

### Conditional Workflows

Use Handlebars conditionals in templates:

```yaml
{{#if database}}
- name: Database tests
  run: npm run test:database
{{/if}}

{{#if authentication}}
- name: Authentication tests
  run: npm run test:auth
{{/if}}
```

### Multi-Environment Support

```yaml
jobs:
  {{#each environments}}
  deploy-{{this}}:
    runs-on: ubuntu-latest
    environment: {{this}}
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to {{this}}
        run: aifabrix deploy {{appName}} --environment {{this}}
  {{/each}}
```

---

## Migration Guide

### From Manual Workflows

If you have existing GitHub workflows:

1. **Backup existing workflows**
2. **Generate new workflows** with `aifabrix create --github`
3. **Compare and merge** customizations
4. **Test thoroughly** before removing old workflows

### Updating Workflows

To update generated workflows:

1. **Regenerate workflows** (backup first)
2. **Apply customizations** from backup
3. **Test updated workflows**
4. **Commit changes**

---

## Support

For workflow-related issues:

1. **Check GitHub Actions documentation**
2. **Review workflow logs** in repository Actions tab
3. **Validate YAML syntax** with online validators
4. **Test workflows** in feature branches first

For AI Fabrix Builder specific issues:

1. **Run `aifabrix doctor`** to check environment
2. **Check CLI reference** for command options
3. **Review configuration files** for errors
4. **Enable debug logging** for detailed output
