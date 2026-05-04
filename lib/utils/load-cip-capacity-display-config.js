/**
 * @fileoverview Resolve CIP standard operation order for CLI display from the
 * same source as `external-datasource.schema.json` ($defs.cipDefinition.properties.operations.properties).
 * Falls back to `lib/schema/cip-capacity-display.fallback.json` when the schema file is unavailable.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
    if (!p || !fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
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
    if (envPath && fs.existsSync(envPath)) return envPath;
  }
  const candidates = [
    path.join(process.cwd(), 'app/schemas/json/external-datasource.schema.json'),
    path.join(process.cwd(), 'aifabrix-dataplane/app/schemas/json/external-datasource.schema.json'),
    path.join(process.cwd(), '..', 'aifabrix-dataplane', 'app/schemas/json/external-datasource.schema.json'),
    path.join(__dirname, '../../../aifabrix-dataplane/app/schemas/json/external-datasource.schema.json')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

const FALLBACK_PATH = path.join(__dirname, '../schema/cip-capacity-display.fallback.json');

/** @type {{ standardOrder: string[], aliases: Record<string, string> }|null} */
let _cache = null;

/**
 * @returns {{ standardOrder: string[], aliases: Record<string, string> }}
 */
function getCipCapacityDisplayConfig() {
  if (_cache) return _cache;
  const schemaPath = resolveExternalDatasourceSchemaPath();
  const schema = schemaPath ? tryReadJsonFile(schemaPath) : null;
  const fromSchema = extractStandardOperationOrderFromSchema(schema);
  const fallback = tryReadJsonFile(FALLBACK_PATH) || {};
  const fbOrder = Array.isArray(fallback.standardOperationOrder)
    ? fallback.standardOperationOrder
    : [];
  const standardOrder = fromSchema && fromSchema.length ? fromSchema : fbOrder;
  const aliases =
    fallback.displayAliases && typeof fallback.displayAliases === 'object'
      ? fallback.displayAliases
      : { create: 'insert (create)' };
  _cache = { standardOrder, aliases };
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
  resolveExternalDatasourceSchemaPath,
  getCipCapacityDisplayConfig,
  standardOperationRank,
  parseCapacityDetailKey,
  clearCipCapacityDisplayConfigCacheForTests
};
