/**
 * AI Fabrix Builder – Ensure secrets in the primary user store
 *
 * Automated flows (resolve, run, wizard, up-infra backfill) **only** write to
 * `~/.aifabrix/secrets.local.yaml` (or the path from `getPrimaryUserSecretsLocalPath`).
 * The shared store (`aifabrix-secrets` file or remote API) is **read** via `loadSecrets()`;
 * writing there is **human-only** through `aifabrix secret set --shared` (see `commands/secrets-set.js`).
 * New values are encrypted when secrets-encryption is set.
 *
 * @fileoverview Central ensure-secrets service for zero-touch install
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./config');
const pathsUtil = require('../utils/paths');
const logger = require('../utils/logger');
const { formatSuccessLine, metadata } = require('../utils/cli-test-layout-chalk');
const remoteDevAuth = require('../utils/remote-dev-auth');
const devApi = require('../api/dev.api');
const {
  findMissingSecretKeys,
  generateSecretValue,
  loadExistingSecrets,
  appendSecretsToFile,
  saveSecretsFile
} = require('../utils/secrets-generator');
const { encryptSecret } = require('../utils/secrets-encryption');
const { loadEnvTemplate } = require('../utils/secrets-helpers');
const {
  buildInfraPlaceholderContext,
  isSecretKeyAllowedEmpty,
  getInfraSecretKeysForUpInfra,
  loadMergedSecretsForEnsureMissingCheck,
  shouldUseMergedSecretsForMissingKeys
} = require('./secrets-ensure-infra');
const { syncLiteralKvSecretsFromCliOverrides } = require('./secrets-infra-placeholder-sync');

/**
 * Lazy require so tests that `jest.mock('../parameters/infra-parameter-catalog')` after other
 * suites loaded secrets-ensure still see the mocked exports (avoids stale destructured refs).
 * @returns {typeof import('../parameters/infra-parameter-catalog')}
 */
function infraParameterCatalogModule() {
  return require('../parameters/infra-parameter-catalog');
}

/**
 * Expand leading ~ to home directory.
 * @param {string} filePath - Path that may start with ~
 * @returns {string} Resolved path
 */
function expandTilde(filePath) {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~' + path.sep)) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Resolve the **configured** shared store for inspection/validation (e.g. `secret validate` without a path).
 * This is the `aifabrix-secrets` target (file or remote API), not the default for automated writes.
 *
 * - File path → that path (expand ~)
 * - http(s) URL → remote
 * - No config → primary user secrets file
 *
 * @returns {Promise<{ type: 'file'|'remote', filePath?: string, serverUrl?: string|null, secretsEndpointUrl?: string, clientCertPem?: string|null, serverCaPem?: string|null }>}
 */
async function resolveWriteTarget() {
  const secretsPath = await config.getSecretsPath();
  const userFilePath = pathsUtil.getPrimaryUserSecretsLocalPath();

  if (!secretsPath) {
    return { type: 'file', filePath: userFilePath };
  }
  const resolvedSecrets = await remoteDevAuth.resolveSharedSecretsEndpoint(secretsPath);
  if (remoteDevAuth.isRemoteSecretsUrl(resolvedSecrets)) {
    const auth = await remoteDevAuth.getRemoteDevAuth();
    return {
      type: 'remote',
      filePath: userFilePath,
      serverUrl: auth ? auth.serverUrl : null,
      secretsEndpointUrl: resolvedSecrets.trim().replace(/\/+$/, ''),
      clientCertPem: auth ? auth.clientCertPem : null,
      serverCaPem: auth ? auth.serverCaPem : null
    };
  }
  const filePath = path.isAbsolute(resolvedSecrets)
    ? resolvedSecrets
    : path.resolve(process.cwd(), expandTilde(resolvedSecrets));
  return { type: 'file', filePath };
}

/**
 * Default write target for **automated** ensure / `setSecretInStore` (resolve, run, wizard, infra).
 * Never the shared store; use `aifabrix secret set --shared` to write shared.
 *
 * @returns {Promise<{ type: 'file', filePath: string }>}
 */
async function resolvePrimaryUserWriteTarget() {
  return { type: 'file', filePath: pathsUtil.getPrimaryUserSecretsLocalPath() };
}

/**
 * Load existing secrets from the resolved target (file or remote).
 *
 * @param {{ type: string, filePath?: string, serverUrl?: string, clientCertPem?: string }} target
 * @returns {Promise<Object>} Existing secrets key-value object
 */
async function loadExistingFromTarget(target) {
  if (target.type === 'file' && target.filePath) {
    return loadExistingSecrets(target.filePath);
  }
  if (target.type === 'remote' && target.serverUrl && target.clientCertPem) {
    try {
      const items = await devApi.listSecrets(
        target.serverUrl,
        target.clientCertPem,
        target.serverCaPem || undefined,
        target.secretsEndpointUrl
      );
      if (!Array.isArray(items)) return {};
      const obj = {};
      for (const item of items) {
        if (item && typeof item.name === 'string' && item.value !== undefined) {
          obj[item.name] = String(item.value);
        }
      }
      return obj;
    } catch {
      return {};
    }
  }
  if (target.type === 'remote' && target.filePath) {
    return loadExistingSecrets(target.filePath);
  }
  return {};
}

/**
 * Write a single secret to file, optionally encrypting the value.
 *
 * @param {string} filePath - Resolved file path
 * @param {string} key - Secret key
 * @param {string} value - Plain value
 * @param {string|null} encryptionKey - Config secrets-encryption key or null
 * @returns {Promise<void>}
 */
async function writeSecretToFile(filePath, key, value, encryptionKey) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  let valueToWrite = value;
  if (encryptionKey && value !== '') {
    try {
      valueToWrite = encryptSecret(value, encryptionKey);
    } catch {
      // Keep plaintext if encryption fails
    }
  }
  appendSecretsToFile(filePath, { [key]: valueToWrite });
}

/**
 * Compute value for a key (suggested or generated).
 * @param {string} key - Secret key
 * @param {Object} suggested - Map of suggested values
 * @param {boolean} emptyForCredentials - Use empty string if true
 * @param {Record<string, string>|undefined} placeholderContext - Catalog defaults + CLI merged map
 * @returns {string}
 */
function valueForKey(key, suggested, emptyForCredentials, placeholderContext) {
  if (key in suggested) return String(suggested[key]);
  return emptyForCredentials ? '' : generateSecretValue(key, placeholderContext);
}

/**
 * Short label for logs (file path or remote secrets URL).
 * @param {{ type?: string, filePath?: string, secretsEndpointUrl?: string }|null} target
 * @returns {string}
 */
function summarizeSecretsStoreForLog(target) {
  if (!target || typeof target !== 'object') return 'secrets store';
  if (target.type === 'remote' && typeof target.secretsEndpointUrl === 'string' && target.secretsEndpointUrl.trim()) {
    return target.secretsEndpointUrl.trim();
  }
  if (typeof target.filePath === 'string' && target.filePath.trim()) {
    return target.filePath.trim();
  }
  return 'secrets store';
}

/**
 * Log that new values were written for keys that were missing or empty.
 * @param {string[]} added
 * @param {{ type?: string, filePath?: string, secretsEndpointUrl?: string }|null} target
 */
function logNewSecretValuesWritten(added, target) {
  if (!Array.isArray(added) || added.length === 0) return;
  const where = summarizeSecretsStoreForLog(target);
  logger.log(
    formatSuccessLine(
      `Wrote ${added.length} new secret value(s) to ${where}. ` +
        'These keys were missing or empty; values are now stored.'
    )
  );
  logger.log(metadata(`  Keys: ${added.join(', ')}`));
}

/**
 * Add secrets to file (with optional encryption).
 * @param {Object} batch
 * @param {string} batch.filePath
 * @param {string[]} batch.toAdd
 * @param {Object} batch.suggested
 * @param {boolean} batch.emptyForCredentials
 * @param {string|null} batch.encryptionKey
 * @param {string[]} batch.added
 * @param {Record<string, string>|undefined} batch.placeholderContext
 * @returns {Promise<string[]>}
 */
async function addSecretsToFile(batch) {
  const {
    filePath,
    toAdd,
    suggested,
    emptyForCredentials,
    encryptionKey,
    added,
    placeholderContext
  } = batch;
  for (const key of toAdd) {
    const value = valueForKey(key, suggested, emptyForCredentials, placeholderContext);
    await writeSecretToFile(filePath, key, value, encryptionKey);
    added.push(key);
  }
  logNewSecretValuesWritten(added, { type: 'file', filePath });
  return added;
}

/**
 * Ensure a list of secret keys exists in the configured store.
 * Only adds keys that are missing or empty. Uses generateSecretValue for new
 * values unless emptyValuesForCredentials is true (then empty string).
 *
 * @async
 * @function ensureSecretsForKeys
 * @param {string[]} keys - Secret keys to ensure
 * @param {Object} [options] - Options
 * @param {boolean} [options.emptyValuesForCredentials=false] - Use empty string for new values
 * @param {Object} [options.suggestedValues] - Optional map key -> value for specific keys
 * @param {boolean} [options.useMergedSecretsForMissingKeys] - When true, treat keys present in the full
 *   `loadSecrets()` merge (including remote `--shared`) as satisfied. When false, only the target store file
 *   is consulted. When omitted and the target file is the primary user secrets path, merged secrets are used (default).
 * @returns {Promise<string[]>} Keys that were added (new or backfilled)
 * @throws {Error} If config or file write fails
 */
async function ensureSecretsForKeys(keys, options = {}) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return [];
  }
  const emptyForCredentials = Boolean(options.emptyValuesForCredentials);
  const suggested = options.suggestedValues && typeof options.suggestedValues === 'object'
    ? options.suggestedValues
    : {};
  const placeholderContext = options.placeholderContext;

  const target = options._targetOverride || (await resolvePrimaryUserWriteTarget());
  let existing = await loadExistingFromTarget(target);
  if (shouldUseMergedSecretsForMissingKeys(options, target)) {
    existing = await loadMergedSecretsForEnsureMissingCheck();
  }
  const toAdd = keys.filter((k) => {
    const v = existing[k];
    const missingOrEmpty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    return missingOrEmpty && !isSecretKeyAllowedEmpty(k);
  });
  if (toAdd.length === 0) return [];

  const encryptionKey = await config.getSecretsEncryptionKey();
  const added = [];

  return addSecretsToFile({
    filePath: target.filePath,
    toAdd,
    suggested,
    emptyForCredentials,
    encryptionKey,
    added,
    placeholderContext
  });
}

/**
 * Ensure secrets referenced in an env template exist in the configured store.
 * Reads template from path or uses content if content is provided (string with kv://).
 *
 * @async
 * @function ensureSecretsFromEnvTemplate
 * @param {string} envTemplatePathOrContent - Path to env.template or template content
 * @param {Object} [options] - Options
 * @param {boolean} [options.emptyValuesForCredentials=false] - Use empty string for new values
 * @param {boolean} [options.useMergedSecretsForMissingKeys] - Same semantics as {@link ensureSecretsForKeys};
 *   defaults to merged lookup when the write target is the primary user secrets file
 * @returns {Promise<string[]>} Keys that were added
 * @throws {Error} If template cannot be read or ensure fails
 */
async function ensureSecretsFromEnvTemplate(envTemplatePathOrContent, options = {}) {
  let template;
  const input = typeof envTemplatePathOrContent === 'string' ? envTemplatePathOrContent : '';
  const looksLikePath = input.length > 0 && !input.includes('\n') && !input.includes('kv://');
  if (looksLikePath && fs.existsSync(input)) {
    template = loadEnvTemplate(input);
  } else if (input.includes('kv://')) {
    template = input;
  } else if (looksLikePath) {
    const err = new Error(`env.template not found: ${input}`);
    err.code = 'ENOENT';
    throw err;
  } else {
    throw new Error('env.template path or content is required');
  }
  let target;
  if (options.preferredFilePath && typeof options.preferredFilePath === 'string') {
    const filePath = path.isAbsolute(options.preferredFilePath)
      ? options.preferredFilePath
      : path.resolve(process.cwd(), options.preferredFilePath);
    target = { type: 'file', filePath };
  } else {
    target = await resolvePrimaryUserWriteTarget();
  }
  let existing = await loadExistingFromTarget(target);
  if (shouldUseMergedSecretsForMissingKeys(options, target)) {
    existing = await loadMergedSecretsForEnsureMissingCheck();
  }
  const missingKeys = findMissingSecretKeys(template, existing);
  return ensureSecretsForKeys(missingKeys, { ...options, _targetOverride: target });
}

/**
 * Write one key-value to a file store (load, merge, optionally encrypt, save).
 * @param {string} filePath - Secrets file path
 * @param {string} key - Secret key
 * @param {string} strValue - Plain value
 * @returns {Promise<void>}
 */
async function writeSecretToStoreFile(filePath, key, strValue) {
  const existing = loadExistingSecrets(filePath);
  const encryptionKey = await config.getSecretsEncryptionKey();
  let valueToWrite = strValue;
  if (encryptionKey && strValue !== '') {
    try {
      valueToWrite = encryptSecret(strValue, encryptionKey);
    } catch {
      // Keep plaintext if encryption fails
    }
  }
  existing[key] = valueToWrite;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  saveSecretsFile(filePath, existing);
}

/**
 * Write a single secret to the configured store (overwrites if key exists).
 * Used when syncing e.g. postgres-passwordKeyVault after --adminPassword override.
 *
 * @async
 * @function setSecretInStore
 * @param {string} key - Secret key
 * @param {string} value - Plain value
 * @returns {Promise<void>}
 */
async function setSecretInStore(key, value) {
  if (!key || typeof key !== 'string' || value === undefined) return;
  const strValue = typeof value === 'string' ? value : String(value);
  const userPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  await writeSecretToStoreFile(userPath, key, strValue);
}

/**
 * Ensure infra secrets exist before ensureAdminSecrets or startInfra.
 * Writes go to the primary user secrets file only (same as all **`ensureSecretsForKeys`** / **`setSecretInStore`** paths).
 * **`kv://` resolution** merges the shared store via **`loadSecrets()`**. To publish a key to shared, use
 * **`aifabrix secret set --shared`**.
 *
 * @async
 * @function ensureInfraSecrets
 * @param {Object} [options] - Options
 * @param {string} [options.adminPassword] - Overrides {{adminPassword}} (and alias adminPwd)
 * @param {string} [options.adminPwd] - Alias for adminPassword
 * @param {string} [options.adminEmail] - Overrides {{adminEmail}}
 * @param {string} [options.userPassword] - Overrides {{userPassword}}
 * @param {boolean} [options.tlsEnabled] - Merged into catalog placeholders: TLS_ENABLED / HTTP_ENABLED (HTTP is opposite of TLS; default TLS off)
 * @returns {Promise<string[]>} Keys that were added
 *
 * After backfill, non-empty `--adminPassword` / `--userPassword` / `--adminEmail` update all catalog
 * literals that reference the same `{{placeholder}}` (see `secrets-infra-placeholder-sync.js`).
 */
async function ensureInfraSecrets(options = {}) {
  const keys = getInfraSecretKeysForUpInfra();
  const placeholderContext = buildInfraPlaceholderContext(options);
  const userSecretsPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  const added = await ensureSecretsForKeys(keys, {
    placeholderContext,
    _targetOverride: { type: 'file', filePath: userSecretsPath }
  });

  async function writeInfraPlaceholderLiteralToUserLocal(key, value) {
    const strValue = typeof value === 'string' ? value : String(value);
    await writeSecretToStoreFile(userSecretsPath, key, strValue);
  }

  await syncLiteralKvSecretsFromCliOverrides(
    options,
    placeholderContext,
    writeInfraPlaceholderLiteralToUserLocal,
    infraParameterCatalogModule
  );
  return added;
}

module.exports = {
  ensureSecretsForKeys,
  ensureSecretsFromEnvTemplate,
  ensureInfraSecrets,
  setSecretInStore,
  resolveWriteTarget,
  resolvePrimaryUserWriteTarget,
  loadExistingFromTarget,
  getInfraSecretKeysForUpInfra,
  isSecretKeyAllowedEmpty,
  buildInfraPlaceholderContext
};

/**
 * @deprecated Prefer getInfraSecretKeysForUpInfra(). Names only: relaxed read of infra.parameter.yaml
 * (standardUpInfraEnsureKeys + exact keys with ensureOn upInfra), not workspace discovery.
 */
Object.defineProperty(module.exports, 'INFRA_SECRET_KEYS', {
  enumerable: true,
  get() {
    const cat = infraParameterCatalogModule();
    const bundledYaml = path.join(__dirname, '..', 'schema', 'infra.parameter.yaml');
    return cat.readRelaxedUpInfraEnsureKeyList(bundledYaml) || [];
  }
});
