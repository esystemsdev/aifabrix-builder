/**
 * Moves roles/permissions from *-system.{json,yaml} into rbac.{yaml,json} when both exist.
 *
 * @fileoverview migrateSystemRbacIntoRbacFile
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const appConfigResolver = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const extractModule = require('./repair-rbac-extract');

function _safeString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

/**
 * Merges roles from source into target; dedupes by role.value.
 * @param {Object[]} targetRoles - rbac.roles (mutated)
 * @param {Object[]} sourceRoles - roles to merge in
 * @returns {boolean} True if targetRoles changed
 */
function _mergeRoleObjectsInto(targetRoles, sourceRoles) {
  if (!Array.isArray(sourceRoles) || sourceRoles.length === 0) return false;
  const seen = new Set(
    (targetRoles || []).map(r => _safeString(r?.value)).filter(Boolean)
  );
  let updated = false;
  for (const r of sourceRoles) {
    if (!r || typeof r !== 'object') continue;
    const value = _safeString(r.value);
    if (!value || seen.has(value)) continue;
    targetRoles.push({
      name: r.name,
      value: r.value,
      description: r.description,
      groups: Array.isArray(r.groups) ? [...r.groups] : []
    });
    seen.add(value);
    updated = true;
  }
  return updated;
}

/**
 * @param {unknown[]} existingRoles - roles already on permission
 * @param {unknown[]} incomingRoles - roles from merged permission
 * @returns {string[]|null} New roles array if union added roles
 */
function _unionPermissionRoleSets(existingRoles, incomingRoles) {
  const a = new Set(Array.isArray(existingRoles) ? existingRoles : []);
  let unionChanged = false;
  for (const rv of incomingRoles || []) {
    if (typeof rv === 'string' && rv.trim() && !a.has(rv)) {
      a.add(rv);
      unionChanged = true;
    }
  }
  return unionChanged ? [...a] : null;
}

/**
 * Merges permissions from source into target; dedupes by name; unions roles arrays.
 * @param {Object[]} targetPerms - rbac.permissions (mutated)
 * @param {Object[]} sourcePerms - permissions to merge in
 * @returns {boolean} True if targetPerms changed
 */
function _mergePermissionObjectsInto(targetPerms, sourcePerms) {
  if (!Array.isArray(sourcePerms) || sourcePerms.length === 0) return false;
  const byName = new Map(
    (targetPerms || []).filter(p => p && typeof p === 'object').map(p => [p.name, p])
  );
  let updated = false;
  for (const p of sourcePerms) {
    if (!p || typeof p !== 'object') continue;
    const name = _safeString(p.name);
    if (!name) continue;
    const existing = byName.get(name);
    if (!existing) {
      targetPerms.push({
        name: p.name,
        description: _safeString(p.description) || `Permission: ${name}`,
        roles: Array.isArray(p.roles) ? [...p.roles] : []
      });
      byName.set(name, targetPerms[targetPerms.length - 1]);
      updated = true;
      continue;
    }
    const mergedRoles = _unionPermissionRoleSets(existing.roles, Array.isArray(p.roles) ? p.roles : []);
    if (mergedRoles) {
      existing.roles = mergedRoles;
      updated = true;
    }
  }
  return updated;
}

/**
 * @param {string[]} changes - Repair changelog lines
 * @param {boolean} rbacContentChanged - Whether rbac JSON/YAML payload changed
 */
function _appendMigrateSystemRbacNotes(changes, rbacContentChanged) {
  if (rbacContentChanged) {
    changes.push('Merged roles/permissions from external system file into rbac file');
  }
  changes.push('Removed roles and permissions from external system file (canonical copy in rbac file)');
}

/**
 * When an rbac file already exists, moves roles/permissions out of the external system JSON into that file.
 * (Initial create-from-system is handled by createRbacFromSystemIfNeeded in repair.js.)
 *
 * @param {string} appPath - Integration directory
 * @param {string} systemFilePath - Path to *-system.json (or yaml)
 * @param {Object} systemParsed - Parsed system (mutated: roles/permissions removed when not dryRun)
 * @param {{ dryRun: boolean, changes: string[] }} options
 * @returns {boolean} True if system had RBAC fields to relocate or rbac was merged
 */
function migrateSystemRbacIntoRbacFile(appPath, systemFilePath, systemParsed, options) {
  const { dryRun, changes } = options;
  const extracted = extractModule.extractRbacFromSystem(systemParsed);
  if (!extracted) return false;

  const rbacPath = appConfigResolver.resolveRbacPath(appPath);
  if (!rbacPath) {
    return false;
  }

  const loaded = loadConfigFile(rbacPath);
  /** Clone so merges never mutate a shared mock / cached object returned by tests or loaders. */
  const rbac = {
    roles: Array.isArray(loaded.roles)
      ? loaded.roles.map(r => ({
        name: r.name,
        value: r.value,
        description: r.description,
        groups: Array.isArray(r.groups) ? [...r.groups] : []
      }))
      : [],
    permissions: Array.isArray(loaded.permissions)
      ? loaded.permissions.map(p => ({
        name: p.name,
        description: p.description,
        roles: Array.isArray(p.roles) ? [...p.roles] : []
      }))
      : []
  };

  const rolesMerged = _mergeRoleObjectsInto(rbac.roles, extracted.roles);
  const permsMerged = _mergePermissionObjectsInto(rbac.permissions, extracted.permissions);
  const rbacContentChanged = rolesMerged || permsMerged;

  _appendMigrateSystemRbacNotes(changes, rbacContentChanged);

  if (!dryRun) {
    if (rbacContentChanged) {
      writeConfigFile(rbacPath, rbac);
    }
    delete systemParsed.roles;
    delete systemParsed.permissions;
    writeConfigFile(systemFilePath, systemParsed);
  }
  return true;
}

module.exports = {
  migrateSystemRbacIntoRbacFile
};
