# GitHub Workflows Documentation

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
2. **Publish NPM** - Package publishing (if enabled)
3. **Create Release** - GitHub release creation

**Features:**
- Version tag validation
- NPM publishing with authentication
- GitHub release with changelog
- Conditional NPM publishing

### Pull Request Checks (`pr-checks.yaml`)

**Triggers:**
- Pull request events (opened, synchronized, reopened)

**Checks:**
- File size validation (≤500 lines)
- TODO detection in modified files
- Conventional commit message validation

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

### Deployment Integration

Workflows can integrate with AI Fabrix deployment:

```yaml
# .github/workflows/deploy.yaml
name: Deploy to AI Fabrix

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to AI Fabrix
        run: |
          aifabrix build {{appName}}
          aifabrix push {{appName}} --registry ${{ secrets.ACR_REGISTRY }}
          aifabrix deploy {{appName}} --controller ${{ secrets.CONTROLLER_URL }}
        env:
          AIFABRIX_SECRETS: ${{ secrets.AIFABRIX_SECRETS }}
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
    strategy:
      matrix:
        environment: [staging, production]
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to ${{ matrix.environment }}
        run: |
          aifabrix deploy {{appName}} \
            --controller ${{ secrets.CONTROLLER_URL }} \
            --environment ${{ matrix.environment }}
        if: |
          (matrix.environment == 'staging' && github.ref == 'refs/heads/develop') ||
          (matrix.environment == 'production' && github.ref == 'refs/heads/main')
```

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
