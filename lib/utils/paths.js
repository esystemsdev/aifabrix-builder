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
const fs = require('fs');
const yaml = require('js-yaml');

function safeHomedir() {
  try {
    if (typeof os.homedir === 'function') {
      const hd = os.homedir();
      if (typeof hd === 'string' && hd.length > 0) {
        return hd;
      }
    }
  } catch {
    // ignore
  }
  return process.env.HOME || process.env.USERPROFILE || '/';
}

/**
 * Returns the base AI Fabrix directory.
 * Resolved from config.yaml `aifabrix-home` (stored under OS home).
 * Falls back to ~/.aifabrix when not specified.
 *
 * @returns {string} Absolute path to the AI Fabrix home directory
 */
function getAifabrixHome() {
  try {
    const configPath = path.join(safeHomedir(), '.aifabrix', 'config.yaml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(content) || {};
      const homeOverride = config && typeof config['aifabrix-home'] === 'string' ? config['aifabrix-home'].trim() : '';
      if (homeOverride) {
        return path.resolve(homeOverride);
      }
    }
  } catch {
    // Ignore errors and fall back to default
  }
  return path.join(safeHomedir(), '.aifabrix');
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

