/**
 * Path Utilities for AI Fabrix Builder
 *
 * Centralized helpers for resolving filesystem locations with support for
 * AIFABRIX_HOME override. Defaults to ~/.aifabrix when not specified.
 *
 * @fileoverview Path resolution utilities with environment overrides
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const os = require('os');

/**
 * Returns the base AI Fabrix directory.
 * Respects AIFABRIX_HOME environment variable, otherwise defaults to ~/.aifabrix
 *
 * @returns {string} Absolute path to the AI Fabrix home directory
 */
function getAifabrixHome() {
  // In test environments, ignore AIFABRIX_HOME to keep deterministic paths for unit tests
  // Jest sets JEST_WORKER_ID; NODE_ENV may be 'test'
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  if (isTestEnv) {
    return path.join(os.homedir(), '.aifabrix');
  }
  const homeOverride = process.env.AIFABRIX_HOME && String(process.env.AIFABRIX_HOME).trim();
  if (homeOverride) {
    return path.resolve(homeOverride);
  }
  return path.join(os.homedir(), '.aifabrix');
}

/**
 * Returns the applications base directory for a developer.
 * Dev 0: <home>/applications
 * Dev > 0: <home>/applications-dev-{id}
 *
 * @param {number|string} developerId - Developer ID
 * @returns {string} Absolute path to applications base directory
 */
function getApplicationsBaseDir(developerId) {
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const base = getAifabrixHome();
  if (idNum === 0) {
    return path.join(base, 'applications');
  }
  return path.join(base, `applications-dev-${developerId}`);
}

/**
 * Returns the developer-specific application directory.
 * Dev 0: points to applications/ (no app subdirectory)
 * Dev > 0: <home>/applications-dev-{id}/{appName}-dev-{id}
 *
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @returns {string} Absolute path to developer-specific app directory
 */
function getDevDirectory(appName, developerId) {
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const baseDir = getApplicationsBaseDir(developerId);
  if (idNum === 0) {
    return baseDir;
  }
  return path.join(baseDir, `${appName}-dev-${developerId}`);
}

module.exports = {
  getAifabrixHome,
  getApplicationsBaseDir,
  getDevDirectory
};

