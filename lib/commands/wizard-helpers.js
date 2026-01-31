/**
 * @fileoverview Wizard command helpers - pure and I/O helpers for wizard flow
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const logger = require('../utils/logger');

/**
 * Build preferences object for wizard.yaml (schema shape: intent, fieldOnboardingLevel, enableOpenAPIGeneration, enableMCP, enableABAC, enableRBAC)
 * @param {string} intent - User intent
 * @param {Object} preferences - From promptForUserPreferences (mcp, abac, rbac)
 * @returns {Object} Preferences for wizard-config schema
 */
function buildPreferencesForSave(intent, preferences) {
  return {
    intent: intent || 'general integration',
    fieldOnboardingLevel: 'full',
    enableOpenAPIGeneration: true,
    enableMCP: Boolean(preferences?.mcp),
    enableABAC: Boolean(preferences?.abac),
    enableRBAC: Boolean(preferences?.rbac)
  };
}

/**
 * Build source object for wizard.yaml (no secrets)
 * @param {Object} [source] - Source state
 * @returns {Object|undefined}
 */
function buildSourceForSave(source) {
  if (!source) return undefined;
  const out = { type: source.type };
  if (source.type === 'openapi-file' && source.filePath) out.filePath = source.filePath;
  if (source.type === 'openapi-url' && source.url) out.url = source.url;
  if (source.type === 'mcp-server' && source.serverUrl) {
    out.serverUrl = source.serverUrl;
    out.token = source.token ? '(set)' : undefined;
  }
  if (source.type === 'known-platform' && source.platform) out.platform = source.platform;
  return out;
}

/**
 * Build partial wizard state for saving to wizard.yaml (no secrets)
 * @param {Object} opts - Collected state
 * @returns {Object} Serializable wizard config shape
 */
function buildWizardStateForSave(opts) {
  const state = {
    appName: opts.appKey,
    mode: opts.mode,
    source: buildSourceForSave(opts.source)
  };
  if (opts.mode === 'add-datasource' && opts.systemIdOrKey) state.systemIdOrKey = opts.systemIdOrKey;
  if (opts.credential) state.credential = opts.credential;
  if (opts.preferences) state.preferences = opts.preferences;
  return state;
}

/**
 * Format source config as a short line for display
 * @param {Object} [source] - Source config
 * @returns {string|null}
 */
function formatSourceLine(source) {
  if (!source) return null;
  const s = source;
  return s.type + (s.filePath ? ` (${s.filePath})` : s.url ? ` (${s.url})` : s.platform ? ` (${s.platform})` : '');
}

/**
 * Format preferences config as a short line for display
 * @param {Object} [preferences] - Preferences config
 * @returns {string|null}
 */
function formatPreferencesLine(preferences) {
  if (!preferences || (!preferences.intent && (preferences.enableMCP === undefined || preferences.enableMCP === null))) {
    return null;
  }
  const p = preferences;
  return [p.intent && `intent=${p.intent}`, p.enableMCP && 'MCP', p.enableABAC && 'ABAC', p.enableRBAC && 'RBAC'].filter(Boolean).join(', ') || '(defaults)';
}

/**
 * Show a short summary of loaded wizard config (for resume flow)
 * @param {Object} config - Loaded wizard config
 * @param {string} displayPath - Path to show (e.g. integration/test/wizard.yaml)
 */
function showWizardConfigSummary(config, displayPath) {
  logger.log(chalk.blue('\n📋 Saved config summary'));
  logger.log(chalk.gray(`  From: ${displayPath}`));
  if (config.appName) logger.log(chalk.gray(`  App: ${config.appName}`));
  if (config.mode) logger.log(chalk.gray(`  Mode: ${config.mode}`));
  const srcLine = formatSourceLine(config.source);
  if (srcLine) logger.log(chalk.gray(`  Source: ${srcLine}`));
  if (config.credential) logger.log(chalk.gray(`  Credential: ${config.credential.action || 'skip'}`));
  const prefs = formatPreferencesLine(config.preferences);
  if (prefs) logger.log(chalk.gray(`  Preferences: ${prefs}`));
  logger.log('');
}

/**
 * Ensure integration/<appKey> directory exists
 * @param {string} appKey - Application key
 * @returns {Promise<string>} Resolved config path (integration/<appKey>/wizard.yaml)
 */
async function ensureIntegrationDir(appKey) {
  const dir = path.join(process.cwd(), 'integration', appKey);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'wizard.yaml');
}

/** External system types that support add-datasource (excludes webapp/application) */
const EXTERNAL_SYSTEM_TYPES = ['openapi', 'mcp', 'custom'];

/**
 * Returns true if the system is an external system that supports add-datasource (not a webapp).
 * @param {Object} sys - System object from getExternalSystem (may have type, systemType, or kind)
 * @returns {boolean}
 */
function isExternalSystemForAddDatasource(sys) {
  const type = (sys?.type || sys?.systemType || sys?.kind || '').toLowerCase();
  if (!type) return true;
  if (EXTERNAL_SYSTEM_TYPES.includes(type)) return true;
  if (['webapp', 'application', 'app'].includes(type)) return false;
  return true;
}

module.exports = {
  buildPreferencesForSave,
  buildSourceForSave,
  buildWizardStateForSave,
  formatSourceLine,
  formatPreferencesLine,
  showWizardConfigSummary,
  ensureIntegrationDir,
  EXTERNAL_SYSTEM_TYPES,
  isExternalSystemForAddDatasource
};
