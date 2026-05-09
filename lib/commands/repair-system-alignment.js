/**
 * Helper functions for aligning external integration system/datasource config.
 *
 * Extracted from repair.js to keep file size under 500 lines.
 *
 * @fileoverview External integration repair helpers (system/datasource alignment)
 */

'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const { systemKeyToKvPrefix, securityKeyToVar } = require('../utils/credential-secrets-env');
const { backupIntegrationFile } = require('../utils/integration-file-backup');
const logger = require('../utils/logger');

/**
 * Loads first system file and returns parsed object with key
 * @param {string} appPath - Application path
 * @param {string} systemFileName - System file name
 * @returns {Object} Parsed system config
 */
function loadFirstSystemFile(appPath, systemFileName) {
  const systemPath = path.join(appPath, systemFileName);
  if (!fs.existsSync(systemPath)) {
    throw new Error(`System file not found: ${systemPath}`);
  }
  return loadConfigFile(systemPath);
}

function resolveSystemContext(appPath, systemFiles) {
  const systemFilePath = path.join(appPath, systemFiles[0]);
  const systemParsed = loadFirstSystemFile(appPath, systemFiles[0]);
  const systemKey = systemParsed.key ||
    path.basename(systemFiles[0], path.extname(systemFiles[0])).replace(/-system$/, '');
  return { systemFilePath, systemParsed, systemKey };
}

function ensureExternalIntegrationBlock(variables, systemFiles, datasourceFiles, changes) {
  const extInt = variables.externalIntegration;
  let updated = false;
  if (!extInt) {
    variables.externalIntegration = {
      schemaBasePath: './',
      systems: systemFiles,
      dataSources: datasourceFiles,
      autopublish: true,
      version: '1.0.0'
    };
    changes.push('Created externalIntegration block from discovered files');
    updated = true;
  } else {
    const prevSystems = extInt.systems || [];
    const prevDataSources = extInt.dataSources || [];
    if (JSON.stringify(prevSystems) !== JSON.stringify(systemFiles)) {
      changes.push(`systems: [${prevSystems.join(', ')}] → [${systemFiles.join(', ')}]`);
      extInt.systems = systemFiles;
      updated = true;
    }
    if (JSON.stringify(prevDataSources) !== JSON.stringify(datasourceFiles)) {
      changes.push(`dataSources: [${prevDataSources.join(', ')}] → [${datasourceFiles.join(', ')}]`);
      extInt.dataSources = datasourceFiles;
      updated = true;
    }
  }
  return updated;
}

function alignAppKeyWithSystem(variables, systemKey, _systemParsed, changes) {
  const appKey = variables.app?.key;
  if (!appKey || appKey === systemKey) return false;
  if (!variables.app) variables.app = {};
  variables.app.key = systemKey;
  changes.push(`app.key: ${appKey} → ${systemKey}`);
  return true;
}

/**
 * Aligns datasource systemKey values to match the system key.
 * Updates each datasource file whose systemKey differs from the system key.
 *
 * @param {string} appPath - Application directory path
 * @param {string[]} datasourceFiles - Datasource file names
 * @param {string} systemKey - Expected system key
 * @param {boolean} dryRun - If true, report changes but do not write
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any file was updated (or would be in dry-run)
 */
function alignDatasourceSystemKeys(appPath, datasourceFiles, systemKey, dryRun, changes, backupCtx) {
  if (!datasourceFiles || datasourceFiles.length === 0) return false;
  let updated = false;
  for (const datasourceFile of datasourceFiles) {
    const datasourcePath = path.join(appPath, datasourceFile);
    if (!fs.existsSync(datasourcePath)) continue;
    const parsed = loadConfigFile(datasourcePath);
    const old = parsed.systemKey;
    if (old !== systemKey) {
      parsed.systemKey = systemKey;
      if (!dryRun) {
        backupIntegrationFile(datasourcePath, backupCtx);
        writeConfigFile(datasourcePath, parsed);
      }
      changes.push(`${datasourceFile}: systemKey ${old} → ${systemKey}`);
      updated = true;
    }
  }
  return updated;
}

/**
 * Derives a datasource key from filename when the file has no key.
 * - hubspot-datasource-company.json → hubspot-company
 * - datasource-companies.json → {systemKey}-companies (e.g. test-hubspot-companies)
 *
 * @param {string} fileName - Datasource file name
 * @param {string} systemKey - System key (e.g. test-hubspot), used for datasource-*.json style names
 * @returns {string}
 */
function deriveDatasourceKeyFromFileName(fileName, systemKey) {
  const base = path.basename(fileName, path.extname(fileName));
  if (/^datasource-/.test(base)) {
    const suffix = base.slice('datasource-'.length);
    return systemKey && typeof systemKey === 'string' ? `${systemKey}-${suffix}` : base;
  }
  return base.replace(/-datasource-/, '-');
}

/**
 * Aligns system file dataSources array to match datasource keys from discovered files.
 * The system file holds logical keys (not filenames): each key comes from that datasource
 * file's "key" property, or is derived from the filename when missing (e.g. datasource-companies.json → {systemKey}-companies).
 *
 * @param {string} appPath - Application directory path
 * @param {Object} systemParsed - Parsed system config (mutated)
 * @param {string[]} datasourceFiles - Datasource file names
 * @param {string} systemKey - System key for deriving key when missing
 * @param {boolean} dryRun - If true, report changes but do not write
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if dataSources was updated (or would be in dry-run)
 */
function alignSystemFileDataSources(appPath, systemParsed, datasourceFiles, systemKey, _dryRun, changes) {
  const keys = [];
  for (const fileName of datasourceFiles) {
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = loadConfigFile(filePath);
      const key = parsed && typeof parsed.key === 'string' && parsed.key.trim()
        ? parsed.key.trim()
        : deriveDatasourceKeyFromFileName(fileName, systemKey);
      keys.push(key);
    } catch (err) {
      logger.log(chalk.yellow(`⚠ Could not load datasource file ${fileName}: ${err.message}; using derived key`));
      keys.push(deriveDatasourceKeyFromFileName(fileName, systemKey));
    }
  }
  const prev = Array.isArray(systemParsed.dataSources) ? [...systemParsed.dataSources] : [];
  if (JSON.stringify(prev) === JSON.stringify(keys)) return false;
  systemParsed.dataSources = keys;
  changes.push(`dataSources: [${prev.join(', ') || '(none)'}] → [${keys.join(', ')}] (keys from each datasource file's "key" or filename)`);
  return true;
}

/**
 * Builds the set of auth variable names (UPPERCASE, no underscores) from authentication.variables and authentication.security.
 * Used to detect configuration entries that belong only in the authentication section.
 * Canonical keys per method are in lib/schema/external-system.schema.json $defs.authenticationVariablesByMethod
 * (e.g. oauth2: variables baseUrl, tokenUrl, scope; security clientId, clientSecret).
 *
 * @param {Object} systemParsed - Parsed system config
 * @param {string} _systemKey - System key (unused; for API consistency)
 * @returns {Set<string>}
 */
function buildAuthVarNames(systemParsed, _systemKey) {
  const names = new Set();
  const auth = systemParsed.authentication;
  if (auth && typeof auth.variables === 'object') {
    for (const k of Object.keys(auth.variables)) {
      names.add(String(k).toUpperCase().replace(/_/g, ''));
    }
  }
  if (auth && typeof auth.security === 'object') {
    for (const k of Object.keys(auth.security)) {
      names.add(securityKeyToVar(k));
    }
  }
  return names;
}

/**
 * Derives the normalized auth variable part from a config entry name (for matching against authNames).
 * E.g. KV_HUBSPOT_CLIENTID → CLIENTID, BASEURL → BASEURL.
 * @param {string} name - Entry name
 * @param {string} systemKey - System key for KV_ prefix
 * @returns {string}
 */
function normalizedAuthPartFromConfigName(name, systemKey) {
  const n = String(name).trim();
  if (!n) return '';
  const prefix = systemKeyToKvPrefix(systemKey);
  const kvPrefix = `KV_${prefix}_`;
  if (n.toUpperCase().startsWith(kvPrefix)) {
    const rest = n.slice(kvPrefix.length);
    return rest.toUpperCase().replace(/_/g, '');
  }
  // Old-style or other KV_* names: treat last segment as var (e.g. KV_HUBSPOT_CLIENTID → CLIENTID)
  if (n.toUpperCase().startsWith('KV_')) {
    const parts = n.split('_').filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
  }
  return n.toUpperCase().replace(/_/g, '');
}

function removeAuthVarsFromConfiguration(systemParsed, systemKey, _dryRun, changes) {
  const config = systemParsed.configuration;
  if (!Array.isArray(config)) return false;
  const authNames = buildAuthVarNames(systemParsed, systemKey);
  if (authNames.size === 0) return false;
  const removed = [];
  const filtered = config.filter((entry) => {
    if (!entry || !entry.name) return true;
    const authPart = normalizedAuthPartFromConfigName(entry.name, systemKey);
    if (authNames.has(authPart)) {
      removed.push(entry.name);
      return false;
    }
    return true;
  });
  if (removed.length === 0) return false;
  systemParsed.configuration = filtered;
  changes.push(`Removed authentication variable(s) from configuration: ${removed.join(', ')}`);
  return true;
}

module.exports = {
  alignAppKeyWithSystem,
  alignDatasourceSystemKeys,
  alignSystemFileDataSources,
  ensureExternalIntegrationBlock,
  removeAuthVarsFromConfiguration,
  resolveSystemContext
};

