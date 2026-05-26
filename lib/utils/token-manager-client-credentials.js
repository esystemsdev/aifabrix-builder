/**
 * Client credential loading from secrets.local.yaml and environment.
 *
 * @fileoverview Client credentials helpers for token-manager
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const logger = require('./logger');
const pathsUtil = require('./paths');

/** App key used for dataplane client credentials in secrets.local.yaml */
const DATAPLANE_APP_KEY = 'dataplane';

/**
 * @returns {string}
 */
function getSecretsFilePath() {
  return pathsUtil.getPrimaryUserSecretsLocalPath();
}

/**
 * Validate that secrets.local.yaml contains dataplane client credentials.
 * @param {string} [secretsFilePath] - Path to secrets file; defaults to ~/.aifabrix/secrets.local.yaml
 * @returns {{ valid: boolean, hint?: string }}
 */
function validateDataplaneSecrets(secretsFilePath) {
  const filePath = secretsFilePath || getSecretsFilePath();
  const hint = 'Dataplane credentials are missing. Run: aifabrix app rotate-secret dataplane';
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, hint };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const secrets = yaml.load(content) || {};
    const clientIdKey = `${DATAPLANE_APP_KEY}-client-idKeyVault`;
    const clientSecretKey = `${DATAPLANE_APP_KEY}-client-secretKeyVault`;
    const hasId =
      secrets[clientIdKey] !== null &&
      secrets[clientIdKey] !== undefined &&
      String(secrets[clientIdKey]).trim() !== '';
    const hasSecret =
      secrets[clientSecretKey] !== null &&
      secrets[clientSecretKey] !== undefined &&
      String(secrets[clientSecretKey]).trim() !== '';
    if (hasId && hasSecret) {
      return { valid: true };
    }
    return { valid: false, hint };
  } catch {
    return { valid: false, hint };
  }
}

/**
 * Read client id/secret for one app key from secrets.local.yaml.
 * @param {string} appName - Application key
 * @returns {{ clientId: string, clientSecret: string }|null}
 */
function readClientCredentialsFromSecretsFile(appName) {
  try {
    const secretsFile = getSecretsFilePath();
    if (!fs.existsSync(secretsFile)) {
      return null;
    }
    const content = fs.readFileSync(secretsFile, 'utf8');
    const secrets = yaml.load(content) || {};
    const clientId = secrets[`${appName}-client-idKeyVault`];
    const clientSecret = secrets[`${appName}-client-secretKeyVault`];
    if (clientId && clientSecret) {
      return {
        clientId: String(clientId),
        clientSecret: String(clientSecret)
      };
    }
  } catch (error) {
    logger.warn(`Failed to load credentials from secrets.local.yaml: ${error.message}`);
  }
  return null;
}

/**
 * App keys to try when resolving client credentials (integration app, then dataplane).
 * @param {string} appName
 * @returns {string[]}
 */
function credentialAppKeysToTry(appName) {
  const keys = [appName];
  if (appName !== DATAPLANE_APP_KEY) {
    keys.push(DATAPLANE_APP_KEY);
  }
  return keys;
}

/**
 * @returns {{ clientId: string, clientSecret: string }|null}
 */
function readClientCredentialsFromEnv() {
  const pairs = [
    [process.env.CLIENTID || process.env.CLIENT_ID, process.env.CLIENTSECRET || process.env.CLIENT_SECRET],
    [
      process.env.MISO_CLIENTID || process.env.MISO_CLIENT_ID,
      process.env.MISO_CLIENTSECRET || process.env.MISO_CLIENT_SECRET
    ]
  ];
  for (const [clientId, clientSecret] of pairs) {
    if (clientId && clientSecret) {
      return {
        clientId: String(clientId).trim(),
        clientSecret: String(clientSecret).trim()
      };
    }
  }
  return null;
}

/**
 * Decrypt secure:// client credential entries from secrets.local.yaml when needed.
 * @param {string} appName
 * @param {{ clientId: string, clientSecret: string }} raw
 * @returns {Promise<{ clientId: string, clientSecret: string }|null>}
 */
async function decryptClientCredentialsFromSecrets(appName, raw) {
  const { isEncrypted } = require('./secrets-encryption');
  if (!isEncrypted(raw.clientId) && !isEncrypted(raw.clientSecret)) {
    return raw;
  }
  try {
    const { decryptSecretsObject } = require('../core/secrets-load');
    const idKey = `${appName}-client-idKeyVault`;
    const secretKey = `${appName}-client-secretKeyVault`;
    const decrypted = await decryptSecretsObject({
      [idKey]: raw.clientId,
      [secretKey]: raw.clientSecret
    });
    const clientId = decrypted[idKey];
    const clientSecret = decrypted[secretKey];
    if (clientId && clientSecret) {
      return {
        clientId: String(clientId),
        clientSecret: String(clientSecret)
      };
    }
  } catch (error) {
    logger.warn(`Failed to decrypt client credentials for ${appName}: ${error.message}`);
  }
  return null;
}

/**
 * @param {string} appName
 * @returns {Promise<{ clientId: string, clientSecret: string }|null>}
 */
async function readClientCredentialsFromSecretsFileDecrypted(appName) {
  const raw = readClientCredentialsFromSecretsFile(appName);
  if (!raw) {
    return null;
  }
  return decryptClientCredentialsFromSecrets(appName, raw);
}

/**
 * @param {string} appName
 * @returns {Promise<{ credentialApp: string, credentials: { clientId: string, clientSecret: string }|null }>}
 */
async function resolveCredentialAppForDeployment(appName) {
  const fromEnv = readClientCredentialsFromEnv();
  if (fromEnv) {
    return { credentialApp: appName, credentials: fromEnv };
  }
  for (const key of credentialAppKeysToTry(appName)) {
    const fromFile = await readClientCredentialsFromSecretsFileDecrypted(key);
    if (fromFile) {
      return { credentialApp: key, credentials: fromFile };
    }
  }
  return { credentialApp: appName, credentials: null };
}

/**
 * @param {string} appName
 * @returns {Promise<{ clientId: string, clientSecret: string }|null>}
 */
async function loadClientCredentials(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const resolved = await resolveCredentialAppForDeployment(appName);
  return resolved.credentials;
}

module.exports = {
  DATAPLANE_APP_KEY,
  validateDataplaneSecrets,
  loadClientCredentials,
  resolveCredentialAppForDeployment
};
