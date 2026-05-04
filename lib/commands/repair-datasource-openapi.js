/**
 * @fileoverview Repair OpenAPI block on external datasource JSON.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

function hasNonEmptyObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;
}

/**
 * Repair `openapi` section:
 * - If operations exist, ensure `openapi.enabled=true`
 * - If enabled/operations and missing documentKey/fileId, default documentKey to datasource key (common convention)
 * - If enabled+operations and autoRbac missing, default to true (wizard/fixtures expectation)
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean} True if updated
 */
function repairOpenapiSection(parsed, changes) {
  const openapi = parsed?.openapi;
  if (!openapi || typeof openapi !== 'object') {
    return false;
  }

  const hasOps = hasNonEmptyObject(openapi.operations);
  const enabled = openapi.enabled === true;
  let updated = false;

  if (hasOps && openapi.enabled !== true) {
    openapi.enabled = true;
    changes.push('Set openapi.enabled=true (operations present)');
    updated = true;
  }

  if ((enabled || hasOps) && !openapi.documentKey && !openapi.fileId) {
    if (typeof parsed.key === 'string' && parsed.key.trim()) {
      openapi.documentKey = parsed.key.trim();
      changes.push(`Set openapi.documentKey=${openapi.documentKey}`);
      updated = true;
    }
  }

  if ((enabled || hasOps) && hasOps && openapi.autoRbac === undefined) {
    openapi.autoRbac = true;
    changes.push('Set openapi.autoRbac=true (enabled operations, default)');
    updated = true;
  }

  return updated;
}

module.exports = { repairOpenapiSection };

