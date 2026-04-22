/**
 * Resolve Docker image name/tag for run (config + optional --image / --registry overrides).
 *
 * @fileoverview Shared by checkPrerequisites and container start / docker run fallback
 */

'use strict';

const { resolveDockerImageRef } = require('../utils/resolve-docker-image-ref');

/**
 * @param {string} appName
 * @param {Object} appConfig
 * @param {Object} runOptions - runOptions.image / runOptions.registry override config
 * @returns {{ imageName: string, imageTag: string }}
 */
function resolveRunImage(appName, appConfig, runOptions) {
  return resolveDockerImageRef(appName, appConfig, runOptions);
}

module.exports = { resolveRunImage };
