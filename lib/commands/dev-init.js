const { formatSuccessLine, formatSuccessParagraph, successGlyph } = require('../utils/cli-test-layout-chalk');
/**
 * @fileoverview aifabrix dev init – onboard with Builder Server (issue-cert, save cert, get settings, add SSH key, SSH config alias).
 * Auth: first call (issue-cert) uses no client cert; other calls send the client cert (mTLS on https, X-Client-Cert header on http for getSettings/addSshKey).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const config = require('../core/config');
const { getConfigDirForPaths } = require('../utils/paths');
const {
  generateCSR,
  getCertDir,
  readClientCertPem,
  readClientKeyPem,
  getCertValidNotAfter,
  normalizePemNewlines,
  mergeCaPemBlocks
} = require('../utils/dev-cert-helper');
const { getOrCreatePublicKeyContent } = require('../utils/ssh-key-helper');
const devApi = require('../api/dev.api');
const logger = require('../utils/logger');
const {
  isSslUntrustedError,
  isSslHostnameMismatchError,
  fetchInstallCa,
  installCaPlatform,
  promptInstallCa,
  isLinuxCaSudoRequiredError
} = require('../utils/dev-ca-install');
const { runOptionalHostsSetup } = require('../utils/dev-hosts-helper');
const { mergeDevSshConfigAfterInit } = require('../utils/dev-init-ssh-merge');
const { resolveInitOptions } = require('../utils/dev-init-resolve');
const { displayDevConfig } = require('./dev-show-display');
const {
  isHealthHttpServerError,
  formatEnsureServerTrustedFailure
} = require('../utils/dev-init-health-messages');
const { getBadRequestHint, logCertTroubleshootingHint } = require('../utils/dev-init-cert-hints');

/**
 * Install dev CA into the OS trust store. On Linux without sudo, log and return false so the caller can use in-process PEM.
 * @param {Buffer} caBuf - CA PEM buffer
 * @param {string} baseUrlForInstall - Builder Server base URL (for install-ca-help paths)
 * @returns {Promise<boolean>} true if the OS store was updated
 */
async function tryInstallDevCaToOsStoreOrWarnLinuxSudo(caBuf, baseUrlForInstall) {
  try {
    await installCaPlatform(caBuf, baseUrlForInstall);
    return true;
  } catch (installErr) {
    if (isLinuxCaSudoRequiredError(installErr)) {
      logger.log(
        chalk.yellow(
          '  ⚠ Could not install the development CA into the system trust store (sudo/root required). ' +
            'Continuing with the downloaded CA for this CLI session; browsers and curl may still warn until you install it manually.\n' +
            '  ' +
            (installErr.message || String(installErr))
        )
      );
      return false;
    }
    throw installErr;
  }
}

/**
 * Prompt, fetch dev CA, install into OS store, verify health with PEM for Node TLS.
 * @param {string} baseUrl - Builder Server base URL
 * @param {Object} options - Commander options
 * @returns {Promise<string>} Dev root CA PEM
 */
async function installDevCaAndRetryHealth(baseUrl, options) {
  const skipInstall = options['no-install-ca'];
  const autoInstall = options.yes || options.y;
  const manualUrl = `${baseUrl.replace(/\/+$/, '')}/install-ca`;
  if (skipInstall) {
    throw new Error(`Server certificate not trusted. Install CA manually: ${manualUrl}`);
  }
  if (!autoInstall) {
    const install = await promptInstallCa();
    if (!install) {
      throw new Error(`Server certificate not trusted. Install CA manually: ${manualUrl}`);
    }
  }
  logger.log(chalk.gray('  Downloading and installing CA...'));
  const caBuf = await fetchInstallCa(baseUrl);
  const caPemStr = caBuf.toString('utf8').trim();
  const installedToOsStore = await tryInstallDevCaToOsStoreOrWarnLinuxSudo(caBuf, baseUrl);
  logger.log(
    chalk.gray(
      installedToOsStore ? '  CA installed. Retrying...' : '  Retrying with downloaded CA (in-process trust)...'
    )
  );
  try {
    await devApi.getHealth(baseUrl, caPemStr);
  } catch (healthErr) {
    if (isHealthHttpServerError(healthErr)) {
      logger.log(
        chalk.yellow(
          `  ⚠ GET /health returned HTTP ${healthErr.status} (${healthErr.message || 'Server Error'}). ` +
            'TLS is verified; continuing with certificate onboarding.'
        )
      );
    } else {
      throw healthErr;
    }
  }
  return caPemStr;
}

/**
 * Ensure the Builder Server is trusted: run health check; on SSL untrusted error,
 * optionally fetch and install CA, then retry using the PEM in-process (Node does not use Windows user ROOT for fetch).
 * @param {string} baseUrl - Builder Server base URL
 * @param {Object} options - Commander options (yes, y, no-install-ca)
 * @returns {Promise<string|null>} Dev root CA PEM to pass to dev API for TLS, or null if no install-ca path was used
 */
async function ensureServerTrusted(baseUrl, options) {
  try {
    await devApi.getHealth(baseUrl);
    return null;
  } catch (err) {
    if (isSslHostnameMismatchError(err)) {
      throw new Error(
        `TLS hostname does not match the server certificate for ${baseUrl}. Open the site in a browser only after accepting a warning, or the certificate may list a different DNS name. Use a URL whose hostname is in the certificate (SAN), or reissue the server certificate for this host.`
      );
    }
    if (!isSslUntrustedError(err)) {
      if (isHealthHttpServerError(err)) {
        logger.log(
          chalk.yellow(
            `  ⚠ GET /health returned HTTP ${err.status} (${err.message || 'Server Error'}). ` +
              'Continuing certificate onboarding; fix server health if later steps fail.'
          )
        );
        return null;
      }
      throw err;
    }
    return installDevCaAndRetryHealth(baseUrl, options);
  }
}

/**
 * Request certificate from Builder Server; map API errors to user messages.
 * @param {string} baseUrl - Builder Server base URL
 * @param {string} devId - Developer ID
 * @param {string} pin - One-time PIN
 * @param {string} csrPem - PEM CSR
 * @param {string} [serverCaPem] - Dev root CA for Node TLS (after install-ca)
 * @returns {Promise<Object>} IssueCertResponseDto
 */
async function requestCertificate(baseUrl, devId, pin, csrPem, serverCaPem) {
  try {
    return await devApi.issueCert(baseUrl, {
      developerId: devId,
      pin: pin.trim(),
      csr: csrPem
    }, serverCaPem);
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
  const certNormalized = normalizePemNewlines(certificatePem);
  const keyNormalized = normalizePemNewlines(keyPem);
  await fs.writeFile(path.join(certDir, 'cert.pem'), certNormalized, { mode: 0o600 });
  await fs.writeFile(path.join(certDir, 'key.pem'), keyNormalized, { mode: 0o600 });
  if (caPem && typeof caPem === 'string' && caPem.trim()) {
    const caNormalized = normalizePemNewlines(caPem.trim());
    await fs.writeFile(path.join(certDir, 'ca.pem'), caNormalized, { mode: 0o600 });
    logger.log(
      `${chalk.green('  ')}${successGlyph()}${chalk.green(' Certificate and CA saved to ')}${chalk.cyan(path.join(certDir, 'cert.pem'))}`
    );
  } else {
    logger.log(
      `${chalk.green('  ')}${successGlyph()}${chalk.green(' Certificate saved to ')}${chalk.cyan(path.join(certDir, 'cert.pem'))}`
    );
  }
  await config.setDeveloperId(devId);
  logger.log(
    `${chalk.green('  ')}${successGlyph()}${chalk.green(' Developer ID set to ')}${chalk.cyan(devId)}`
  );
}

/**
 * Register SSH public key with Builder Server for Mutagen sync.
 * @param {string} baseUrl - Builder Server base URL
 * @param {string} clientCertPem - Client certificate PEM
 * @param {string} clientKeyPem - Client private key PEM (for mTLS)
 * @param {string} devId - Developer ID
 */
async function registerSshKey(baseUrl, clientCertPem, clientKeyPem, devId, serverCaPem) {
  const publicKey = getOrCreatePublicKeyContent();
  try {
    await devApi.addSshKey(baseUrl, clientCertPem, devId, {
      publicKey,
      label: 'aifabrix-init'
    }, clientKeyPem, serverCaPem);
    logger.log(chalk.green('  ') + formatSuccessLine('SSH key registered'));
  } catch (err) {
    if (err.status === 409) {
      logger.log(chalk.yellow('  ⚠ SSH key already registered'));
    } else {
      throw err;
    }
  }
}

/**
 * Run SSH key registration step (log, register, handle 400 hint).
 * @param {string} baseUrl - Builder Server base URL
 * @param {Object} issueResponse - IssueCert response (certificate)
 * @param {string} keyPem - Client key PEM
 * @param {string} configDir - Config directory
 * @param {string} devId - Developer ID
 * @private
 */
async function _runSshKeyRegistrationStep(baseUrl, issueResponse, keyPem, configDir, devId, serverCaPem) {
  logger.log(chalk.gray('  Registering SSH key for Mutagen sync...'));
  try {
    if (keyPem && typeof keyPem === 'string') {
      logger.log(chalk.gray('  Using client certificate for TLS'));
    }
    await registerSshKey(baseUrl, issueResponse.certificate, keyPem, devId, serverCaPem);
  } catch (err) {
    const msg = err.status === 400 ? getBadRequestHint() : (err.message || String(err));
    logger.log(chalk.yellow('  ⚠ Could not register SSH key: ' + msg));
    logCertTroubleshootingHint(configDir, devId, baseUrl);
  }
}

/**
 * Apply settings from issue-cert response or fetch via getSettings; merge into config.
 * @param {string} baseUrl - Builder Server base URL
 * @param {string} devId - Developer ID
 * @param {Object} issueResponse - IssueCert response (certificate, settings)
 * @param {string} keyPem - Client key PEM
 * @param {string} [serverCaPem] - Dev root CA for Node TLS
 */
async function applySettingsFromServer(baseUrl, devId, issueResponse, keyPem, serverCaPem) {
  const configDir = getConfigDirForPaths();
  if (issueResponse.settings && typeof issueResponse.settings === 'object') {
    await config.mergeRemoteSettings(issueResponse.settings);
    logger.log(chalk.green('  ') + formatSuccessLine('Config updated from server (issue-cert response)'));
    return;
  }
  logger.log(chalk.gray('  Fetching settings...'));
  try {
    if (keyPem && typeof keyPem === 'string') {
      logger.log(chalk.gray('  Using client certificate for TLS'));
    }
    const settings = await devApi.getSettings(baseUrl, issueResponse.certificate, keyPem, serverCaPem);
    await config.mergeRemoteSettings(settings);
    logger.log(chalk.green('  ') + formatSuccessLine('Config updated from server'));
  } catch (err) {
    const msg = err.status === 400 ? getBadRequestHint() : (err.message || String(err));
    logger.log(chalk.yellow('  ⚠ Could not fetch settings (server may not support cert yet): ' + msg));
    logCertTroubleshootingHint(configDir, devId, baseUrl);
  }
}

/**
 * @param {Object} options - Commander options
 * @param {string} baseUrl
 * @param {string} devId - Developer ID (--developer-id) for devNN.hosts line
 */
async function maybeAddHostsDuringInit(options, baseUrl, devId) {
  if (!options.addHosts && !options['add-hosts']) return;
  const hostsIp = options.hostsIp || options['hosts-ip'];
  await runOptionalHostsSetup({
    baseUrl,
    developerId: devId,
    hostsIp: typeof hostsIp === 'string' ? hostsIp : undefined,
    skipConfirm: Boolean(options.yes || options.y),
    logger
  });
}

/**
 * @param {string} baseUrl
 * @param {Object} options
 * @returns {Promise<string|null>}
 */
async function resolveServerCaPemForTls(baseUrl, options) {
  try {
    return await ensureServerTrusted(baseUrl, options);
  } catch (err) {
    throw new Error(formatEnsureServerTrustedFailure(baseUrl, err));
  }
}

/**
 * @param {{ hostAlias: string|null, syncUser: string, syncHost: string|null }} p
 */
function logOnboardingFinished({ hostAlias, syncUser, syncHost }) {
  logger.log(formatSuccessParagraph('Onboarding complete. You can use remote Docker and Mutagen sync.'));
  if (hostAlias) {
    logger.log(
      chalk.gray('  You can also open an SSH session on the builder with ') +
        chalk.cyan(`ssh ${hostAlias}`) +
        chalk.gray(' (uses your registered SSH key; see ~/.ssh/config).')
    );
  } else if (syncHost && syncUser) {
    logger.log(
      chalk.gray('  You can SSH to the builder with ') +
        chalk.cyan(`ssh ${syncUser}@${syncHost}`) +
        chalk.gray(' when your key is authorized there.')
    );
  }
  logger.log('');
}

/**
 * Run dev init: validate PIN via issue-cert, save certificate, fetch settings, add SSH key.
 * @param {Object} options - Commander options (devId, server, pin)
 * @returns {Promise<void>}
 */
async function runDevInit(options) {
  const { baseUrl, devId } = await resolveInitOptions(options);

  // Save developer-id and remote-server before TLS / issue-cert so ~/.aifabrix/config.yaml
  // matches the CLI even if onboarding fails later (PIN, network, etc.). User can retry init.
  await config.setDeveloperId(devId);
  await config.setRemoteServer(baseUrl);
  process.env.AIFABRIX_DEVELOPERID = devId;

  logger.log(chalk.blue('\n🔐 Onboarding with Builder Server...\n'));

  await maybeAddHostsDuringInit(options, baseUrl, devId);
  const serverCaPemForTls = await resolveServerCaPemForTls(baseUrl, options);

  logger.log(chalk.gray('  Generating certificate request...'));
  const { csrPem, keyPem } = generateCSR(devId);

  logger.log(chalk.gray('  Requesting certificate (issue-cert)...'));
  const issueResponse = await requestCertificate(baseUrl, devId, options.pin, csrPem, serverCaPemForTls || undefined);

  const configDir = getConfigDirForPaths();
  const caPem = mergeCaPemBlocks(
    serverCaPemForTls,
    issueResponse.caCertificate,
    issueResponse.ca
  );
  await saveCertAndConfig(configDir, devId, issueResponse.certificate, keyPem, caPem);

  await applySettingsFromServer(baseUrl, devId, issueResponse, keyPem, serverCaPemForTls || undefined);
  await _runSshKeyRegistrationStep(baseUrl, issueResponse, keyPem, configDir, devId, serverCaPemForTls || undefined);
  const sshInfo = await mergeDevSshConfigAfterInit(baseUrl, devId);
  logOnboardingFinished(sshInfo);
}

/** Days before cert expiry at which we auto-refresh on dev refresh. */
const CERT_REFRESH_DAYS = 14;

/**
 * True if the cert in certDir expires within CERT_REFRESH_DAYS (or we cannot read expiry).
 * @param {string} certDir - Certificate directory
 * @returns {boolean}
 */
function shouldRefreshDevCert(certDir) {
  const validNotAfter = getCertValidNotAfter(certDir);
  if (!validNotAfter) return true;
  const now = Date.now();
  const threshold = now + CERT_REFRESH_DAYS * 24 * 60 * 60 * 1000;
  return validNotAfter.getTime() < threshold;
}

/**
 * Refresh developer certificate: create PIN (with current cert), issue new cert, save and apply settings.
 * @param {{ serverUrl: string, clientCertPem: string, serverCaPem?: string|null }} auth - Current auth from getRemoteDevAuth
 * @returns {Promise<void>}
 */
async function runCertificateRefresh(auth) {
  const devId = await config.getDeveloperId();
  if (!devId) throw new Error('developer-id not set in config.');
  const configDir = getConfigDirForPaths();
  const serverCaPem = auth.serverCaPem || undefined;
  logger.log(chalk.blue('\n🔄 Refreshing certificate (create PIN + issue-cert)...\n'));
  const pinRes = await devApi.createPin(auth.serverUrl, auth.clientCertPem, devId, serverCaPem);
  const pin = pinRes.pin;
  if (!pin || typeof pin !== 'string') throw new Error('Server did not return a PIN.');
  logger.log(chalk.gray('  Generating new certificate request...'));
  const { csrPem, keyPem } = generateCSR(devId);
  logger.log(chalk.gray('  Requesting new certificate (issue-cert)...'));
  const issueResponse = await requestCertificate(auth.serverUrl, devId, pin, csrPem, serverCaPem);
  const caPem = mergeCaPemBlocks(serverCaPem, issueResponse.caCertificate, issueResponse.ca);
  await saveCertAndConfig(configDir, devId, issueResponse.certificate, keyPem, caPem);
  await applySettingsFromServer(auth.serverUrl, devId, issueResponse, keyPem, serverCaPem);
  logger.log(formatSuccessLine('Certificate refreshed and config updated from server.\n'));
}

/**
 * GET /api/dev/settings and merge into local config (used by dev refresh when cert is still valid).
 * @param {{ serverUrl: string, serverCaPem?: string|null }} auth
 * @param {string} clientCertPem
 * @param {string|null|undefined} clientKeyPem
 * @param {string} devId
 * @returns {Promise<void>}
 */
async function fetchAndMergeRemoteSettings(auth, clientCertPem, clientKeyPem, devId) {
  logger.log(chalk.blue('\n🔄 Fetching settings from Builder Server...\n'));
  const settings = await devApi.getSettings(
    auth.serverUrl,
    clientCertPem,
    clientKeyPem || undefined,
    auth.serverCaPem || undefined
  );
  await config.mergeRemoteSettings(settings);
  logger.log(formatSuccessLine('Config updated from server.\n'));
  await displayDevConfig(devId);
}

/**
 * Fetch settings from Builder Server and merge into config (GET /api/dev/settings).
 * If certificate expires within CERT_REFRESH_DAYS (or --cert), refresh cert first (create PIN + issue-cert).
 * @param {Object} [options] - Commander options; options.cert = true forces cert refresh
 * @returns {Promise<void>}
 * @throws {Error} If remote server or certificate not configured, or getSettings fails
 */
async function runDevRefresh(options = {}) {
  const { getRemoteDevAuth } = require('../utils/remote-dev-auth');
  const auth = await getRemoteDevAuth();
  if (!auth) {
    throw new Error('Remote server is not configured. Set remote-server and run "aifabrix dev init" first.');
  }
  const devId = await config.getDeveloperId();
  const certDir = getCertDir(getConfigDirForPaths(), devId);
  const clientCertPem = readClientCertPem(certDir);
  const clientKeyPem = readClientKeyPem(certDir);
  if (!clientCertPem) {
    throw new Error('Client certificate not found. Run "aifabrix dev init" first.');
  }
  if (Boolean(options.cert) || shouldRefreshDevCert(certDir)) {
    await runCertificateRefresh(auth);
    await displayDevConfig(devId);
    return;
  }
  await fetchAndMergeRemoteSettings(auth, clientCertPem, clientKeyPem, devId);
}

module.exports = { runDevInit, runDevRefresh };
