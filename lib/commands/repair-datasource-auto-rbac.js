/**
 * Auto-RBAC operation key normalization for datasource OpenAPI sections.
 *
 * @fileoverview Normalize operation keys for RBAC safety and consistency
 * @author AI Fabrix Team
 * @version 2.2.0
 */

'use strict';

function safeString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function toCamelCaseKey(opKey) {
  const s = safeString(opKey);
  if (!s) return '';
  // Split on common separators, keep only alphanumerics
  const parts = s
    .split(/[^a-zA-Z0-9]+/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
  const rest = parts
    .slice(1)
    .map((p) => (p.charAt(0).toUpperCase() + p.slice(1)));
  const out = [first, ...rest].join('');
  // Must match ^[a-z][a-zA-Z0-9]*$
  return /^[a-z][a-zA-Z0-9]*$/.test(out) ? out : '';
}

function buildRenameMap(operationMap) {
  if (!operationMap || typeof operationMap !== 'object' || Array.isArray(operationMap)) return {};
  const renameMap = {};
  for (const k of Object.keys(operationMap)) {
    // If it's already schema-valid but contains capitals, normalize to lowercase to align
    // with RBAC permission name restrictions (external-system schema forbids A-Z).
    if (/^[a-z][a-zA-Z0-9]*$/.test(k)) {
      if (/[A-Z]/.test(k)) {
        renameMap[k] = k.toLowerCase();
      }
      continue;
    }
    const camel = toCamelCaseKey(k);
    if (!camel || camel === k) continue;
    // Use lowercase key to keep RBAC permission names schema-valid.
    renameMap[k] = camel.toLowerCase();
  }
  return renameMap;
}

function toKebabAliasKey(opKey) {
  const s = safeString(opKey);
  if (!s) return '';
  const withHyphens = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const cleaned = withHyphens.replace(/[^a-z0-9-]+/g, '-');
  return cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function buildAliasMapFromCanonicalOps(canonicalOps) {
  if (!canonicalOps || typeof canonicalOps !== 'object' || Array.isArray(canonicalOps)) return {};
  const aliasMap = {};
  for (const k of Object.keys(canonicalOps)) {
    // If canonical is createBasic, allow alias create-basic to map back to createBasic
    const alias = toKebabAliasKey(k);
    if (!alias || alias === k) continue;
    if (aliasMap[alias]) continue;
    aliasMap[alias] = k;
  }
  return aliasMap;
}

function renameKeysInObject(obj, renameMap) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  let updated = false;
  for (const [oldKey, newKey] of Object.entries(renameMap)) {
    if (!oldKey || !newKey || oldKey === newKey) continue;
    if (obj[oldKey] === undefined) continue;
    if (obj[newKey] !== undefined) continue; // avoid collisions
    obj[newKey] = obj[oldKey];
    delete obj[oldKey];
    updated = true;
  }
  return updated;
}

function mergeAndDeleteAliasKeys(obj, renameMap) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  let updated = false;
  for (const [oldKey, newKey] of Object.entries(renameMap)) {
    if (!oldKey || !newKey || oldKey === newKey) continue;
    if (obj[oldKey] === undefined) continue;
    if (obj[newKey] === undefined) continue;

    const oldVal = obj[oldKey];
    const newVal = obj[newKey];
    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      const merged = [...new Set([...newVal, ...oldVal])];
      obj[newKey] = merged;
    }
    delete obj[oldKey];
    updated = true;
  }
  return updated;
}

function renameScenarioOperations(parsed, renameMap) {
  const scenarios = parsed?.testPayload?.scenarios;
  if (!Array.isArray(scenarios)) return false;
  let updated = false;
  for (const sc of scenarios) {
    const op = safeString(sc?.operation);
    if (!op) continue;
    const newOp = renameMap[op];
    if (!newOp) continue;
    sc.operation = newOp;
    updated = true;
  }
  return updated;
}

/**
 * When OpenAPI autoRbac is enabled, ensure operation keys are schema-valid and consistent across:
 * - openapi.operations
 * - execution.cip.operations
 * - testPayload.scenarios[].operation
 */
function normalizeAutoRbacOperationKeys(parsed, changes) {
  const openapi = parsed?.openapi;
  if (!openapi || typeof openapi !== 'object') return false;
  if (openapi.autoRbac !== true) return false;

  const renameMap = {
    ...buildRenameMap(openapi.operations),
    ...buildAliasMapFromCanonicalOps(openapi.operations)
  };
  const keysToRename = Object.keys(renameMap);
  if (keysToRename.length === 0) return false;

  const cipOps = parsed?.execution?.cip?.operations;
  let updated = false;
  updated = renameKeysInObject(openapi.operations, renameMap) || updated;
  updated = renameKeysInObject(cipOps, renameMap) || updated;
  updated = renameScenarioOperations(parsed, renameMap) || updated;

  const wsAllowed = parsed?.fieldMappings?.writeSurface?.allowed;
  updated = renameKeysInObject(wsAllowed, renameMap) || updated;
  // If both alias + canonical exist, merge and drop alias (schema requires canonical camelCase keys).
  updated = mergeAndDeleteAliasKeys(wsAllowed, renameMap) || updated;

  if (updated && Array.isArray(changes)) {
    const pairs = keysToRename.map((k) => `${k}→${renameMap[k]}`).join(', ');
    changes.push(
      `Normalized autoRbac operation keys (permission names are lowercase per schema; kebab aliases fold into canonical keys): ${pairs}`
    );
  }

  return updated;
}

module.exports = {
  normalizeAutoRbacOperationKeys,
  toCamelCaseKey
};

