/**
 * Picks the parent directory for platform `builder/<app>` materialization when the project has no
 * `builder/<app>`. Compares the effective config directory (`getAifabrixSystemDir`) to the resolved
 * AI Fabrix home (`getAifabrixHome`, from `AIFABRIX_HOME` or `aifabrix-home` in config.yaml).
 *
 * @fileoverview System builder root parent (config dir vs home override)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');

/**
 * When the effective config directory lies under the resolved AI Fabrix home, keep state (including
 * `builder/`) beside `config.yaml` (e.g. `$HOME/.aifabrix/builder` when `AIFABRIX_HOME=$HOME`).
 * When `aifabrix-home` relocates home outside the config tree, materialize under that home instead.
 *
 * Uses a resolved-path prefix check (not `path.relative`) so "nested under home" is stable across
 * platforms (e.g. sibling paths like `/var/aifabrix` vs `/var/aifabrix-config` must not be treated
 * as nested).
 *
 * @param {string} systemDir - Absolute config/state directory (same as `getAifabrixSystemDir()`).
 * @param {string} homeDir - Absolute AI Fabrix home (`getAifabrixHome()`).
 * @returns {string} Absolute directory whose `builder/` subdir is used
 */
function resolveSystemBuilderParentDir(systemDir, homeDir) {
  const s = path.resolve(systemDir);
  const h = path.resolve(homeDir);
  if (s === h) {
    return s;
  }
  const sep = path.sep;
  const homePrefix = h.endsWith(sep) ? h : `${h}${sep}`;
  const configUnderHome = s.startsWith(homePrefix);
  return configUnderHome ? s : h;
}

module.exports = {
  resolveSystemBuilderParentDir
};
