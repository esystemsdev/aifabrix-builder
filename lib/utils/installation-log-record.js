/**
 * Build deterministic installation.log record lines (no I/O).
 *
 * @fileoverview installation record body formatting
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const config = require('../core/config');
const { maskSensitiveData } = require('./log-redaction');
const {
  createOperationId,
  getCliVersion,
  collectPlatformAppImages,
  derivePlatformVersion,
  buildInfraSectionLines,
  resolveLogMode,
  sanitizeUrl
} = require('./installation-log-core');

/**
 * @param {string[]} lines
 * @param {string} isoHeader
 * @returns {void}
 */
function pushTopBanner(lines, isoHeader) {
  lines.push('='.repeat(80));
  lines.push(`INSTALLATION ${isoHeader}`);
  lines.push('-'.repeat(80));
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @param {Object} identity
 * @returns {void}
 */
function pushIdentityCore(lines, payload, identity) {
  const { startedAt, completedAt, developerId, mode, platformVersion, durationSec } = identity;
  lines.push('recordVersion: 1');
  lines.push(`operationId: ${createOperationId()}`);
  lines.push(`command: ${payload.command}`);
  lines.push(`outcome: ${payload.outcome}`);
  lines.push(`durationSec: ${durationSec}`);
  lines.push(`cliVersion: ${getCliVersion()}`);
  lines.push(`platformVersion: ${platformVersion}`);
  lines.push(`developerId: ${developerId}`);
  lines.push(`mode: ${mode}`);
  lines.push(`startedAt: ${startedAt.toISOString()}`);
  lines.push(`completedAt: ${completedAt.toISOString()}`);

  if (payload.setupMode) {
    lines.push(`setupMode: ${payload.setupMode}`);
  }
  if (payload.upPlatformForce) {
    lines.push('upPlatformForce: true');
  }
  lines.push('');
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @param {Object} identity
 * @param {Date} identity.startedAt
 * @param {Date} identity.completedAt
 * @param {string} identity.developerId
 * @param {string} identity.mode
 * @param {string} identity.platformVersion
 * @returns {void}
 */
function pushHeaderAndIdentity(lines, payload, identity) {
  const { startedAt, completedAt } = identity;
  const durationSec = Math.round(
    Math.max(0, completedAt.getTime() - startedAt.getTime()) / 1000
  );
  const isoHeader = completedAt.toISOString();
  pushTopBanner(lines, isoHeader);
  pushIdentityCore(lines, payload, { ...identity, durationSec });
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @returns {void}
 */
function pushInfraBlock(lines, payload) {
  if (!payload.infra || !payload.infra.cfg) {
    return;
  }
  const { lines: infraLines } = buildInfraSectionLines(payload.infra.cfg, payload.infra.options || {});
  lines.push(...infraLines);
  lines.push('');
}

/**
 * @param {string[]} lines
 * @param {Record<string,string>|undefined} platformApps
 * @returns {void}
 */
function pushPlatformAppsBlock(lines, platformApps) {
  if (!platformApps || Object.keys(platformApps).length === 0) {
    return;
  }
  lines.push('Platform Apps');
  for (const key of Object.keys(platformApps).sort()) {
    lines.push(`  ${key}: ${platformApps[key]}`);
  }
  lines.push('');
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @returns {void}
 */
function pushConfigBlock(lines, payload) {
  const cfgExtra = payload.configExtra || {};
  const hasConfig =
    cfgExtra.controllerUrl ||
    cfgExtra.adminEmail === 'set' ||
    cfgExtra.adminEmail === 'unset';
  if (!hasConfig) {
    return;
  }
  lines.push('Config');
  if (cfgExtra.controllerUrl) {
    lines.push(`  controllerUrl: ${sanitizeUrl(cfgExtra.controllerUrl)}`);
  }
  if (cfgExtra.adminEmail === 'set' || cfgExtra.adminEmail === 'unset') {
    lines.push(`  adminEmail: ${cfgExtra.adminEmail}`);
  }
  lines.push('');
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @returns {void}
 */
function pushCleanupBlock(lines, payload) {
  const cleanup = payload.cleanup;
  if (!cleanup || typeof cleanup !== 'object' || Object.keys(cleanup).length === 0) {
    return;
  }
  lines.push('Cleanup');
  if (cleanup.volumesRemoved !== undefined) {
    lines.push(`  volumesRemoved: ${cleanup.volumesRemoved}`);
  }
  if (cleanup.configPreserved !== undefined) {
    lines.push(`  configPreserved: ${cleanup.configPreserved}`);
  }
  if (Array.isArray(cleanup.cleanedAppKeys) && cleanup.cleanedAppKeys.length > 0) {
    lines.push(`  cleanedAppKeys: ${cleanup.cleanedAppKeys.sort().join(', ')}`);
  }
  lines.push('');
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @returns {void}
 */
function pushErrorSection(lines, payload) {
  if (payload.outcome !== 'failure' || !payload.error) {
    return;
  }
  const msg =
    typeof payload.error.message === 'string'
      ? payload.error.message
      : String(payload.error);
  lines.push('Error');
  lines.push(`  message: ${maskSensitiveData(msg)}`);
  if (payload.errorCode) {
    lines.push(`  code: ${maskSensitiveData(String(payload.errorCode))}`);
  }
  lines.push('');
}

/**
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function resolvePlatformContextForRecord(payload) {
  const completedAt = payload.completedAt || new Date();
  const startedAt = payload.startedAt || completedAt;
  const options = payload.options || {};
  const mode = resolveLogMode(options);

  let developerId = 'unknown';
  try {
    const id = await config.getDeveloperId();
    developerId = id === null || id === undefined ? 'unknown' : String(id);
  } catch {
    // ignore
  }

  let platformApps = payload.platformApps;
  if (!platformApps && Array.isArray(payload.platformAppList) && payload.platformAppList.length > 0) {
    platformApps = collectPlatformAppImages(payload.platformAppList, options);
  }
  const platformVersion =
    payload.platformVersion ||
    (platformApps ? derivePlatformVersion(platformApps) : 'unknown');

  return { completedAt, startedAt, mode, developerId, platformApps, platformVersion };
}

/**
 * @param {Object} payload
 * @returns {Promise<string[]>}
 */
async function buildInstallationRecordLines(payload) {
  const ctx = await resolvePlatformContextForRecord(payload);
  const lines = [];
  pushHeaderAndIdentity(lines, payload, {
    startedAt: ctx.startedAt,
    completedAt: ctx.completedAt,
    developerId: ctx.developerId,
    mode: ctx.mode,
    platformVersion: ctx.platformVersion
  });
  pushInfraBlock(lines, payload);
  pushPlatformAppsBlock(lines, ctx.platformApps);
  pushConfigBlock(lines, payload);
  pushCleanupBlock(lines, payload);
  pushErrorSection(lines, payload);
  lines.push('='.repeat(80));
  lines.push('');
  return lines;
}

module.exports = {
  buildInstallationRecordLines
};
