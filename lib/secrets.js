/**
 * AI Fabrix Builder Secrets Management
 *
 * This module handles secret resolution and environment file generation.
 * Resolves kv:// references from secrets files and generates .env files.
 *
 * @fileoverview Secret resolution and environment management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const os = require('os');
const chalk = require('chalk');
const logger = require('./utils/logger');
const {
  generateMissingSecrets,
  createDefaultSecrets
} = require('./utils/secrets-generator');

/**
 * Loads environment configuration for docker/local context
 * @returns {Object} Environment configuration
 */
function loadEnvConfig() {
  const envConfigPath = path.join(__dirname, 'schema', 'env-config.yaml');
  const content = fs.readFileSync(envConfigPath, 'utf8');
  return yaml.load(content);
}

/**
 * Loads secrets from the specified file or default location
 * Supports both user secrets (~/.aifabrix/secrets.yaml) and project overrides
 *
 * @async
 * @function loadSecrets
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @returns {Promise<Object>} Loaded secrets object
 * @throws {Error} If secrets file cannot be loaded or parsed
 *
 * @example
 * const secrets = await loadSecrets('../../secrets.local.yaml');
 * // Returns: { 'postgres-passwordKeyVault': 'admin123', ... }
 */
async function loadSecrets(secretsPath) {
  const resolvedPath = resolveSecretsPath(secretsPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Secrets file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');
  const secrets = yaml.load(content);

  if (!secrets || typeof secrets !== 'object') {
    throw new Error(`Invalid secrets file format: ${resolvedPath}`);
  }

  return secrets;
}

/**
 * Resolves secrets file path (same logic as loadSecrets)
 * Also checks common locations if path is not provided
 * @function resolveSecretsPath
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @returns {string} Resolved secrets file path
 */
function resolveSecretsPath(secretsPath) {
  let resolvedPath = secretsPath;

  if (!resolvedPath) {
    // Check common locations for secrets.local.yaml
    const commonLocations = [
      path.join(process.cwd(), '..', 'aifabrix-setup', 'secrets.local.yaml'),
      path.join(process.cwd(), '..', '..', 'aifabrix-setup', 'secrets.local.yaml'),
      path.join(process.cwd(), 'secrets.local.yaml'),
      path.join(process.cwd(), '..', 'secrets.local.yaml'),
      path.join(os.homedir(), '.aifabrix', 'secrets.yaml')
    ];

    // Find first existing file
    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        resolvedPath = location;
        break;
      }
    }

    // If none found, use default location
    if (!resolvedPath) {
      resolvedPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
    }
  } else if (secretsPath.startsWith('..')) {
    resolvedPath = path.resolve(process.cwd(), secretsPath);
  }

  return resolvedPath;
}

/**
 * Resolves kv:// references in environment template
 * Replaces kv://keyName with actual values from secrets
 *
 * @async
 * @function resolveKvReferences
 * @param {string} envTemplate - Environment template content
 * @param {Object} secrets - Secrets object from loadSecrets()
 * @param {string} [environment='local'] - Environment context (docker/local)
 * @param {string} [secretsFilePath] - Path to secrets file (for error messages)
 * @returns {Promise<string>} Resolved environment content
 * @throws {Error} If kv:// reference cannot be resolved
 *
 * @example
 * const resolved = await resolveKvReferences(template, secrets, 'local');
 * // Returns: 'DATABASE_URL=postgresql://user:pass@localhost:5432/db'
 */
async function resolveKvReferences(envTemplate, secrets, environment = 'local', secretsFilePath = null) {
  const envConfig = loadEnvConfig();
  const envVars = envConfig.environments[environment] || envConfig.environments.local;

  // First, replace ${VAR} references in the template itself (for variables like DB_HOST=${DB_HOST})
  let resolved = envTemplate.replace(/\$\{([A-Z_]+)\}/g, (match, envVar) => {
    return envVars[envVar] || match;
  });

  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const missingSecrets = [];

  let match;
  while ((match = kvPattern.exec(resolved)) !== null) {
    const secretKey = match[1];
    if (!(secretKey in secrets)) {
      missingSecrets.push(`kv://${secretKey}`);
    }
  }

  if (missingSecrets.length > 0) {
    const fileInfo = secretsFilePath ? `\n\nSecrets file location: ${secretsFilePath}` : '';
    throw new Error(`Missing secrets: ${missingSecrets.join(', ')}${fileInfo}`);
  }

  // Now replace kv:// references, and handle ${VAR} inside the secret values
  resolved = resolved.replace(kvPattern, (match, secretKey) => {
    let value = secrets[secretKey];
    if (typeof value === 'string') {
      // Replace ${VAR} references inside the secret value
      value = value.replace(/\$\{([A-Z_]+)\}/g, (m, envVar) => {
        return envVars[envVar] || m;
      });
    }
    return value;
  });

  return resolved;
}

/**
 * Loads environment template from file
 * @function loadEnvTemplate
 * @param {string} templatePath - Path to env.template
 * @returns {string} Template content
 * @throws {Error} If file not found
 */
function loadEnvTemplate(templatePath) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`env.template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Processes environment variables and copies to output path if needed
 * Updates PORT variable to use localPort if available (only when copying to envOutputPath)
 * When .env stays in builder folder, uses port (container port)
 * @function processEnvVariables
 * @param {string} envPath - Path to generated .env file
 * @param {string} variablesPath - Path to variables.yaml
 * @throws {Error} If processing fails
 */
function processEnvVariables(envPath, variablesPath) {
  if (!fs.existsSync(variablesPath)) {
    return;
  }

  const variablesContent = fs.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);

  if (!variables?.build?.envOutputPath || variables.build.envOutputPath === null) {
    return;
  }

  let outputPath = path.resolve(process.cwd(), variables.build.envOutputPath);
  if (!outputPath.endsWith('.env')) {
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
      outputPath = path.join(outputPath, '.env');
    } else {
      outputPath = path.join(outputPath, '.env');
    }
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read the .env file content
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update PORT variable: use localPort ONLY when copying to envOutputPath (outside builder folder)
  // When .env stays in builder folder, it uses port (container port)
  const portToUse = variables.build?.localPort || variables.port || 3000;

  // Replace PORT line (handles PORT=value format, with or without spaces)
  envContent = envContent.replace(/^PORT\s*=\s*.*$/m, `PORT=${portToUse}`);

  // Write updated content to output path
  fs.writeFileSync(outputPath, envContent, { mode: 0o600 });
  logger.log(chalk.green(`✓ Copied .env to: ${variables.build.envOutputPath}`));
}

/**
 * Generates .env file from template and secrets
 * Creates environment file for local development
 *
 * @async
 * @function generateEnvFile
 * @param {string} appName - Name of the application
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [environment='local'] - Environment context
 * @param {boolean} [force=false] - Generate missing secret keys in secrets file
 * @returns {Promise<string>} Path to generated .env file
 * @throws {Error} If generation fails
 *
 * @example
 * const envPath = await generateEnvFile('myapp', '../../secrets.local.yaml', 'local', true);
 * // Returns: './builder/myapp/.env'
 */
async function generateEnvFile(appName, secretsPath, environment = 'local', force = false) {
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const templatePath = path.join(builderPath, 'env.template');
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const envPath = path.join(builderPath, '.env');

  const template = loadEnvTemplate(templatePath);

  // Resolve secrets path to show in error messages
  const resolvedSecretsPath = resolveSecretsPath(secretsPath);

  if (force) {
    await generateMissingSecrets(template, resolvedSecretsPath);
  }

  const secrets = await loadSecrets(secretsPath);
  const resolved = await resolveKvReferences(template, secrets, environment, resolvedSecretsPath);

  fs.writeFileSync(envPath, resolved, { mode: 0o600 });
  processEnvVariables(envPath, variablesPath);

  return envPath;
}

/**
 * Generates admin secrets for infrastructure
 * Creates ~/.aifabrix/admin-secrets.env with Postgres and Redis credentials
 *
 * @async
 * @function generateAdminSecretsEnv
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @returns {Promise<string>} Path to generated admin-secrets.env file
 * @throws {Error} If generation fails
 *
 * @example
 * const adminEnvPath = await generateAdminSecretsEnv('../../secrets.local.yaml');
 * // Returns: '~/.aifabrix/admin-secrets.env'
 */
async function generateAdminSecretsEnv(secretsPath) {
  let secrets;

  try {
    secrets = await loadSecrets(secretsPath);
  } catch (error) {
    // If secrets file doesn't exist, create default secrets
    const defaultSecretsPath = secretsPath || path.join(os.homedir(), '.aifabrix', 'secrets.yaml');

    if (!fs.existsSync(defaultSecretsPath)) {
      logger.log('Creating default secrets file...');
      await createDefaultSecrets(defaultSecretsPath);
      secrets = await loadSecrets(secretsPath);
    } else {
      throw error;
    }
  }

  const aifabrixDir = path.join(os.homedir(), '.aifabrix');
  const adminEnvPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(aifabrixDir)) {
    fs.mkdirSync(aifabrixDir, { recursive: true, mode: 0o700 });
  }

  const postgresPassword = secrets['postgres-passwordKeyVault'] || '';

  const adminSecrets = `# Infrastructure Admin Credentials
POSTGRES_PASSWORD=${postgresPassword}
PGADMIN_DEFAULT_EMAIL=admin@aifabrix.ai
PGADMIN_DEFAULT_PASSWORD=${postgresPassword}
REDIS_HOST=local:localhost:6379
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASSWORD=${postgresPassword}
`;

  fs.writeFileSync(adminEnvPath, adminSecrets, { mode: 0o600 });
  return adminEnvPath;
}

/**
 * Validates that all required secrets are present
 * Checks for missing kv:// references and provides helpful error messages
 *
 * @function validateSecrets
 * @param {string} envTemplate - Environment template content
 * @param {Object} secrets - Available secrets
 * @returns {Object} Validation result with missing secrets
 *
 * @example
 * const validation = validateSecrets(template, secrets);
 * // Returns: { valid: false, missing: ['kv://missing-secret'] }
 */
function validateSecrets(envTemplate, secrets) {
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const missing = [];

  let match;
  while ((match = kvPattern.exec(envTemplate)) !== null) {
    const secretKey = match[1];
    if (!(secretKey in secrets)) {
      missing.push(`kv://${secretKey}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

module.exports = {
  loadSecrets,
  resolveKvReferences,
  generateEnvFile,
  generateMissingSecrets,
  generateAdminSecretsEnv,
  validateSecrets,
  createDefaultSecrets
};
