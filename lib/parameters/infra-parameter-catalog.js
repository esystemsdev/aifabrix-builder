/**
 * @fileoverview Load and query infra.parameter.yaml (AJV + JSON Schema)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const nodeFsLib = require('../internal/node-fs');
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
  if (!nodeFsLib.nodeFs().existsSync(resolved)) {
    const err = new Error(`infra parameter catalog not found: ${resolved}`);
    err.code = 'ENOENT';
    throw err;
  }
  try {
    return yaml.load(nodeFsLib.nodeFs().readFileSync(resolved, 'utf8'));
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
  const schema = JSON.parse(nodeFsLib.nodeFs().readFileSync(SCHEMA_PATH, 'utf8'));
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
    if (!nodeFsLib.nodeFs().existsSync(resolved)) return null;
    const doc = yaml.load(nodeFsLib.nodeFs().readFileSync(resolved, 'utf8'));
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
    if (!nodeFsLib.nodeFs().existsSync(resolved)) return null;
    const doc = yaml.load(nodeFsLib.nodeFs().readFileSync(resolved, 'utf8'));
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
 * Read `defaults` from infra.parameter.yaml without AJV (fallback when full catalog load fails).
 * Same normalization as normalizeCatalogDefaults (adminEmail, adminPassword, userPassword only).
 *
 * @param {string} [catalogPath]
 * @returns {Record<string, string>}
 */
function readRelaxedCatalogDefaults(catalogPath = DEFAULT_CATALOG_PATH) {
  try {
    const resolved = path.resolve(catalogPath);
    if (!nodeFsLib.nodeFs().existsSync(resolved)) return {};
    const doc = yaml.load(nodeFsLib.nodeFs().readFileSync(resolved, 'utf8'));
    if (!doc || typeof doc !== 'object') return {};
    return normalizeCatalogDefaults(doc.defaults);
  } catch {
    return {};
  }
}

/**
 * List exact `kv://` keys whose catalog generator is `literal` and whose value contains `{{placeholderName}}`.
 * Used to sync the secrets store when CLI overrides a shared placeholder (ensure only backfills missing keys).
 *
 * @param {{ data?: object }} catalogApi - Result of getInfraParameterCatalog()
 * @param {string} placeholderName - e.g. adminPassword, userPassword, adminEmail
 * @returns {string[]}
 */
function listKvKeysWithLiteralPlaceholder(catalogApi, placeholderName) {
  if (!catalogApi || !placeholderName || typeof placeholderName !== 'string') return [];
  const needle = `{{${placeholderName}}}`;
  const keys = [];
  for (const entry of catalogApi.data?.parameters || []) {
    if (!entry || typeof entry.key !== 'string' || !entry.key.trim()) continue;
    const g = entry.generator;
    if (!g || g.type !== 'literal') continue;
    const v = g.value;
    if (typeof v === 'string' && v.includes(needle)) {
      keys.push(entry.key.trim());
    }
  }
  return keys;
}

const ALPHANUMERIC_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Cryptographic random string using only [a-zA-Z0-9] (no base64 punctuation).
 * @param {object} gen - generator with optional length (1–512, default 32)
 * @param {{ randomBytes: Function }} cryptoLike
 * @returns {string}
 */
function randomAlphanumericFromGenerator(gen, cryptoLike) {
  const len = Math.min(512, Math.max(1, Number(gen.length) || 32));
  const bytes = cryptoLike.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHANUMERIC_CHARSET[bytes[i] % 62];
  }
  return out;
}

/**
 * Short alphanumeric secret (default 8 chars). Same charset as randomAlphanumeric.
 * @param {object} gen - optional length (1–512, default 8)
 * @param {{ randomBytes: Function }} cryptoLike
 * @returns {string}
 */
function passwordFromGenerator(gen, cryptoLike) {
  const len = Math.min(512, Math.max(1, Number(gen.length) || 8));
  return randomAlphanumericFromGenerator({ length: len }, cryptoLike);
}

function valueForGeneratorType(gen, cryptoLike) {
  if (!gen || !gen.type) return '';
  if (gen.type === 'randomBytes32') return cryptoLike.randomBytes(32).toString('base64');
  if (gen.type === 'randomAlphanumeric') return randomAlphanumericFromGenerator(gen, cryptoLike);
  if (gen.type === 'password') return passwordFromGenerator(gen, cryptoLike);
  if (gen.type === 'emptyString' || gen.type === 'emptyAllowed') return '';
  if (gen.type === 'literal') return gen.value !== undefined && gen.value !== null ? String(gen.value) : '';
  if (gen.type === 'databaseUrl' || gen.type === 'databasePassword') return '';
  return '';
}

const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

/**
 * Replace {{name}} in a string using a plain map (catalog defaults + CLI overrides).
 * Unknown names stay as-is.
 * @param {string} str
 * @param {Record<string, string>} vars
 * @returns {string}
 */
function expandInfraCatalogPlaceholders(str, vars) {
  if (str === undefined || str === null) return '';
  const s = String(str);
  if (!s.includes('{{')) return s;
  const map = vars && typeof vars === 'object' ? vars : {};
  return s.replace(PLACEHOLDER_RE, (full, name) => {
    if (Object.prototype.hasOwnProperty.call(map, name) && map[name] !== undefined && map[name] !== null) {
      return String(map[name]);
    }
    return full;
  });
}

/**
 * Normalize catalog `defaults` block to known keys only.
 * @param {object|undefined} raw
 * @returns {Record<string, string>}
 */
function normalizeCatalogDefaults(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const k of ['adminEmail', 'adminPassword', 'userPassword']) {
    if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
      out[k] = String(raw[k]).trim();
    }
  }
  return out;
}

/**
 * Merge infra.parameter.yaml `defaults` with up-infra / caller CLI options (non-empty override wins).
 * @param {object|undefined} catalogData - Parsed catalog root (`getInfraParameterCatalog().data`)
 * @param {object} [cliOptions]
 * @param {string} [cliOptions.adminPassword]
 * @param {string} [cliOptions.adminPwd] - Alias for adminPassword
 * @param {string} [cliOptions.adminEmail]
 * @param {string} [cliOptions.userPassword]
 * @param {boolean} [cliOptions.tlsEnabled] - When true, TLS_ENABLED is "true"; otherwise "false". HTTP_ENABLED is always the opposite (for {{HTTP_ENABLED}}).
 * @returns {Record<string, string>}
 */
function mergeInfraParameterDefaultsForCli(catalogData, cliOptions = {}) {
  const base = normalizeCatalogDefaults(catalogData && catalogData.defaults);
  const o = cliOptions || {};
  const pwd = String(o.adminPassword || o.adminPwd || '').trim();
  if (pwd) base.adminPassword = pwd;
  const em = String(o.adminEmail || '').trim();
  if (em) base.adminEmail = em;
  const up = String(o.userPassword || '').trim();
  if (up) base.userPassword = up;
  base.TLS_ENABLED = o.tlsEnabled === true ? 'true' : 'false';
  base.HTTP_ENABLED = base.TLS_ENABLED === 'true' ? 'false' : 'true';
  return base;
}

/**
 * Produce value from catalog generator (no database slot resolution — use secrets-generator for DB).
 * @param {string} key - Secret key
 * @param {object} entry - Catalog entry
 * @param {{ randomBytes: Function }} cryptoLike - crypto module or stub
 * @param {Record<string, string>|undefined} placeholderVars - Merged defaults + CLI; when omitted, uses catalog defaults only
 * @returns {string}
 */
function getCatalogDataForPlaceholders() {
  try {
    return getInfraParameterCatalog().data || {};
  } catch {
    return {};
  }
}

function generateValueFromCatalogEntry(key, entry, cryptoLike = require('crypto'), placeholderVars) {
  const raw = valueForGeneratorType(entry && entry.generator, cryptoLike);
  let vars = placeholderVars;
  if (vars === undefined) {
    vars = mergeInfraParameterDefaultsForCli(getCatalogDataForPlaceholders(), {});
  }
  if (!vars || typeof vars !== 'object') vars = {};
  return expandInfraCatalogPlaceholders(raw, vars);
}

module.exports = {
  loadInfraParameterCatalog,
  getInfraParameterCatalog,
  clearInfraParameterCatalogCache,
  generateValueFromCatalogEntry,
  readRelaxedUpInfraEnsureKeyList,
  readRelaxedEmptyAllowedKeySet,
  readRelaxedCatalogDefaults,
  listKvKeysWithLiteralPlaceholder,
  standardBootstrapKeysFromDoc,
  DEFAULT_CATALOG_PATH,
  SCHEMA_PATH,
  formatAjvErrors,
  randomAlphanumericFromGenerator,
  passwordFromGenerator,
  expandInfraCatalogPlaceholders,
  mergeInfraParameterDefaultsForCli,
  normalizeCatalogDefaults
};
