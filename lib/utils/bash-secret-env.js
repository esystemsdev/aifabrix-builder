/**
 * Map secrets keys `BASH_<NAME>` to process-style env `{ [NAME]: value }` for child_process env.
 * Same naming rule as kv://BASH_* resolution (see secrets-bash-kv.js).
 *
 * @fileoverview BASH-prefixed secret → exported-style env for Docker/subprocess
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const secretsLoad = require('../core/secrets-load');

/**
 * @param {string} suffix - Part after BASH_
 * @returns {boolean}
 */
function isValidExportedName(suffix) {
  return Boolean(suffix && /^[A-Za-z_][A-Za-z0-9_]*$/.test(suffix));
}

/**
 * Collect `BASH_*` entries from a flat or shallow secrets object.
 *
 * @param {Record<string, unknown>|null|undefined} secrets - Merged secrets map (decrypted)
 * @returns {Record<string, string>} e.g. { NPM_TOKEN: '...' } from BASH_NPM_TOKEN
 */
function collectBashPrefixedEnv(secrets) {
  const out = {};
  if (!secrets || typeof secrets !== 'object') return out;
  for (const [k, v] of Object.entries(secrets)) {
    if (typeof k !== 'string' || !k.startsWith('BASH_')) continue;
    if (v === undefined || v === null) continue;
    const str = typeof v === 'string' ? v.trim() : String(v).trim();
    if (!str) continue;
    const suffix = k.slice(5);
    if (!isValidExportedName(suffix)) continue;
    out[suffix] = str;
  }
  return out;
}

/**
 * Overlay for `child_process` `env`: values from primary user `secrets.local.yaml` plus `aifabrix-secrets`
 * for every `BASH_*` key (merged via {@link secretsLoad.loadSecrets}).
 *
 * @param {string|null} [secretsPath] - Optional explicit secrets file (same as resolve)
 * @param {string|null} [appName] - Optional app name for loadSecrets second arg
 * @returns {Promise<Record<string, string>>}
 */
async function getBashPrefixedProcessEnvOverlay(secretsPath = null, appName = null) {
  const secrets = await secretsLoad.loadSecrets(secretsPath, appName);
  return collectBashPrefixedEnv(secrets);
}

module.exports = {
  collectBashPrefixedEnv,
  getBashPrefixedProcessEnvOverlay
};
