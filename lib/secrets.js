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
const chalk = require('chalk');
const logger = require('./utils/logger');
const config = require('./config');
const devConfig = require('./utils/dev-config');
const {
  generateMissingSecrets,
  createDefaultSecrets
} = require('./utils/secrets-generator');
const {
  resolveSecretsPath,
  getActualSecretsPath
} = require('./utils/secrets-path');
const {
  loadUserSecrets,
  loadBuildSecrets,
  loadDefaultSecrets,
  buildHostnameToServiceMap,
  resolveUrlPort
} = require('./utils/secrets-utils');
const { decryptSecret, isEncrypted } = require('./utils/secrets-encryption');
const pathsUtil = require('./utils/paths');

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
 * Decrypts encrypted values in secrets object
 * Checks for secure:// prefix and decrypts using encryption key from config
 *
 * @async
 * @function decryptSecretsObject
 * @param {Object} secrets - Secrets object with potentially encrypted values
 * @returns {Promise<Object>} Secrets object with decrypted values
 * @throws {Error} If decryption fails or encryption key is missing
 */
async function decryptSecretsObject(secrets) {
  if (!secrets || typeof secrets !== 'object') {
    return secrets;
  }

  const encryptionKey = await config.getSecretsEncryptionKey();
  if (!encryptionKey) {
    // No encryption key set, check if any values are encrypted
    const hasEncrypted = Object.values(secrets).some(value => isEncrypted(value));
    if (hasEncrypted) {
      throw new Error('Encrypted secrets found but no encryption key configured. Run "aifabrix secure --secrets-encryption <key>" to set encryption key.');
    }
    // No encrypted values, return as-is
    return secrets;
  }

  const decryptedSecrets = {};
  for (const [key, value] of Object.entries(secrets)) {
    if (isEncrypted(value)) {
      try {
        decryptedSecrets[key] = decryptSecret(value, encryptionKey);
      } catch (error) {
        throw new Error(`Failed to decrypt secret '${key}': ${error.message}`);
      }
    } else {
      decryptedSecrets[key] = value;
    }
  }

  return decryptedSecrets;
}

/**
 * Loads secrets with cascading lookup
 * Supports both user secrets (~/.aifabrix/secrets.local.yaml) and project overrides
 * User's file takes priority, then falls back to build.secrets from variables.yaml
 * Automatically decrypts values with secure:// prefix
 *
 * @async
 * @function loadSecrets
 * @param {string} [secretsPath] - Path to secrets file (optional, for explicit override)
 * @param {string} [appName] - Application name (optional, for variables.yaml lookup)
 * @returns {Promise<Object>} Loaded secrets object with decrypted values
 * @throws {Error} If no secrets file found and no fallback available
 *
 * @example
 * const secrets = await loadSecrets('../../secrets.local.yaml');
 * // Returns: { 'postgres-passwordKeyVault': 'admin123', ... }
 */
async function loadSecrets(secretsPath, appName) {
  let secrets;

  // If explicit path provided, use it (backward compatibility)
  if (secretsPath) {
    const resolvedPath = resolveSecretsPath(secretsPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Secrets file not found: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    secrets = yaml.load(content);

    if (!secrets || typeof secrets !== 'object') {
      throw new Error(`Invalid secrets file format: ${resolvedPath}`);
    }
  } else {
    // Cascading lookup: user's file first
    let mergedSecrets = loadUserSecrets();

    // Then check build.secrets from variables.yaml if appName provided
    if (appName) {
      mergedSecrets = await loadBuildSecrets(mergedSecrets, appName);
    }

    // If still no secrets found, try default location
    if (Object.keys(mergedSecrets).length === 0) {
      mergedSecrets = loadDefaultSecrets();
    }

    // If still empty, throw error
    if (Object.keys(mergedSecrets).length === 0) {
      throw new Error('No secrets file found. Please create ~/.aifabrix/secrets.local.yaml or configure build.secrets in variables.yaml');
    }

    secrets = mergedSecrets;
  }

  // Decrypt encrypted values
  return await decryptSecretsObject(secrets);
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
 * @param {Object|string|null} [secretsFilePaths] - Paths object with userPath and buildPath, or string path (for backward compatibility)
 * @param {string} [secretsFilePaths.userPath] - User's secrets file path
 * @param {string|null} [secretsFilePaths.buildPath] - App's build.secrets file path (if configured)
 * @param {string} [appName] - Application name (optional, for error messages)
 * @returns {Promise<string>} Resolved environment content
 * @throws {Error} If kv:// reference cannot be resolved
 *
 * @example
 * const resolved = await resolveKvReferences(template, secrets, 'local');
 * // Returns: 'DATABASE_URL=postgresql://user:pass@localhost:5432/db'
 */
async function resolveKvReferences(envTemplate, secrets, environment = 'local', secretsFilePaths = null, appName = null) {
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
    let fileInfo = '';
    if (secretsFilePaths) {
      // Handle backward compatibility: if it's a string, use it as-is
      if (typeof secretsFilePaths === 'string') {
        fileInfo = `\n\nSecrets file location: ${secretsFilePaths}`;
      } else if (typeof secretsFilePaths === 'object' && secretsFilePaths.userPath) {
        // New format: show both paths if buildPath is configured
        const paths = [secretsFilePaths.userPath];
        if (secretsFilePaths.buildPath) {
          paths.push(secretsFilePaths.buildPath);
        }
        fileInfo = `\n\nSecrets file location: ${paths.join(' and ')}`;
      }
    }
    const resolveCommand = appName ? `aifabrix resolve ${appName}` : 'aifabrix resolve <app-name>';
    throw new Error(`Missing secrets: ${missingSecrets.join(', ')}${fileInfo}\n\nRun "${resolveCommand}" to generate missing secrets.`);
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
 * Resolves service ports in URLs within .env content for Docker environment
 * Replaces ports in URLs with containerPort from service's variables.yaml
 *
 * @function resolveServicePortsInEnvContent
 * @param {string} envContent - Resolved .env file content
 * @param {string} environment - Environment context (docker/local)
 * @returns {string} Content with resolved ports
 */
function resolveServicePortsInEnvContent(envContent, environment) {
  // Only process docker environment
  if (environment !== 'docker') {
    return envContent;
  }

  const envConfig = loadEnvConfig();
  const dockerHosts = envConfig.environments.docker || {};
  const hostnameToService = buildHostnameToServiceMap(dockerHosts);

  // Pattern to match URLs: http://hostname:port or https://hostname:port
  // Matches: protocol://hostname:port/path?query
  // Captures: protocol, hostname, port, and optional path/query
  // Note: [^\s\n]* matches any non-whitespace characters except newline (stops at end of line)
  const urlPattern = /(https?:\/\/)([a-zA-Z0-9-]+):(\d+)([^\s\n]*)?/g;

  return envContent.replace(urlPattern, (match, protocol, hostname, port, urlPath = '') => {
    return resolveUrlPort(protocol, hostname, port, urlPath || '', hostnameToService);
  });
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

  // Resolve secrets paths to show in error messages (use actual paths that loadSecrets would use)
  const secretsPaths = await getActualSecretsPath(secretsPath, appName);

  if (force) {
    // Use userPath for generating missing secrets (priority file)
    await generateMissingSecrets(template, secretsPaths.userPath);
  }

  const secrets = await loadSecrets(secretsPath, appName);
  let resolved = await resolveKvReferences(template, secrets, environment, secretsPaths, appName);

  // Resolve service ports in URLs for docker environment
  if (environment === 'docker') {
    resolved = resolveServicePortsInEnvContent(resolved, environment);
  }

  // For local environment, update infrastructure ports to use dev-specific ports
  if (environment === 'local') {
    const devId = await config.getDeveloperId();
    // Convert string developer ID to number for getDevPorts
    const devIdNum = parseInt(devId, 10);
    const ports = devConfig.getDevPorts(devIdNum);

    // Update DATABASE_PORT if present
    resolved = resolved.replace(/^DATABASE_PORT\s*=\s*.*$/m, `DATABASE_PORT=${ports.postgres}`);

    // Update REDIS_URL if present (format: redis://localhost:port)
    resolved = resolved.replace(/^REDIS_URL\s*=\s*redis:\/\/localhost:\d+/m, `REDIS_URL=redis://localhost:${ports.redis}`);

    // Update REDIS_HOST if it contains a port
    resolved = resolved.replace(/^REDIS_HOST\s*=\s*localhost:\d+/m, `REDIS_HOST=localhost:${ports.redis}`);
  }

  fs.writeFileSync(envPath, resolved, { mode: 0o600 });

  // Update PORT variable in container .env file to use port (from variables.yaml)
  // Note: containerPort is ONLY used for Docker Compose port mapping, NOT for PORT env variable
  // The application inside container listens on PORT env variable, which should be 'port' from variables.yaml
  if (fs.existsSync(variablesPath)) {
    const variablesContent = fs.readFileSync(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);
    const port = variables.port || 3000;

    // Update PORT in container .env file to use port (NOT containerPort, NOT localPort)
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/^PORT\s*=\s*.*$/m, `PORT=${port}`);
    fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  }

  // Process and copy to envOutputPath if configured (uses localPort for copied file)
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
    const defaultSecretsPath = secretsPath || path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');

    if (!fs.existsSync(defaultSecretsPath)) {
      logger.log('Creating default secrets file...');
      await createDefaultSecrets(defaultSecretsPath);
      secrets = await loadSecrets(secretsPath);
    } else {
      throw error;
    }
  }

  const aifabrixDir = pathsUtil.getAifabrixHome();
  const adminEnvPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(aifabrixDir)) {
    fs.mkdirSync(aifabrixDir, { recursive: true, mode: 0o700 });
  }

  const postgresPassword = secrets['postgres-passwordKeyVault'] || '';

  const adminSecrets = `# Infrastructure Admin Credentials
POSTGRES_PASSWORD=${postgresPassword}
PGADMIN_DEFAULT_EMAIL=admin@aifabrix.ai
PGADMIN_DEFAULT_PASSWORD=${postgresPassword}
REDIS_HOST=local:redis:6379
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
