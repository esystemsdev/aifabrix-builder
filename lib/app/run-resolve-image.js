/**
 * Resolve Docker image name/tag for run (config + optional --image / --registry overrides).
 *
 * @fileoverview Shared by checkPrerequisites and container start / docker run fallback
 */

'use strict';

const config = require('../core/config');
const { resolveDockerImageRef } = require('../utils/resolve-docker-image-ref');
const { checkImageExists } = require('../utils/app-run-containers');
const { buildDevImageRepositoryPath } = require('../utils/image-name');

/**
 * @param {string} appName
 * @param {Object} appConfig
 * @param {Object} runOptions - runOptions.image / runOptions.registry override config
 * @returns {{ imageName: string, imageTag: string }}
 */
function resolveRunImage(appName, appConfig, runOptions) {
  return resolveDockerImageRef(appName, appConfig, runOptions);
}

/**
 * Resolves which local image to run: developer-scoped ref first when present, else manifest base.
 * With {@link runOptions.base} true, uses manifest base only (no dev-first probe).
 *
 * @async
 * @param {string} appName
 * @param {Object} appConfig
 * @param {Object} [runOptions]
 * @param {string} [runOptions.image] - Full override (skips fallback logic)
 * @param {boolean} [runOptions.base] - When true, manifest base ref only
 * @returns {Promise<{ imageName: string, imageTag: string }>}
 */
async function resolveRunImageWithLocalFallback(appName, appConfig, runOptions = {}) {
  const opts = runOptions || {};
  if (opts.image) {
    return resolveDockerImageRef(appName, appConfig, opts);
  }

  const baseRef = resolveDockerImageRef(appName, appConfig, opts);

  if (opts.base === true) {
    return baseRef;
  }

  const developerId = await config.getDeveloperId();
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  if (!Number.isFinite(idNum) || idNum === 0) {
    return baseRef;
  }

  const tag = baseRef.imageTag;
  const devRepo = buildDevImageRepositoryPath(baseRef.imageName, developerId);
  const devExists = await checkImageExists(devRepo, tag, false);
  if (devExists) {
    return { imageName: devRepo, imageTag: tag };
  }
  const baseExists = await checkImageExists(baseRef.imageName, tag, false);
  if (baseExists) {
    return baseRef;
  }

  throw new Error(
    `Docker image not found (tried ${devRepo}:${tag} then ${baseRef.imageName}:${tag})\n` +
      `Run 'aifabrix build ${appName}' or pull the manifest image, or use --base after pulling the base image.`
  );
}

module.exports = { resolveRunImage, resolveRunImageWithLocalFallback };
