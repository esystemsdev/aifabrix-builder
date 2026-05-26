/**
 * Schema-aware testPayload repair (payloadTemplate / expectedResult).
 *
 * @fileoverview Helpers for repair-datasource testPayload generation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * @param {string|string[]|undefined} type - JSON Schema type
 * @returns {string}
 */
function primarySchemaType(type) {
  if (Array.isArray(type)) {
    const nonNull = type.filter(t => t !== 'null');
    return nonNull[0] || 'string';
  }
  return type || 'string';
}

/**
 * @param {Object|null|undefined} schema - JSON Schema node
 * @param {string} key - Property name
 * @returns {Object|null}
 */
function getSchemaProperty(schema, key) {
  if (!schema || typeof schema !== 'object') return null;
  const props = schema.properties;
  if (props && typeof props === 'object' && Object.prototype.hasOwnProperty.call(props, key)) {
    return props[key];
  }
  if (schema.additionalProperties === true) {
    return { type: 'string' };
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    return schema.additionalProperties;
  }
  return null;
}

/**
 * @param {Object|null|undefined} rootSchema - metadataSchema root
 * @param {string[]} pathParts - Dot path under raw payload (no raw. prefix)
 * @returns {Object|null}
 */
function getSchemaNodeAtPath(rootSchema, pathParts) {
  if (!rootSchema || !pathParts.length) return rootSchema;
  let node = rootSchema;
  for (const part of pathParts) {
    if (!part) continue;
    const next = getSchemaProperty(node, part);
    if (!next) return null;
    node = next;
  }
  return node;
}

/**
 * @param {Object|null|undefined} node - JSON Schema node
 * @returns {*}
 */
function placeholderFromSchemaNode(node) {
  if (!node || typeof node !== 'object') return '';
  const type = primarySchemaType(node.type);
  if (node.format === 'date-time') return '2025-01-15T10:30:00Z';
  if (node.format === 'date') return '2025-01-15';
  if (node.format === 'uuid') return '00000000-0000-4000-8000-000000000001';
  if (type === 'boolean') return false;
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'array') return [];
  if (type === 'object') {
    if (node.properties && typeof node.properties === 'object') {
      const out = {};
      for (const [k, sub] of Object.entries(node.properties)) {
        out[k] = placeholderFromSchemaNode(sub);
      }
      return out;
    }
    return {};
  }
  return '';
}

/**
 * @param {string} type - Legacy attribute type
 * @returns {*}
 */
function placeholderForType(type) {
  if (type === 'number' || type === 'integer') return 0;
  if (type === 'boolean') return false;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return '';
}

/**
 * @param {Object} parsed - Datasource config
 * @param {string[]} pathParts - Path under raw payload
 * @param {Object} [attrConfig] - Attribute config (optional type fallback)
 * @returns {*}
 */
function resolvePlaceholderForPath(parsed, pathParts, attrConfig) {
  const node = getSchemaNodeAtPath(parsed?.metadataSchema, pathParts);
  if (node) return placeholderFromSchemaNode(node);
  return placeholderForType(attrConfig?.type || 'string');
}

/**
 * @param {Object} obj - Target object (mutated)
 * @param {string[]} pathParts - Path segments
 * @param {*} value - Value to set
 */
function setNestedValue(obj, pathParts, value) {
  const parts = pathParts.filter(Boolean);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur) || typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  const existing = cur[last];
  if (
    existing &&
    typeof existing === 'object' &&
    !Array.isArray(existing) &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    cur[last] = { ...existing, ...value };
    return;
  }
  cur[last] = value;
}

/**
 * @param {Object} parsed - Datasource config
 * @param {Array<{ path: string, config: Object }>} pathEntries - Sorted deepest-first
 * @param {Object} payloadTemplate - payloadTemplate (mutated)
 */
function enrichObjectLeavesFromNestedPaths(parsed, pathEntries, payloadTemplate) {
  const propertiesNode = getSchemaNodeAtPath(parsed?.metadataSchema, ['properties']);
  for (const { path } of pathEntries) {
    if (!path.startsWith('properties.')) continue;
    const leaf = path.slice('properties.'.length);
    if (!leaf || leaf.includes('.')) continue;
    if (!payloadTemplate.properties || typeof payloadTemplate.properties !== 'object') {
      payloadTemplate.properties = placeholderFromSchemaNode(propertiesNode);
    }
    if (payloadTemplate.properties[leaf] === undefined || payloadTemplate.properties[leaf] === '') {
      const leafNode = getSchemaNodeAtPath(parsed?.metadataSchema, ['properties', leaf]);
      payloadTemplate.properties[leaf] = leafNode
        ? placeholderFromSchemaNode(leafNode)
        : 'sample';
    }
  }
}

/**
 * @param {string} expressionPath - Path from {{ ... }} token
 * @returns {string|null}
 */
function stripExpressionPathPrefix(expressionPath) {
  const path = expressionPath.trim();
  if (path.startsWith('raw.')) return path.slice(4);
  if (path.startsWith('metadata.')) return path.slice(9);
  return path;
}

/**
 * @param {Object} parsed - Datasource config
 * @param {Object} attrs - fieldMappings.attributes
 * @returns {Array<{ attrKey: string, path: string|null, config: Object, expectedOnly: *|null }>}
 */
function buildPathEntriesFromAttributes(parsed, attrs) {
  const pathEntries = [];
  for (const [attrKey, config] of Object.entries(attrs)) {
    const match = config?.expression?.match(/\{\{\s*([^}|]+)/);
    if (!match) {
      const metaNode = parsed.metadataSchema?.properties?.[attrKey];
      const expected = metaNode
        ? placeholderFromSchemaNode(metaNode)
        : placeholderForType(config?.type || 'string');
      pathEntries.push({ attrKey, path: null, config, expectedOnly: expected });
      continue;
    }
    pathEntries.push({
      attrKey,
      path: stripExpressionPathPrefix(match[1]),
      config,
      expectedOnly: null
    });
  }
  return pathEntries.sort((a, b) => {
    const depthA = a.path ? a.path.split('.').length : 0;
    const depthB = b.path ? b.path.split('.').length : 0;
    return depthB - depthA;
  });
}

/**
 * @param {Object} parsed - Datasource config
 * @param {Array} pathEntries - From buildPathEntriesFromAttributes
 * @returns {{ payloadTemplate: Object, expectedResult: Object }}
 */
function buildTemplatesFromPathEntries(parsed, pathEntries) {
  const payloadTemplate = {};
  const expectedResult = {};
  for (const entry of pathEntries) {
    const { attrKey, path, config, expectedOnly } = entry;
    const metaNode = parsed.metadataSchema?.properties?.[attrKey];
    expectedResult[attrKey] = metaNode
      ? placeholderFromSchemaNode(metaNode)
      : (expectedOnly ?? placeholderForType(config?.type || 'string'));
    if (!path) continue;
    const parts = path.split('.');
    setNestedValue(payloadTemplate, parts, resolvePlaceholderForPath(parsed, parts, config));
  }
  enrichObjectLeavesFromNestedPaths(parsed, pathEntries, payloadTemplate);
  return { payloadTemplate, expectedResult };
}

/**
 * Builds minimal payloadTemplate and expectedResult from attributes + metadataSchema.
 *
 * @param {Object} parsed - Parsed datasource (mutated)
 * @param {string[]} changes - Change log
 * @returns {boolean} True if testPayload was added or updated
 */
function repairTestPayload(parsed, changes) {
  const attrs = parsed?.fieldMappings?.attributes;
  if (!attrs || typeof attrs !== 'object') return false;

  const pathEntries = buildPathEntriesFromAttributes(parsed, attrs);
  const { payloadTemplate, expectedResult } = buildTemplatesFromPathEntries(parsed, pathEntries);

  if (!parsed.testPayload) parsed.testPayload = {};
  parsed.testPayload.payloadTemplate = payloadTemplate;
  parsed.testPayload.expectedResult = expectedResult;
  changes.push(
    'Generated testPayload.payloadTemplate and testPayload.expectedResult from attributes and metadataSchema'
  );
  return true;
}

module.exports = {
  primarySchemaType,
  getSchemaNodeAtPath,
  placeholderFromSchemaNode,
  placeholderForType,
  resolvePlaceholderForPath,
  repairTestPayload
};
