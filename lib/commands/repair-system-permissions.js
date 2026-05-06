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

function _normalizeOperationKey(opKey) {
  const s = _safeString(opKey);
  if (!s) return '';
  const withHyphens = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const cleaned = withHyphens.replace(/[^a-z0-9-]+/g, '-');
  return cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function _ensureDefaultRoles(systemParsed, systemKey) {
  if (Array.isArray(systemParsed.roles) && systemParsed.roles.length > 0) return false;
  const key = _safeString(systemKey) || _safeString(systemParsed?.key) || 'system';
  const display = _safeString(systemParsed?.displayName) || key;
  systemParsed.roles = [
    {
      name: `${display} Admin`,
      value: `${key}-admin`,
      description: `Full access to all ${display} operations`,
      groups: []
    },
    {
      name: `${display} Reader`,
      value: `${key}-reader`,
      description: `Read-only access to all ${display} data`,
      groups: []
    }
  ];
  return true;
}

function _pickRoleValue(systemParsed, suffix, fallback) {
  const roles = Array.isArray(systemParsed.roles) ? systemParsed.roles : [];
  const vals = roles
    .map((r) => r && typeof r === 'object' ? _safeString(r.value) : '')
    .filter(Boolean);
  return vals.find((v) => v.endsWith(suffix)) || vals[0] || fallback;
}

function _defaultRolesForPermissionName(permName, { adminValue, readerValue }) {
  const roles = [];
  const cap = typeof permName === 'string' && permName.includes(':') ? permName.split(':')[1] : '';
  const isRead = cap === 'list' || cap === 'get';
  if (isRead && readerValue) roles.push(readerValue);
  if (adminValue) roles.push(adminValue);
  return roles;
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
    .map((opKey) => _normalizeOperationKey(opKey) || opKey)
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

function _getExistingPermissionNameSet(systemParsed) {
  const asArray = Array.isArray(systemParsed.permissions) ? systemParsed.permissions : [];
  return new Set(
    asArray
      .map((p) => (typeof p === 'string' ? p : p && typeof p === 'object' ? p.name : null))
      .filter((n) => typeof n === 'string' && n.trim())
  );
}

function _backfillEmptyPermissionRoles(systemParsed, dryRun, adminValue, readerValue, changes) {
  if (dryRun) return false;
  if (!Array.isArray(systemParsed.permissions)) return false;
  let updated = false;
  for (const p of systemParsed.permissions) {
    if (!p || typeof p !== 'object') continue;
    if (typeof p.name !== 'string' || !p.name.trim()) continue;
    if (!Array.isArray(p.roles)) p.roles = [];
    if (p.roles.length > 0) continue;
    p.roles = _defaultRolesForPermissionName(p.name, { adminValue, readerValue });
    if (p.roles.length > 0) {
      changes.push(`RBAC: defaulted empty roles for system permission ${p.name}`);
      updated = true;
    }
  }
  return updated;
}

function _addMissingSystemPermission(systemParsed, perm, dryRun, adminValue, readerValue) {
  if (dryRun) return;
  if (!Array.isArray(systemParsed.permissions)) systemParsed.permissions = [];
  systemParsed.permissions.push({
    name: perm,
    roles: _defaultRolesForPermissionName(perm, { adminValue, readerValue }),
    description: `Permission: ${perm}`
  });
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

  const rolesAdded = _ensureDefaultRoles(systemParsed, systemParsed?.key);
  if (rolesAdded) {
    changes.push('Added default Admin/Reader roles (required for RBAC permissions)');
  }
  const adminValue = _pickRoleValue(systemParsed, '-admin', 'admin');
  const readerValue = _pickRoleValue(systemParsed, '-reader', null);

  const existing = _getExistingPermissionNameSet(systemParsed);
  let updated = _backfillEmptyPermissionRoles(systemParsed, dryRun, adminValue, readerValue, changes);

  for (const perm of desired) {
    if (existing.has(perm)) continue;
    _addMissingSystemPermission(systemParsed, perm, dryRun, adminValue, readerValue);
    changes.push(`Added system permission: ${perm} (autoRbac)`);
    existing.add(perm);
    updated = true;
  }
  return updated;
}

module.exports = { ensureSystemPermissionsForAutoRbac };

