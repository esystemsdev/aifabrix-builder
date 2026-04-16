/**
 * Shared output for `aifabrix status`: title + configuration block.
 * TLS/SSL (`infraTlsSslCell`) and `devNN` title match `dev-show-display.js`; environment, Traefik,
 * and scoped-resources lines use uppercase ON/OFF-style labels for status output.
 *
 * @fileoverview Infra status CLI display helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const config = require('../core/config');
const logger = require('./logger');

/** En dash for unset / empty values (same as dev-show-display). */
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
function logPaddedFieldRow(label, value) {
  logger.log(`  ${label.padEnd(LABEL_W)} ${cell(value)}`);
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
 * Infra / compose TLS mode from ~/.aifabrix `tlsEnabled` (not Docker TLS verify).
 * @param {boolean} tlsEnabled
 * @returns {string}
 */
function infraTlsSslCell(tlsEnabled) {
  return tlsEnabled ? 'ON 🔒' : 'OFF 🕐';
}

/**
 * Traefik proxy row (`traefik: true` in config). Icons only (no ANSI color).
 * @param {boolean} traefikEnabled
 * @returns {string}
 */
function statusTraefikProxyCell(traefikEnabled) {
  return traefikEnabled ? 'ON 🟢' : 'OFF 🟡';
}

/**
 * Environment for status (uppercase).
 * @param {unknown} environment
 * @returns {string}
 */
function formatStatusEnvironment(environment) {
  if (isUnset(environment)) {
    return EM;
  }
  return String(environment).trim().toUpperCase();
}

/**
 * Scoped resources for status: ON vs OFF (DEFAULT).
 * @param {boolean} useScoped
 * @returns {string}
 */
function statusScopedResourcesCell(useScoped) {
  return useScoped ? 'ON' : 'OFF (DEFAULT)';
}

/**
 * Single-line title for `aifabrix status` (same dev profile + remote host pattern as dev show).
 * @param {string} devIdStr
 * @param {string|null|undefined} remoteServer
 * @returns {string}
 */
function formatInfraStatusTitleLine(devIdStr, remoteServer) {
  const who = devProfileHandle(devIdStr);
  const host = hostFromRemoteUrl(remoteServer);
  if (host) {
    return `📊 Infrastructure Status (${who} @ ${host})`;
  }
  return `📊 Infrastructure Status (${who})`;
}

/**
 * @param {{ remoteServer: string|null|undefined, tlsEnabled: boolean, environment: unknown, useScoped: boolean, traefikEnabled: boolean }} p
 */
function logInfraStatusConfigurationSummary(p) {
  logger.log('⚙️ Configuration');
  logPaddedFieldRow('Server', p.remoteServer);
  logPaddedFieldRow('TLS/SSL', infraTlsSslCell(p.tlsEnabled));
  logPaddedFieldRow('Traefik proxy', statusTraefikProxyCell(p.traefikEnabled));
  logPaddedFieldRow('Environment', formatStatusEnvironment(p.environment));
  logPaddedFieldRow('Scoped resources', statusScopedResourcesCell(p.useScoped));
  logger.log('');
}

/**
 * @returns {Promise<{ devIdStr: string, remoteServer: string|null|undefined, tlsEnabled: boolean, environment: unknown, useScoped: boolean, traefikEnabled: boolean }>}
 */
async function loadInfraStatusSummary() {
  const [rawDevId, environment, tlsEnabled, remoteServer, useScoped, traefikEnabled] = await Promise.all([
    config.getDeveloperId(),
    config.getCurrentEnvironment(),
    config.getTlsEnabled(),
    config.getRemoteServer(),
    config.getUseEnvironmentScopedResources(),
    config.getTraefikEnabled()
  ]);
  const devIdStr = rawDevId === null || rawDevId === undefined ? '0' : String(rawDevId);
  return {
    devIdStr,
    environment,
    tlsEnabled,
    remoteServer,
    useScoped,
    traefikEnabled
  };
}

module.exports = {
  loadInfraStatusSummary,
  formatInfraStatusTitleLine,
  logInfraStatusConfigurationSummary,
  logPaddedFieldRow
};
