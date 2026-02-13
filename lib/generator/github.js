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
  const stepsDir = path.join(__dirname, '..', '..', 'templates', 'github', 'steps');
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
 * @param {Object} config - Configuration from application.yaml
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
    const templatesDir = path.join(__dirname, '..', '..', 'templates', 'github');
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
/**
 * Builds base context for template rendering
 * @function buildBaseContext
 * @param {Object} config - Application configuration
 * @param {Object} options - Additional options
 * @returns {Object} Base context object
 */
/**
 * Determines file extension based on language
 * @function getFileExtension
 * @param {string} language - Programming language
 * @returns {string} File extension
 */
function getFileExtension(language) {
  return language === 'python' ? 'py' : 'js';
}

/**
 * Determines source directory based on language
 * @function getSourceDir
 * @param {string} language - Programming language
 * @returns {string} Source directory
 */
function getSourceDir(language) {
  return language === 'python' ? 'src' : 'lib';
}

/**
 * Builds base configuration values
 * @function buildBaseConfigValues
 * @param {Object} config - Configuration object
 * @param {Object} options - Options object
 * @returns {Object} Base configuration values
 */
function buildBaseConfigValues(config, options) {
  const language = config.language || 'typescript';
  return {
    appName: config.appName || 'myapp',
    mainBranch: options.mainBranch || 'main',
    language: language,
    fileExtension: getFileExtension(language),
    sourceDir: getSourceDir(language),
    buildCommand: options.buildCommand || 'npm run build',
    port: config.port || 3000,
    database: config.database || false,
    redis: config.redis || false,
    storage: config.storage || false,
    authentication: config.authentication || false
  };
}

function buildBaseContext(config, options) {
  return buildBaseConfigValues(config, options);
}

/**
 * Renders step templates
 * @function renderStepTemplates
 * @param {Object} stepTemplates - Step templates object
 * @param {Object} baseContext - Base context for rendering
 * @returns {Object} Rendered steps
 */
function renderStepTemplates(stepTemplates, baseContext) {
  const renderedSteps = {};
  for (const [stepName, template] of Object.entries(stepTemplates)) {
    renderedSteps[stepName] = template(baseContext);
  }
  return renderedSteps;
}

/**
 * Builds final template context
 * @function buildFinalTemplateContext
 * @param {Object} baseContext - Base context
 * @param {Object} options - Additional options
 * @param {Object} renderedSteps - Rendered step templates
 * @returns {Object} Final template context
 */
function buildFinalTemplateContext(baseContext, options, renderedSteps) {
  const githubSteps = options.githubSteps || [];
  return {
    ...baseContext,
    uploadCoverage: options.uploadCoverage !== false,
    githubSteps: githubSteps,
    stepContent: renderedSteps,
    hasSteps: githubSteps.length > 0,
    hasNpmStep: githubSteps.includes('npm')
  };
}

async function getTemplateContext(config, options = {}, stepTemplates = {}) {
  const baseContext = buildBaseContext(config, options);
  const renderedSteps = renderStepTemplates(stepTemplates, baseContext);
  return buildFinalTemplateContext(baseContext, options, renderedSteps);
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
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'github', `${templateName}.hbs`);
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
/**
 * Validates required fields
 * @function validateRequiredFields
 * @param {Object} config - Application configuration
 * @returns {string[]} Array of error messages
 */
function validateRequiredFields(config) {
  const errors = [];

  if (!config.appName) {
    errors.push('Application name is required');
  }

  if (!config.language) {
    errors.push('Language is required');
  }

  if (!['typescript', 'python'].includes(config.language)) {
    errors.push('Language must be either typescript or python');
  }

  return errors;
}

/**
 * Validates optional fields
 * @function validateOptionalFields
 * @param {Object} config - Application configuration
 * @param {Object} options - Generation options
 * @returns {string[]} Array of error messages
 */
function validateOptionalFields(config, options) {
  const errors = [];

  // Validate port
  if (config.port && (config.port < 1 || config.port > 65535)) {
    errors.push('Port must be between 1 and 65535');
  }

  // Validate branch name
  if (options.mainBranch && !/^[a-zA-Z0-9_-]+$/.test(options.mainBranch)) {
    errors.push('Main branch name contains invalid characters');
  }

  return errors;
}

/**
 * Collects validation warnings
 * @function collectValidationWarnings
 * @param {Object} config - Application configuration
 * @returns {string[]} Array of warning messages
 */
function collectValidationWarnings(config) {
  const warnings = [];

  if (config.language === 'python' && !config.database) {
    warnings.push('Python applications typically require a database');
  }

  if (config.authentication && !config.database) {
    warnings.push('Authentication typically requires a database for user storage');
  }

  return warnings;
}

function validateWorkflowConfig(config, options = {}) {
  const errors = [
    ...validateRequiredFields(config),
    ...validateOptionalFields(config, options)
  ];
  const warnings = collectValidationWarnings(config);

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
