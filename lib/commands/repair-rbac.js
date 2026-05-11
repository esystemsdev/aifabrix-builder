/**
 * RBAC merge for repair: build permissions from datasources and ensure default roles.
 *
 * @fileoverview Repair RBAC merge from datasource resourceType/capabilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const { backupIntegrationFile } = require('../utils/integration-file-backup');
const appConfigResolver = require('../utils/app-config-resolver');
const { extractRbacFromSystem } = require('./repair-rbac-extract');

const DEFAULT_CAPABILITIES = ['list', 'get', 'create', 'update', 'delete'];

function _safeString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function _normalizeOperationKey(opKey) {
  const s = _safeString(opKey);
  if (!s) return '';
  const withHyphens = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const cleaned = withHyphens.replace(/[^a-z0-9-]+/g, '-');
  return cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Resolves capabilities from datasource (array or legacy object).
 * @param {Object} parsed - Parsed datasource
 * @returns {string[]}
 */
function getCapabilitiesFromDatasource(parsed) {
  const cap = parsed?.capabilities;
  if (Array.isArray(cap)) {
    const arr = cap.filter(c => typeof c === 'string');
    if (arr.length > 0) return arr;
    return [...DEFAULT_CAPABILITIES];
  }
  if (cap && typeof cap === 'object') {
    const keys = Object.keys(cap).filter(k => cap[k] === true);
    if (keys.length > 0) return keys;
    return [...DEFAULT_CAPABILITIES];
  }
  return [...DEFAULT_CAPABILITIES];
}

/**
 * Collects permission names (resourceType:capability) from datasource files.
 * @param {string} appPath - Application path
 * @param {string[]} datasourceFiles - Datasource file names
 * @returns {Set<string>}
 */
function collectPermissionNames(appPath, datasourceFiles) {
  const permissionNames = new Set();
  for (const fileName of datasourceFiles || []) {
    const parsed = _safeLoadDatasource(appPath, fileName);
    if (!parsed) continue;
    _collectPermissionNamesFromDatasourceParsed(permissionNames, parsed);
  }
  return permissionNames;
}

function _safeLoadDatasource(appPath, fileName) {
  const filePath = path.join(appPath, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    return loadConfigFile(filePath);
  } catch (err) {
    logger.log(chalk.yellow(`⚠ Could not load ${fileName} for RBAC: ${err.message}`));
    return null;
  }
}

function _hasAutoRbacOps(parsed) {
  const openapi = parsed?.openapi;
  return (
    openapi &&
    typeof openapi === 'object' &&
    openapi.autoRbac === true &&
    openapi.operations &&
    typeof openapi.operations === 'object' &&
    !Array.isArray(openapi.operations)
  );
}

function _collectPermissionNamesFromDatasourceParsed(permissionNames, parsed) {
  const resourceType = parsed?.resourceType || 'document';

  if (_hasAutoRbacOps(parsed)) {
    const ops = parsed.openapi.operations;
    for (const opKey of Object.keys(ops)) {
      const normOpKey = _normalizeOperationKey(opKey) || _safeString(opKey);
      if (!normOpKey) continue;
      permissionNames.add(`${resourceType}:${normOpKey}`);
    }
  }
  // When autoRbac is false/missing, RBAC is considered manual; do not auto-generate permissions.
}

function _collectManagedResourceTypesFromDatasources(appPath, datasourceFiles) {
  const out = new Set();
  for (const fileName of datasourceFiles || []) {
    const parsed = _safeLoadDatasource(appPath, fileName);
    if (!parsed) continue;
    if (!_hasAutoRbacOps(parsed)) continue;
    const rt = _safeString(parsed.resourceType) || 'document';
    out.add(rt);
  }
  return out;
}

function _buildDesiredPermissionNames(appPath, datasourceFiles) {
  const desired = collectPermissionNames(appPath, datasourceFiles);
  if (desired.size === 0) return { desired, managedResourceTypes: new Set(), aliases: new Map() };

  const managedResourceTypes = _collectManagedResourceTypesFromDatasources(appPath, datasourceFiles);

  // Build alias map for rename support (kebab-case or case variants -> canonical).
  const aliases = new Map();
  for (const name of desired) {
    const [rt, op] = String(name).split(':');
    if (!rt || !op) continue;
    const kebab = _normalizeOperationKey(op);
    if (kebab && `${rt}:${kebab}` !== name) {
      aliases.set(`${rt}:${kebab}`, name);
    }
    const lower = `${rt}:${String(op).toLowerCase()}`;
    if (lower !== name) {
      aliases.set(lower, name);
    }
    const dehyphen = `${rt}:${String(op).replace(/-/g, '').toLowerCase()}`;
    if (dehyphen !== name) {
      aliases.set(dehyphen, name);
    }
  }
  return { desired, managedResourceTypes, aliases };
}

function _renameExistingPermissionIfAliasMatches(rbac, aliases, changes) {
  if (!rbac || !Array.isArray(rbac.permissions) || aliases.size === 0) return false;
  let updated = false;
  for (const p of rbac.permissions) {
    if (!p || typeof p !== 'object') continue;
    const name = _safeString(p.name);
    if (!name) continue;
    const canonical = aliases.get(name);
    if (!canonical || canonical === name) continue;
    p.name = canonical;
    changes.push(`Renamed RBAC permission: ${name} → ${canonical}`);
    updated = true;
  }
  return updated;
}

function _removeExtraAutoRbacPermissions(rbac, desired, managedResourceTypes, changes) {
  if (!rbac || !Array.isArray(rbac.permissions) || desired.size === 0) return false;
  if (!managedResourceTypes || managedResourceTypes.size === 0) return false;
  const before = rbac.permissions.length;
  rbac.permissions = rbac.permissions.filter((p) => {
    const name = _safeString(p?.name);
    if (!name || !name.includes(':')) return true;
    const [rt] = name.split(':');
    if (!managedResourceTypes.has(rt)) return true;
    return desired.has(name);
  });
  const after = rbac.permissions.length;
  if (after === before) return false;
  changes.push(`Removed ${before - after} extra autoRbac permission(s) not present in operations`);
  return true;
}

/**
 * Loads existing RBAC file (rbac.yaml, rbac.yml, or rbac.json) or creates empty structure.
 * Uses extractRbacFromSystem when no file exists. New file path respects format (rbac.json when format is 'json').
 *
 * @param {string} appPath - Application path
 * @param {Object} [systemParsed] - Parsed system for extractRbacFromSystem
 * @param {Function} extractRbacFromSystem - (system) => rbac or null
 * @param {string} [format] - 'json' or 'yaml'; used only when creating a new file (default 'yaml')
 * @returns {{ rbac: Object, rbacPath: string }} rbacPath is resolved path or path.join(appPath, 'rbac.{json|yaml}') for new file
 */
function loadOrCreateRbac(appPath, systemParsed, extractRbacFromSystem, format) {
  const resolvedPath = appConfigResolver.resolveRbacPath(appPath);
  let rbac;
  let rbacPath;
  if (resolvedPath) {
    rbac = loadConfigFile(resolvedPath);
    rbacPath = resolvedPath;
  } else {
    rbac = extractRbacFromSystem(systemParsed) || { roles: [], permissions: [] };
    if (!Array.isArray(rbac.roles)) rbac.roles = [];
    if (!Array.isArray(rbac.permissions)) rbac.permissions = [];
    const ext = (format === 'json') ? 'rbac.json' : 'rbac.yaml';
    rbacPath = path.join(appPath, ext);
  }
  return { rbac, rbacPath };
}

/**
 * Adds missing permissions to rbac.permissions. Mutates rbac.
 * @param {Object} rbac - RBAC object (mutated)
 * @param {Set<string>} permissionNames - Desired permission names
 * @param {string[]} changes - Array to append to
 * @returns {boolean}
 */
function addMissingPermissions(rbac, permissionNames, changes) {
  const existing = new Set((rbac.permissions || []).map(p => p?.name).filter(Boolean));
  let updated = false;
  for (const name of permissionNames) {
    if (existing.has(name)) continue;
    rbac.permissions = rbac.permissions || [];
    rbac.permissions.push({ name, roles: [], description: `Permission: ${name}` });
    existing.add(name);
    changes.push(`Added RBAC permission: ${name}`);
    updated = true;
  }
  return updated;
}

/**
 * Ensures default Admin and Reader roles if rbac.roles is empty. Mutates rbac.
 * @param {Object} rbac - RBAC object (mutated)
 * @param {string} systemKey - System key
 * @param {string} displayName - Display name
 * @param {string[]} changes - Array to append to
 * @returns {boolean}
 */
function ensureDefaultRoles(rbac, systemKey, displayName, changes) {
  const hasRoles = Array.isArray(rbac.roles) && rbac.roles.length > 0;
  if (hasRoles) return false;
  const adminValue = `${systemKey}-admin`;
  const readerValue = `${systemKey}-reader`;
  rbac.roles = [
    { name: `${displayName} Admin`, value: adminValue, description: `Full access to all ${displayName} operations`, groups: [] },
    { name: `${displayName} Reader`, value: readerValue, description: `Read-only access to all ${displayName} data`, groups: [] }
  ];
  const listGetPerms = (rbac.permissions || [])
    .filter(p => p?.name && (p.name.split(':')[1] === 'list' || p.name.split(':')[1] === 'get'))
    .map(p => p.name);
  for (const p of rbac.permissions || []) {
    if (!p.roles) p.roles = [];
    if (p.name && listGetPerms.includes(p.name) && !p.roles.includes(readerValue)) p.roles.push(readerValue);
    if (!p.roles.includes(adminValue)) p.roles.push(adminValue);
  }
  changes.push('Added default Admin and Reader roles to rbac file');
  return true;
}

function _roleValues(rbac) {
  const roles = Array.isArray(rbac.roles) ? rbac.roles : [];
  return roles
    .map(r => r?.value)
    .filter(v => typeof v === 'string' && v.trim());
}

function _pickAdminRoleValue(roleValues, systemKey) {
  return (
    roleValues.find(v => v === `${systemKey}-admin`) ||
    roleValues.find(v => /-admin$/.test(v)) ||
    roleValues[0] ||
    null
  );
}

function _pickReaderRoleValue(roleValues, systemKey) {
  return (
    roleValues.find(v => v === `${systemKey}-reader`) ||
    roleValues.find(v => /-reader$/.test(v)) ||
    null
  );
}

function _capabilityFromPermissionName(name) {
  if (typeof name !== 'string' || !name.includes(':')) return null;
  return name.split(':')[1] || null;
}

function _defaultRolesForCapability(cap, { adminValue, readerValue }) {
  const roles = [];
  if ((cap === 'list' || cap === 'get') && readerValue) roles.push(readerValue);
  if (adminValue) roles.push(adminValue);
  return roles;
}

/**
 * Ensures every permission has at least one role assigned.
 *
 * When roles already exist, new permissions may be added with empty roles (invalid for manifest).
 * Apply a safe default:
 * - list/get -> reader + admin when those roles exist
 * - create/update/delete -> admin when it exists (otherwise first available role)
 *
 * Mutates rbac.
 * @param {Object} rbac - RBAC object (mutated)
 * @param {string} systemKey - System key
 * @param {string[]} changes - Array to append to
 * @returns {boolean}
 */
function ensureNonEmptyPermissionRoles(rbac, systemKey, changes) {
  const roleValues = _roleValues(rbac);
  if (!Array.isArray(rbac.permissions) || roleValues.length === 0) return false;

  const adminValue = _pickAdminRoleValue(roleValues, systemKey);
  const readerValue = _pickReaderRoleValue(roleValues, systemKey);

  let updated = false;
  for (const p of rbac.permissions) {
    if (!p || typeof p !== 'object') continue;
    if (!Array.isArray(p.roles)) p.roles = [];
    if (p.roles.length > 0) continue;

    const cap = _capabilityFromPermissionName(p.name);
    const defaults = _defaultRolesForCapability(cap, { adminValue, readerValue });
    for (const rv of defaults) {
      if (!p.roles.includes(rv)) p.roles.push(rv);
    }
    if (p.roles.length > 0) {
      changes.push(`RBAC: defaulted empty roles for ${p.name}`);
      updated = true;
    }
  }
  return updated;
}

/**
 * Merges RBAC from datasources: ensures permission per resourceType:capability, adds Admin/Reader roles if none.
 * When creating a new RBAC file, uses rbac.json if format is 'json', otherwise rbac.yaml.
 *
 * @param {string} appPath - Application path
 * @param {Object} systemParsed - Parsed system (key, displayName)
 * @param {string[]} datasourceFiles - Datasource file names
 * @param {Function} extractRbacFromSystem - (system) => rbac or null
 * @param {{ format?: string, dryRun: boolean, changes: string[], backupCtx?: Object }} options - format ('json'|'yaml'), dryRun, changes array
 * @returns {boolean} True if rbac was updated (or would be in dry-run)
 */
function mergeRbacFromDatasources(appPath, systemParsed, datasourceFiles, extractRbacFromSystem, options) {
  const { format = 'yaml', dryRun, changes, backupCtx } = options;
  const rbacFormat = format === 'json' ? 'json' : 'yaml';
  const { desired: permissionNames, managedResourceTypes, aliases } = _buildDesiredPermissionNames(appPath, datasourceFiles);
  if (permissionNames.size === 0) return false;
  const systemKey = systemParsed?.key || 'system';
  const displayName = systemParsed?.displayName || systemKey;
  const { rbac, rbacPath } = loadOrCreateRbac(appPath, systemParsed, extractRbacFromSystem, rbacFormat);
  let updated = _renameExistingPermissionIfAliasMatches(rbac, aliases, changes);
  updated = addMissingPermissions(rbac, permissionNames, changes) || updated;
  updated = _removeExtraAutoRbacPermissions(rbac, permissionNames, managedResourceTypes, changes) || updated;
  updated = ensureDefaultRoles(rbac, systemKey, displayName, changes) || updated;
  updated = ensureNonEmptyPermissionRoles(rbac, systemKey, changes) || updated;
  if (updated && !dryRun) {
    backupIntegrationFile(rbacPath, backupCtx);
    writeConfigFile(rbacPath, rbac);
  }
  return updated;
}

const { migrateSystemRbacIntoRbacFile } = require('./repair-rbac-migrate');

module.exports = {
  extractRbacFromSystem,
  getCapabilitiesFromDatasource,
  mergeRbacFromDatasources,
  migrateSystemRbacIntoRbacFile
};
