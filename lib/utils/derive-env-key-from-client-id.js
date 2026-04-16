/**
 * Derive pipeline/env segment (dev|tst|pro|miso) from MISO_CLIENTID convention.
 *
 * @fileoverview Plan 122 — optional MISO_PIPELINE_ENV_KEY override
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const ENV_TOKENS = new Set(['dev', 'tst', 'pro', 'miso']);

/**
 * @param {string|null|undefined} clientId - e.g. miso-controller-dev-dataplane
 * @param {string|null|undefined} pipelineOverride - MISO_PIPELINE_ENV_KEY when set in resolved env
 * @returns {string} Lowercase env key (default miso)
 */
function deriveEnvKeyFromClientId(clientId, pipelineOverride) {
  const o = pipelineOverride !== undefined && pipelineOverride !== null
    ? String(pipelineOverride).trim().toLowerCase()
    : '';
  if (o && ENV_TOKENS.has(o)) {
    return o;
  }
  if (!clientId || typeof clientId !== 'string') {
    return 'miso';
  }
  const parts = clientId.split('-').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].toLowerCase();
    if (ENV_TOKENS.has(p)) {
      return p;
    }
  }
  return 'miso';
}

module.exports = {
  deriveEnvKeyFromClientId,
  ENV_TOKENS
};
