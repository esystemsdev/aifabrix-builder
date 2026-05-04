/**
 * @fileoverview Extract display summary from parsed external-datasource JSON (offline validate).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { flattenRootDimensionsForDisplay } = require('../validation/dimension-display-helpers');

/**
 * Count JSON Schema property nodes (recursive `properties` bags).
 * @param {object|null|undefined} metadataSchema
 * @returns {number}
 */
function countMetadataSchemaProperties(metadataSchema) {
  if (!metadataSchema || typeof metadataSchema !== 'object') {
    return 0;
  }
  let n = 0;
  function walk(node, depth) {
    if (depth > 25 || !node || typeof node !== 'object') {
      return;
    }
    const props = node.properties;
    if (props && typeof props === 'object' && !Array.isArray(props)) {
      for (const key of Object.keys(props)) {
        n += 1;
        walk(props[key], depth + 1);
      }
    }
    if (Array.isArray(node.allOf)) {
      for (const sub of node.allOf) {
        walk(sub, depth + 1);
      }
    }
    if (node.items && typeof node.items === 'object') {
      walk(node.items, depth + 1);
    }
  }
  walk(metadataSchema, 0);
  return n;
}

/**
 * @param {object} fk
 * @returns {{ name: string, target: string, fields: string }}
 */
function normalizeForeignKeyRow(fk) {
  return {
    name: fk.name,
    target: fk.targetDatasource,
    fields: Array.isArray(fk.fields) ? fk.fields.join(', ') : ''
  };
}

/**
 * @param {object} parsed
 * @returns {{ dimensionKeys: string[], dimensions: Record<string, string> }}
 */
function summarizeDimensions(parsed) {
  const dimFlat = flattenRootDimensionsForDisplay(parsed.dimensions);
  const abacDims =
    parsed.abac && parsed.abac.dimensions && typeof parsed.abac.dimensions === 'object' ? parsed.abac.dimensions : {};
  const allDims = { ...dimFlat, ...abacDims };
  return { dimensionKeys: Object.keys(allDims), dimensions: allDims };
}

/**
 * @param {object|null} sync
 * @returns {string}
 */
function summarizeSyncLine(sync) {
  if (!sync || typeof sync !== 'object') {
    return 'Not configured';
  }
  const parts = [];
  if (sync.mode) {
    parts.push(String(sync.mode));
  }
  if (sync.batchSize !== undefined && sync.batchSize !== null) {
    parts.push(`batch size ${sync.batchSize}`);
  }
  if (sync.schedule) {
    parts.push(`schedule ${JSON.stringify(sync.schedule)}`);
  }
  return parts.length ? parts.join(', ') : 'Present';
}

/**
 * @param {object} parsed
 * @returns {{ openapiLine: string, hasOpenapi: boolean, capabilityKeys: string[] }}
 */
function summarizeOpenapi(parsed) {
  const openapi = parsed.openapi && typeof parsed.openapi === 'object' ? parsed.openapi : {};
  const operations = openapi.operations && typeof openapi.operations === 'object' ? openapi.operations : {};
  const capabilityKeys = Object.keys(operations);
  let openapiLine = 'Not configured';
  if (openapi.enabled === true) {
    openapiLine = openapi.autoRbac ? 'enabled, auto RBAC' : 'enabled';
  } else if (parsed.openapi && Object.prototype.hasOwnProperty.call(parsed.openapi, 'enabled')) {
    openapiLine = 'disabled';
  }
  return {
    openapiLine,
    hasOpenapi: Object.keys(openapi).length > 0,
    capabilityKeys
  };
}

/**
 * @param {object} parsed
 * @returns {string}
 */
function summarizeTestPayloadLine(parsed) {
  const tp = parsed.testPayload;
  const hasTestPayload = !!tp && typeof tp === 'object';
  if (!hasTestPayload) {
    return 'Not configured';
  }
  if (Array.isArray(tp.scenarios)) {
    return `${tp.scenarios.length} scenario(s)`;
  }
  return 'Present';
}

/**
 * @param {object} parsed
 * @returns {string[]}
 */
function summarizeExposedProfileNames(parsed) {
  if (parsed.exposed && parsed.exposed.profiles && typeof parsed.exposed.profiles === 'object') {
    return Object.keys(parsed.exposed.profiles);
  }
  return [];
}

/**
 * @param {string|undefined} v
 * @returns {string}
 */
function dash(v) {
  return v || '—';
}

/**
 * @param {object} parsed
 * @returns {object}
 */
function assembleSummary(parsed) {
  const attrs = parsed.fieldMappings && parsed.fieldMappings.attributes;
  const attrCount = attrs && typeof attrs === 'object' ? Object.keys(attrs).length : 0;
  const pk = Array.isArray(parsed.primaryKey) ? parsed.primaryKey.join(', ') : String(parsed.primaryKey || '');
  const lk = Array.isArray(parsed.labelKey) ? parsed.labelKey.join(', ') : String(parsed.labelKey || '');
  const fks = Array.isArray(parsed.foreignKeys) ? parsed.foreignKeys.map(normalizeForeignKeyRow) : [];
  const { dimensionKeys, dimensions } = summarizeDimensions(parsed);
  const oa = summarizeOpenapi(parsed);
  const sync = parsed.sync && typeof parsed.sync === 'object' ? parsed.sync : null;
  return {
    key: dash(parsed.key),
    resourceType: dash(parsed.resourceType),
    entityType: dash(parsed.entityType),
    metadataSchemaPropertyCount: countMetadataSchemaProperties(parsed.metadataSchema),
    fieldMappingAttributeCount: attrCount,
    primaryKey: pk || '—',
    labelKey: lk || '—',
    foreignKeys: fks,
    dimensionKeys,
    dimensions,
    exposedProfileNames: summarizeExposedProfileNames(parsed),
    openapiLine: oa.openapiLine,
    hasOpenapi: oa.hasOpenapi,
    capabilityKeys: oa.capabilityKeys,
    testPayloadLine: summarizeTestPayloadLine(parsed),
    hasTestPayload: !!parsed.testPayload && typeof parsed.testPayload === 'object',
    syncLine: summarizeSyncLine(sync)
  };
}

/**
 * @param {object} parsed - Parsed datasource JSON
 * @returns {object|null}
 */
function buildDatasourceValidateSummary(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  return assembleSummary(parsed);
}

module.exports = {
  buildDatasourceValidateSummary,
  countMetadataSchemaProperties
};
