/**
 * Datasource repair helpers: align dimensions, metadataSchema, exposed, sync, testPayload
 * with fieldMappings.attributes as source of truth (external-datasource schema v2.4+).
 *
 * @fileoverview Repair datasource files for external integration
 * @author AI Fabrix Team
 * @version 2.2.0
 */

'use strict';

const { repairOpenapiSection } = require('./repair-datasource-openapi');

const DEFAULT_SYNC = {
  mode: 'pull',
  batchSize: 500
};

const MINIMAL_METADATA_SCHEMA = {
  type: 'object',
  additionalProperties: true
};

/** Plan 346 / v2.4.1 closed root for testPayload */
const TEST_PAYLOAD_TOP_LEVEL_ALLOW = new Set([
  'mode',
  'primaryKey',
  'scenarios',
  'fk',
  'actors',
  'payloadTemplate',
  'expectedResult'
]);

/**
 * @param {string|undefined} entityType - entityType from datasource
 * @returns {boolean}
 */
function isNoneEntityType(entityType) {
  return entityType === 'none';
}

/**
 * @param {string|undefined} entityType - entityType from datasource
 * @returns {boolean}
 */
function isStorageEntityType(entityType) {
  return entityType === 'recordStorage' || entityType === 'documentStorage';
}

/**
 * Ensures metadataSchema.properties.externalId for recordStorage/documentStorage (schema v2.4).
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean} True if externalId was added or corrected
 */
function ensureStorageExternalIdMetadataProperty(parsed, changes) {
  if (!isStorageEntityType(parsed?.entityType)) return false;
  if (!parsed.metadataSchema || typeof parsed.metadataSchema !== 'object') return false;
  if (!parsed.metadataSchema.properties || typeof parsed.metadataSchema.properties !== 'object') {
    parsed.metadataSchema.properties = {};
  }
  const props = parsed.metadataSchema.properties;
  const ext = props.externalId;
  const ok = ext
    && typeof ext === 'object'
    && ext.type === 'string'
    && ext.index === true;
  if (ok) return false;
  props.externalId = {
    ...(typeof ext === 'object' && ext !== null ? ext : {}),
    type: 'string',
    index: true
  };
  changes.push('Ensured metadataSchema.properties.externalId (type string, index true) for storage entityType');
  return true;
}

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
 * @param {string} path - Normalized path (raw. prefix already stripped)
 * @param {string[]} paths
 * @param {Set<string>} topLevelKeys
 * @param {Set<string>} referencedSchemaPropertyNames
 */
function accumulatePathSegments(path, paths, topLevelKeys, referencedSchemaPropertyNames) {
  paths.push(path);
  const segments = path.split('.');
  const first = segments[0];
  if (first) topLevelKeys.add(first);
  if (first === 'metadata' && segments.length >= 2 && segments[1]) {
    referencedSchemaPropertyNames.add(segments[1]);
  }
}

/**
 * Extracts paths from attribute expressions (e.g. {{ metadata.email }}, {{ raw.id }}).
 * Skips record_ref: expressions.
 *
 * @param {Object} attributes - fieldMappings.attributes object
 * @returns {{ paths: string[], topLevelKeys: Set<string>, referencedSchemaPropertyNames: Set<string> }}
 */
function parsePathsFromExpressions(attributes) {
  const paths = [];
  const topLevelKeys = new Set();
  const referencedSchemaPropertyNames = new Set();
  if (!attributes || typeof attributes !== 'object') {
    return { paths, topLevelKeys, referencedSchemaPropertyNames };
  }
  for (const attr of Object.values(attributes)) {
    const expr = attr?.expression;
    if (typeof expr !== 'string') continue;
    if (/^\s*record_ref:/i.test(expr.trim())) continue;
    const match = expr.match(/\{\{\s*([^}]+)\s*\}\}/);
    if (!match) continue;
    let path = match[1].trim().split('|')[0].trim();
    if (path.startsWith('raw.')) path = path.slice(4);
    if (path) accumulatePathSegments(path, paths, topLevelKeys, referencedSchemaPropertyNames);
  }
  return { paths, topLevelKeys, referencedSchemaPropertyNames };
}

/**
 * @param {Object} binding - dimension binding
 * @param {string} dimKey - dimension key
 * @param {string[]} changes - Change log
 * @returns {boolean}
 */
function removeOperatorWithoutActor(binding, dimKey, changes) {
  if (binding.operator && !binding.actor) {
    delete binding.operator;
    changes.push(`Removed 'operator' from dimension '${dimKey}' (no actor)`);
    return true;
  }
  return false;
}

/**
 * @param {string} dimKey - dimension key
 * @param {Object} binding - dimension binding
 * @param {string[]} changes - Change log
 * @returns {boolean}
 */
function repairFkDimensionBinding(dimKey, binding, changes) {
  let updated = false;
  if (binding.field !== undefined) {
    delete binding.field;
    changes.push(`Removed invalid 'field' from FK dimension '${dimKey}'`);
    updated = true;
  }
  return removeOperatorWithoutActor(binding, dimKey, changes) || updated;
}

/**
 * @param {string} dimKey - dimension key
 * @param {Object} binding - dimension binding
 * @param {string[]} changes - Change log
 * @returns {boolean}
 */
function repairLocalDimensionBinding(dimKey, binding, changes) {
  let updated = false;
  if (binding.via !== undefined) {
    delete binding.via;
    changes.push(`Removed invalid 'via' from local dimension '${dimKey}'`);
    updated = true;
  }
  return removeOperatorWithoutActor(binding, dimKey, changes) || updated;
}

/**
 * Normalizes dimension bindings: FK vs local invariants; strip operator without actor.
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean}
 */
function repairDimensionBindingShape(parsed, changes) {
  const dims = parsed?.dimensions;
  if (!dims || typeof dims !== 'object') return false;
  let updated = false;
  for (const [dimKey, binding] of Object.entries(dims)) {
    if (!binding || typeof binding !== 'object') continue;
    const t = binding.type;
    if (t === 'fk') {
      updated = repairFkDimensionBinding(dimKey, binding, changes) || updated;
    } else if (t === 'local' || t === undefined) {
      updated = repairLocalDimensionBinding(dimKey, binding, changes) || updated;
    } else {
      updated = removeOperatorWithoutActor(binding, dimKey, changes) || updated;
    }
  }
  return updated;
}

/**
 * Removes root local dimension bindings whose field is not in fieldMappings.attributes.
 * Skips FK bindings.
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean} True if any dimension was removed
 */
function repairRootDimensionsFromAttributes(parsed, changes) {
  const dims = parsed?.dimensions;
  if (!dims || typeof dims !== 'object') return false;
  const attributeKeys = getAttributeKeys(parsed);
  let updated = false;
  for (const [dimKey, binding] of Object.entries(dims)) {
    if (!binding || typeof binding !== 'object') continue;
    if (binding.type === 'fk') continue;
    if (binding.type !== undefined && binding.type !== 'local') continue;
    const field = binding.field;
    if (typeof field !== 'string') continue;
    if (attributeKeys.has(field)) continue;
    delete dims[dimKey];
    changes.push(`Removed root dimension '${dimKey}': field '${field}' not in fieldMappings.attributes`);
    updated = true;
  }
  return updated;
}

/**
 * Adds metadataSchema property stubs for metadata.* paths referenced in attributes.
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {Set<string>} referencedSchemaPropertyNames - Property names under metadata
 * @param {string[]} changes - Change log
 * @returns {boolean}
 */
function ensureMetadataSchemaPropertyStubs(parsed, referencedSchemaPropertyNames, changes) {
  if (!referencedSchemaPropertyNames || referencedSchemaPropertyNames.size === 0) return false;
  if (!parsed.metadataSchema || typeof parsed.metadataSchema !== 'object') return false;
  if (!parsed.metadataSchema.properties || typeof parsed.metadataSchema.properties !== 'object') {
    parsed.metadataSchema.properties = {};
  }
  const props = parsed.metadataSchema.properties;
  const added = [];
  for (const name of referencedSchemaPropertyNames) {
    if (!name || props[name] !== undefined) continue;
    props[name] = { type: 'string' };
    added.push(name);
  }
  if (added.length === 0) return false;
  changes.push(`Added metadataSchema.properties stubs for [${added.join(', ')}]`);
  return true;
}

/**
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {Set<string>} referencedSchemaPropertyNames - metadata.* names from expressions
 * @param {string[]} changes - Change log
 * @returns {boolean}
 */
function pruneMetadataSchemaPropertiesByAttributeRefs(parsed, referencedSchemaPropertyNames, changes) {
  const props = parsed.metadataSchema?.properties;
  if (
    !props || typeof props !== 'object'
    || referencedSchemaPropertyNames.size === 0
  ) {
    return false;
  }
  const toRemove = Object.keys(props).filter(k => {
    if (referencedSchemaPropertyNames.has(k)) return false;
    if (isStorageEntityType(parsed.entityType) && k === 'externalId') return false;
    return true;
  });
  if (toRemove.length === 0) return false;
  toRemove.forEach(k => delete props[k]);
  changes.push(`Pruned metadataSchema.properties: removed [${toRemove.join(', ')}] (not referenced by attributes)`);
  return true;
}

/**
 * Ensures metadataSchema exists (minimal stub if missing). Prunes top-level properties not
 * referenced by metadata.* paths in expressions (after stripping raw. prefix).
 * Skipped entirely for entityType 'none'.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean} True if schema was added or pruned
 */
function repairMetadataSchemaFromAttributes(parsed, changes) {
  if (isNoneEntityType(parsed?.entityType)) {
    return false;
  }
  const { referencedSchemaPropertyNames } = parsePathsFromExpressions(parsed?.fieldMappings?.attributes ?? {});
  let updated = false;

  if (!parsed.metadataSchema || typeof parsed.metadataSchema !== 'object') {
    parsed.metadataSchema = { ...MINIMAL_METADATA_SCHEMA, properties: {} };
    changes.push('Added minimal metadataSchema (was missing)');
    ensureMetadataSchemaPropertyStubs(parsed, referencedSchemaPropertyNames, changes);
    updated = true;
  } else {
    if (pruneMetadataSchemaPropertiesByAttributeRefs(parsed, referencedSchemaPropertyNames, changes)) {
      updated = true;
    }
    if (ensureMetadataSchemaPropertyStubs(parsed, referencedSchemaPropertyNames, changes)) {
      updated = true;
    }
  }
  if (ensureStorageExternalIdMetadataProperty(parsed, changes)) {
    updated = true;
  }
  return updated;
}

/**
 * Sets exposed.schema from fieldMappings.attributes keys (metadata.<key> leaves). v2.4 canonical.
 * Removes deprecated exposed.attributes when present so output matches schema.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean} True if exposed was updated
 */
function repairExposeFromAttributes(parsed, changes) {
  const keys = Array.from(getAttributeKeys(parsed)).filter(Boolean).sort();
  if (keys.length === 0) return false;
  if (!parsed.exposed) parsed.exposed = {};
  const schema = {};
  keys.forEach(k => {
    schema[k] = `metadata.${k}`;
  });
  const prev = parsed.exposed.schema;
  const same = prev && typeof prev === 'object'
    && keys.length === Object.keys(prev).length
    && keys.every(k => prev[k] === schema[k]);
  if (same && parsed.exposed.attributes === undefined) return false;
  parsed.exposed.schema = schema;
  if (parsed.exposed.attributes !== undefined) {
    delete parsed.exposed.attributes;
  }
  changes.push(`Set exposed.schema for [${keys.join(', ')}]`);
  return true;
}

/**
 * Adds default sync section if missing or empty. Not applied for entityType 'none'.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean} True if sync was added
 */
function repairSyncSection(parsed, changes) {
  if (isNoneEntityType(parsed?.entityType)) return false;
  const sync = parsed.sync;
  if (sync && typeof sync === 'object' && Object.keys(sync).length > 0) return false;
  parsed.sync = { ...DEFAULT_SYNC };
  changes.push('Added default sync section (mode: pull, batchSize: 500)');
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
 * Removes unknown top-level keys from testPayload (v2.4.1 closed root).
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean}
 */
function sanitizeTestPayloadTopLevel(parsed, changes) {
  const tp = parsed?.testPayload;
  if (!tp || typeof tp !== 'object' || Array.isArray(tp)) return false;
  const removed = [];
  for (const key of Object.keys(tp)) {
    if (!TEST_PAYLOAD_TOP_LEVEL_ALLOW.has(key)) {
      delete tp[key];
      removed.push(key);
    }
  }
  if (removed.length === 0) return false;
  changes.push(`Removed unknown testPayload keys: [${removed.join(', ')}]`);
  return true;
}

/**
 * Builds minimal payloadTemplate and expectedResult from attribute expression paths.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
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
      let path = match[1].trim();
      if (path.startsWith('raw.')) {
        path = path.slice(4);
      }
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
 * Runs all requested datasource repairs.
 *
 * @param {Object} parsed - Parsed datasource object (mutated)
 * @param {Object} options - { expose?: boolean, sync?: boolean, test?: boolean }
 * @param {string[]} [changes] - Optional array to append change descriptions to
 * @returns {{ updated: boolean, changes: string[] }}
 */
function repairDatasourceFile(parsed, options = {}, changes = []) {
  const out = Array.isArray(changes) ? changes : [];
  let updated = false;
  const none = isNoneEntityType(parsed?.entityType);

  if (!none) {
    updated = repairDimensionBindingShape(parsed, out) || updated;
    updated = repairRootDimensionsFromAttributes(parsed, out) || updated;
    updated = repairMetadataSchemaFromAttributes(parsed, out) || updated;
  }

  updated = repairOpenapiSection(parsed, out) || updated;

  if (options.expose) {
    updated = repairExposeFromAttributes(parsed, out) || updated;
  }

  if (!none && options.sync) {
    updated = repairSyncSection(parsed, out) || updated;
  }

  if (options.test) {
    sanitizeTestPayloadTopLevel(parsed, out);
    updated = repairTestPayload(parsed, out) || updated;
    updated = sanitizeTestPayloadTopLevel(parsed, out) || updated;
  }

  return { updated, changes: out };
}

module.exports = {
  getAttributeKeys,
  parsePathsFromExpressions,
  repairDimensionBindingShape,
  repairRootDimensionsFromAttributes,
  repairMetadataSchemaFromAttributes,
  repairExposeFromAttributes,
  repairSyncSection,
  repairTestPayload,
  repairOpenapiSection,
  sanitizeTestPayloadTopLevel,
  repairDatasourceFile,
  DEFAULT_SYNC,
  MINIMAL_METADATA_SCHEMA,
  TEST_PAYLOAD_TOP_LEVEL_ALLOW,
  isNoneEntityType
};
