/**
 * Datasource Validation
 *
 * Validates external datasource JSON files against schema.
 *
 * @fileoverview Datasource validation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const pathsUtil = require('../utils/paths');
const { loadExternalDataSourceSchema } = require('../utils/schema-loader');
const { formatValidationErrors } = require('../utils/error-formatter');
const { validateFieldReferences } = require('./field-reference-validator');
const { validateAbac } = require('./abac-validator');
const { buildDatasourceValidateSummary } = require('./datasource-validate-summary');

const EXCLUDE_JSON_NAMES = new Set(['application.json', 'rbac.json', 'package.json', 'package-lock.json']);

/**
 * Resolve identifier to an existing file path, or null.
 * If `fs.statSync` is unavailable (partial Jest mocks), `existsSync` alone implies a file.
 * @param {string} identifier
 * @returns {string|null} Absolute path
 */
function tryResolveAsExistingFile(identifier) {
  const candidates = [...new Set([identifier, path.resolve(identifier)])];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      try {
        const st = fs.statSync(p);
        if (st && typeof st.isFile === 'function' && st.isFile()) {
          return path.resolve(p);
        }
      } catch {
        return path.resolve(p);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Pick integration app folder for a datasource `key` (longest matching prefix wins).
 * @param {string} datasourceKey
 * @param {string[]} appNames
 * @returns {string|null}
 */
function pickIntegrationAppForDatasourceKey(datasourceKey, appNames) {
  const matches = appNames.filter((app) => datasourceKey === app || datasourceKey.startsWith(`${app}-`));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.length - a.length);
  return matches[0];
}

/**
 * @param {string} fileName
 * @returns {boolean}
 */
function shouldScanJsonDatasourceCandidate(fileName) {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.json')) return false;
  if (EXCLUDE_JSON_NAMES.has(fileName)) return false;
  if (lower.endsWith('-deploy.json') || lower.endsWith('-system.json')) return false;
  return true;
}

/**
 * @param {string} fileName
 * @returns {boolean}
 */
function isDatasourceNamedJson(fileName) {
  return fileName.toLowerCase().includes('datasource');
}

/**
 * @param {string} dir
 * @param {string[]} scanOrder
 * @param {string} datasourceKey
 * @returns {string[]}
 */
function collectJsonPathsMatchingDatasourceKey(dir, scanOrder, datasourceKey) {
  const hits = [];
  for (const name of scanOrder) {
    const full = path.join(dir, name);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      continue;
    }
    if (parsed && typeof parsed === 'object' && parsed.key === datasourceKey) {
      hits.push(full);
    }
  }
  return hits;
}

/**
 * Find integration JSON whose parsed `key` equals datasourceKey.
 * @param {string} datasourceKey
 * @returns {string} Absolute file path
 * @throws {Error}
 */
function resolvePathFromIntegrationDatasourceKey(datasourceKey) {
  const appNames = pathsUtil.listIntegrationAppNames();
  const appName = pickIntegrationAppForDatasourceKey(datasourceKey, appNames);
  if (!appName) {
    throw new Error(
      `No integration/<app>/ folder matches datasource key "${datasourceKey}". ` +
        'Pass a path to the JSON file, or use a key whose prefix matches an app under integration/ ' +
        '(e.g. app test-e2e-hubspot for key test-e2e-hubspot-users).'
    );
  }
  const dir = pathsUtil.getIntegrationPath(appName);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Integration folder not found: ${dir}`);
  }
  const entries = fs.readdirSync(dir);
  const jsonFiles = entries.filter(shouldScanJsonDatasourceCandidate);
  const prefer = jsonFiles.filter(isDatasourceNamedJson);
  const scanOrder = [...prefer, ...jsonFiles.filter((f) => !prefer.includes(f))];
  const hits = collectJsonPathsMatchingDatasourceKey(dir, scanOrder, datasourceKey);
  if (hits.length === 0) {
    throw new Error(
      `No datasource JSON with key "${datasourceKey}" under integration/${appName}/. ` +
        `Checked: ${scanOrder.length ? scanOrder.join(', ') : '(no JSON candidates)'}`
    );
  }
  if (hits.length > 1) {
    throw new Error(`Ambiguous: multiple files declare key "${datasourceKey}": ${hits.join(', ')}`);
  }
  return hits[0];
}

/**
 * @param {string} identifier - File path or datasource `key`
 * @returns {string} Absolute path to JSON file
 * @throws {Error}
 */
function resolveValidateInputPath(identifier) {
  const trimmed = String(identifier || '').trim();
  if (!trimmed) {
    throw new Error('File path is required and must be a string');
  }
  const asFile = tryResolveAsExistingFile(trimmed);
  if (asFile) return asFile;
  if (trimmed.toLowerCase().endsWith('.json')) {
    throw new Error(`File not found: ${trimmed}`);
  }
  return resolvePathFromIntegrationDatasourceKey(trimmed);
}

/**
 * Validates a datasource file against external-datasource schema
 *
 * @async
 * @function validateDatasourceFile
 * @param {string} filePathOrKey - Path to the datasource JSON file, or datasource `key` resolved under integration/<app>/
 * @returns {Promise<Object>} Validation result: `valid`, `errors`, `warnings`, `resolvedPath`, and `summary`
 *   (from `buildDatasourceValidateSummary` when JSON parses; `null` on JSON syntax errors).
 * @throws {Error} If file cannot be read or parsed
 *
 * @example
 * const result = await validateDatasourceFile('./hubspot-deal.json');
 * // Returns: { valid: true, errors: [], warnings: [], resolvedPath: '...' }
 */
async function validateDatasourceFile(filePathOrKey) {
  if (!filePathOrKey || typeof filePathOrKey !== 'string') {
    throw new Error('File path is required and must be a string');
  }

  const filePath = resolveValidateInputPath(filePathOrKey.trim());

  const content = fs.readFileSync(filePath, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON syntax: ${error.message}`],
      warnings: [],
      resolvedPath: filePath,
      summary: null
    };
  }

  const summary = buildDatasourceValidateSummary(parsed);

  const validate = loadExternalDataSourceSchema();
  const schemaValid = validate(parsed);

  if (!schemaValid) {
    return {
      valid: false,
      errors: formatValidationErrors(validate.errors, { rootData: parsed, dedupe: true }),
      warnings: [],
      resolvedPath: filePath,
      summary
    };
  }

  const fieldRefErrors = validateFieldReferences(parsed);
  const abacErrors = validateAbac(parsed);
  const postSchemaErrors = [...fieldRefErrors, ...abacErrors];
  if (postSchemaErrors.length > 0) {
    return {
      valid: false,
      errors: postSchemaErrors,
      warnings: [],
      resolvedPath: filePath,
      summary
    };
  }

  return {
    valid: true,
    errors: [],
    warnings: [],
    resolvedPath: filePath,
    summary
  };
}

/**
 * Validates parsed datasource JSON (same rules as {@link validateDatasourceFile}, without reading a file).
 *
 * @param {Object} parsed - Parsed datasource object
 * @returns {{ valid: boolean, errors: string[], warnings: string[], summary: Object|null }}
 */
function validateDatasourceParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      errors: ['Datasource JSON must be an object'],
      warnings: [],
      summary: null
    };
  }

  const summary = buildDatasourceValidateSummary(parsed);

  const validate = loadExternalDataSourceSchema();
  const schemaValid = validate(parsed);

  if (!schemaValid) {
    return {
      valid: false,
      errors: formatValidationErrors(validate.errors, { rootData: parsed, dedupe: true }),
      warnings: [],
      summary
    };
  }

  const fieldRefErrors = validateFieldReferences(parsed);
  const abacErrors = validateAbac(parsed);
  const postSchemaErrors = [...fieldRefErrors, ...abacErrors];
  if (postSchemaErrors.length > 0) {
    return {
      valid: false,
      errors: postSchemaErrors,
      warnings: [],
      summary
    };
  }

  return {
    valid: true,
    errors: [],
    warnings: [],
    summary
  };
}

module.exports = {
  validateDatasourceFile,
  validateDatasourceParsed,
  resolveValidateInputPath,
  resolvePathFromIntegrationDatasourceKey
};

