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
const { resolveRbacPath } = require('../utils/app-config-resolver');

const DEFAULT_CAPABILITIES = ['list', 'get', 'create', 'update', 'delete'];

/**
 * Extracts roles and permissions from external system JSON for rbac.yaml (same rules as repair).
 * @param {Object} system - Parsed system config
 * @returns {Object|null} RBAC object or null
 */
function extractRbacFromSystem(system) {
  if (!system || typeof system !== 'object') return null;
  const hasRoles = system.roles && Array.isArray(system.roles) && system.roles.length > 0;
  const hasPermissions = system.permissions && Array.isArray(system.permissions) && system.permissions.length > 0;
  if (!hasRoles && !hasPermissions) return null;
  const rbac = {};
  if (hasRoles) rbac.roles = system.roles;
  if (hasPermissions) rbac.permissions = system.permissions;
  return rbac;
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
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = loadConfigFile(filePath);
      const resourceType = parsed?.resourceType || 'document';
      const caps = getCapabilitiesFromDatasource(parsed);
      for (const cap of caps) permissionNames.add(`${resourceType}:${cap}`);
    } catch (err) {
      logger.log(chalk.yellow(`⚠ Could not load ${fileName} for RBAC: ${err.message}`));
    }
  }
  return permissionNames;
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
  const resolvedPath = resolveRbacPath(appPath);
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
 * @param {{ format?: string, dryRun: boolean, changes: string[] }} options - format ('json'|'yaml'), dryRun, changes array
 * @returns {boolean} True if rbac was updated (or would be in dry-run)
 */
function mergeRbacFromDatasources(appPath, systemParsed, datasourceFiles, extractRbacFromSystem, options) {
  const { format = 'yaml', dryRun, changes } = options;
  const rbacFormat = format === 'json' ? 'json' : 'yaml';
  const permissionNames = collectPermissionNames(appPath, datasourceFiles);
  if (permissionNames.size === 0) return false;
  const systemKey = systemParsed?.key || 'system';
  const displayName = systemParsed?.displayName || systemKey;
  const { rbac, rbacPath } = loadOrCreateRbac(appPath, systemParsed, extractRbacFromSystem, rbacFormat);
  let updated = addMissingPermissions(rbac, permissionNames, changes);
  updated = ensureDefaultRoles(rbac, systemKey, displayName, changes) || updated;
  updated = ensureNonEmptyPermissionRoles(rbac, systemKey, changes) || updated;
  if (updated && !dryRun) {
    writeConfigFile(rbacPath, rbac);
  }
  return updated;
}

module.exports = {
  extractRbacFromSystem,
  getCapabilitiesFromDatasource,
  mergeRbacFromDatasources
};
