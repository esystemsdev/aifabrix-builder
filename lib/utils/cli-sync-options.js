/**
 * @fileoverview Detect skip-sync from Commander options and raw argv (--no-sync → sync: false).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * True when the user passed `--no-sync` or Commander set `sync: false` / `noSync: true`.
 * Do not use for `protection upload --no-sync` (post-upload datasource sync only).
 *
 * @param {Object|null|undefined} options - Commander-parsed options
 * @param {import('commander').Command} [cmd] - Commander command (for rawArgs fallback)
 * @returns {boolean}
 */
function cliOptsSkipSync(options, cmd) {
  if (!options || typeof options !== 'object') {
    return false;
  }
  if (options.noSync === true) {
    return true;
  }
  if (options.sync === false) {
    return true;
  }
  const raw = cmd && Array.isArray(cmd.rawArgs) ? cmd.rawArgs : [];
  return raw.includes('--no-sync');
}

module.exports = {
  cliOptsSkipSync
};
