/**
 * Read database passwords from .env for Docker Compose generation.
 *
 * @fileoverview Compose DB password helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fsSync = require('fs');
const fs = require('fs').promises;
const { formatMissingDbPasswordError } = require('./error-formatter');

/** Reads and parses .env file. @param {string} envPath - Path to .env file. @returns {Promise<Object>} env vars. @throws {Error} If file not found. */
async function readEnvFile(envPath) {
  if (!fsSync.existsSync(envPath)) {
    throw new Error(`.env file not found: ${envPath}`);
  }

  try {
    const envContent = await fs.readFile(envPath, 'utf8');
    if (envContent === undefined || envContent === null) {
      throw new Error('Failed to read .env file: file content is empty or undefined');
    }
    const lines = envContent.split('\n');
    const envVars = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        envVars[key] = value;
      }
    }

    return envVars;
  } catch (error) {
    throw new Error(`Failed to read .env file: ${error.message}`);
  }
}

/**
 * Validates and extracts password from environment variables
 * @function extractPassword
 * @param {Object} envVars - Environment variables
 * @param {string} passwordKey - Password key to look up
 * @param {Object} [context] - Optional: { appKey, multi } for clearer error messages
 * @returns {string} Password value
 * @throws {Error} If password is missing or empty
 */
function extractPassword(envVars, passwordKey, context = {}) {
  const { appKey, multi } = context;
  const appSuffix = appKey ? ` for application '${appKey}'` : '';

  if (!(passwordKey in envVars)) {
    throw new Error(multi && appKey ? formatMissingDbPasswordError(appKey, { multiDb: true, passwordKey }) : 'Missing required password variable ' + passwordKey + ' in .env file' + appSuffix + '. Add ' + passwordKey + '=your_secret to your .env file.');
  }

  const password = envVars[passwordKey].trim();
  if (!password || password.length === 0) {
    throw new Error('Password variable ' + passwordKey + ' is empty in .env file' + appSuffix + '. Set a non-empty value.');
  }

  return password;
}

/**
 * Processes multiple databases
 * @function processMultipleDatabases
 * @param {Array} databases - Array of database configurations
 * @param {Object} envVars - Environment variables
 * @param {string} appKey - Application key
 * @returns {Object} Object with passwords map and array
 */
function processMultipleDatabases(databases, envVars, appKey) {
  const passwords = {};
  const passwordsArray = [];
  for (let i = 0; i < databases.length; i++) {
    const db = databases[i];
    const dbName = db.name || appKey;
    const passwordKey = `DB_${i}_PASSWORD`;
    const password = extractPassword(envVars, passwordKey, { appKey, multi: true });
    passwords[dbName] = password;
    passwordsArray.push(password);
  }
  return { passwords, passwordsArray };
}

/**
 * Processes single database case
 * @function processSingleDatabase
 * @param {Object} envVars - Environment variables
 * @param {string} appKey - Application key
 * @returns {Object} Object with passwords map and array
 */
function processSingleDatabase(envVars, appKey) {
  const passwords = {};
  const passwordsArray = [];
  const passwordKey = ('DB_0_PASSWORD' in envVars) ? 'DB_0_PASSWORD' : 'DB_PASSWORD';
  if (!(passwordKey in envVars)) {
    throw new Error(formatMissingDbPasswordError(appKey));
  }
  const password = extractPassword(envVars, passwordKey, { appKey });
  passwords[appKey] = password;
  passwordsArray.push(password);
  return { passwords, passwordsArray };
}

/**
 * Reads database passwords from .env file
 * @async
 * @function readDatabasePasswords
 * @param {string} envPath - Path to .env file
 * @param {Array<Object>} databases - Array of database configurations
 * @param {string} appKey - Application key (fallback for single database)
 * @returns {Promise<Object>} Object with passwords map and array
 * @throws {Error} If required password variables are missing
 */
async function readDatabasePasswords(envPath, databases, appKey) {
  const envVars = await readEnvFile(envPath);
  if (databases && databases.length > 0) {
    const { passwords, passwordsArray } = processMultipleDatabases(databases, envVars, appKey);
    return { map: passwords, array: passwordsArray };
  }
  const { passwords, passwordsArray } = processSingleDatabase(envVars, appKey);
  return { map: passwords, array: passwordsArray };
}

module.exports = {
  readDatabasePasswords,
  readEnvFile,
  extractPassword
};
