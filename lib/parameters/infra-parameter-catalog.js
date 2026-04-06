/**
 * @fileoverview Load and query infra.parameter.yaml (AJV + JSON Schema)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

const DEFAULT_CATALOG_PATH = path.join(__dirname, '..', 'schema', 'infra.parameter.yaml');
const SCHEMA_PATH = path.join(__dirname, '..', 'schema', 'infra-parameter.schema.json');

let cachedCatalog = null;
let cachedPath = null;

/**
 * Format AJV errors for a single message line.
 * @param {object[]} errors - AJV errors array
 * @returns {string}
 */
function formatAjvErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return 'Validation failed';
  return errors
    .map((e) => `${e.instancePath || '/'} ${e.message}`.trim())
    .join('; ');
}

/**
 * @param {string} resolved - Absolute path to YAML
 * @returns {object}
 */
function readCatalogYamlDocument(resolved) {
  if (!fs.existsSync(resolved)) {
    const err = new Error(`infra parameter catalog not found: ${resolved}`);
    err.code = 'ENOENT';
    throw err;
  }
  try {
    return yaml.load(fs.readFileSync(resolved, 'utf8'));
  } catch (e) {
    const err = new Error(`Invalid infra parameter YAML (${resolved}): ${e.message}`);
    err.cause = e;
    throw err;
  }
}

/**
 * @param {object} doc - Parsed root
 */
function assertEachParameterHasKeyXorPattern(doc) {
  const list = doc.parameters || [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const hasKey = Boolean(entry.key && String(entry.key).length > 0);
    const hasPat = Boolean(entry.keyPattern && String(entry.keyPattern).length > 0);
    if (hasKey === hasPat) {
      throw new Error(`infra.parameter.yaml parameters[${i}]: set exactly one of key or keyPattern`);
    }
  }
}

/**
 * @param {object} doc - Parsed catalog
 */
function validateCatalogAgainstJsonSchema(doc) {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(doc)) {
    throw new Error(`infra.parameter.yaml failed schema: ${formatAjvErrors(validate.errors || [])}`);
  }
}

/**
 * @param {object} doc - Validated document
 * @returns {{ exact: Map<string, object>, patterns: { regex: RegExp, entry: object }[] }}
 */
function buildCatalogIndexes(doc) {
  /** @type {Map<string, object>} */
  const exact = new Map();
  /** @type {{ regex: RegExp, entry: object }[]} */
  const patterns = [];
  for (const entry of doc.parameters || []) {
    if (entry.key) {
      exact.set(entry.key, entry);
    } else if (entry.keyPattern) {
      try {
        patterns.push({ regex: new RegExp(entry.keyPattern), entry });
      } catch (reErr) {
        throw new Error(`Invalid keyPattern in catalog: ${entry.keyPattern}: ${reErr.message}`);
      }
    }
  }
  return { exact, patterns };
}

/**
 * @param {object} doc - Root document
 * @param {Map<string, object>} exact - Exact key map
 * @param {{ regex: RegExp, entry: object }[]} patterns - Ordered patterns
 * @returns {object} Catalog API
 */
/**
 * @param {object} doc - Parsed catalog root
 * @returns {string[]}
 */
function standardBootstrapKeysFromDoc(doc) {
  const extra = doc && doc.standardUpInfraEnsureKeys;
  if (!Array.isArray(extra)) return [];
  return extra.map((k) => String(k).trim()).filter(Boolean);
}

function createCatalogApi(doc, exact, patterns) {
  function findEntryForKey(key) {
    if (!key || typeof key !== 'string') return null;
    if (exact.has(key)) return exact.get(key);
    for (const { regex, entry } of patterns) {
      if (regex.test(key)) return entry;
    }
    return null;
  }

  function getEnsureOnKeys(hook) {
    const out = new Set();
    for (const entry of doc.parameters || []) {
      if (!entry.key || !Array.isArray(entry.ensureOn)) continue;
      if (entry.ensureOn.includes(hook)) out.add(entry.key);
    }
    return [...out];
  }

  function isKeyAllowedEmpty(key) {
    const entry = findEntryForKey(key);
    return Boolean(entry && entry.generator && entry.generator.type === 'emptyAllowed');
  }

  function keyMatchesEnsureHook(key, hook) {
    const entry = findEntryForKey(key);
    return Boolean(entry && Array.isArray(entry.ensureOn) && entry.ensureOn.includes(hook));
  }

  function getStandardUpInfraBootstrapKeys() {
    return standardBootstrapKeysFromDoc(doc);
  }

  return {
    data: doc,
    findEntryForKey,
    getEnsureOnKeys,
    getStandardUpInfraBootstrapKeys,
    isKeyAllowedEmpty,
    keyMatchesEnsureHook
  };
}

/**
 * Load and validate catalog from disk.
 * @param {string} [catalogPath] - YAML path (default bundled schema copy)
 * @returns {ReturnType<typeof createCatalogApi>}
 * @throws {Error} On missing file, invalid YAML, or schema validation failure
 */
function loadInfraParameterCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
  const resolved = path.resolve(catalogPath);
  const doc = readCatalogYamlDocument(resolved);
  validateCatalogAgainstJsonSchema(doc);
  assertEachParameterHasKeyXorPattern(doc);
  const { exact, patterns } = buildCatalogIndexes(doc);
  return createCatalogApi(doc, exact, patterns);
}

/**
 * Cached catalog (for CLI hot paths).
 * @param {string} [catalogPath]
 * @returns {ReturnType<typeof loadInfraParameterCatalog>}
 */
function getInfraParameterCatalog(catalogPath) {
  const resolved = path.resolve(catalogPath || DEFAULT_CATALOG_PATH);
  if (cachedCatalog && cachedPath === resolved) return cachedCatalog;
  cachedCatalog = loadInfraParameterCatalog(resolved);
  cachedPath = resolved;
  return cachedCatalog;
}

/**
 * Test-only: clear memoized catalog.
 */
function clearInfraParameterCatalogCache() {
  cachedCatalog = null;
  cachedPath = null;
}

/**
 * @param {object} doc - Parsed YAML root
 * @param {Set<string>} set - Target set
 */
function addRelaxedUpInfraKeysFromDoc(doc, set) {
  if (Array.isArray(doc.standardUpInfraEnsureKeys)) {
    for (const k of doc.standardUpInfraEnsureKeys) {
      if (typeof k === 'string' && k.trim()) set.add(k.trim());
    }
  }
  for (const entry of doc.parameters || []) {
    if (
      entry &&
      typeof entry.key === 'string' &&
      entry.key.trim() &&
      Array.isArray(entry.ensureOn) &&
      entry.ensureOn.includes('upInfra')
    ) {
      set.add(entry.key.trim());
    }
  }
}

/**
 * YAML-only parse (no AJV): `standardUpInfraEnsureKeys` plus exact `parameters[].key` where ensureOn includes upInfra.
 * Used when full catalog validation fails so callers can still read key names from the shipped file.
 *
 * @param {string} [catalogPath] - Path to infra.parameter.yaml
 * @returns {string[]|null} Sorted unique keys, or null if unreadable
 */
function readRelaxedUpInfraEnsureKeyList(catalogPath = DEFAULT_CATALOG_PATH) {
  try {
    const resolved = path.resolve(catalogPath);
    if (!fs.existsSync(resolved)) return null;
    const doc = yaml.load(fs.readFileSync(resolved, 'utf8'));
    if (!doc || typeof doc !== 'object') return null;
    const set = new Set();
    addRelaxedUpInfraKeysFromDoc(doc, set);
    return [...set].sort();
  } catch {
    return null;
  }
}

/**
 * YAML-only: keys whose generator type is emptyAllowed (for ensure backfill behavior).
 *
 * @param {string} [catalogPath]
 * @returns {Set<string>|null}
 */
function readRelaxedEmptyAllowedKeySet(catalogPath = DEFAULT_CATALOG_PATH) {
  try {
    const resolved = path.resolve(catalogPath);
    if (!fs.existsSync(resolved)) return null;
    const doc = yaml.load(fs.readFileSync(resolved, 'utf8'));
    if (!doc || typeof doc !== 'object') return null;
    const set = new Set();
    for (const entry of doc.parameters || []) {
      if (
        entry &&
        typeof entry.key === 'string' &&
        entry.key.trim() &&
        entry.generator &&
        entry.generator.type === 'emptyAllowed'
      ) {
        set.add(entry.key.trim());
      }
    }
    return set;
  } catch {
    return null;
  }
}

/**
 * @param {object} gen - generator block
 * @param {{ randomBytes: Function }} cryptoLike
 * @returns {string}
 */
function valueForGeneratorType(gen, cryptoLike) {
  if (!gen || !gen.type) return '';
  if (gen.type === 'randomBytes32') return cryptoLike.randomBytes(32).toString('base64');
  if (gen.type === 'emptyString' || gen.type === 'emptyAllowed') return '';
  if (gen.type === 'literal') return gen.value !== undefined && gen.value !== null ? String(gen.value) : '';
  if (gen.type === 'databaseUrl' || gen.type === 'databasePassword') return '';
  return '';
}

/**
 * Produce value from catalog generator (no database slot resolution — use secrets-generator for DB).
 * @param {string} key - Secret key
 * @param {object} entry - Catalog entry
 * @param {{ randomBytes: Function }} cryptoLike - crypto module or stub
 * @returns {string}
 */
function generateValueFromCatalogEntry(key, entry, cryptoLike = require('crypto')) {
  return valueForGeneratorType(entry && entry.generator, cryptoLike);
}

module.exports = {
  loadInfraParameterCatalog,
  getInfraParameterCatalog,
  clearInfraParameterCatalogCache,
  generateValueFromCatalogEntry,
  readRelaxedUpInfraEnsureKeyList,
  readRelaxedEmptyAllowedKeySet,
  standardBootstrapKeysFromDoc,
  DEFAULT_CATALOG_PATH,
  SCHEMA_PATH,
  formatAjvErrors
};
