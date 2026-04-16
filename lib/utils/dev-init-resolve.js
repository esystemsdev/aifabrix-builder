/**
 * Resolve Builder URL, developer id, and PIN for dev init.
 * CLI flags override config. Developer id from config is not used when it is "0" (local default).
 *
 * @fileoverview Shared onboarding option resolution for dev-init command
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../core/config');

function requirePin(options) {
  const pin = options.pin;
  if (!pin || typeof pin !== 'string' || !pin.trim()) {
    throw new Error(
      '--pin is required (one-time PIN). On an enrolled admin PC run: aifabrix dev pin <developer-id>, ' +
        'then use the PIN on this machine.'
    );
  }
}

/**
 * @param {Object} options - Commander options
 * @returns {Promise<{ devId: string, devIdFromConfig: boolean }>}
 */
async function resolveDeveloperIdPart(options) {
  const rawOptDev = options.developerId ?? options['developer-id'];
  let devId;
  let devIdFromConfig = false;
  if (rawOptDev !== undefined && rawOptDev !== null && String(rawOptDev).trim() !== '') {
    devId = String(rawOptDev).trim();
  } else {
    const fromCfg = await config.getDeveloperId();
    devId = fromCfg !== undefined && fromCfg !== null ? String(fromCfg).trim() : '';
    devIdFromConfig = true;
  }

  if (!devId || !/^[0-9]+$/.test(devId)) {
    throw new Error(
      'Pass --developer-id <id> (digits only) or set developer-id in config (aifabrix dev set-id <id>).'
    );
  }

  if (devIdFromConfig && devId === '0') {
    throw new Error(
      'Cannot use default developer-id 0 from config for Builder onboarding. Pass --developer-id <id> (e.g. 02) or run aifabrix dev set-id first.'
    );
  }

  return { devId, devIdFromConfig };
}

/**
 * @param {Object} options - Commander options
 * @returns {Promise<string>} Normalized base URL (no trailing slash)
 */
async function resolveServerBaseUrl(options) {
  let server = options.server;
  if (!server || typeof server !== 'string' || !String(server).trim()) {
    const fromCfg = await config.getRemoteServer();
    server = fromCfg && typeof fromCfg === 'string' ? fromCfg.trim() : '';
  } else {
    server = String(server).trim();
  }

  if (!server) {
    throw new Error(
      'Pass --server <Builder URL> or set remote-server in ~/.aifabrix/config.yaml (from settings merge or aifabrix dev show).'
    );
  }

  return server.replace(/\/+$/, '');
}

/**
 * @param {Object} options - Commander options
 * @returns {Promise<{ baseUrl: string, devId: string }>}
 */
async function resolveInitOptions(options) {
  requirePin(options);
  const { devId } = await resolveDeveloperIdPart(options);
  const baseUrl = await resolveServerBaseUrl(options);
  return { baseUrl, devId };
}

module.exports = { resolveInitOptions };
