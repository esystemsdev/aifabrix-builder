/**
 * Append-only operational log for platform install / infra commands.
 * One record per top-level CLI command; no secrets; deterministic section order.
 *
 * @fileoverview installation.log writer beside config.yaml
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const paths = require('./paths');
const config = require('../core/config');
const logger = require('./logger');
const { buildInstallationRecordLines } = require('./installation-log-record');
const { sanitizeUrl } = require('./installation-log-core');

const INSTALLATION_LOG = 'installation.log';
/** Rotate when log exceeds this size; keep .1 and .2 backups. */
const MAX_LOG_BYTES = 10 * 1024 * 1024;

/**
 * @param {string} logPath
 * @param {number} [maxBytes]
 * @returns {Promise<void>}
 */
async function rotateInstallationLogIfNeeded(logPath, maxBytes = MAX_LOG_BYTES) {
  let st;
  try {
    st = await fs.stat(logPath);
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return;
    }
    throw e;
  }
  if (st.size < maxBytes) {
    return;
  }
  const dir = path.dirname(logPath);
  const base = path.basename(logPath);
  const p2 = path.join(dir, `${base}.2`);
  const p1 = path.join(dir, `${base}.1`);
  try {
    await fs.unlink(p2);
  } catch {
    // ignore
  }
  try {
    await fs.rename(p1, p2);
  } catch {
    // ignore
  }
  try {
    await fs.rename(logPath, p1);
  } catch {
    // ignore
  }
}

/**
 * @param {Object} payload
 * @returns {Promise<void>}
 */
async function appendInstallationRecord(payload) {
  const lines = await buildInstallationRecordLines(payload);
  const body = lines.join('\n');
  const logDir = paths.getAifabrixSystemDir();
  const logPath = path.join(logDir, INSTALLATION_LOG);

  try {
    await fs.mkdir(logDir, { recursive: true });
    await rotateInstallationLogIfNeeded(logPath);
    await fs.appendFile(logPath, body, 'utf8');
  } catch (err) {
    logger.warn(`installation.log: could not append (${err && err.message ? err.message : err})`);
  }
}

/**
 * @returns {Promise<string|undefined>}
 */
async function resolveControllerUrlForLog() {
  try {
    const { resolveControllerUrl } = require('./controller-url');
    const u = await resolveControllerUrl();
    return sanitizeUrl(u);
  } catch {
    return undefined;
  }
}

/**
 * @returns {Promise<'set'|'unset'>}
 */
async function resolveAdminEmailPresence() {
  try {
    const e = await config.getAdminEmail();
    return e && String(e).trim() ? 'set' : 'unset';
  } catch {
    return 'unset';
  }
}

const core = require('./installation-log-core');

module.exports = {
  appendInstallationRecord,
  createOperationId: core.createOperationId,
  stripDockerDigest: core.stripDockerDigest,
  collectPlatformAppImages: core.collectPlatformAppImages,
  derivePlatformVersion: core.derivePlatformVersion,
  resolveControllerUrlForLog,
  resolveAdminEmailPresence,
  buildInfraSectionLines: core.buildInfraSectionLines,
  resolveLogMode: core.resolveLogMode,
  getCliVersion: core.getCliVersion,
  rotateInstallationLogIfNeeded,
  INSTALLATION_LOG,
  MAX_LOG_BYTES
};
