/**
 * Setup platform topology mode (`single` | `full`).
 *
 * This is distinct from `setupInstallationProfile` (dev/pro password bundle) and from
 * the login/run environment (`dev` | `tst` | `pro`).
 *
 * @fileoverview Setup platform mode normalization and defaults
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/** @enum {string} */
const SETUP_PLATFORM_MODE = Object.freeze({
  SINGLE: 'single',
  FULL: 'full'
});

/**
 * @param {unknown} value
 * @returns {'single'|'full'}
 */
function normalizeSetupPlatformMode(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === SETUP_PLATFORM_MODE.FULL) return SETUP_PLATFORM_MODE.FULL;
  if (raw === 'all' || raw === 'full-platform' || raw === 'platform-full') return SETUP_PLATFORM_MODE.FULL;
  return SETUP_PLATFORM_MODE.SINGLE;
}

/**
 * Derived config flags for a chosen platform mode.
 *
 * - single: direct ports, no front door ingress
 * - full: enable Traefik ingress + env-scoped resources
 *
 * @param {'single'|'full'} mode
 * @returns {{ traefik: boolean, useEnvironmentScopedResources: boolean }}
 */
function flagsForSetupPlatformMode(mode) {
  const m = normalizeSetupPlatformMode(mode);
  return {
    traefik: m === SETUP_PLATFORM_MODE.FULL,
    useEnvironmentScopedResources: m === SETUP_PLATFORM_MODE.FULL
  };
}

module.exports = {
  SETUP_PLATFORM_MODE,
  normalizeSetupPlatformMode,
  flagsForSetupPlatformMode
};

