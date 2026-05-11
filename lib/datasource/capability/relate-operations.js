/**
 * Metadata-only foreign key updates for datasource JSON (plan 132 Phase 4).
 *
 * @fileoverview capability relate — foreignKeys[] (+ optional metadataSchema property)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { jsonPointerPath } = require('./json-pointer');

/**
 * @param {unknown} o
 * @returns {unknown}
 */
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

function _asObject(x) {
  return x && typeof x === 'object' ? x : null;
}

function _uniqStrings(list) {
  const out = [];
  const seen = new Set();
  for (const x of list || []) {
    const s = String(x || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function _getTargetMetaProps(targetDoc) {
  const props = targetDoc?.metadataSchema?.properties;
  return props && typeof props === 'object' ? props : null;
}

function _buildRelationMetadataSchema({ relationName, targetDoc, resolvedTargetFields }) {
  // Fallback to a minimal stub when we cannot derive target metadata.
  const targetProps = _getTargetMetaProps(targetDoc);
  if (!targetProps) {
    return {
      type: 'object',
      nullable: true,
      description: `Resolved relation via FK "${relationName}"`
    };
  }

  const include = _uniqStrings([
    ...(Array.isArray(resolvedTargetFields) ? resolvedTargetFields : []),
    ...(Array.isArray(targetDoc?.primaryKey) ? targetDoc.primaryKey : []),
    ...(Array.isArray(targetDoc?.labelKey) ? targetDoc.labelKey : [])
  ]);

  /** @type {Record<string, any>} */
  const properties = {};
  for (const f of include) {
    const node = targetProps[f];
    if (_asObject(node)) {
      properties[f] = deepClone(node);
    }
  }

  const requiredFromTarget = Array.isArray(targetDoc?.metadataSchema?.required) ? targetDoc.metadataSchema.required : [];
  const required = requiredFromTarget.filter((x) => include.includes(String(x)));

  const out = {
    type: 'object',
    nullable: true,
    description: `Resolved relation via FK "${relationName}"`,
    properties
  };
  if (required.length > 0) {
    out.required = required;
  }
  return out;
}

/**
 * FK `name` must match schema: ^[a-z][a-zA-Z0-9]*$
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeRelationName(raw) {
  const s = String(raw || '').trim();
  if (!s) {
    throw new Error('--relation-name is required');
  }
  if (!/^[a-z][a-zA-Z0-9]*$/.test(s)) {
    throw new Error(
      `--relation-name "${s}" must match ^[a-z][a-zA-Z0-9]*$ (camelCase)`
    );
  }
  return s;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeTargetDatasource(raw) {
  const s = String(raw || '').trim();
  if (!s) {
    throw new Error('--to <targetDatasource> is required');
  }
  if (!/^[a-z0-9-]+$/.test(s)) {
    throw new Error(
      `--to "${s}" must match targetDatasource pattern (lowercase letters, digits, hyphens)`
    );
  }
  return s;
}

/**
 * @param {object} d - Mutated doc clone
 * @param {object} fkRow
 * @param {string} relationName
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {boolean} replaced existing row
 */
function upsertForeignKeyRow(d, fkRow, relationName, patchOperations, updatedSections) {
  const idx = d.foreignKeys.findIndex((fk) => fk && fk.name === relationName);
  if (idx >= 0) {
    d.foreignKeys[idx] = fkRow;
    patchOperations.push({
      op: 'replace',
      path: `/foreignKeys/${idx}`,
      value: fkRow
    });
    updatedSections.push(`foreignKeys.${relationName} → ${fkRow.targetDatasource}`);
    return true;
  }
  d.foreignKeys.push(fkRow);
  patchOperations.push({
    op: 'add',
    path: '/foreignKeys/-',
    value: fkRow
  });
  updatedSections.push(`foreignKeys.${relationName} → ${fkRow.targetDatasource}`);
  return false;
}

function _buildDefaultFkDescription({ fields, targetDatasource, resolvedTargetFields }) {
  const left = Array.isArray(fields) ? fields.join(',') : String(fields || '');
  const tf = Array.isArray(resolvedTargetFields) && resolvedTargetFields.length > 0 ? resolvedTargetFields : null;
  const right = tf ? `${targetDatasource}.${tf.join(',')}` : targetDatasource;
  return `Foreign key join: ${left} → ${right}`;
}

/**
 * @param {object} d
 * @param {string} name
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {void}
 */
function addMetadataPropertyStub(d, name, patchOperations, updatedSections, options = {}) {
  if (!d.metadataSchema) {
    d.metadataSchema = { type: 'object', properties: {} };
  }
  if (!d.metadataSchema.properties) {
    d.metadataSchema.properties = {};
  }
  const exists = Boolean(d.metadataSchema.properties[name]);

  const metaBlock = _buildRelationMetadataSchema({
    relationName: name,
    targetDoc: options.targetDoc || null,
    resolvedTargetFields: options.resolvedTargetFields || null
  });

  if (exists) {
    // On overwrite, keep any existing description to avoid wiping user-authored docs.
    const existingDesc = d.metadataSchema.properties[name]?.description;
    if (existingDesc) {
      metaBlock.description = existingDesc;
    }
    d.metadataSchema.properties[name] = metaBlock;
    patchOperations.push({
      op: 'replace',
      path: jsonPointerPath('metadataSchema', 'properties', name),
      value: metaBlock
    });
    updatedSections.push(`metadataSchema.properties.${name}`);
    return;
  }

  d.metadataSchema.properties[name] = metaBlock;
  patchOperations.push({
    op: 'add',
    path: jsonPointerPath('metadataSchema', 'properties', name),
    value: metaBlock
  });
  updatedSections.push(`metadataSchema.properties.${name}`);
}

/**
 * @param {object} opts
 * @returns {{ fields: string[], targetFields: string[] | undefined }}
 */
function parseRelateFields(opts) {
  const fields = Array.isArray(opts.fields)
    ? opts.fields.map((f) => String(f).trim()).filter(Boolean)
    : [];
  if (fields.length === 0) {
    throw new Error('Provide at least one --field <name>');
  }
  const targetFields =
    Array.isArray(opts.targetFields) && opts.targetFields.length > 0
      ? opts.targetFields.map((f) => String(f).trim()).filter(Boolean)
      : undefined;
  return { fields, targetFields };
}

/**
 * @param {object} d - mutated clone
 * @param {string} name
 * @param {boolean} overwrite
 * @returns {boolean} whether an existing row was found
 */
function assertOverwriteAllowedAndGetExisting(d, name, overwrite) {
  const idx0 = d.foreignKeys.findIndex((fk) => fk && fk.name === name);
  if (idx0 >= 0 && !overwrite) {
    throw new Error(
      `foreignKeys[].name "${name}" already exists; pass --overwrite to replace`
    );
  }
  return idx0 >= 0;
}

/**
 * @param {string} name
 * @param {string[]} fields
 * @param {string} targetDatasource
 * @param {string[] | undefined} targetFields
 * @param {object} [options]
 * @param {object|null} [options.existingRow]
 * @param {boolean|undefined} [options.required]
 * @param {string|undefined} [options.description]
 * @param {string[]|undefined|null} [options.resolvedTargetFields]
 * @returns {object}
 */
function buildForeignKeyRow(name, fields, targetDatasource, targetFields, options = {}) {
  const fkRow = { name, fields, targetDatasource };
  if (targetFields && targetFields.length > 0) {
    fkRow.targetFields = targetFields;
  }
  const existing = options.existingRow && typeof options.existingRow === 'object' ? options.existingRow : null;
  const required =
    options.required !== undefined && options.required !== null
      ? Boolean(options.required)
      : existing?.required;
  if (required !== undefined) {
    fkRow.required = Boolean(required);
  } else {
    // Default for new FKs: explicit optional unless user marks required.
    fkRow.required = false;
  }

  const description = typeof options.description === 'string' && options.description.trim()
    ? options.description.trim()
    : existing?.description;
  if (typeof description === 'string' && description.trim()) {
    fkRow.description = description.trim();
  } else {
    fkRow.description = _buildDefaultFkDescription({
      fields,
      targetDatasource,
      resolvedTargetFields: options.resolvedTargetFields || null
    });
  }
  return fkRow;
}

/**
 * @param {object} doc
 * @param {object} opts
 * @returns {{
 *   doc: object,
 *   patchOperations: object[],
 *   updatedSections: string[],
 *   replaced: boolean
 * }}
 */
function applyCapabilityRelate(doc, opts) {
  const name = normalizeRelationName(opts.relationName);
  const targetDatasource = normalizeTargetDatasource(opts.targetDatasource);
  const { fields, targetFields } = parseRelateFields(opts);

  const d = deepClone(doc);
  if (!Array.isArray(d.foreignKeys)) {
    d.foreignKeys = [];
  }

  const replaced = assertOverwriteAllowedAndGetExisting(d, name, Boolean(opts.overwrite));
  const existingRow = replaced ? d.foreignKeys.find((fk) => fk && fk.name === name) : null;
  const fkRow = buildForeignKeyRow(name, fields, targetDatasource, targetFields, {
    existingRow,
    required: opts.required,
    description: opts.description,
    resolvedTargetFields: opts.resolvedTargetFields
  });
  const patchOperations = [];
  const updatedSections = [];
  upsertForeignKeyRow(d, fkRow, name, patchOperations, updatedSections);

  if (opts.addMetadataProperty !== false) {
    addMetadataPropertyStub(d, name, patchOperations, updatedSections, {
      targetDoc: opts.targetDoc,
      resolvedTargetFields: opts.resolvedTargetFields
    });
  }

  return { doc: d, patchOperations, updatedSections, replaced };
}

module.exports = {
  applyCapabilityRelate,
  normalizeRelationName,
  normalizeTargetDatasource
};
