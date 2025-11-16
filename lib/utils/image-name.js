/**
 * Image name utilities
 *
 * @fileoverview Helper functions for computing developer-scoped Docker image names
 * based on the current developer identifier. Ensures consistent local build naming.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * Builds a developer-scoped image name for local Docker builds.
 * Format: "<base>-dev<developerId>".
 * If developerId is missing, non-numeric, or 0 → "<base>-extra".
 *
 * @function buildDevImageName
 * @param {string} baseName - Base image name (no registry), e.g., "myapp"
 * @param {(string|number|null|undefined)} developerId - Developer identifier
 * @returns {string} Developer-scoped image name
 *
 * @example
 * buildDevImageName('myapp', 123) // "myapp-dev123"
 * buildDevImageName('myapp', '0') // "myapp-extra"
 * buildDevImageName('myapp') // "myapp-extra"
 */
function buildDevImageName(baseName, developerId) {
  const id =
    typeof developerId === 'number'
      ? developerId
      : typeof developerId === 'string'
        ? parseInt(developerId, 10)
        : NaN;

  if (!baseName || typeof baseName !== 'string') {
    throw new Error('Base image name is required and must be a string');
  }

  if (!Number.isFinite(id) || id === 0) {
    return `${baseName}-extra`;
  }

  return `${baseName}-dev${id}`;
}

module.exports = {
  buildDevImageName
};

