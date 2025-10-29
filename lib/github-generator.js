/**
 * GitHub Actions Workflow Generator Module
 *
 * Generates GitHub Actions workflow files from Handlebars templates
 * following ISO 27001 security standards
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Register Handlebars helper for checking array contains
Handlebars.registerHelper('contains', (array, value) => {
  return array && array.includes(value);
});

/**
 * Load extra workflow step templates from files
 * @param {string[]} stepNames - Array of step names to load
 * @returns {Promise<Object>} Object mapping step names to their compiled content
 */
async function loadStepTemplates(stepNames = []) {
  const stepsDir = path.join(__dirname, '..', 'templates', 'github', 'steps');
  const stepTemplates = {};

  for (const stepName of stepNames) {
    const stepPath = path.join(stepsDir, `${stepName}.hbs`);

    if (fsSync.existsSync(stepPath)) {
      try {
        const stepContent = await fs.readFile(stepPath, 'utf8');
        stepTemplates[stepName] = Handlebars.compile(stepContent);
      } catch (error) {
        throw new Error(`Failed to load step template '${stepName}': ${error.message}`);
      }
    } else {
      throw new Error(`Step template '${stepName}' not found at ${stepPath}`);
    }
  }

  return stepTemplates;
}

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

    // Load step templates if githubSteps are provided
    const stepTemplates = options.githubSteps && options.githubSteps.length > 0
      ? await loadStepTemplates(options.githubSteps)
      : {};

    // Get template context
    const templateContext = await getTemplateContext(config, options, stepTemplates);

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
 * @param {Object} stepTemplates - Compiled step templates
 * @returns {Promise<Object>} Template context
 */
async function getTemplateContext(config, options = {}, stepTemplates = {}) {
  const githubSteps = options.githubSteps || [];

  // Render step templates with the base context
  const renderedSteps = {};
  const baseContext = {
    appName: config.appName || 'myapp',
    mainBranch: options.mainBranch || 'main',
    language: config.language || 'typescript',
    fileExtension: config.language === 'python' ? 'py' : 'js',
    sourceDir: config.language === 'python' ? 'src' : 'lib',
    buildCommand: options.buildCommand || 'npm run build',
    port: config.port || 3000,
    database: config.database || false,
    redis: config.redis || false,
    storage: config.storage || false,
    authentication: config.authentication || false
  };

  for (const [stepName, template] of Object.entries(stepTemplates)) {
    renderedSteps[stepName] = template(baseContext);
  }

  return {
    ...baseContext,
    uploadCoverage: options.uploadCoverage !== false,
    githubSteps: githubSteps,
    stepContent: renderedSteps,
    hasSteps: githubSteps.length > 0,
    hasNpmStep: githubSteps.includes('npm')
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

    // Load step templates if githubSteps are provided
    const stepTemplates = options.githubSteps && options.githubSteps.length > 0
      ? await loadStepTemplates(options.githubSteps)
      : {};

    // Get template context
    const templateContext = await getTemplateContext(config, options, stepTemplates);

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
  loadStepTemplates,
  generateWorkflowFile,
  validateWorkflowConfig,
  generateWorkflowsWithValidation
};
