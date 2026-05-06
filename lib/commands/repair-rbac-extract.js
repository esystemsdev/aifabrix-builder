/**
 * Shared RBAC extraction from external system JSON (repair / merge).
 *
 * @fileoverview extractRbacFromSystem for repair-rbac and migrate
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

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

module.exports = { extractRbacFromSystem };
