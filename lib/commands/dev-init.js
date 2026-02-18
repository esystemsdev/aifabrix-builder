/**
 * @fileoverview aifabrix dev init – onboard with Builder Server (issue-cert, save cert, get settings, add SSH key).
 * Auth: first call (issue-cert) uses no client cert; all other calls (getSettings, addSshKey, and every other dev API) send the client certificate.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const config = require('../core/config');
const { getConfigDirForPaths } = require('../utils/paths');
const { generateCSR, getCertDir, readClientCertPem, readClientKeyPem } = require('../utils/dev-cert-helper');
const { getOrCreatePublicKeyContent } = require('../utils/ssh-key-helper');
const devApi = require('../api/dev.api');
const logger = require('../utils/logger');

/**
 * Validate init options and return normalized baseUrl and devId.
 * @param {Object} options - Commander options
 * @returns {{ baseUrl: string, devId: string }}
 */
function validateInitOptions(options) {
  const devId = options.developerId || options['developer-id'];
  const server = options.server;
  const pin = options.pin;

  if (!devId || typeof devId !== 'string' || !/^[0-9]+$/.test(devId)) {
    throw new Error('--developer-id is required and must be a non-empty digit string (e.g. 01)');
  }
  if (!server || typeof server !== 'string' || !server.trim()) {
    throw new Error('--server is required and must be the Builder Server base URL (e.g. https://dev.aifabrix.dev)');
  }
  if (!pin || typeof pin !== 'string' || !pin.trim()) {
    throw new Error('--pin is required (one-time PIN from your admin)');
  }
  return { baseUrl: server.trim().replace(/\/+$/, ''), devId };
}

/**
 * Request certificate from Builder Server; map API errors to user messages.
 * @param {string} baseUrl - Builder Server base URL
 * @param {string} devId - Developer ID
 * @param {string} pin - One-time PIN
 * @param {string} csrPem - PEM CSR
 * @returns {Promise<Object>} IssueCertResponseDto
 */
async function requestCertificate(baseUrl, devId, pin, csrPem) {
  try {
    return await devApi.issueCert(baseUrl, {
      developerId: devId,
      pin: pin.trim(),
      csr: csrPem
    });
  } catch (err) {
    if (err.status === 401) {
      throw new Error('Invalid or expired PIN. Ask your admin for a new PIN (aifabrix dev pin <developerId>).');
    }
    if (err.status === 404) {
      throw new Error(`Developer ${devId} not found on the server.`);
    }
    if (err.status === 503) {
      throw new Error('Certificate signing is temporarily unavailable. Try again later.');
    }
    throw err;
  }
}

/**
 * Save certificate, key, and optional CA to cert dir; set developer-id in config.
 * Remote Docker requires ca.pem in the cert dir; if the server provides it (e.g. issue-cert
 * response caCertificate or ca), it is saved so DOCKER_CERT_PATH works.
 * @param {string} configDir - Config directory
 * @param {string} devId - Developer ID
 * @param {string} certificatePem - Issued certificate PEM
 * @param {string} keyPem - Private key PEM
 * @param {string} [caPem] - Optional CA certificate PEM (for remote Docker TLS)
 */
async function saveCertAndConfig(configDir, devId, certificatePem, keyPem, caPem) {
  const certDir = getCertDir(configDir, devId);
  await fs.mkdir(certDir, { recursive: true });
  await fs.writeFile(path.join(certDir, 'cert.pem'), certificatePem, { mode: 0o600 });
  await fs.writeFile(path.join(certDir, 'key.pem'), keyPem, { mode: 0o600 });
  if (caPem && typeof caPem === 'string' && caPem.trim()) {
    await fs.writeFile(path.join(certDir, 'ca.pem'), caPem.trim(), { mode: 0o600 });
    logger.log(chalk.green('  ✓ Certificate and CA saved to ') + chalk.cyan(path.join(certDir, 'cert.pem')));
  } else {
    logger.log(chalk.green('  ✓ Certificate saved to ') + chalk.cyan(path.join(certDir, 'cert.pem')));
  }
  await config.setDeveloperId(devId);
  logger.log(chalk.green('  ✓ Developer ID set to ') + chalk.cyan(devId));
}

/**
 * Message for 400 Bad Request: nginx often forwards X-Client-Cert with literal newlines.
 * @returns {string} Hint for server-side nginx fix
 */
function getBadRequestHint() {
  return 'Bad Request (400) often means the server\'s nginx is forwarding the client certificate with literal newlines in X-Client-Cert. On the server, use nginx njs to escape newlines (see .cursor/plans/builder-cli.md §5).';
}

/**
 * Log a one-line hint for cert troubleshooting (curl test and docs).
 * @param {string} configDir - Config directory
 * @param {string} devId - Developer ID
 * @param {string} baseUrl - Builder Server base URL
 */
function logCertTroubleshootingHint(configDir, devId, baseUrl) {
  const certDir = getCertDir(configDir, devId);
  const certPath = path.join(certDir, 'cert.pem');
  const keyPath = path.join(certDir, 'key.pem');
  logger.log(chalk.gray(`  Test with: curl -v --cert ${certPath} --key ${keyPath} ${baseUrl}/api/dev/settings`));
  logger.log(chalk.gray('  See .cursor/plans/builder-cli.md §5 for 200 vs 401 vs 400 and nginx/server fix.'));
}

/**
 * Register SSH public key with Builder Server for Mutagen sync.
 * @param {string} baseUrl - Builder Server base URL
 * @param {string} clientCertPem - Client certificate PEM
 * @param {string} clientKeyPem - Client private key PEM (for mTLS)
 * @param {string} devId - Developer ID
 */
async function registerSshKey(baseUrl, clientCertPem, clientKeyPem, devId) {
  const publicKey = getOrCreatePublicKeyContent();
  try {
    await devApi.addSshKey(baseUrl, clientCertPem, devId, {
      publicKey,
      label: 'aifabrix-init'
    }, clientKeyPem);
    logger.log(chalk.green('  ✓ SSH key registered'));
  } catch (err) {
    if (err.status === 409) {
      logger.log(chalk.yellow('  ⚠ SSH key already registered'));
    } else {
      throw err;
    }
  }
}

/**
 * Apply settings from issue-cert response or fetch via getSettings; merge into config.
 * @param {string} baseUrl - Builder Server base URL
 * @param {string} devId - Developer ID
 * @param {Object} issueResponse - IssueCert response (certificate, settings)
 * @param {string} keyPem - Client key PEM
 */
async function applySettingsFromServer(baseUrl, devId, issueResponse, keyPem) {
  const configDir = getConfigDirForPaths();
  if (issueResponse.settings && typeof issueResponse.settings === 'object') {
    await config.mergeRemoteSettings(issueResponse.settings);
    logger.log(chalk.green('  ✓ Config updated from server (issue-cert response)'));
    return;
  }
  logger.log(chalk.gray('  Fetching settings...'));
  try {
    if (keyPem && typeof keyPem === 'string') {
      logger.log(chalk.gray('  Using client certificate for TLS'));
    }
    const settings = await devApi.getSettings(baseUrl, issueResponse.certificate, keyPem);
    await config.mergeRemoteSettings(settings);
    logger.log(chalk.green('  ✓ Config updated from server'));
  } catch (err) {
    const msg = err.status === 400 ? getBadRequestHint() : (err.message || String(err));
    logger.log(chalk.yellow('  ⚠ Could not fetch settings (server may not support cert yet): ' + msg));
    logCertTroubleshootingHint(configDir, devId, baseUrl);
  }
}

/**
 * Run dev init: validate PIN via issue-cert, save certificate, fetch settings, add SSH key.
 * @param {Object} options - Commander options (devId, server, pin)
 * @returns {Promise<void>}
 */
async function runDevInit(options) {
  const { baseUrl, devId } = validateInitOptions(options);
  logger.log(chalk.blue('\n🔐 Onboarding with Builder Server...\n'));

  try {
    await devApi.getHealth(baseUrl);
  } catch (err) {
    throw new Error(`Cannot reach Builder Server at ${baseUrl}. Check URL and network. ${err.message}`);
  }

  logger.log(chalk.gray('  Generating certificate request...'));
  const { csrPem, keyPem } = generateCSR(devId);

  logger.log(chalk.gray('  Requesting certificate (issue-cert)...'));
  const issueResponse = await requestCertificate(baseUrl, devId, options.pin, csrPem);

  const configDir = getConfigDirForPaths();
  const caPem = issueResponse.caCertificate || issueResponse.ca;
  await saveCertAndConfig(configDir, devId, issueResponse.certificate, keyPem, caPem);

  await config.setRemoteServer(baseUrl);

  await applySettingsFromServer(baseUrl, devId, issueResponse, keyPem);

  logger.log(chalk.gray('  Registering SSH key for Mutagen sync...'));
  try {
    if (keyPem && typeof keyPem === 'string') {
      logger.log(chalk.gray('  Using client certificate for TLS'));
    }
    await registerSshKey(baseUrl, issueResponse.certificate, keyPem, devId);
  } catch (err) {
    const msg = err.status === 400 ? getBadRequestHint() : (err.message || String(err));
    logger.log(chalk.yellow('  ⚠ Could not register SSH key: ' + msg));
    logCertTroubleshootingHint(configDir, devId, baseUrl);
  }

  logger.log(chalk.green('\n✓ Onboarding complete. You can use remote Docker and Mutagen sync.\n'));
}

/**
 * Fetch settings from Builder Server and merge into config (GET /api/dev/settings).
 * Use when docker-endpoint or sync-ssh-host are empty because getSettings failed during init.
 * @returns {Promise<void>}
 * @throws {Error} If remote server or certificate not configured, or getSettings fails
 */
async function runDevRefresh() {
  const { getRemoteDevAuth } = require('../utils/remote-dev-auth');
  const auth = await getRemoteDevAuth();
  if (!auth) {
    throw new Error('Remote server is not configured. Set remote-server and run "aifabrix dev init" first.');
  }
  const devId = await config.getDeveloperId();
  const configDir = getConfigDirForPaths();
  const certDir = getCertDir(configDir, devId);
  const clientCertPem = readClientCertPem(certDir);
  const clientKeyPem = readClientKeyPem(certDir);
  if (!clientCertPem) {
    throw new Error('Client certificate not found. Run "aifabrix dev init" first.');
  }
  logger.log(chalk.blue('\n🔄 Fetching settings from Builder Server...\n'));
  const settings = await devApi.getSettings(auth.serverUrl, clientCertPem, clientKeyPem || undefined);
  await config.mergeRemoteSettings(settings);
  logger.log(chalk.green('✓ Config updated from server. Run "aifabrix dev config" to verify.\n'));
}

module.exports = { runDevInit, runDevRefresh };
