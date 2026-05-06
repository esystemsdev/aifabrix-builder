/**
 * @fileoverview Repair external system permissions[] for OpenAPI autoRbac operations
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfigFile } = require('../utils/config-format');

function _safeString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function _permissionNamesFromDatasource(parsed) {
  const resourceType = _safeString(parsed && parsed.resourceType) || 'document';
  const openapi = parsed && parsed.openapi;
  if (!openapi || typeof openapi !== 'object') return [];
  if (openapi.autoRbac !== true) return [];
  const ops = openapi.operations;
  if (!ops || typeof ops !== 'object' || Array.isArray(ops)) return [];
  return Object.keys(ops)
    .map((k) => _safeString(k))
    .filter(Boolean)
    .map((opKey) => `${resourceType}:${opKey}`);
}

function _collectAutoRbacOperationPermissions(appPath, datasourceFiles) {
  const permissionNames = new Set();
  for (const fileName of datasourceFiles || []) {
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    let parsed;
    try {
      parsed = loadConfigFile(filePath);
    } catch {
      continue;
    }
    for (const perm of _permissionNamesFromDatasource(parsed)) {
      permissionNames.add(perm);
    }
  }
  return permissionNames;
}

/**
 * Ensure system.permissions includes autoRbac-derived permission names.
 * @param {string} appPath
 * @param {Object} systemParsed - parsed *-system.json/yaml (mutated)
 * @param {string[]} datasourceFiles
 * @param {boolean} dryRun
 * @param {string[]} changes
 * @returns {boolean} updated
 */
function ensureSystemPermissionsForAutoRbac(appPath, systemParsed, datasourceFiles, dryRun, changes) {
  if (!systemParsed || typeof systemParsed !== 'object') return false;
  const desired = _collectAutoRbacOperationPermissions(appPath, datasourceFiles);
  if (desired.size === 0) return false;

  if (!Array.isArray(systemParsed.permissions)) {
    systemParsed.permissions = [];
  }
  const existing = new Set(systemParsed.permissions.filter((p) => typeof p === 'string' && p.trim()));
  let updated = false;
  for (const perm of desired) {
    if (existing.has(perm)) continue;
    if (!dryRun) systemParsed.permissions.push(perm);
    changes.push(`Added system permission: ${perm} (autoRbac)`);
    existing.add(perm);
    updated = true;
  }
  return updated;
}

module.exports = { ensureSystemPermissionsForAutoRbac };

