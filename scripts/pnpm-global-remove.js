#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * pnpm global remove with virtual-store repair retry (pnpm 9+ global layout).
 * @fileoverview Used by install-local.js uninstall path
 * @author AI Fabrix Team
 */

const { execSync } = require('child_process');

/**
 * @param {unknown} error - Thrown from execSync
 * @returns {boolean} True when `pnpm i -g` repair may fix the failure
 */
function isPnpmUnexpectedVirtualStoreError(error) {
  const msg =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  return msg.includes('ERR_PNPM_UNEXPECTED_VIRTUAL_STORE');
}

/**
 * @param {NodeJS.ProcessEnv} env - Environment
 * @returns {void} Nothing
 */
function repairPnpmGlobalInstall(env) {
  execSync('pnpm i -g', { stdio: 'inherit', env });
}

/**
 * @param {NodeJS.ProcessEnv} env - pnpm env (e.g. pnpmEnv + CI)
 * @param {string} packageName - Scoped package name to remove globally
 * @returns {void} Nothing
 */
function runPnpmGlobalRemove(env, packageName) {
  try {
    execSync(`pnpm remove -g ${packageName}`, { stdio: 'inherit', env });
  } catch (firstError) {
    if (!isPnpmUnexpectedVirtualStoreError(firstError)) throw firstError;
    console.log(
      '\n⚠️  pnpm global virtual store layout mismatch. Running `pnpm i -g` to repair, then retrying remove...\n'
    );
    repairPnpmGlobalInstall(env);
    execSync(`pnpm remove -g ${packageName}`, { stdio: 'inherit', env });
  }
}

module.exports = { runPnpmGlobalRemove };
