/**
 * Client token listing and proactive refresh for auth status.
 *
 * @fileoverview Stored app tokens, auto-refresh when credentials exist
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const config = require('../core/config');
const logger = require('../utils/logger');
const { successGlyph, failureGlyph } = require('../utils/cli-test-layout-chalk');
const {
  getOrRefreshClientToken,
  loadClientCredentials,
  refreshClientToken,
  isTokenExpired
} = require('../utils/token-manager');

/**
 * @param {string} controllerUrl
 * @param {string} storedController
 * @returns {boolean}
 */
function controllersMatch(controllerUrl, storedController) {
  if (!storedController) {
    return false;
  }
  return config.normalizeControllerUrl(storedController) === config.normalizeControllerUrl(controllerUrl);
}

/**
 * @param {string} environment
 * @param {string} controllerUrl
 * @returns {Promise<Record<string, { controller?: string, token?: string, expiresAt?: string }>>}
 */
async function getClientEntriesForController(environment, controllerUrl) {
  const configData = await config.getConfig();
  const clients = configData.environments?.[environment]?.clients || {};
  const out = {};
  for (const [appName, tokenData] of Object.entries(clients)) {
    if (controllersMatch(controllerUrl, tokenData?.controller)) {
      out[appName] = tokenData;
    }
  }
  return out;
}

/**
 * Refresh expired client tokens when secrets.local.yaml (or env) has client id/secret.
 *
 * @async
 * @param {string} environment
 * @param {string} controllerUrl
 * @returns {Promise<number>} Count refreshed
 */
async function refreshExpiredClientTokensWherePossible(environment, controllerUrl) {
  const entries = await getClientEntriesForController(environment, controllerUrl);
  let refreshed = 0;
  for (const appName of Object.keys(entries)) {
    const tokenData = entries[appName];
    if (!tokenData?.token || !isTokenExpired(tokenData.expiresAt)) {
      continue;
    }
    const credentials = await loadClientCredentials(appName);
    if (!credentials?.clientId || !credentials?.clientSecret) {
      continue;
    }
    try {
      await refreshClientToken(environment, appName, controllerUrl);
      refreshed += 1;
    } catch {
      // Skip apps without valid credentials or controller errors
    }
  }
  return refreshed;
}

/**
 * @param {string} expiresAt
 * @returns {'valid'|'expired'|'unknown'}
 */
function tokenExpiryState(expiresAt) {
  if (!expiresAt) {
    return 'unknown';
  }
  return isTokenExpired(expiresAt) ? 'expired' : 'valid';
}

/**
 * Build rows for stored client tokens table.
 *
 * @async
 * @param {string} environment
 * @param {string} controllerUrl
 * @returns {Promise<Array<{ appName: string, expiresAt: string, state: string, logoutCmd: string }>>}
 */
async function listClientTokenRows(environment, controllerUrl) {
  const entries = await getClientEntriesForController(environment, controllerUrl);
  const rows = [];
  for (const appName of Object.keys(entries).sort()) {
    const tokenData = entries[appName];
    const state = tokenExpiryState(tokenData.expiresAt);
    const credentials = await loadClientCredentials(appName);
    const canRefresh = !!(credentials?.clientId && credentials?.clientSecret);
    let stateLabel = state;
    if (state === 'expired' && canRefresh) {
      stateLabel = 'expired (credentials available — refreshed on status if possible)';
    } else if (state === 'expired' && !canRefresh) {
      stateLabel = 'expired (no client id/secret in secrets — logout or login)';
    }
    rows.push({
      appName,
      expiresAt: tokenData.expiresAt || '—',
      state: stateLabel,
      logoutCmd: `aifabrix logout -e ${environment} -a ${appName}`
    });
  }
  return rows;
}

/**
 * Print stored application client tokens and logout commands.
 *
 * @async
 * @param {string} environment
 * @param {string} controllerUrl
 * @param {number} [refreshedCount]
 * @returns {Promise<void>}
 */
async function displayStoredClientTokensSection(environment, controllerUrl, refreshedCount = 0) {
  const rows = await listClientTokenRows(environment, controllerUrl);
  if (rows.length === 0) {
    return;
  }

  logger.log('');
  logger.log(chalk.bold('Stored application client tokens:'));
  if (refreshedCount > 0) {
    logger.log(
      chalk.gray(
        `  Refreshed ${refreshedCount} expired token(s) using client id/secret from secrets.local.yaml or env.`
      )
    );
  }
  logger.log(chalk.gray(`  Environment: ${environment} · Controller: ${controllerUrl}`));
  logger.log('');
  for (const row of rows) {
    const icon = row.state.startsWith('valid') ? successGlyph() : failureGlyph();
    logger.log(`  ${icon} ${chalk.cyan(row.appName)}`);
    logger.log(`      Expires: ${chalk.gray(row.expiresAt)}`);
    logger.log(`      Status: ${row.state}`);
    logger.log(`      Clear: ${chalk.gray(row.logoutCmd)}`);
  }
  logger.log('');
  logger.log(chalk.gray('  Clear all client tokens for this environment:'), chalk.gray(`aifabrix logout -e ${environment}`));
  logger.log(chalk.gray('  Clear device login for this controller:'), chalk.gray(`aifabrix logout -c ${controllerUrl}`));
  logger.log('');
}

/**
 * Resolve a working client token (refresh when expired if credentials exist).
 *
 * @async
 * @param {string} controllerUrl
 * @param {string} environment
 * @param {function(string, string, string, string, string): Promise<Object>} validateClientTokenFn
 * @returns {Promise<Object|null>}
 */
async function tryResolveClientTokenAuth(controllerUrl, environment, validateClientTokenFn) {
  const entries = await getClientEntriesForController(environment, controllerUrl);
  const appNames = Object.keys(entries);
  if (appNames.length === 0) {
    return null;
  }

  const ordered = ['dataplane', ...appNames.filter(a => a !== 'dataplane').sort()];
  let lastFailure = null;

  for (const appName of ordered) {
    try {
      const refreshed = await getOrRefreshClientToken(environment, appName, controllerUrl);
      if (!refreshed?.token) {
        continue;
      }
      const stored = await config.getClientToken(environment, appName);
      const result = await validateClientTokenFn(
        refreshed.token,
        controllerUrl,
        environment,
        appName,
        stored?.expiresAt
      );
      if (result.authenticated) {
        return result;
      }
      lastFailure = result;
    } catch {
      // Try next app
    }
  }

  return lastFailure;
}

module.exports = {
  refreshExpiredClientTokensWherePossible,
  displayStoredClientTokensSection,
  tryResolveClientTokenAuth,
  listClientTokenRows,
  getClientEntriesForController
};
