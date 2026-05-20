/**
 * @fileoverview Shared auth/helpers for identity CLI commands
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { resolveControllerUrl } = require('../utils/controller-url');
const { normalizeControllerUrl, resolveEnvironment } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const {
  unwrapControllerData,
  throwIfApiFailed,
  assertSyncStatsOk,
  apiErrorMessage
} = require('../identity/identity-apply-core');

/**
 * @returns {Promise<{ controllerUrl: string, authConfig: Object }>}
 */
async function resolveControllerAndAuth() {
  const controllerUrl = await resolveControllerUrl();
  if (!controllerUrl) {
    throw new Error('Controller URL is required. Run "aifabrix login" first.');
  }
  const normalized = normalizeControllerUrl(controllerUrl);
  const deviceToken = await getOrRefreshDeviceToken(normalized);
  if (!deviceToken || !deviceToken.token) {
    throw new Error(
      `Not authenticated for controller: ${controllerUrl}. Run "aifabrix login" and try again.`
    );
  }
  return {
    controllerUrl: deviceToken.controller || normalized,
    authConfig: { type: 'bearer', token: deviceToken.token }
  };
}

/**
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
async function resolveEnvKey(options = {}) {
  const fromFlag = options.env || options.environment;
  if (fromFlag) {
    return String(fromFlag).trim();
  }
  const env = await resolveEnvironment();
  return env || 'dev';
}

/**
 * @param {string} raw
 * @param {string} label
 * @returns {string}
 */
function requireNonEmpty(raw, label) {
  const s = String(raw || '').trim();
  if (!s) {
    throw new Error(`${label} is required.`);
  }
  return s;
}

/**
 * @param {string} groupsArg
 * @returns {string[]}
 */
function parseGroupsList(groupsArg) {
  const raw = String(groupsArg || '').trim();
  if (!raw) {
    throw new Error('--groups is required (comma-separated group names).');
  }
  const parts = raw
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error('At least one group name is required in --groups.');
  }
  return parts;
}

module.exports = {
  resolveControllerAndAuth,
  resolveEnvKey,
  requireNonEmpty,
  parseGroupsList,
  unwrapControllerData,
  throwIfApiFailed,
  assertSyncStatsOk,
  apiErrorMessage
};
