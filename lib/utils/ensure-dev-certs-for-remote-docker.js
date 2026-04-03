/**
 * When `docker-endpoint` is set but dev cert.pem/key.pem are missing, optionally call
 * POST /api/dev/issue-cert using a one-time PIN from the environment (same flow as `aifabrix dev init`).
 * There is no unauthenticated cert download; the PIN must be created from an enrolled machine.
 *
 * @fileoverview Auto issue-cert for remote Docker before infra / docker checks
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const config = require('../core/config');
const logger = require('./logger');
const devApi = require('../api/dev.api');
const { getConfigDirForPaths } = require('./paths');
const {
  generateCSR,
  getCertDir,
  mergeCaPemBlocks,
  normalizePemNewlines
} = require('./dev-cert-helper');
const { isSslUntrustedError, fetchInstallCa } = require('./dev-ca-install');

/**
 * Read one-time issue-cert PIN from env or first non-empty line of AIFABRIX_DEV_ISSUE_PIN_FILE.
 * @returns {string|null}
 */
function readIssueCertPin() {
  const a = process.env.AIFABRIX_DEV_ISSUE_PIN;
  const b = process.env.AIFABRIX_ISSUE_CERT_PIN;
  const fromEnv =
    typeof a === 'string' && a.trim() ? a.trim() : typeof b === 'string' && b.trim() ? b.trim() : '';
  if (fromEnv) return fromEnv;
  const fp = process.env.AIFABRIX_DEV_ISSUE_PIN_FILE;
  if (!fp || typeof fp !== 'string' || !fp.trim()) return null;
  try {
    const content = fs.readFileSync(path.normalize(fp.trim()), 'utf8');
    if (typeof content !== 'string') {
      throw new Error('readFileSync did not return string content');
    }
    const line = content.split(/\r?\n/).find((l) => l.trim());
    return line ? line.trim() : null;
  } catch (e) {
    throw new Error(`AIFABRIX_DEV_ISSUE_PIN_FILE (${fp}): ${e.message}`);
  }
}

async function resolveServerCaForIssueCert(baseUrl) {
  try {
    await devApi.getHealth(baseUrl);
    return null;
  } catch (err) {
    if (isSslUntrustedError(err)) {
      const caBuf = await fetchInstallCa(baseUrl);
      const caPemStr = caBuf.toString('utf8').trim();
      await devApi.getHealth(baseUrl, caPemStr);
      return caPemStr;
    }
    throw err;
  }
}

async function requestIssueCert(baseUrl, devId, pin, csrPem, serverCaPem) {
  try {
    return await devApi.issueCert(
      baseUrl,
      { developerId: devId, pin: pin.trim(), csr: csrPem },
      serverCaPem || undefined
    );
  } catch (err) {
    if (err.status === 401) {
      throw new Error(
        'Invalid or expired PIN (AIFABRIX_DEV_ISSUE_PIN / AIFABRIX_ISSUE_CERT_PIN). ' +
          'Create a new PIN from an enrolled machine, e.g. `aifabrix dev pin <developerId>`.'
      );
    }
    if (err.status === 404) {
      throw new Error(`Developer ${devId} not found on Builder Server.`);
    }
    if (err.status === 503) {
      throw new Error('Certificate signing is temporarily unavailable. Try again later.');
    }
    throw err;
  }
}

async function saveDevCertMaterial(configDir, devId, certificatePem, keyPem, caPem) {
  const certDir = getCertDir(configDir, devId);
  await fsPromises.mkdir(certDir, { recursive: true });
  await fsPromises.writeFile(
    path.join(certDir, 'cert.pem'),
    normalizePemNewlines(certificatePem),
    { mode: 0o600 }
  );
  await fsPromises.writeFile(
    path.join(certDir, 'key.pem'),
    normalizePemNewlines(keyPem),
    { mode: 0o600 }
  );
  if (caPem && typeof caPem === 'string' && caPem.trim()) {
    await fsPromises.writeFile(
      path.join(certDir, 'ca.pem'),
      normalizePemNewlines(caPem.trim()),
      { mode: 0o600 }
    );
  }
  await config.setDeveloperId(devId);
}

/**
 * @returns {Promise<{ baseUrl: string, devId: string, certDir: string, configDir: string }|null>}
 */
async function readEnsureIssueCertContext() {
  const endpoint = await config.getDockerEndpoint();
  if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim()) return null;

  const remoteServer = await config.getRemoteServer();
  if (!remoteServer || typeof remoteServer !== 'string' || !remoteServer.trim()) return null;

  const devIdRaw = await config.getDeveloperId();
  if (!devIdRaw || typeof devIdRaw !== 'string' || !String(devIdRaw).trim()) return null;
  const devId = String(devIdRaw).trim();

  const configDir = getConfigDirForPaths();
  const certDir = getCertDir(configDir, devId);
  if (fs.existsSync(path.join(certDir, 'cert.pem')) && fs.existsSync(path.join(certDir, 'key.pem'))) {
    return null;
  }

  return {
    baseUrl: remoteServer.trim().replace(/\/+$/, ''),
    devId,
    certDir,
    configDir
  };
}

function missingTlsFilesError(certDir, devId) {
  return new Error(
    `docker-endpoint is set but client TLS files are missing in ${certDir}. ` +
      'On a PC that already has a client certificate to the Builder Server, run: aifabrix dev pin ' +
      devId +
      '. Then on this host: aifabrix dev activate --pin <pin> (or dev init --pin) if remote-server and developer-id are in config, ' +
      'or export AIFABRIX_DEV_ISSUE_PIN=<pin> before retrying. ' +
      'Alternatively, if the Docker engine does not require client certificates, set docker-tls-skip-verify or AIFABRIX_DOCKER_TLS_SKIP_VERIFY.'
  );
}

/**
 * If remote Docker is configured and TLS files are missing, run issue-cert when a PIN is supplied via env.
 * If no PIN and TLS skip-verify is set in config or env, returns without error.
 * If no PIN and verify is required, throws with instructions.
 * @returns {Promise<void>}
 */
async function ensureDevCertsIfNeededForRemoteDocker() {
  const ctx = await readEnsureIssueCertContext();
  if (!ctx) return;

  const pin = readIssueCertPin();
  if (!pin) {
    if (await config.getDockerTlsSkipVerify()) return;
    throw missingTlsFilesError(ctx.certDir, ctx.devId);
  }

  logger.log(chalk.blue('\n🔐 Fetching developer certificate from Builder Server (issue-cert)...\n'));
  const serverCaPem = await resolveServerCaForIssueCert(ctx.baseUrl);
  const { csrPem, keyPem } = generateCSR(ctx.devId);
  const issueResponse = await requestIssueCert(ctx.baseUrl, ctx.devId, pin, csrPem, serverCaPem);
  const caPem = mergeCaPemBlocks(serverCaPem, issueResponse.caCertificate, issueResponse.ca);
  await saveDevCertMaterial(ctx.configDir, ctx.devId, issueResponse.certificate, keyPem, caPem);
  logger.log(
    chalk.green('✓ Saved TLS material to ') + chalk.cyan(ctx.certDir) + chalk.green(' for remote Docker.\n')
  );
}

module.exports = { ensureDevCertsIfNeededForRemoteDocker, readIssueCertPin };
