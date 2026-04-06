/**
 * Plan 117 URL path prefix for url://public (dev/tst only when gated).
 *
 * @fileoverview baseEffective ∧ derived envKey ∈ {dev,tst}
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {boolean} useEnvironmentScopedResources - config gate
 * @param {boolean} appEnvironmentScopedResources - application.yaml
 * @param {string} derivedEnvKey - from client id (dev|tst|pro|miso)
 * @returns {string} '' | '/dev' | '/tst'
 */
function computePublicUrlPathPrefix(useEnvironmentScopedResources, appEnvironmentScopedResources, derivedEnvKey) {
  const baseEffective = Boolean(useEnvironmentScopedResources) && Boolean(appEnvironmentScopedResources);
  if (!baseEffective) {
    return '';
  }
  const k = String(derivedEnvKey || '').toLowerCase();
  if (k === 'dev') {
    return '/dev';
  }
  if (k === 'tst') {
    return '/tst';
  }
  return '';
}

module.exports = {
  computePublicUrlPathPrefix
};
