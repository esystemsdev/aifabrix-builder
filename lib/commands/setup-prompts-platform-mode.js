/**
 * Setup prompts for platform topology mode (single vs full).
 *
 * @fileoverview Setup platform mode prompt + CLI option normalization
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const inquirer = require('inquirer');
const { normalizeSetupPlatformMode, SETUP_PLATFORM_MODE } = require('../core/setup-platform-mode');

/**
 * Resolve platform mode from CLI options, if provided.
 * @param {Object} [options]
 * @returns {'single'|'full'|null}
 */
function resolvePlatformModeFromOptions(options = {}) {
  const raw = options.platform;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return null;
  }
  const normalized = normalizeSetupPlatformMode(raw);
  // Guard: only accept exact canonical values from CLI; reject unexpected to avoid silent typos.
  const rawNorm = String(raw).trim().toLowerCase();
  if (rawNorm !== 'single' && rawNorm !== 'full') {
    throw new Error('--platform must be single or full (example: aifabrix setup --platform full)');
  }
  return normalized;
}

/**
 * @async
 * @param {Object} [options]
 * @returns {Promise<'single'|'full'>}
 */
async function promptSetupPlatformMode(options = {}) {
  const fromCli = resolvePlatformModeFromOptions(options);
  if (fromCli) return fromCli;

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Platform mode:',
      choices: [
        {
          name: 'Single environment — direct ports (no Traefik front door)',
          value: SETUP_PLATFORM_MODE.SINGLE
        },
        {
          name: 'Full platform — Traefik front door + miso/dev/tst/pro (shared infra)',
          value: SETUP_PLATFORM_MODE.FULL
        }
      ],
      default: SETUP_PLATFORM_MODE.SINGLE
    }
  ]);
  return normalizeSetupPlatformMode(mode);
}

module.exports = {
  resolvePlatformModeFromOptions,
  promptSetupPlatformMode
};

