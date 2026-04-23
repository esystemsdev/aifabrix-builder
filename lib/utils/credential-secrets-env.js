/**
 * Collect KV_* env vars as secret store items and push to dataplane.
 * Reads integration .env, resolves kv:// in values, scans payload for kv:// refs,
 * and pushes plain values to POST /api/v1/credential/secret.
 *
 * @fileoverview Credential secrets push from .env and payload (Dataplane)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const { loadSecrets } = require('../core/secrets');
const { storeCredentialSecrets } = require('../api/credential.api');

const KV_PREFIX = 'KV_';
const KV_REF_PATTERN = /kv:\/\/([a-zA-Z0-9_\-/]+)/g;

/**
 * Converts systemKey to KV_* prefix (e.g. hubspot -> HUBSPOT, my-hubspot -> MY_HUBSPOT).
 * @param {string} systemKey - System key
 * @returns {string}
 */
function systemKeyToKvPrefix(systemKey) {
  if (!systemKey || typeof systemKey !== 'string') return '';
  return systemKey.replace(/-/g, '_').toUpperCase();
}

/**
 * Maps authentication security key (camelCase) to env VAR (UPPERCASE, no underscores).
 * Used for canonical KV_<APPKEY>_<VAR> names (e.g. clientId → CLIENTID).
 * @param {string} securityKey - Security key (e.g. 'clientId', 'clientSecret')
 * @returns {string}
 */
function securityKeyToVar(securityKey) {
  if (!securityKey || typeof securityKey !== 'string') return '';
  return securityKey.replace(/_/g, '').toUpperCase();
}

/** Known single-segment variable suffixes (uppercase) for inferring var vs namespace in env keys */
const VAR_SUFFIXES = new Set(['ID', 'SECRET', 'KEY', 'TOKEN', 'URL', 'USERNAME', 'PASSWORD']);

/**
 * Converts var segment(s) from env key to path-style camelCase (e.g. CLIENT_ID → clientId, CLIENTID → clientId).
 * @param {string[]} varSegments - One or two segments (e.g. ['CLIENT', 'ID'], ['CLIENTID'])
 * @returns {string}
 */
function varSegmentsToCamelCase(varSegments) {
  if (!varSegments || varSegments.length === 0) return '';
  if (varSegments.length === 1) {
    const s = varSegments[0].toLowerCase();
    if (s.endsWith('id') && s.length > 2) return s.slice(0, -2) + 'Id';
    if (s.endsWith('secret') && s.length > 6) return s.slice(0, -6) + 'Secret';
    if (s.endsWith('key') && s.length > 3) return s.slice(0, -3) + 'Key';
    if (s.endsWith('token') && s.length > 5) return s.slice(0, -5) + 'Token';
    if (s.endsWith('url') && s.length > 3) return s.slice(0, -3) + 'Url';
    return s;
  }
  return varSegments.map((seg, i) => {
    const lower = seg.toLowerCase();
    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

/**
 * Builds kv path from segments when systemKey is provided (path = kv://systemKey/variable).
 * @param {string[]} segments - Parsed segments after KV_ prefix
 * @param {string} systemKey - System key (e.g. 'microsoft-teams')
 * @returns {string|null}
 */
function kvPathWithSystemKey(segments, systemKey) {
  const prefixInKey = systemKey.replace(/-/g, '_').toUpperCase();
  const prefixSegs = prefixInKey.split('_').filter(Boolean);
  if (segments.length <= prefixSegs.length) return null;
  const prefixMatch = prefixSegs.every((p, i) => segments[i] === p);
  if (!prefixMatch) return null;
  const varSegments = segments.slice(prefixSegs.length);
  const pathVar = varSegmentsToCamelCase(varSegments);
  return pathVar ? `kv://${systemKey}/${pathVar}` : null;
}

/**
 * Builds kv path from segments when systemKey is not provided (infers namespace and variable).
 * @param {string[]} segments - Parsed segments after KV_ prefix
 * @returns {string|null}
 */
function kvPathInferred(segments) {
  if (segments.length === 1) return `kv://${segments[0].toLowerCase()}`;
  const varSegmentCount = (segments.length >= 2 && VAR_SUFFIXES.has(segments[segments.length - 1])) ? 2 : 1;
  const namespace = segments.slice(0, -varSegmentCount).map(s => s.toLowerCase()).join('-');
  const varSegments = segments.slice(-varSegmentCount);
  const pathVar = varSegmentsToCamelCase(varSegments);
  return (namespace && pathVar) ? `kv://${namespace}/${pathVar}` : null;
}

/**
 * Returns the path segment used in kv://&lt;systemKey&gt;/&lt;segment&gt; for a given security key.
 * Uses the same derivation as env key → path (securityKeyToVar + varSegmentsToCamelCase).
 * @param {string} securityKey - Security key (e.g. 'apiKey', 'clientId', 'clientSecret')
 * @returns {string} Canonical path segment (e.g. 'apiKey', 'clientId')
 */
function getKvPathSegmentForSecurityKey(securityKey) {
  if (!securityKey || typeof securityKey !== 'string') return '';
  return varSegmentsToCamelCase([securityKeyToVar(securityKey)]);
}

/**
 * Converts KV_* env key to kv:// path in format kv://&lt;system-key&gt;/&lt;variable&gt;.
 * System-key uses hyphens (e.g. microsoft-teams); variable is camelCase (e.g. clientId).
 * When systemKey is provided, uses it as the path namespace; otherwise infers from segments.
 *
 * @param {string} envKey - Env var name (e.g. KV_MICROSOFT_TEAMS_CLIENT_ID)
 * @param {string} [systemKey] - Optional system key (e.g. 'microsoft-teams'); when provided, path is kv://systemKey/variable
 * @returns {string|null} kv:// path or null if invalid
 */
function kvEnvKeyToPath(envKey, systemKey) {
  if (!envKey || typeof envKey !== 'string' || !envKey.toUpperCase().startsWith(KV_PREFIX)) return null;
  const rest = envKey.slice(KV_PREFIX.length).trim();
  if (!rest) return null;
  const segments = rest.split('_').filter(Boolean);
  if (segments.length === 0) return null;

  const hasSystemKey = typeof systemKey === 'string' && systemKey.length > 0;
  if (hasSystemKey) return kvPathWithSystemKey(segments, systemKey);
  return kvPathInferred(segments);
}

/**
 * Collects KV_* entries from env map as secret items (key = kv path, value = raw).
 * When value is a kv:// path, uses it as the key so it matches payload paths (e.g. kv://microsoft-teams/clientId).
 * Otherwise derives path from env key via kvEnvKeyToPath(envKey).
 *
 * @param {Object.<string, string>} envMap - Key-value map from .env
 * @returns {Array<{ key: string, value: string }>} Items (key = kv://..., value = raw)
 */
function collectKvEnvVarsAsSecretItems(envMap, systemKey) {
  if (!envMap || typeof envMap !== 'object') {
    return [];
  }
  const items = [];
  for (const [envKey, rawValue] of Object.entries(envMap)) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (value === '') continue;
    let kvPath = null;
    if (value.startsWith('kv://') && isValidKvPath(value)) {
      kvPath = value;
    }
    if (!kvPath) kvPath = kvEnvKeyToPath(envKey, systemKey) || kvEnvKeyToPath(envKey);
    if (!kvPath) continue;
    items.push({ key: kvPath, value });
  }
  return items;
}

/**
 * Resolves a single value if it is a kv:// reference using secrets map.
 * Supports path-style keys (e.g. secrets/foo) and hyphen-style (secrets-foo).
 *
 * @param {Object} secrets - Loaded secrets object
 * @param {string} value - Value (may be "kv://..." or plain)
 * @returns {string|null} Resolved plain value or null if unresolved
 */
function resolveKvValue(secrets, value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('kv://')) {
    return trimmed;
  }
  const pathMatch = trimmed.match(/^kv:\/\/([a-zA-Z0-9_\-/]+)$/);
  if (!pathMatch) return null;
  const pathKey = pathMatch[1];
  const resolved = secrets[pathKey];
  if (resolved === undefined) return null;
  return typeof resolved === 'string' ? resolved : String(resolved);
}

/**
 * Recursively collects all kv:// references from a JSON-serializable payload.
 *
 * @param {Object|Array|string|number|boolean|null} obj - Upload payload (application + dataSources)
 * @param {Set<string>} [acc] - Accumulator set (internal)
 * @returns {string[]} Unique kv:// refs (e.g. ["kv://secrets/foo"])
 */
function collectKvRefsFromPayload(obj, acc = new Set()) {
  if (obj === null || obj === undefined) {
    return Array.from(acc);
  }
  if (typeof obj === 'string') {
    let m;
    KV_REF_PATTERN.lastIndex = 0;
    while ((m = KV_REF_PATTERN.exec(obj)) !== null) {
      acc.add(`kv://${m[1]}`);
    }
    return Array.from(acc);
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectKvRefsFromPayload(item, acc);
    }
    return Array.from(acc);
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      collectKvRefsFromPayload(v, acc);
    }
    return Array.from(acc);
  }
  return Array.from(acc);
}

/**
 * Validates that key is a well-formed kv path (kv:// with alphanumeric/hyphen/slash segments).
 *
 * @param {string} key - kv:// path
 * @returns {boolean}
 */
function isValidKvPath(key) {
  return typeof key === 'string' && /^kv:\/\/[a-z0-9][a-z0-9\-/]*$/i.test(key.trim());
}

/**
 * Builds secret items from .env file (KV_* vars, values resolved).
 * @param {string} envFilePath - Path to .env
 * @param {Object} secrets - Loaded secrets
 * @param {Map<string, string>} itemsByKey - Mutable map to add items to
 */
function buildItemsFromEnv(envFilePath, secrets, itemsByKey, systemKey) {
  if (!envFilePath || typeof envFilePath !== 'string' || !fs.existsSync(envFilePath)) return;
  try {
    const content = fs.readFileSync(envFilePath, 'utf8');
    const envMap = parseEnvToMap(content);
    const fromEnv = collectKvEnvVarsAsSecretItems(envMap, systemKey);
    for (const { key, value } of fromEnv) {
      const resolved = resolveKvValue(secrets, value);
      // Skip placeholder: value that equals the kv path (e.g. from env.template) must not be pushed as the secret
      if (resolved !== null && resolved !== undefined && isValidKvPath(key) && resolved.trim() !== key.trim()) {
        itemsByKey.set(key, resolved);
      }
    }
  } catch {
    // Best-effort: continue without .env items
  }
}

/**
 * Builds secret items from payload kv:// refs not already in itemsByKey.
 * @param {Object} payload - Upload payload
 * @param {Object} secrets - Loaded secrets
 * @param {Map<string, string>} itemsByKey - Mutable map to add items to
 */
function buildItemsFromPayload(payload, secrets, itemsByKey) {
  if (!payload || typeof payload !== 'object') return;
  const refs = collectKvRefsFromPayload(payload);
  const existingKeys = new Set(itemsByKey.keys());
  for (const ref of refs) {
    if (existingKeys.has(ref)) continue;
    const pathKey = ref.replace(/^kv:\/\//, '');
    const resolved = secrets[pathKey];
    if (resolved !== null && resolved !== undefined && isValidKvPath(ref)) {
      itemsByKey.set(ref, typeof resolved === 'string' ? resolved : String(resolved));
    }
  }
}

/**
 * Derives stored count from API response.
 * @param {Object} res - Response from storeCredentialSecrets
 * @param {number} fallback - Fallback when stored not in response
 * @returns {number}
 */
function storedCountFromResponse(res, fallback) {
  if (res && typeof res.stored === 'number') return res.stored;
  if (res && res.data && res.data.stored !== undefined && res.data.stored !== null) return res.data.stored;
  return fallback;
}

/**
 * Sends items to dataplane credential API; returns pushed count or warning.
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Auth config
 * @param {Array<{ key: string, value: string }>} items - Items to send
 * @returns {Promise<{ pushed: number, warning?: string }>}
 */
async function sendCredentialSecrets(dataplaneUrl, authConfig, items) {
  try {
    const res = await storeCredentialSecrets(dataplaneUrl, authConfig, items);
    const failed = res && (res.success === false || res.data?.success === false);
    if (failed) {
      const status = res.status ?? res.statusCode;
      if (status === 403 || status === 401) {
        return { pushed: 0, warning: 'Could not push credential secrets (permission denied or unauthenticated). Ensure dataplane role has credential:create if you use KV_* in .env.' };
      }
      const errMsg = res.formattedError || res.data?.formattedError || res.error || res.data?.error || 'Failed to push credential secrets to dataplane.';
      return { pushed: 0, warning: errMsg };
    }
    return { pushed: storedCountFromResponse(res, items.length) };
  } catch (err) {
    return { pushed: 0, warning: err.message || 'Failed to push credential secrets to dataplane.' };
  }
}

/**
 * Pushes credential secrets to dataplane: from .env (KV_*) and from payload kv:// refs.
 * Resolves all kv:// in values via loadSecrets; sends only plain values. Best-effort:
 * on 403/401 logs warning and returns; never logs secret values.
 *
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth config (Bearer)
 * @param {Object} options - Options
 * @param {string} [options.envFilePath] - Path to .env (integration/<systemKey>/.env)
 * @param {string} [options.appName] - App/system name for loadSecrets context
 * @param {Object} [options.payload] - Upload payload { application, dataSources } for kv scan
 * @returns {Promise<{ pushed: number, keys?: string[], skipped?: boolean, warning?: string }>} Count pushed, keys (on success), skipped (when nothing to push), optional warning
 */
async function pushCredentialSecrets(dataplaneUrl, authConfig, options = {}) {
  const { envFilePath, appName, payload } = options;
  let secrets;
  try {
    secrets = await loadSecrets(undefined, appName);
  } catch {
    secrets = {};
  }
  const itemsByKey = new Map();
  buildItemsFromEnv(envFilePath, secrets, itemsByKey, appName);
  buildItemsFromPayload(payload, secrets, itemsByKey);

  const items = Array.from(itemsByKey.entries())
    .filter(([k]) => isValidKvPath(k))
    .map(([key, value]) => ({ key, value }));

  if (items.length === 0) return { pushed: 0, skipped: true };
  const sendResult = await sendCredentialSecrets(dataplaneUrl, authConfig, items);
  if (sendResult.pushed > 0) {
    sendResult.keys = items.map(i => i.key.replace(/^kv:\/\//, ''));
  }
  return sendResult;
}

/**
 * Parses .env-style content into key-value map (first = separates key and value).
 *
 * @param {string} content - Raw .env content
 * @returns {Object.<string, string>}
 */
function parseEnvToMap(content) {
  if (!content || typeof content !== 'string') return {};
  const map = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      const value = trimmed.substring(eq + 1);
      map[key] = value;
    }
  }
  return map;
}

module.exports = {
  collectKvEnvVarsAsSecretItems,
  collectKvRefsFromPayload,
  pushCredentialSecrets,
  kvEnvKeyToPath,
  getKvPathSegmentForSecurityKey,
  systemKeyToKvPrefix,
  securityKeyToVar,
  isValidKvPath,
  resolveKvValue,
  parseEnvToMap
};
