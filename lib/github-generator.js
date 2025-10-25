/**
 * GitHub Actions Workflow Generator Module
 *
 * Generates GitHub Actions workflow files from Handlebars templates
 * following ISO 27001 security standards
 */

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

/**
 * Generate GitHub Actions workflow files from templates
 * @param {string} appPath - Path to application directory
 * @param {Object} config - Configuration from variables.yaml
 * @param {Object} options - Generation options
 * @returns {Promise<string[]>} Array of generated file paths
 */
async function generateGithubWorkflows(appPath, config, options = {}) {
  try {
    // Create .github/workflows directory
    const workflowsDir = path.join(appPath, '.github', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    // Get template context
    const templateContext = getTemplateContext(config, options);

    // Load and compile templates
    const templatesDir = path.join(__dirname, '..', 'templates', 'github');
    const templateFiles = await fs.readdir(templatesDir);

    const generatedFiles = [];

    for (const templateFile of templateFiles) {
      if (templateFile.endsWith('.hbs')) {
        const templatePath = path.join(templatesDir, templateFile);
        const templateContent = await fs.readFile(templatePath, 'utf8');

        // Compile template
        const template = Handlebars.compile(templateContent);

        // Generate content
        const generatedContent = template(templateContext);

        // Write to workflows directory
        const outputFileName = templateFile.replace('.hbs', '');
        const outputPath = path.join(workflowsDir, outputFileName);
        await fs.writeFile(outputPath, generatedContent);

        generatedFiles.push(outputPath);
      }
    }

    return generatedFiles;

  } catch (error) {
    throw new Error(`Failed to generate GitHub workflows: ${error.message}`);
  }
}

/**
 * Get template context from config
 * @param {Object} config - Application configuration
 * @param {Object} options - Additional options
 * @returns {Object} Template context
 */
function getTemplateContext(config, options = {}) {
  return {
    appName: config.appName || 'myapp',
    mainBranch: options.mainBranch || 'main',
    language: config.language || 'typescript',
    fileExtension: config.language === 'python' ? 'py' : 'js',
    sourceDir: config.language === 'python' ? 'src' : 'lib',
    buildCommand: options.buildCommand || 'npm run build',
    uploadCoverage: options.uploadCoverage !== false,
    publishToNpm: options.publishToNpm || false,
    port: config.port || 3000,
    database: config.database || false,
    redis: config.redis || false,
    storage: config.storage || false,
    authentication: config.authentication || false
  };
}

/**
 * Generate a specific workflow file
 * @param {string} appPath - Path to application directory
 * @param {string} templateName - Name of template file (without .hbs)
 * @param {Object} config - Application configuration
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Path to generated file
 */
async function generateWorkflowFile(appPath, templateName, config, options = {}) {
  try {
    // Create .github/workflows directory
    const workflowsDir = path.join(appPath, '.github', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    // Load template
    const templatePath = path.join(__dirname, '..', 'templates', 'github', `${templateName}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf8');

    // Compile template
    const template = Handlebars.compile(templateContent);

    // Get template context
    const templateContext = getTemplateContext(config, options);

    // Generate content
    const generatedContent = template(templateContext);

    // Write to workflows directory
    const outputPath = path.join(workflowsDir, templateName);
    await fs.writeFile(outputPath, generatedContent);

    return outputPath;

  } catch (error) {
    throw new Error(`Failed to generate workflow file ${templateName}: ${error.message}`);
  }
}

/**
 * Validate GitHub workflow configuration
 * @param {Object} config - Application configuration
 * @param {Object} options - Generation options
 * @returns {Object} Validation result
 */
function validateWorkflowConfig(config, options = {}) {
  const errors = [];
  const warnings = [];

  // Validate required fields
  if (!config.appName) {
    errors.push('Application name is required');
  }

  if (!config.language) {
    errors.push('Language is required');
  }

  if (!['typescript', 'python'].includes(config.language)) {
    errors.push('Language must be either typescript or python');
  }

  // Validate port
  if (config.port && (config.port < 1 || config.port > 65535)) {
    errors.push('Port must be between 1 and 65535');
  }

  // Validate branch name
  if (options.mainBranch && !/^[a-zA-Z0-9_-]+$/.test(options.mainBranch)) {
    errors.push('Main branch name contains invalid characters');
  }

  // Warnings
  if (config.language === 'python' && !config.database) {
    warnings.push('Python applications typically require a database');
  }

  if (config.authentication && !config.database) {
    warnings.push('Authentication typically requires a database for user storage');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate workflow files with validation
 * @param {string} appPath - Path to application directory
 * @param {Object} config - Application configuration
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generation result
 */
async function generateWorkflowsWithValidation(appPath, config, options = {}) {
  try {
    // Validate configuration
    const validation = validateWorkflowConfig(config, options);

    if (!validation.valid) {
      return {
        success: false,
        validation,
        files: []
      };
    }

    // Generate workflows
    const files = await generateGithubWorkflows(appPath, config, options);

    return {
      success: true,
      validation,
      files
    };

  } catch (error) {
    return {
      success: false,
      validation: {
        valid: false,
        errors: [error.message],
        warnings: []
      },
      files: []
    };
  }
}

module.exports = {
  generateGithubWorkflows,
  getTemplateContext,
  generateWorkflowFile,
  validateWorkflowConfig,
  generateWorkflowsWithValidation
};
