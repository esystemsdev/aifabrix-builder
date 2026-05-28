/**
 * @fileoverview Resolve CIP standard operation order for CLI display from the
 * same source as `external-datasource.schema.json` ($defs.cipDefinition.properties.operations.properties).
 * Falls back to `lib/schema/cip-capacity-display.fallback.json` when the schema file is unavailable.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { existsSync, readFileSync } = require('../internal/fs-real-sync');

/**
 * @param {object|null} schema - Parsed external-datasource.schema.json
 * @returns {string[]|null}
 */
function extractStandardOperationOrderFromSchema(schema) {
  const props =
    schema &&
    schema.$defs &&
    schema.$defs.cipDefinition &&
    schema.$defs.cipDefinition.properties &&
    schema.$defs.cipDefinition.properties.operations &&
    schema.$defs.cipDefinition.properties.operations.properties;
  if (!props || typeof props !== 'object') return null;
  return Object.keys(props);
}

/**
 * @param {string} p
 * @returns {object|null}
 */
function tryReadJsonFile(p) {
  try {
    if (!p || !existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve path to dataplane external-datasource.schema.json (monorepo / env).
 * Set `AIFABRIX_EXTERNAL_DATASOURCE_SCHEMA` to override.
 * @returns {string|null}
 */
function resolveExternalDatasourceSchemaPath() {
  if (process.env.AIFABRIX_EXTERNAL_DATASOURCE_SCHEMA) {
    const envPath = String(process.env.AIFABRIX_EXTERNAL_DATASOURCE_SCHEMA).trim();
    if (envPath && existsSync(envPath)) return envPath;
  }
  const candidates = [
    path.join(__dirname, '../schema/external-datasource.schema.json'),
    path.join(process.cwd(), 'app/schemas/json/external-datasource.schema.json'),
    path.join(process.cwd(), 'aifabrix-dataplane/app/schemas/json/external-datasource.schema.json'),
    path.join(process.cwd(), '..', 'aifabrix-dataplane', 'app/schemas/json/external-datasource.schema.json'),
    path.join(__dirname, '../../../aifabrix-dataplane/app/schemas/json/external-datasource.schema.json')
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

const FALLBACK_PATH = path.join(__dirname, '../schema/cip-capacity-display.fallback.json');

/**
 * When schema/fallback JSON cannot be read (missing file, parse error, or Jest fs mocks in a shared worker).
 * Must stay aligned with `cip-capacity-display.fallback.json` and dataplane `cipDefinition.operations`.
 */
const HARDCODED_STANDARD_OPERATION_ORDER = ['list', 'get', 'create', 'update', 'delete'];
const HARDCODED_DISPLAY_ALIASES = { create: 'insert (create)' };

/** @type {{ standardOrder: string[], aliases: Record<string, string> }|null} */
let _cache = null;

/**
 * @returns {{ standardOperationOrder: string[], displayAliases: Record<string, string> }}
 */
function readFallbackDisplayConfig() {
  const fromFile = tryReadJsonFile(FALLBACK_PATH);
  const order =
    fromFile && Array.isArray(fromFile.standardOperationOrder) && fromFile.standardOperationOrder.length
      ? fromFile.standardOperationOrder
      : HARDCODED_STANDARD_OPERATION_ORDER;
  const aliases =
    fromFile && fromFile.displayAliases && typeof fromFile.displayAliases === 'object'
      ? fromFile.displayAliases
      : HARDCODED_DISPLAY_ALIASES;
  return { standardOperationOrder: order, displayAliases: aliases };
}

/**
 * Prefer schema key order, then append any fallback standard ops missing from the schema
 * (guards partial/stale schema files and cross-test cache pollution in Jest).
 * @param {string[]|null} fromSchema
 * @param {string[]} fbOrder
 * @returns {string[]}
 */
function mergeStandardOperationOrders(fromSchema, fbOrder) {
  const schemaOps = Array.isArray(fromSchema)
    ? fromSchema.map(op => String(op).trim().toLowerCase()).filter(Boolean)
    : [];
  const fallbackOps = Array.isArray(fbOrder)
    ? fbOrder.map(op => String(op).trim().toLowerCase()).filter(Boolean)
    : [];
  if (!schemaOps.length) return fallbackOps;
  const seen = new Set(schemaOps);
  const merged = [...schemaOps];
  for (const op of fallbackOps) {
    if (seen.has(op)) continue;
    seen.add(op);
    merged.push(op);
  }
  return merged;
}

/**
 * @returns {{ standardOrder: string[], aliases: Record<string, string> }}
 */
function getCipCapacityDisplayConfig() {
  if (_cache) return _cache;
  const schemaPath = resolveExternalDatasourceSchemaPath();
  const schema = schemaPath ? tryReadJsonFile(schemaPath) : null;
  const fromSchema = extractStandardOperationOrderFromSchema(schema);
  const fallback = readFallbackDisplayConfig();
  const standardOrder = mergeStandardOperationOrders(
    fromSchema,
    fallback.standardOperationOrder
  );
  _cache = { standardOrder, aliases: fallback.displayAliases };
  return _cache;
}

/**
 * @param {string[]} standardOrder - from schema `cipDefinition.operations.properties` keys
 * @param {string} op
 * @returns {number}
 */
function standardOperationRank(standardOrder, op) {
  const idx = standardOrder.indexOf(op);
  if (idx >= 0) return idx;
  return 500;
}

/**
 * @param {string} capacityKey e.g. capacity:myOp#3 or capacity:update#1
 * @returns {{ op: string, index: number }|null}
 */
function parseCapacityDetailKey(capacityKey) {
  const s = String(capacityKey);
  const m = s.match(/^capacity:([^#]+)#(\d+)$/i);
  if (m) {
    return { op: String(m[1]).toLowerCase(), index: parseInt(m[2], 10) };
  }
  const m2 = s.match(/^capacity:([^#]+)$/i);
  if (m2) {
    return { op: String(m2[1]).toLowerCase(), index: 0 };
  }
  return null;
}

function clearCipCapacityDisplayConfigCacheForTests() {
  _cache = null;
}

module.exports = {
  extractStandardOperationOrderFromSchema,
  mergeStandardOperationOrders,
  resolveExternalDatasourceSchemaPath,
  getCipCapacityDisplayConfig,
  standardOperationRank,
  parseCapacityDetailKey,
  clearCipCapacityDisplayConfigCacheForTests
};
