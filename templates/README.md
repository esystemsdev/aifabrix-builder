# AI Fabrix Builder Templates

These are Handlebars (.hbs) template files that generate Docker files and application configurations for AI Fabrix applications. They should NOT be linted as Dockerfiles since they contain template variables that will be replaced during generation.

## Template Structure

The templates directory is organized as follows:

### Application Templates (for `--template` flag)

Application templates are folder-based and located under `templates/applications/`. When you use `--template <name>`, the tool looks for `templates/applications/<name>/` and copies all files from that folder to `builder/<app>/`.

**Example:**
- `templates/applications/miso-controller/` - Miso Controller application template
- `templates/applications/keycloak/` - Keycloak application template

**Template Validation:**
- Template folder must exist in `templates/applications/<name>/`
- Template folder must contain at least one file
- Hidden files (starting with `.`) are skipped
- If a template includes a `Dockerfile`, it will be copied to `builder/<app>/Dockerfile` along with other files

### Language Templates

- `python/Dockerfile.hbs` - Python application Dockerfile template
- `python/docker-compose.hbs` - Python application docker-compose template
- `typescript/Dockerfile.hbs` - TypeScript/Node.js application Dockerfile template
- `typescript/docker-compose.hbs` - TypeScript/Node.js application docker-compose template

### Infrastructure Templates

- `infra/compose.yaml` - Infrastructure services docker-compose template

### GitHub Workflow Templates

- `github/ci.yaml.hbs` - Continuous Integration workflow
- `github/pr-checks.yaml.hbs` - Pull Request checks workflow
- `github/release.yaml.hbs` - Release and publish workflow
- `github/test.yaml.hbs` - Test workflow

### GitHub Workflow Step Templates (for `--github-steps` flag)

Extra workflow steps are located in `templates/github/steps/`. When you use `--github-steps <steps>`, the tool loads step templates from `templates/github/steps/{step}.hbs` and includes them in the generated workflows.

**Example:**
- `github/steps/npm.hbs` - NPM publishing step
- `github/steps/test.hbs` - Custom test step

**Step Templates:**
- Step templates are Handlebars templates that generate workflow job definitions
- They receive the same context as the main workflow templates
- Step templates are rendered and included in workflow files based on the `githubSteps` array

## Template Variables

### Application Configuration
- `{{app.key}}` - Application key/identifier
- `{{image.name}}` - Container image name
- `{{image.tag}}` - Container image tag (defaults to "latest")
- `{{port}}` - Application port from schema
- `{{startupCommand}}` - Custom startup command (optional)

### Health Check Configuration
- `{{healthCheck.path}}` - Health check endpoint path (e.g., "/health")
- `{{healthCheck.interval}}` - Health check interval in seconds

### Service Requirements
- `{{requiresDatabase}}` - Database requirement flag (conditional db-init service)
- `{{requiresStorage}}` - Storage requirement flag (conditional volume mounting)
- `{{databases}}` - Array of database configurations

### Build Configuration
- `{{build.localPort}}` - Local development port (different from Docker port)
- `{{mountVolume}}` - Volume mount path for local development

## Usage

### Application Templates

Use `--template <name>` when creating an application:

```bash
aifabrix create myapp --template miso-controller --port 3000
```

This validates that `templates/applications/miso-controller/` exists and copies all files (including Dockerfile if present) from it to `builder/myapp/`.

### GitHub Workflow Steps

Use `--github-steps <steps>` when creating an application with GitHub workflows:

```bash
aifabrix create myapp --github --github-steps npm
```

This loads step templates from:
- `templates/github/steps/npm.hbs`

And includes them in the generated workflow files (e.g., `release.yaml`).

**Currently available step templates:**
- `npm.hbs` - Adds NPM publishing job to release workflow

**Creating custom step templates:**
Create your own step templates in `templates/github/steps/{your-step}.hbs` and reference them in `--github-steps`.

### Language and Infrastructure Templates

These templates are processed automatically by the AI Fabrix Builder SDK based on the application schema defined in `variables.yaml`. The generated files will be valid Docker files after template processing.

## VS Code Configuration

The `.vscode/settings.json` file is configured to:
- Treat `.hbs` files as Handlebars templates (not Dockerfiles)
- Ignore template files from Docker linting
- Prevent false linting errors on template variables

## Generated Output

After processing, these templates generate:
- Valid Dockerfiles with proper syntax
- Docker-compose files with conditional services
- Infrastructure configurations with shared services only
