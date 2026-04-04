/**
 * AI Fabrix Builder - Configuration Path Utilities
 *
 * Helper functions for managing path configuration in config.yaml
 *
 * @fileoverview Path configuration utilities for config management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');

/**
 * GET /api/dev/settings response parameter names (builder-cli.md §1).
 * Single source of truth so CLI and config merge stay aligned with the contract.
 */
const SETTINGS_RESPONSE_KEYS = [
  'user-mutagen-folder',
  'secrets-encryption',
  'aifabrix-secrets',
  'aifabrix-env-config',
  'remote-server',
  'docker-endpoint',
  'docker-tls-skip-verify',
  'sync-ssh-user',
  'sync-ssh-host'
];

/**
 * Get path configuration value
 * @async
 * @param {Function} getConfigFn - Function to get config
 * @param {string} key - Configuration key
 * @returns {Promise<string|null>} Path value or null
 */
async function getPathConfig(getConfigFn, key) {
  const config = await getConfigFn();
  return config[key] || null;
}

/**
 * Set path configuration value
 * @async
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @param {string} key - Configuration key
 * @param {string} value - Path value
 * @param {string} errorMsg - Error message if validation fails
 * @returns {Promise<void>}
 */
async function setPathConfig(getConfigFn, saveConfigFn, key, value, errorMsg) {
  if (!value || typeof value !== 'string') {
    throw new Error(errorMsg);
  }
  const config = await getConfigFn();
  config[key] = value;
  await saveConfigFn(config);
}

/**
 * Clear a path config key (set to undefined so getPathConfig returns null).
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @param {string} key - Configuration key
 * @returns {Promise<void>}
 */
async function clearPathConfig(getConfigFn, saveConfigFn, key) {
  const config = await getConfigFn();
  config[key] = undefined;
  await saveConfigFn(config);
}

function createHomeAndSecretsPathFunctions(getConfigFn, saveConfigFn) {
  return {
    async getAifabrixHomeOverride() {
      return getPathConfig(getConfigFn, 'aifabrix-home');
    },
    async setAifabrixHomeOverride(homePath) {
      if (typeof homePath !== 'string') {
        throw new Error('Home path is required and must be a string');
      }
      const trimmed = homePath.trim();
      if (trimmed === '') {
        await clearPathConfig(getConfigFn, saveConfigFn, 'aifabrix-home');
        return;
      }
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-home', trimmed, 'Home path must be a non-empty string');
    },
    async getAifabrixWorkOverride() {
      return getPathConfig(getConfigFn, 'aifabrix-work');
    },
    async setAifabrixWorkOverride(workPath) {
      if (typeof workPath !== 'string') {
        throw new Error('Work path is required and must be a string');
      }
      const trimmed = workPath.trim();
      if (trimmed === '') {
        await clearPathConfig(getConfigFn, saveConfigFn, 'aifabrix-work');
        return;
      }
      const resolved = path.resolve(trimmed);
      await setPathConfig(
        getConfigFn,
        saveConfigFn,
        'aifabrix-work',
        resolved,
        'Work path must be a non-empty string'
      );
    },
    async getAifabrixSecretsPath() {
      return getPathConfig(getConfigFn, 'aifabrix-secrets');
    },
    async setAifabrixSecretsPath(secretsPath) {
      if (typeof secretsPath !== 'string') {
        throw new Error('Secrets path is required and must be a string');
      }
      const trimmed = secretsPath.trim();
      if (trimmed === '') {
        await clearPathConfig(getConfigFn, saveConfigFn, 'aifabrix-secrets');
        return;
      }
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-secrets', trimmed, 'Secrets path must be a non-empty string');
    }
  };
}

/** Default env-config path when aifabrix-env-config is not set (builder schema). */
function getDefaultEnvConfigPath() {
  return path.join(__dirname, '..', 'schema', 'env-config.yaml');
}

/**
 * Resolve configured `aifabrix-env-config` to an absolute path.
 * Relative paths are resolved against the workspace root first: `aifabrix-work` from the same config,
 * then {@link module:lib/utils/paths.getAifabrixWork} (env `AIFABRIX_WORK` + on-disk yaml). If neither
 * is set, falls back to `aifabrix-home` from config, then {@link module:lib/utils/paths.getAifabrixHome}.
 * Never uses the process current working directory alone as the anchor.
 *
 * @async
 * @param {string} raw - Non-empty path string from config (may be relative)
 * @param {Function} getConfigFn - Async config loader
 * @returns {Promise<string>} Normalized absolute path
 */
async function resolveEnvConfigPathToAbsolute(raw, getConfigFn) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    throw new Error('Env config path must be a non-empty string');
  }
  if (path.isAbsolute(trimmed)) {
    return path.normalize(path.resolve(trimmed));
  }
  const pathsMod = require('./paths');

  const workFromConfig = await getPathConfig(getConfigFn, 'aifabrix-work');
  let workBase =
    workFromConfig && String(workFromConfig).trim() !== ''
      ? path.resolve(String(workFromConfig).trim())
      : null;
  if (!workBase) {
    workBase = pathsMod.getAifabrixWork();
  }
  if (workBase && String(workBase).trim() !== '') {
    return path.normalize(path.resolve(String(workBase).trim(), trimmed));
  }

  const homeFromConfig = await getPathConfig(getConfigFn, 'aifabrix-home');
  const base =
    homeFromConfig && String(homeFromConfig).trim() !== ''
      ? path.resolve(String(homeFromConfig).trim())
      : pathsMod.getAifabrixHome();
  return path.normalize(path.resolve(base, trimmed));
}

function createEnvConfigPathFunctions(getConfigFn, saveConfigFn) {
  return {
    async getAifabrixEnvConfigPath() {
      const value = await getPathConfig(getConfigFn, 'aifabrix-env-config');
      if (!value || typeof value !== 'string') {
        return getDefaultEnvConfigPath();
      }
      return resolveEnvConfigPathToAbsolute(value, getConfigFn);
    },
    async setAifabrixEnvConfigPath(envConfigPath) {
      if (typeof envConfigPath !== 'string') {
        throw new Error('Env config path is required and must be a string');
      }
      const trimmed = envConfigPath.trim();
      if (trimmed === '') {
        await clearPathConfig(getConfigFn, saveConfigFn, 'aifabrix-env-config');
        return;
      }
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-env-config', trimmed, 'Env config path must be a non-empty string');
    },
    async getAifabrixBuilderDir() {
      const envConfigPath = await getPathConfig(getConfigFn, 'aifabrix-env-config');
      if (!envConfigPath || typeof envConfigPath !== 'string') {
        return null;
      }
      const absolute = await resolveEnvConfigPathToAbsolute(envConfigPath.trim(), getConfigFn);
      return path.dirname(absolute);
    }
  };
}

/**
 * Whether remote Docker TLS should skip server certificate verification (dev / self-signed daemon).
 * Env AIFABRIX_DOCKER_TLS_SKIP_VERIFY=1|true forces skip when set.
 * @param {*} raw - Config or settings value
 * @returns {boolean}
 */
function isDockerTlsSkipVerifyTruthy(raw) {
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

/**
 * Explicit opt-out of TLS verify skip in config (docker-tls-skip-verify: false).
 * @param {*} raw - Config value
 * @returns {boolean}
 */
function isDockerTlsSkipVerifyExplicitlyFalse(raw) {
  if (raw === false) return true;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    return s === 'false' || s === '0' || s === 'no';
  }
  return false;
}

function createRemoteConfigGetters(getConfigFn) {
  return {
    async getRemoteServer() {
      return getPathConfig(getConfigFn, 'remote-server');
    },
    async getDockerEndpoint() {
      return getPathConfig(getConfigFn, 'docker-endpoint');
    },
    /**
     * When true, Docker CLI may use DOCKER_TLS_VERIFY=0 only when ca.pem is absent (no trust anchor).
     * If ca.pem exists (e.g. after issue-cert), the daemon is always verified regardless of this flag.
     */
    async getDockerTlsSkipVerify() {
      const envRaw = process.env.AIFABRIX_DOCKER_TLS_SKIP_VERIFY;
      if (envRaw !== undefined && String(envRaw).trim() !== '') {
        return isDockerTlsSkipVerifyTruthy(String(envRaw).trim());
      }
      const config = await getConfigFn();
      const flag = config['docker-tls-skip-verify'];
      if (isDockerTlsSkipVerifyExplicitlyFalse(flag)) {
        return false;
      }
      if (isDockerTlsSkipVerifyTruthy(flag)) {
        return true;
      }
      return false;
    },
    async getUserMutagenFolder() {
      return getPathConfig(getConfigFn, 'user-mutagen-folder');
    },
    async getSyncSshUser() {
      return getPathConfig(getConfigFn, 'sync-ssh-user');
    },
    async getSyncSshHost() {
      return getPathConfig(getConfigFn, 'sync-ssh-host');
    }
  };
}

function createRemoteConfigSetters(getConfigFn, saveConfigFn) {
  return {
    async setRemoteServer(value) {
      if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new Error('remote-server must be a string');
      }
      const config = await getConfigFn();
      config['remote-server'] = value ? value.trim().replace(/\/+$/, '') : undefined;
      await saveConfigFn(config);
    },
    async setDockerEndpoint(value) {
      if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new Error('docker-endpoint must be a string');
      }
      const config = await getConfigFn();
      config['docker-endpoint'] = value || undefined;
      await saveConfigFn(config);
    },
    async setDockerTlsSkipVerify(value) {
      const config = await getConfigFn();
      if (value === null || value === undefined) {
        config['docker-tls-skip-verify'] = undefined;
      } else if (typeof value === 'boolean') {
        config['docker-tls-skip-verify'] = value;
      } else if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (s === '' || s === 'false' || s === '0' || s === 'no') {
          config['docker-tls-skip-verify'] = false;
        } else {
          config['docker-tls-skip-verify'] = isDockerTlsSkipVerifyTruthy(value);
        }
      } else {
        throw new Error('docker-tls-skip-verify must be a boolean or string');
      }
      await saveConfigFn(config);
    }
  };
}

function isHttpUrl(value) {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
}

/**
 * Derive hostname from a URL (e.g. https://builder.aifabrix.dev -> builder.aifabrix.dev).
 * @param {string} url - URL string
 * @returns {string|null} Hostname or null if invalid
 */
function hostnameFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim().replace(/\/+$/, '');
  if (!s) return null;
  const withProtocol = s.match(/^https?:\/\//) ? s : `https://${s}`;
  try {
    return new URL(withProtocol).hostname || null;
  } catch {
    return null;
  }
}

function applySecretsUrlFromRemote(config) {
  const remoteServer = config['remote-server'];
  const secretsPath = config['aifabrix-secrets'];
  if (!remoteServer || !secretsPath || isHttpUrl(secretsPath)) return;
  const base = typeof remoteServer === 'string' ? remoteServer.trim().replace(/\/+$/, '') : '';
  if (!base) return;
  config['aifabrix-secrets'] = `${base}/api/dev/secrets`;
}

function applySyncAndDockerFromHost(config) {
  const host = hostnameFromUrl(config['remote-server']);
  if (!host) return;
  if (!config['sync-ssh-host']) config['sync-ssh-host'] = host;
  if (!config['docker-endpoint']) config['docker-endpoint'] = `tcp://${host}:2376`;
}

async function mergeRemoteSettingsImpl(getConfigFn, saveConfigFn, settings) {
  if (!settings || typeof settings !== 'object') return;
  const config = await getConfigFn();
  delete config['aifabrix-secrets-path'];
  for (const key of SETTINGS_RESPONSE_KEYS) {
    const raw = settings[key];
    if (raw === undefined || raw === null) continue;
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === '') continue;
    config[key] = value;
  }
  applySecretsUrlFromRemote(config);
  applySyncAndDockerFromHost(config);
  await saveConfigFn(config);
}

/**
 * Remote Docker / Builder Server config. Used when remote-server is set.
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @returns {Object} Remote config getters, setters, and mergeRemoteSettings
 */
function createRemoteConfigFunctions(getConfigFn, saveConfigFn) {
  return {
    ...createRemoteConfigGetters(getConfigFn),
    ...createRemoteConfigSetters(getConfigFn, saveConfigFn),
    async mergeRemoteSettings(settings) {
      return mergeRemoteSettingsImpl(getConfigFn, saveConfigFn, settings);
    }
  };
}

/**
 * Create path configuration functions with config access
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @returns {Object} Path configuration functions
 */
function createPathConfigFunctions(getConfigFn, saveConfigFn) {
  return {
    ...createHomeAndSecretsPathFunctions(getConfigFn, saveConfigFn),
    ...createEnvConfigPathFunctions(getConfigFn, saveConfigFn),
    ...createRemoteConfigFunctions(getConfigFn, saveConfigFn)
  };
}

module.exports = {
  getPathConfig,
  setPathConfig,
  createPathConfigFunctions,
  getDefaultEnvConfigPath,
  resolveEnvConfigPathToAbsolute,
  SETTINGS_RESPONSE_KEYS
};

