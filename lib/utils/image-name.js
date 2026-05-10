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
 * Format: "<base>-dev<developerId>" when developerId is a positive integer.
 * If developerId is missing, non-numeric, or 0 → returns baseName (manifest image; no dev suffix).
 *
 * @function buildDevImageName
 * @param {string} baseName - Base image name (no registry), e.g., "myapp"
 * @param {(string|number|null|undefined)} developerId - Developer identifier
 * @returns {string} Developer-scoped image name or base name when id is 0 / absent
 *
 * @example
 * buildDevImageName('myapp', 123) // "myapp-dev123"
 * buildDevImageName('myapp', '0') // "myapp"
 * buildDevImageName('myapp') // "myapp"
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
    return baseName;
  }

  return `${baseName}-dev${id}`;
}

/**
 * Developer-scoped repository path for run/build resolution (may include registry prefix).
 * For qualified paths (slashes), only the last segment gets `-dev<id>`; id 0 returns path unchanged.
 *
 * @param {string} repositoryPath - Full repository path (e.g. "reg/ns/app" or "app")
 * @param {(string|number|null|undefined)} developerId - Developer id from config
 * @returns {string}
 */
function buildDevImageRepositoryPath(repositoryPath, developerId) {
  if (!repositoryPath || typeof repositoryPath !== 'string') {
    throw new Error('Repository path is required and must be a string');
  }
  const idNum =
    typeof developerId === 'number' ? developerId : parseInt(String(developerId), 10);
  if (!Number.isFinite(idNum) || idNum === 0) {
    return repositoryPath;
  }
  const idx = repositoryPath.lastIndexOf('/');
  const tail = idx === -1 ? repositoryPath : repositoryPath.slice(idx + 1);
  const scopedTail = buildDevImageName(tail, developerId);
  if (idx === -1) {
    return scopedTail;
  }
  return `${repositoryPath.slice(0, idx)}/${scopedTail}`;
}

module.exports = {
  buildDevImageName,
  buildDevImageRepositoryPath
};

