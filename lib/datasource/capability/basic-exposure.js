/**
 * Build a minimal exposed.profiles row from metadataSchema (primitives + required fields).
 *
 * @fileoverview Minimal exposed.profiles row from metadataSchema (used by applyCapabilityCopy when basicExposure)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const PRIMITIVE = new Set(['string', 'number', 'integer', 'boolean']);

/**
 * @param {object} prop - JSON Schema property
 * @returns {boolean}
 */
function isPrimitiveSchemaProperty(prop) {
  if (!prop || typeof prop !== 'object') {
    return false;
  }
  const t = prop.type;
  if (typeof t === 'string') {
    return PRIMITIVE.has(t);
  }
  if (Array.isArray(t)) {
    return t.some((x) => PRIMITIVE.has(x));
  }
  return false;
}

/**
 * Attribute names for a minimal array-style profile: required primitives + all primitive properties.
 *
 * @param {object} parsed - Datasource JSON
 * @returns {string[]} Sorted unique attribute names
 */
function listBasicExposureAttributes(parsed) {
  const ms = parsed.metadataSchema;
  const properties = ms && typeof ms === 'object' ? ms.properties : null;
  if (!properties || typeof properties !== 'object') {
    return [];
  }
  const required = Array.isArray(ms.required) ? ms.required : [];
  const names = new Set();
  for (const key of required) {
    if (properties[key] && isPrimitiveSchemaProperty(properties[key])) {
      names.add(key);
    }
  }
  for (const [key, prop] of Object.entries(properties)) {
    if (isPrimitiveSchemaProperty(prop)) {
      names.add(key);
    }
  }
  return [...names].sort();
}

/**
 * @param {object} parsed - Datasource JSON
 * @returns {string[]}
 * @throws {Error} When nothing can be derived
 */
function buildBasicExposureProfileArray(parsed) {
  const attrs = listBasicExposureAttributes(parsed);
  if (attrs.length === 0) {
    throw new Error(
      'Cannot build basic exposure: metadataSchema.properties has no primitive fields (or missing metadataSchema). ' +
        'Add primitive fields to metadataSchema, copy an existing exposed.profiles.<from> via capability copy, or choose another target key.'
    );
  }
  return attrs;
}

module.exports = {
  buildBasicExposureProfileArray,
  listBasicExposureAttributes,
  isPrimitiveSchemaProperty
};
