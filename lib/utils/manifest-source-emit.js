/**
 * Plan 141 P2: one gray **Manifest:** line on TTY when a command has resolved an application manifest.
 *
 * @fileoverview emitManifestMetadataLineIfTTY
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { resolveApplicationConfigPath } = require('./app-config-resolver');
const { resolveApplicationManifestPathSync } = require('./manifest-location');
const { metadata } = require('./cli-test-layout-chalk');
const pathsUtil = require('./paths');

/**
 * @param {string} tier - Tier id from {@link resolveApplicationManifestPathSync}
 * @returns {string}
 */
function humanTierLabel(tier) {
  if (tier === 'cwd-integration') return 'cwd/integration';
  if (tier === 'cwd-builder') return 'cwd/builder';
  if (tier === 'system-builder') return 'system-builder';
  return tier;
}

/**
 * Gray metadata line: `Manifest: <tier> — <configPath>`.
 *
 * @param {{ tier: string, configPath: string }} args
 * @returns {string}
 */
function formatManifestSourceMetadataLine(args) {
  const tier = args && typeof args.tier === 'string' ? args.tier : 'resolved';
  const configPath = args && typeof args.configPath === 'string' ? args.configPath : '';
  return metadata(`Manifest: ${humanTierLabel(tier)} — ${configPath}`);
}

/**
 * @param {string} appKey
 * @param {string} appPath
 * @param {string} [cwd]
 * @returns {string}
 */
function computeTierForAppPath(appKey, appPath, cwd) {
  const hit = resolveApplicationManifestPathSync({
    targetKey: appKey,
    cwd: cwd || process.cwd()
  });
  if (hit && path.resolve(hit.absolutePath) === path.resolve(appPath)) {
    return hit.tier;
  }
  return 'resolved';
}

/**
 * Machine-readable manifest provenance for `--json` consumers (plan 141).
 *
 * @param {string} appKey
 * @param {string} appPath - Application directory (absolute)
 * @param {{ cwd?: string }} [opts]
 * @returns {{ tier: string, tierLabel: string, configPath: string }}
 */
function getManifestSourcePayload(appKey, appPath, opts = {}) {
  const key = appKey && typeof appKey === 'string' ? appKey.trim() : '';
  const dir = appPath && typeof appPath === 'string' ? appPath.trim() : '';
  if (!key || !dir) {
    return { tier: 'unknown', tierLabel: 'unknown', configPath: '' };
  }
  let configPath = '';
  try {
    configPath = resolveApplicationConfigPath(dir);
  } catch {
    configPath = '';
  }
  let tier = 'resolved';
  try {
    tier = computeTierForAppPath(key, dir, opts.cwd);
  } catch {
    tier = 'resolved';
  }
  return {
    tier,
    tierLabel: humanTierLabel(tier),
    configPath
  };
}

/**
 * @returns {boolean}
 */
function isStdoutTty() {
  return Boolean(process.stdout && process.stdout.isTTY);
}

/**
 * Logs one gray manifest line when appropriate (TTY, not JSON, not env-only).
 *
 * @param {{ log: function(string): void }} logger - e.g. `require('./logger')`
 * @param {{ appKey: string, appPath: string, envOnly?: boolean, json?: boolean, cwd?: string }} opts
 * @returns {void}
 */
function emitManifestMetadataLineIfTTY(logger, opts) {
  if (!logger || typeof logger.log !== 'function') return;
  if (!opts || opts.json || opts.envOnly) return;
  if (!isStdoutTty()) return;
  const appKey = opts.appKey && typeof opts.appKey === 'string' ? opts.appKey.trim() : '';
  const appPath = opts.appPath && typeof opts.appPath === 'string' ? opts.appPath.trim() : '';
  if (!appKey || !appPath) return;
  let configPath;
  try {
    configPath = resolveApplicationConfigPath(appPath);
  } catch {
    return;
  }
  const tier = computeTierForAppPath(appKey, appPath, opts.cwd);
  logger.log(formatManifestSourceMetadataLine({ tier, configPath }));
}

/**
 * One gray **Manifest:** line for a platform system builder app (`keycloak`, `miso-controller`, `dataplane`).
 *
 * @param {{ log: function(string): void }} logger
 * @param {string} appKey
 * @param {{ envOnly?: boolean, json?: boolean, cwd?: string }} [opts]
 * @returns {void}
 */
function emitSystemBuilderAppManifestLineIfTTY(logger, appKey, opts = {}) {
  if (!appKey || typeof appKey !== 'string') return;
  emitManifestMetadataLineIfTTY(logger, {
    appKey,
    appPath: pathsUtil.getBuilderPath(appKey),
    envOnly: !!opts.envOnly,
    json: !!opts.json,
    cwd: opts.cwd
  });
}

/**
 * Gray **Manifest:** line for each platform app (Keycloak, Miso Controller, dataplane), in order.
 * Used after templates exist (e.g. guided `up-platform` after muted registry prep).
 *
 * @param {{ log: function(string): void }} logger
 * @param {{ envOnly?: boolean, json?: boolean, cwd?: string }} [opts]
 * @returns {void}
 */
function emitAllPlatformSystemManifestLinesIfTTY(logger, opts = {}) {
  for (const appKey of pathsUtil.SYSTEM_BUILDER_APP_KEYS) {
    emitSystemBuilderAppManifestLineIfTTY(logger, appKey, opts);
  }
}

/**
 * Integration load/export manifest line (plan 144).
 *
 * @param {{ tier?: string, configPath?: string, labelPrefix?: string }} opts
 * @returns {void}
 */
function emitManifestSourceMetadata(opts = {}) {
  if (!isStdoutTty()) return;
  const log = require('./logger');
  const tier = opts.tier && typeof opts.tier === 'string' ? opts.tier : 'resolved';
  const configPath =
    opts.configPath && typeof opts.configPath === 'string' ? opts.configPath : '';
  const labelPrefix =
    opts.labelPrefix && typeof opts.labelPrefix === 'string' ? opts.labelPrefix : '';
  const tierLabel = tier === 'int' ? 'integration' : humanTierLabel(tier);
  const line = labelPrefix
    ? metadata(`${labelPrefix} — ${tierLabel} — ${configPath}`)
    : formatManifestSourceMetadataLine({ tier: tierLabel, configPath });
  log.log(line);
}

module.exports = {
  emitManifestMetadataLineIfTTY,
  emitManifestSourceMetadata,
  emitSystemBuilderAppManifestLineIfTTY,
  emitAllPlatformSystemManifestLinesIfTTY,
  formatManifestSourceMetadataLine,
  computeTierForAppPath,
  humanTierLabel,
  getManifestSourcePayload
};
