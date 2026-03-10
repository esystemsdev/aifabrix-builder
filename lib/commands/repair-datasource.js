/**
 * Datasource repair helpers: align dimensions, metadataSchema, exposed, sync, testPayload
 * with fieldMappings.attributes as source of truth.
 *
 * @fileoverview Repair datasource files for external integration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const DEFAULT_SYNC = {
  mode: 'pull',
  batchSize: 500,
  maxParallelRequests: 5
};

const MINIMAL_METADATA_SCHEMA = {
  type: 'object',
  additionalProperties: true
};

/**
 * Returns the set of attribute keys from fieldMappings.attributes.
 * @param {Object} parsed - Parsed datasource object
 * @returns {Set<string>}
 */
function getAttributeKeys(parsed) {
  const attrs = parsed?.fieldMappings?.attributes;
  if (!attrs || typeof attrs !== 'object') return new Set();
  return new Set(Object.keys(attrs));
}

/**
 * Extracts paths from attribute expressions (e.g. {{ metadata.email }}).
 * Skips record_ref: expressions.
 * - topLevelKeys: first segment of each path (e.g. "metadata" from "metadata.id").
 * - referencedSchemaPropertyNames: for paths like "metadata.xxx" or "metadata.xxx.yyy", the name "xxx"
 *   (the first property under metadata). Used to prune metadataSchema.properties so we only keep
 *   properties that are referenced; we do not compare against "metadata" or the schema would be wiped.
 *
 * @param {Object} attributes - fieldMappings.attributes object
 * @returns {{ paths: string[], topLevelKeys: Set<string>, referencedSchemaPropertyNames: Set<string> }}
 */
function parsePathsFromExpressions(attributes) {
  const paths = [];
  const topLevelKeys = new Set();
  const referencedSchemaPropertyNames = new Set();
  if (!attributes || typeof attributes !== 'object') return { paths, topLevelKeys, referencedSchemaPropertyNames };
  for (const attr of Object.values(attributes)) {
    const expr = attr?.expression;
    if (typeof expr !== 'string') continue;
    if (/^\s*record_ref:/i.test(expr.trim())) continue;
    const match = expr.match(/\{\{\s*([^}]+)\s*\}\}/);
    if (!match) continue;
    const path = match[1].trim().split('|')[0].trim();
    if (path) {
      paths.push(path);
      const segments = path.split('.');
      const first = segments[0];
      if (first) topLevelKeys.add(first);
      if (first === 'metadata' && segments.length >= 2 && segments[1]) {
        referencedSchemaPropertyNames.add(segments[1]);
      }
    }
  }
  return { paths, topLevelKeys, referencedSchemaPropertyNames };
}

/**
 * Removes dimension entries whose value is metadata.<attr> and attr is not in fieldMappings.attributes.
 * Mutates parsed.fieldMappings.dimensions.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any dimension was removed
 */
function repairDimensionsFromAttributes(parsed, changes) {
  const dims = parsed?.fieldMappings?.dimensions;
  if (!dims || typeof dims !== 'object') return false;
  const attributeKeys = getAttributeKeys(parsed);
  let updated = false;
  for (const [dimKey, value] of Object.entries(dims)) {
    if (typeof value !== 'string') continue;
    if (!value.startsWith('metadata.')) continue;
    const attr = value.slice('metadata.'.length).trim();
    if (!attr || attributeKeys.has(attr)) continue;
    delete dims[dimKey];
    changes.push(`Removed dimension '${dimKey}': ${value} not in fieldMappings.attributes`);
    updated = true;
  }
  return updated;
}

/**
 * Ensures metadataSchema exists (minimal stub if missing). If present, prunes top-level
 * properties not referenced by any attribute expression. Uses the first property name under
 * "metadata" in paths (e.g. metadata.id → "id") so we do not remove schema properties that
 * are referenced. If no metadata.xxx paths exist, we do not prune (keep all properties).
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if schema was added or pruned
 */
function repairMetadataSchemaFromAttributes(parsed, changes) {
  const { referencedSchemaPropertyNames } = parsePathsFromExpressions(parsed?.fieldMappings?.attributes ?? {});
  if (!parsed.metadataSchema || typeof parsed.metadataSchema !== 'object') {
    parsed.metadataSchema = { ...MINIMAL_METADATA_SCHEMA };
    changes.push('Added minimal metadataSchema (was missing)');
    return true;
  }
  const props = parsed.metadataSchema.properties;
  if (!props || typeof props !== 'object') return false;
  if (referencedSchemaPropertyNames.size === 0) return false;
  const toRemove = Object.keys(props).filter(k => !referencedSchemaPropertyNames.has(k));
  if (toRemove.length === 0) return false;
  toRemove.forEach(k => delete props[k]);
  changes.push(`Pruned metadataSchema.properties: removed [${toRemove.join(', ')}] (not referenced by attributes)`);
  return true;
}

/**
 * Sets exposed.attributes to the list of fieldMappings.attributes keys (sorted).
 * Only when options.expose is true; caller should gate.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if exposed was updated
 */
function repairExposeFromAttributes(parsed, changes) {
  const keys = Array.from(getAttributeKeys(parsed)).filter(Boolean).sort();
  if (keys.length === 0) return false;
  if (!parsed.exposed) parsed.exposed = {};
  const prev = parsed.exposed.attributes;
  const same = Array.isArray(prev) && prev.length === keys.length && prev.every((v, i) => v === keys[i]);
  if (same) return false;
  parsed.exposed.attributes = keys;
  changes.push(`Set exposed.attributes to [${keys.join(', ')}]`);
  return true;
}

/**
 * Adds default sync section if missing or empty.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if sync was added
 */
function repairSyncSection(parsed, changes) {
  const sync = parsed.sync;
  if (sync && typeof sync === 'object' && Object.keys(sync).length > 0) return false;
  parsed.sync = { ...DEFAULT_SYNC };
  changes.push('Added default sync section (mode: pull, batchSize: 500, maxParallelRequests: 5)');
  return true;
}

function placeholderForType(type) {
  if (type === 'number' || type === 'integer') return 0;
  if (type === 'boolean') return false;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return '';
}

function setNested(obj, pathParts, value) {
  let cur = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const p = pathParts[i];
    if (!(p in cur) || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  const last = pathParts[pathParts.length - 1];
  if (last) cur[last] = value;
}

/**
 * Builds minimal payloadTemplate and expectedResult from attribute expression paths.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if testPayload was added or updated
 */
function repairTestPayload(parsed, changes) {
  const attrs = parsed?.fieldMappings?.attributes;
  if (!attrs || typeof attrs !== 'object') return false;
  const payloadTemplate = {};
  const expectedResult = {};
  for (const [key, config] of Object.entries(attrs)) {
    const type = config?.type || 'string';
    const placeholder = placeholderForType(type);
    expectedResult[key] = placeholder;
    const match = config?.expression?.match(/\{\{\s*([^}|]+)/);
    if (match) {
      const path = match[1].trim();
      setNested(payloadTemplate, path.split('.'), placeholder);
    }
  }
  if (!parsed.testPayload) parsed.testPayload = {};
  parsed.testPayload.payloadTemplate = payloadTemplate;
  parsed.testPayload.expectedResult = expectedResult;
  changes.push('Generated testPayload.payloadTemplate and testPayload.expectedResult from attributes');
  return true;
}

/**
 * Runs all requested datasource repairs. Core: dimensions + metadataSchema. Optional: expose, sync, testPayload.
 *
 * @param {Object} parsed - Parsed datasource object (mutated)
 * @param {Object} options - { expose?: boolean, sync?: boolean, test?: boolean }
 * @param {string[]} [changes] - Optional array to append change descriptions to
 * @returns {{ updated: boolean, changes: string[] }}
 */
function repairDatasourceFile(parsed, options = {}, changes = []) {
  const out = Array.isArray(changes) ? changes : [];
  let updated = false;
  updated = repairDimensionsFromAttributes(parsed, out) || updated;
  updated = repairMetadataSchemaFromAttributes(parsed, out) || updated;
  if (options.expose) updated = repairExposeFromAttributes(parsed, out) || updated;
  if (options.sync) updated = repairSyncSection(parsed, out) || updated;
  if (options.test) updated = repairTestPayload(parsed, out) || updated;
  return { updated, changes: out };
}

module.exports = {
  getAttributeKeys,
  parsePathsFromExpressions,
  repairDimensionsFromAttributes,
  repairMetadataSchemaFromAttributes,
  repairExposeFromAttributes,
  repairSyncSection,
  repairTestPayload,
  repairDatasourceFile,
  DEFAULT_SYNC,
  MINIMAL_METADATA_SCHEMA
};
