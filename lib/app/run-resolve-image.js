/**
 * Resolve Docker image name/tag for run (config + optional --image override).
 *
 * @fileoverview Shared by checkPrerequisites and container start / docker run fallback
 */

'use strict';

const composeGenerator = require('../utils/compose-generator');
const { parseImageOverride } = require('../utils/parse-image-ref');

/**
 * @param {string} appName
 * @param {Object} appConfig
 * @param {Object} runOptions - runOptions.image overrides config
 * @returns {{ imageName: string, imageTag: string }}
 */
function resolveRunImage(appName, appConfig, runOptions) {
  const imageOverride = runOptions && runOptions.image;
  if (imageOverride) {
    const parsed = parseImageOverride(imageOverride);
    return {
      imageName: parsed ? parsed.name : composeGenerator.getImageName(appConfig, appName),
      imageTag: parsed ? parsed.tag : (appConfig.image && appConfig.image.tag) || 'latest'
    };
  }
  return {
    imageName: composeGenerator.getImageName(appConfig, appName),
    imageTag: (appConfig.image && appConfig.image.tag) || 'latest'
  };
}

module.exports = { resolveRunImage };
