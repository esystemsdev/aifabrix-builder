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

function createHomeAndSecretsPathFunctions(getConfigFn, saveConfigFn) {
  return {
    async getAifabrixHomeOverride() {
      return getPathConfig(getConfigFn, 'aifabrix-home');
    },
    async setAifabrixHomeOverride(homePath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-home', homePath, 'Home path is required and must be a string');
    },
    async getAifabrixSecretsPath() {
      return getPathConfig(getConfigFn, 'aifabrix-secrets');
    },
    async setAifabrixSecretsPath(secretsPath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-secrets', secretsPath, 'Secrets path is required and must be a string');
    }
  };
}

function createEnvConfigPathFunctions(getConfigFn, saveConfigFn) {
  return {
    async getAifabrixEnvConfigPath() {
      return getPathConfig(getConfigFn, 'aifabrix-env-config');
    },
    async setAifabrixEnvConfigPath(envConfigPath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-env-config', envConfigPath, 'Env config path is required and must be a string');
    },
    async getAifabrixBuilderDir() {
      const envConfigPath = await getPathConfig(getConfigFn, 'aifabrix-env-config');
      return envConfigPath && typeof envConfigPath === 'string' ? path.dirname(envConfigPath) : null;
    }
  };
}

function createRemoteConfigGetters(getConfigFn) {
  return {
    async getAifabrixWorkspaceRoot() {
      return getPathConfig(getConfigFn, 'aifabrix-workspace-root');
    },
    async getRemoteServer() {
      return getPathConfig(getConfigFn, 'remote-server');
    },
    async getDockerEndpoint() {
      return getPathConfig(getConfigFn, 'docker-endpoint');
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
    async setAifabrixWorkspaceRoot(value) {
      if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new Error('aifabrix-workspace-root must be a string');
      }
      const config = await getConfigFn();
      config['aifabrix-workspace-root'] = value || undefined;
      await saveConfigFn(config);
    },
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

async function mergeRemoteSettingsImpl(getConfigFn, saveConfigFn, settings) {
  if (!settings || typeof settings !== 'object') return;
  const config = await getConfigFn();
  for (const key of SETTINGS_RESPONSE_KEYS) {
    const raw = settings[key];
    if (raw === undefined || raw === null) continue;
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === '') continue;
    config[key] = value;
  }
  const remoteServer = config['remote-server'];
  const secretsPath = config['aifabrix-secrets'];
  if (remoteServer && secretsPath && !isHttpUrl(secretsPath)) {
    const base = typeof remoteServer === 'string' ? remoteServer.trim().replace(/\/+$/, '') : '';
    if (base) config['aifabrix-secrets'] = `${base}/api/dev/secrets`;
  }
  const host = hostnameFromUrl(remoteServer);
  if (host) {
    if (!config['sync-ssh-host']) config['sync-ssh-host'] = host;
    if (!config['docker-endpoint']) config['docker-endpoint'] = `tcp://${host}:2376`;
  }
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
  SETTINGS_RESPONSE_KEYS
};

