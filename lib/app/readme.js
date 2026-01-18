/**
 * Application README.md Generation
 *
 * Generates README.md files for applications based on configuration
 *
 * @fileoverview README.md generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const handlebars = require('handlebars');

/**
 * Checks if a file exists
 * @async
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats application name for display (capitalize first letter of each word)
 * @param {string} appName - Application name
 * @returns {string} Formatted display name
 */
function formatAppDisplayName(appName) {
  return appName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Loads and compiles README.md template
 * @returns {Function} Compiled Handlebars template
 * @throws {Error} If template not found
 * @private
 */
function _loadReadmeTemplate() {
  // Use getProjectRoot to reliably find templates in all environments
  const { getProjectRoot } = require('../utils/paths');
  const projectRoot = getProjectRoot();
  const templatePath = path.join(projectRoot, 'templates', 'applications', 'README.md.hbs');

  if (!fsSync.existsSync(templatePath)) {
    // Provide helpful error message with actual paths checked
    const errorMessage = `README template not found at ${templatePath}\n` +
      `  Project root: ${projectRoot}\n` +
      `  Templates directory: ${path.join(projectRoot, 'templates', 'applications')}\n` +
      `  Global PROJECT_ROOT: ${typeof global !== 'undefined' && global.PROJECT_ROOT ? global.PROJECT_ROOT : 'not set'}`;
    throw new Error(errorMessage);
  }

  const templateContent = fsSync.readFileSync(templatePath, 'utf8');
  return handlebars.compile(templateContent);
}

/**
 * Generates README.md content for an application using Handlebars template
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {string} README.md content
 */
/**
 * Extracts service flags from config
 * @function extractServiceFlags
 * @param {Object} config - Application configuration
 * @returns {Object} Service flags object
 */
function extractServiceFlags(config) {
  return {
    hasDatabase: config.database || config.requires?.database || false,
    hasRedis: config.redis || config.requires?.redis || false,
    hasStorage: config.storage || config.requires?.storage || false,
    hasAuthentication: config.authentication || false
  };
}

/**
 * Builds template context for README generation
 * @function buildReadmeContext
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {Object} Template context
 */
function buildReadmeContext(appName, config) {
  const displayName = formatAppDisplayName(appName);
  const imageName = `aifabrix/${appName}`;
  const port = config.port || 3000;
  // Extract registry from nested structure (config.image.registry) or flattened (config.registry)
  const registry = config.image?.registry || config.registry || 'myacr.azurecr.io';

  const serviceFlags = extractServiceFlags(config);
  const hasAnyService = serviceFlags.hasDatabase || serviceFlags.hasRedis || serviceFlags.hasStorage || serviceFlags.hasAuthentication;

  return {
    appName,
    displayName,
    imageName,
    port,
    registry,
    ...serviceFlags,
    hasAnyService
  };
}

function generateReadmeMd(appName, config) {
  const context = buildReadmeContext(appName, config);
  // Always generate comprehensive README programmatically to ensure consistency
  // regardless of template file content
  return generateComprehensiveReadme(context);
}

/**
 * Generates comprehensive README.md content programmatically
 * @param {Object} context - Template context
 * @returns {string} Comprehensive README.md content
 */
function generateComprehensiveReadme(context) {
  const { appName, displayName, imageName, port, registry, hasDatabase, hasRedis, hasStorage, hasAuthentication, hasAnyService } = context;

  let prerequisites = 'Before running this application, ensure the following prerequisites are met:\n';
  prerequisites += '- `@aifabrix/builder` installed globally\n';
  prerequisites += '- Docker Desktop running\n';

  if (hasAnyService) {
    if (hasDatabase) {
      prerequisites += '- PostgreSQL database\n';
    }
    if (hasRedis) {
      prerequisites += '- Redis\n';
    }
    if (hasStorage) {
      prerequisites += '- File storage configured\n';
    }
    if (hasAuthentication) {
      prerequisites += '- Authentication/RBAC configured\n';
    }
  } else {
    prerequisites += '- Infrastructure running\n';
  }

  let troubleshooting = '';
  if (hasDatabase) {
    troubleshooting = `### Database Connection Issues

If you encounter database connection errors, ensure:
- PostgreSQL is running and accessible
- Database credentials are correctly configured in your \`.env\` file
- The database name matches your configuration
- Verify infrastructure is running and PostgreSQL is accessible`;
  } else {
    troubleshooting = 'Verify infrastructure is running.';
  }

  return `# ${displayName} Builder

Build, run, and deploy ${displayName}.

## Prerequisites

${prerequisites}

## Quick Start

### 1. Install

Install the AI Fabrix Builder CLI if you haven't already.

### 2. Configure

Configure your application settings in \`variables.yaml\`.

### 3. Build & Run Locally

Build the application:
\`\`\`bash
aifabrix build ${appName}
\`\`\`

Run the application:
\`\`\`bash
aifabrix run ${appName}
\`\`\`

The application will be available at http://localhost:${port} (default: ${port}).

### 4. Deploy to Azure

Push to registry:
\`\`\`bash
aifabrix push ${appName} --registry ${registry} --tag "v1.0.0,latest"
\`\`\`

## Configuration

- **Port**: ${port} (default: 3000)
- **Image**: ${imageName}:latest
- **Registry**: ${registry}

## Docker Commands

View logs:
\`\`\`bash
docker logs aifabrix-${appName} -f
\`\`\`

Stop the application:
\`\`\`bash
aifabrix down ${appName}
\`\`\`

## Troubleshooting

${troubleshooting}

For more information, see the [AI Fabrix Builder documentation](https://docs.aifabrix.com).
`;
}

/**
 * Generates README.md file if it doesn't exist
 * @async
 * @function generateReadmeMdFile
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {Promise<void>} Resolves when README.md is generated or skipped
 * @throws {Error} If file generation fails
 */
async function generateReadmeMdFile(appPath, appName, config) {
  // Ensure directory exists
  await fs.mkdir(appPath, { recursive: true });
  const readmePath = path.join(appPath, 'README.md');
  if (!(await fileExists(readmePath))) {
    const readmeContent = generateReadmeMd(appName, config);
    await fs.writeFile(readmePath, readmeContent, 'utf8');
  }
}

module.exports = {
  generateReadmeMdFile,
  generateReadmeMd,
  formatAppDisplayName
};

