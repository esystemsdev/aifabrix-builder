/**
 * Grouped human-readable output for developer config (`dev show`, after `set-id` / `set-format`).
 *
 * @fileoverview Dev show display (sections, remote gating, cert mismatch hints)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const config = require('../core/config');
const devConfig = require('../utils/dev-config');
const logger = require('../utils/logger');
const paths = require('../utils/paths');
const { getUrlsLocalYamlPath } = require('../utils/urls-local-registry');
const {
  getCertDir,
  getCertValidNotAfter,
  getCertSubjectDeveloperId,
  developerIdsMatchNumeric
} = require('../utils/dev-cert-helper');

/** En dash for unset / empty values (readable empty state). */
const EM = '\u2013';
const LABEL_W = 18;

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function isUnset(v) {
  return v === null || v === undefined || v === '';
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function cell(v) {
  return isUnset(v) ? EM : String(v);
}

/**
 * @param {string} label
 * @param {unknown} value
 */
function logRow(label, value) {
  logger.log(`  ${label.padEnd(LABEL_W)} ${cell(value)}`);
}

/**
 * @param {string|undefined|null} raw
 * @returns {{ display: string|null, effective: string|null }}
 */
async function getSecretsDisplay(raw) {
  let effective = null;
  if (raw && typeof raw === 'string' && raw.trim()) {
    try {
      const remoteDevAuth = require('../utils/remote-dev-auth');
      const resolved = await remoteDevAuth.resolveSharedSecretsEndpoint(raw);
      if (typeof resolved === 'string' && resolved.trim() && resolverAndRawDiffer(resolved, raw)) {
        effective = resolved.trim();
      }
    } catch {
      // Show raw only
    }
  }
  const display =
    raw && typeof raw === 'string' && raw.trim()
      ? raw.trim()
      : null;
  return { display, effective };
}

/**
 * @param {string} resolved
 * @param {string} raw
 * @returns {boolean}
 */
function resolverAndRawDiffer(resolved, raw) {
  return resolved.trim() !== raw.trim();
}

/**
 * Prefer HTTPS(S) effective endpoint for display when present.
 * @param {string|null} secretsMain
 * @param {string|null} secretsEffective
 * @returns {string|null}
 */
function secretsApiCell(secretsMain, secretsEffective) {
  const eff = secretsEffective && String(secretsEffective).trim();
  if (eff && /^https?:\/\//i.test(eff)) {
    return eff;
  }
  if (secretsMain && String(secretsMain).trim()) {
    return secretsMain.trim();
  }
  return null;
}

/**
 * @returns {string}
 */
function resolveConfigDir() {
  if (config.CONFIG_DIR && typeof config.CONFIG_DIR === 'string') {
    return config.CONFIG_DIR;
  }
  return path.join(os.homedir(), '.aifabrix');
}

/**
 * @param {string|null|undefined} user
 * @param {string|null|undefined} host
 * @returns {string|null}
 */
function formatSshLine(user, host) {
  const u = user && String(user).trim() ? user : null;
  const h = host && String(host).trim() ? host : null;
  if (!u && !h) {
    return null;
  }
  return `${u ?? EM}@${h ?? EM}`;
}

/**
 * @param {boolean} dockerTlsSkipVerify
 * @returns {string}
 */
function tlsVerifyCell(dockerTlsSkipVerify) {
  return dockerTlsSkipVerify ? 'OFF' : 'ON 🔒';
}

/**
 * Infra / compose TLS mode from ~/.aifabrix `tlsEnabled` (not Docker TLS verify).
 * @param {boolean} tlsEnabled
 * @returns {string}
 */
function infraTlsSslCell(tlsEnabled) {
  return tlsEnabled ? 'ON 🔒' : 'OFF 🕐';
}

/**
 * @param {Date} d
 * @returns {string} YYYY-MM-DD (local)
 */
function formatYmdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {string|null|undefined} remoteUrl
 * @returns {string}
 */
function hostFromRemoteUrl(remoteUrl) {
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return '';
  }
  try {
    const u = new URL(remoteUrl.trim());
    return u.hostname || '';
  } catch {
    return '';
  }
}

/**
 * @param {string} devIdStr
 * @returns {string} e.g. dev02
 */
function devProfileHandle(devIdStr) {
  const s = String(devIdStr);
  if (/^[0-9]+$/.test(s)) {
    return `dev${s.padStart(2, '0')}`;
  }
  return `dev${s}`;
}

/**
 * @param {string} devIdStr
 * @param {boolean} hasRemote
 * @param {string|null|undefined} remoteServer
 * @returns {string}
 */
function buildHeaderLine(devIdStr, hasRemote, remoteServer) {
  let line = '\n🔧 AI Fabrix • Developer Configuration';
  if (hasRemote) {
    const host = hostFromRemoteUrl(remoteServer);
    const who = devProfileHandle(devIdStr);
    line += host ? ` (${who} @ ${host})` : ` (${who})`;
  }
  return `${line}\n`;
}

/**
 * @param {string} certDir
 * @param {string} devId
 * @returns {{ status: string, mismatch: boolean, certDevDigits: string|null, notAfter: Date|null, daysRemaining: number|null }}
 */
function computeRemoteIdentity(certDir, devId) {
  const certPath = path.join(certDir, 'cert.pem');
  const certExists = fs.existsSync(certPath);
  const notAfter = getCertValidNotAfter(certDir);
  const certDevDigits = getCertSubjectDeveloperId(certDir);

  let status;
  if (!certExists) {
    status = 'MISSING';
  } else if (!notAfter) {
    status = 'UNREADABLE';
  } else if (notAfter.getTime() < Date.now()) {
    status = 'EXPIRED';
  } else {
    status = 'VALID';
  }

  const mismatch =
    certExists &&
    certDevDigits !== null &&
    !developerIdsMatchNumeric(devId, certDevDigits);

  let daysRemaining = null;
  if (notAfter && notAfter.getTime() >= Date.now()) {
    daysRemaining = Math.ceil((notAfter.getTime() - Date.now()) / 86400000);
  }

  return { status, mismatch, certDevDigits, notAfter, daysRemaining };
}

/**
 * @param {{ status: string, mismatch: boolean }} identity
 * @returns {string}
 */
function formatCertificateStatus(identity) {
  if (identity.status === 'VALID') {
    return identity.mismatch ? 'VALID ⚠️' : 'VALID ✅';
  }
  if (identity.status === 'EXPIRED') {
    return 'EXPIRED';
  }
  if (identity.status === 'MISSING') {
    return 'MISSING';
  }
  return 'UNREADABLE';
}

/**
 * @param {Date} notAfter
 * @param {string} status
 * @param {number|null} daysRemaining
 * @returns {string|null}
 */
function formatExpiresLine(notAfter, status, daysRemaining) {
  if (!notAfter) {
    return null;
  }
  const ymd = formatYmdLocal(notAfter);
  if (status === 'EXPIRED') {
    return `${ymd} (expired)`;
  }
  if (daysRemaining !== null) {
    return `${ymd} (${daysRemaining} days)`;
  }
  return ymd;
}

/**
 * @param {string} devId
 * @param {{ certDevDigits: string|null }} identity
 */
function logMismatchBlock(devId, identity) {
  logger.log('');
  logger.log(chalk.yellow('⚠️ Developer mismatch'));
  logRow('Config ID', devId);
  const certShown = identity.certDevDigits;
  logRow('Certificate ID', certShown);
  logger.log('');
  logger.log('  Fix:');
  logger.log(`    ${chalk.bold('af dev sync')}`);
}

/**
 * @param {string} devIdStr
 * @param {boolean} hasRemote
 * @param {object} remote
 * @param {string} certDir
 */
function logRemoteAndIdentity(devIdStr, hasRemote, remote, certDir) {
  if (!hasRemote) {
    return;
  }
  logger.log('');
  logger.log('🌐 Remote');
  logRow('Server', remote.server);
  logRow('Docker', remote.dockerEndpoint);
  logRow('SSH', formatSshLine(remote.syncSshUser, remote.syncSshHost));
  logRow('TLS Verify', tlsVerifyCell(remote.dockerTlsSkip));

  const identity = computeRemoteIdentity(certDir, devIdStr);
  logger.log('');
  logger.log('🔐 Identity');
  logRow('Certificate', formatCertificateStatus(identity));
  logRow('Developer ID', identity.certDevDigits);
  const expiresShown = formatExpiresLine(identity.notAfter, identity.status, identity.daysRemaining);
  if (expiresShown) {
    logRow('Expires', expiresShown);
  }
  if (identity.mismatch) {
    logMismatchBlock(devIdStr, identity);
  }
}

/**
 * @param {object} ports
 */
function logPortsSection(ports) {
  logger.log('');
  logger.log('🚀 Ports');
  logRow('App', ports.app);
  logRow('Postgres', ports.postgres);
  logRow('Redis', ports.redis);
  logRow('pgAdmin', ports.pgadmin);
  logRow('Redis Commander', ports.redisCommander);
}

/**
 * @param {object} p
 */
function logConfigurationSection(p) {
  logger.log('');
  logger.log('⚙️ Configuration');
  logRow('TLS/SSL', infraTlsSslCell(p.tlsEnabled));
  logRow('Environment', p.environment);
  logRow('Controller', p.controller);
  logRow('Format', p.formatVal);
  logRow('Scoped resources', p.scopedResourcesLabel);
  logRow('URLs registry', p.urlsLocalPath);
  if (!p.hasRemote) {
    const showRemoteFallback =
      !isUnset(p.remoteServer) ||
      !isUnset(p.dockerEndpoint) ||
      !isUnset(p.syncSshUser) ||
      !isUnset(p.syncSshHost) ||
      p.dockerTlsSkip;
    if (showRemoteFallback) {
      logRow('Server', p.remoteServer);
      logRow('Docker', p.dockerEndpoint);
      logRow('SSH', formatSshLine(p.syncSshUser, p.syncSshHost));
      logRow('TLS Verify', tlsVerifyCell(p.dockerTlsSkip));
    }
  }
}

/**
 * @param {string|null|undefined} homeResolved
 * @param {string|null|undefined} workResolved
 */
function logPathsSection(homeResolved, workResolved) {
  logger.log('');
  logger.log('📁 Paths');
  logRow('Home', homeResolved);
  logRow('Work', workResolved);
}

/**
 * @param {string|null} secretsMain
 * @param {string|null} secretsEffective
 * @param {unknown} mutagenFolder
 */
function logIntegrationsSection(secretsMain, secretsEffective, mutagenFolder) {
  logger.log('');
  logger.log('🔗 Integrations');
  logRow('Secrets API', secretsApiCell(secretsMain, secretsEffective));
  logRow('Mutagen Folder', mutagenFolder);
}

/**
 * Load all inputs for dev show (config, paths, secrets resolution).
 * @param {string} devIdStr - Normalized developer id string
 * @returns {Promise<object>} Bundle passed to {@link renderDevShow}
 */
async function loadDevShowData(devIdStr) {
  const devIdNum = parseInt(devIdStr, 10);
  const ports = devConfig.getDevPorts(Number.isNaN(devIdNum) ? 0 : devIdNum);
  const [
    environment, tlsEnabled, controller, formatRaw, useScoped, secretsRaw,
    remoteServer, dockerEndpoint, dockerTlsSkipVerify, mutagenFolder, syncSshUser, syncSshHost
  ] = await Promise.all([
    config.getCurrentEnvironment(), config.getTlsEnabled(), config.getControllerUrl(),
    config.getFormat(), config.getUseEnvironmentScopedResources(), config.getAifabrixSecretsPath(),
    config.getRemoteServer(), config.getDockerEndpoint(), config.getDockerTlsSkipVerify(),
    config.getUserMutagenFolder(), config.getSyncSshUser(), config.getSyncSshHost()
  ]);
  const urlsLocalPath = getUrlsLocalYamlPath();
  const scopedResourcesLabel = useScoped ? 'on' : 'off (default)';
  const workResolved = paths.getAifabrixWork();
  const homeResolved = paths.getAifabrixHome();
  const { display: secretsMain, effective: secretsEffective } = await getSecretsDisplay(secretsRaw);
  const dockerTlsSkip = Boolean(dockerTlsSkipVerify);
  const hasRemote = Boolean(remoteServer && String(remoteServer).trim());
  const certDir = getCertDir(resolveConfigDir(), devIdStr);
  return {
    devIdStr,
    ports,
    environment,
    tlsEnabled,
    controller,
    formatVal: formatRaw ?? null,
    scopedResourcesLabel,
    workResolved,
    homeResolved,
    secretsMain,
    secretsEffective,
    urlsLocalPath,
    remoteServer,
    dockerEndpoint,
    dockerTlsSkip,
    mutagenFolder,
    syncSshUser,
    syncSshHost,
    hasRemote,
    certDir
  };
}

/**
 * @param {object} data - Output of {@link loadDevShowData}
 */
function renderDevShow(data) {
  logger.log(buildHeaderLine(data.devIdStr, data.hasRemote, data.remoteServer));
  logger.log('👤 Developer');
  logRow('ID', data.devIdStr);
  logRemoteAndIdentity(data.devIdStr, data.hasRemote, {
    server: data.remoteServer,
    dockerEndpoint: data.dockerEndpoint,
    dockerTlsSkip: data.dockerTlsSkip,
    syncSshUser: data.syncSshUser,
    syncSshHost: data.syncSshHost
  }, data.certDir);
  logPortsSection(data.ports);
  logConfigurationSection({
    environment: data.environment,
    tlsEnabled: data.tlsEnabled,
    controller: data.controller,
    formatVal: data.formatVal,
    scopedResourcesLabel: data.scopedResourcesLabel,
    urlsLocalPath: data.urlsLocalPath,
    hasRemote: data.hasRemote,
    remoteServer: data.remoteServer,
    dockerEndpoint: data.dockerEndpoint,
    dockerTlsSkip: data.dockerTlsSkip,
    syncSshUser: data.syncSshUser,
    syncSshHost: data.syncSshHost
  });
  logPathsSection(data.homeResolved, data.workResolved);
  logIntegrationsSection(data.secretsMain, data.secretsEffective, data.mutagenFolder);
  logger.log('');
}

/**
 * Show ports, grouped config, optional remote + identity.
 * @param {string} devId - Developer ID from config
 * @returns {Promise<void>}
 */
async function displayDevConfig(devId) {
  const devIdStr = devId === null || devId === undefined ? '0' : String(devId);
  renderDevShow(await loadDevShowData(devIdStr));
}

module.exports = { displayDevConfig };
