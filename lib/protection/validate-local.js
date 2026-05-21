/**
 * @fileoverview Local AJV validation for protection manifests (shape only).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const SCHEMA_PATH = path.join(__dirname, '..', 'schema', 'protection.schema.json');

let compiledValidator = null;

/**
 * Strip AI Fabrix schema file metadata (not part of JSON Schema validation).
 * @param {Object} raw
 * @returns {Object}
 */
function protectionSchemaForAjv(raw) {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }
  const { metadata: _meta, ...schema } = raw;
  if (schema.$schema && String(schema.$schema).includes('2020-12')) {
    delete schema.$schema;
  }
  return schema;
}

function getValidator() {
  if (compiledValidator) {
    return compiledValidator;
  }
  const schema = protectionSchemaForAjv(require(SCHEMA_PATH));
  const ajv = new Ajv({ allErrors: true, strict: false, strictSchema: false });
  addFormats(ajv);
  compiledValidator = ajv.compile(schema);
  return compiledValidator;
}

/**
 * @param {Object} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateProtectionManifestLocal(manifest) {
  const validate = getValidator();
  const valid = validate(manifest);
  if (valid) {
    return { valid: true, errors: [] };
  }
  const errors = (validate.errors || []).map((err) => {
    const at = err.instancePath || err.schemaPath || '';
    return at ? `${at}: ${err.message}` : String(err.message || 'Schema validation failed');
  });
  return { valid: false, errors };
}

module.exports = {
  validateProtectionManifestLocal,
  getValidator,
  protectionSchemaForAjv
};
