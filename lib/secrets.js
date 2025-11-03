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
const logger = require('./utils/logger');

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
  let resolvedPath = secretsPath;

  if (!resolvedPath) {
    resolvedPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
  } else if (secretsPath.startsWith('..')) {
    resolvedPath = path.resolve(process.cwd(), secretsPath);
  }

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
 * Resolves kv:// references in environment template
 * Replaces kv://keyName with actual values from secrets
 *
 * @async
 * @function resolveKvReferences
 * @param {string} envTemplate - Environment template content
 * @param {Object} secrets - Secrets object from loadSecrets()
 * @param {string} [environment='local'] - Environment context (docker/local)
 * @returns {Promise<string>} Resolved environment content
 * @throws {Error} If kv:// reference cannot be resolved
 *
 * @example
 * const resolved = await resolveKvReferences(template, secrets, 'local');
 * // Returns: 'DATABASE_URL=postgresql://user:pass@localhost:5432/db'
 */
async function resolveKvReferences(envTemplate, secrets, environment = 'local') {
  const envConfig = loadEnvConfig();
  const envVars = envConfig.environments[environment] || envConfig.environments.local;

  let resolved = envTemplate;
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const missingSecrets = [];

  let match;
  while ((match = kvPattern.exec(envTemplate)) !== null) {
    const secretKey = match[1];
    if (!(secretKey in secrets)) {
      missingSecrets.push(`kv://${secretKey}`);
    }
  }

  if (missingSecrets.length > 0) {
    throw new Error(`Missing secrets: ${missingSecrets.join(', ')}`);
  }

  resolved = resolved.replace(kvPattern, (match, secretKey) => {
    let value = secrets[secretKey];
    if (typeof value === 'string') {
      value = value.replace(/\$\{([A-Z_]+)\}/g, (m, envVar) => {
        return envVars[envVar] || m;
      });
    }
    return value;
  });

  return resolved;
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
 * @returns {Promise<string>} Path to generated .env file
 * @throws {Error} If generation fails
 *
 * @example
 * const envPath = await generateEnvFile('myapp', '../../secrets.local.yaml');
 * // Returns: './builder/myapp/.env'
 */
async function generateEnvFile(appName, secretsPath, environment = 'local') {
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const templatePath = path.join(builderPath, 'env.template');
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const envPath = path.join(builderPath, '.env');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`env.template not found: ${templatePath}`);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const secrets = await loadSecrets(secretsPath);
  const resolved = await resolveKvReferences(template, secrets, environment);

  fs.writeFileSync(envPath, resolved, { mode: 0o600 });

  if (fs.existsSync(variablesPath)) {
    const variablesContent = fs.readFileSync(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    if (variables?.build?.envOutputPath) {
      const outputPath = path.resolve(builderPath, variables.build.envOutputPath);
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.copyFileSync(envPath, outputPath);
    }
  }

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

/**
 * Creates default secrets file if it doesn't exist
 * Generates template with common secrets for local development
 *
 * @async
 * @function createDefaultSecrets
 * @param {string} secretsPath - Path where to create secrets file
 * @returns {Promise<void>} Resolves when file is created
 * @throws {Error} If file creation fails
 *
 * @example
 * await createDefaultSecrets('~/.aifabrix/secrets.yaml');
 * // Default secrets file is created
 */
async function createDefaultSecrets(secretsPath) {
  const resolvedPath = secretsPath.startsWith('~')
    ? path.join(os.homedir(), secretsPath.slice(1))
    : secretsPath;

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const defaultSecrets = `# Local Development Secrets
# Production uses Azure KeyVault

# Database Secrets
postgres-passwordKeyVault: "admin123"

# Redis Secrets
redis-passwordKeyVault: ""
redis-urlKeyVault: "redis://\${REDIS_HOST}:6379"

# Keycloak Secrets
keycloak-admin-passwordKeyVault: "admin123"
keycloak-auth-server-urlKeyVault: "http://\${KEYCLOAK_HOST}:8082"
`;

  fs.writeFileSync(resolvedPath, defaultSecrets, { mode: 0o600 });
}

module.exports = {
  loadSecrets,
  resolveKvReferences,
  generateEnvFile,
  generateAdminSecretsEnv,
  validateSecrets,
  createDefaultSecrets
};
