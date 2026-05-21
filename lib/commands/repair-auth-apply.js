/**
 * Repair --auth: canonical authentication blocks and bearerKey preset.
 *
 * bearerKey is a repair-only alias: persisted method remains apikey (schema) with
 * Authorization + Bearer header variables (HubSpot private-app style).
 *
 * @fileoverview Repair authentication method application
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { buildAuthenticationFromMethod } = require('../external-system/generator');

/** Repair CLI --auth values (bearerKey is not a schema method; maps to apikey). */
const ALLOWED_REPAIR_AUTH = [
  'oauth2',
  'aad',
  'apikey',
  'bearerkey',
  'basic',
  'queryparam',
  'oidc',
  'hmac',
  'none'
];

const PRESERVED_VARIABLE_KEYS = ['baseUrl', 'testEndpoint'];

/**
 * @param {string} authOption - Raw --auth value
 * @returns {string} Normalized lowercase auth option
 */
function normalizeRepairAuthOption(authOption) {
  return String(authOption || '').trim().toLowerCase();
}

/**
 * @param {string} authOption - Normalized --auth value
 * @returns {boolean}
 */
function isAllowedRepairAuth(authOption) {
  return ALLOWED_REPAIR_AUTH.includes(normalizeRepairAuthOption(authOption));
}

/**
 * Builds authentication block for repair --auth.
 * @param {string} systemKey - System key
 * @param {string} authOption - Normalized repair auth (e.g. bearerkey, apikey)
 * @returns {{ method: string, variables: Object, security: Object }}
 */
function buildAuthenticationForRepair(systemKey, authOption) {
  const normalized = normalizeRepairAuthOption(authOption);
  if (normalized === 'bearerkey') {
    const base = buildAuthenticationFromMethod(systemKey, 'apikey');
    return {
      method: 'apikey',
      variables: {
        ...base.variables,
        headerName: 'Authorization',
        prefix: 'Bearer'
      },
      security: base.security
    };
  }
  const schemaMethod = normalized === 'queryparam' ? 'queryParam' : normalized;
  return buildAuthenticationFromMethod(systemKey, schemaMethod);
}

/**
 * Merges preserved connectivity fields from existing auth into template variables.
 * @param {Object} mergedVariables - Target variables object (mutated)
 * @param {Object} existingVars - Prior authentication.variables
 */
function mergePreservedAuthVariables(mergedVariables, existingVars) {
  if (!existingVars || typeof existingVars !== 'object') return;
  for (const key of PRESERVED_VARIABLE_KEYS) {
    if (existingVars[key] !== undefined && existingVars[key] !== null) {
      mergedVariables[key] = existingVars[key];
    }
  }
}

/**
 * Human-readable label for repair change log.
 * @param {string} authOption - Normalized repair auth
 * @returns {string}
 */
function repairAuthChangeLabel(authOption) {
  const normalized = normalizeRepairAuthOption(authOption);
  if (normalized === 'bearerkey') {
    return 'bearerKey (apikey + Authorization Bearer)';
  }
  return normalized;
}

const MISSING_TEST_ENDPOINT_WARNING =
  'authentication.variables.testEndpoint is missing for apikey auth — add a GET URL for credential/E2E tests (e.g. /crm/v3/objects/contacts?limit=1, or a path resolved against baseUrl).';

/**
 * Warn when apikey auth (including bearerKey preset) has no testEndpoint.
 * @param {Object} authentication - authentication block on system file
 * @param {string[]} warnings - Mutable warnings list
 */
function appendTestEndpointWarningIfMissing(authentication, warnings) {
  const method = String(authentication?.method || '').toLowerCase();
  if (method !== 'apikey') return;
  const testEndpoint = String(authentication?.variables?.testEndpoint || '').trim();
  if (testEndpoint) return;
  if (warnings.includes(MISSING_TEST_ENDPOINT_WARNING)) return;
  warnings.push(MISSING_TEST_ENDPOINT_WARNING);
}

/**
 * Audit system authentication after repair (with or without --auth).
 * @param {Object} systemParsed - Parsed system config
 * @param {string[]} warnings - Mutable warnings list
 */
function auditRepairAuthenticationWarnings(systemParsed, warnings) {
  const authentication = systemParsed?.authentication || systemParsed?.auth;
  if (!authentication || typeof authentication !== 'object') return;
  appendTestEndpointWarningIfMissing(authentication, warnings);
}

module.exports = {
  ALLOWED_REPAIR_AUTH,
  MISSING_TEST_ENDPOINT_WARNING,
  normalizeRepairAuthOption,
  isAllowedRepairAuth,
  buildAuthenticationForRepair,
  mergePreservedAuthVariables,
  repairAuthChangeLabel,
  appendTestEndpointWarningIfMissing,
  auditRepairAuthenticationWarnings
};
