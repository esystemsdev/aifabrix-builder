/**
 * @fileoverview Detect skip-cert-sync from Commander + legacy option shapes.
 * Commander registers `--no-cert-sync` as `certSync` defaulting to true; `--no-cert-sync` sets `certSync: false`.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * @param {Object|null|undefined} options
 * @returns {boolean}
 */
function cliOptsSkipCertSync(options) {
  if (!options || typeof options !== 'object') return false;
  if (options.noCertSync === true) return true;
  if (options.certSync === false) return true;
  return false;
}

module.exports = { cliOptsSkipCertSync };
