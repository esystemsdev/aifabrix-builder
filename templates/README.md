# AI Fabrix Builder Templates

These are Handlebars (.hbs) template files that generate Docker files for AI Fabrix applications. They should NOT be linted as Dockerfiles since they contain template variables that will be replaced during generation.

## Template Files

- `python/Dockerfile.hbs` - Python application Dockerfile template
- `python/docker-compose.hbs` - Python application docker-compose template
- `typescript/Dockerfile.hbs` - TypeScript/Node.js application Dockerfile template
- `typescript/docker-compose.hbs` - TypeScript/Node.js application docker-compose template
- `infra/compose.yaml` - Infrastructure services docker-compose template

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

These templates are processed by the AI Fabrix Builder SDK based on the application schema defined in `variables.yaml`. The generated files will be valid Docker files after template processing.

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
