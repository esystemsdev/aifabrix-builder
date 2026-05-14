/**
 * Optional infra compose flags (Traefik, pgAdmin, Redis Commander) for config.yaml ↔ startInfra.
 *
 * @fileoverview Effective flag resolution + backfill missing keys after up-infra / setup
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const config = require('../core/config');

/**
 * Resolves effective boolean from CLI option vs config.
 * @param {*} optValue - options.traefik | options.pgAdmin | options.redisAdmin
 * @param {*} cfgValue - cfg.traefik | cfg.pgadmin | cfg.redisCommander
 * @param {boolean} defaultWhenUndef - Default when config value is undefined
 * @returns {boolean}
 */
function resolveInfraOptionalFlag(optValue, cfgValue, defaultWhenUndef = true) {
  if (optValue === true) return true;
  if (optValue === false) return false;
  return cfgValue !== false && (cfgValue === true || defaultWhenUndef);
}

/**
 * Effective optional infra service flags (same resolution as up-infra → startInfra).
 *
 * @param {Object} cfg - Config from {@link config.getConfig}
 * @param {Object} [options] - Commander options (omit for setup-modes)
 * @returns {{ traefik: boolean, pgadmin: boolean, redisCommander: boolean }}
 */
function computeEffectiveInfraOptionalFlags(cfg, options = {}) {
  return {
    traefik: resolveInfraOptionalFlag(options.traefik, cfg.traefik, false),
    pgadmin: resolveInfraOptionalFlag(options.pgAdmin, cfg.pgadmin, true),
    redisCommander: resolveInfraOptionalFlag(options.redisAdmin, cfg.redisCommander, true)
  };
}

/**
 * Writes `traefik` / `pgadmin` / `redisCommander` when missing so config matches compose defaults.
 *
 * @param {Object} cfg - Mutable config (updated when save runs)
 * @param {{ traefik: boolean, pgadmin: boolean, redisCommander: boolean }} effective
 * @returns {Promise<void>}
 */
async function persistMissingInfraOptionalServiceFlags(cfg, effective) {
  const keys = ['traefik', 'pgadmin', 'redisCommander'];
  const merged = { ...cfg };
  let dirty = false;
  for (const k of keys) {
    if (typeof merged[k] === 'undefined') {
      merged[k] = effective[k];
      dirty = true;
    }
  }
  if (!dirty) {
    return;
  }
  await config.saveConfig(merged);
  Object.assign(cfg, merged);
}

module.exports = {
  resolveInfraOptionalFlag,
  computeEffectiveInfraOptionalFlags,
  persistMissingInfraOptionalServiceFlags
};
