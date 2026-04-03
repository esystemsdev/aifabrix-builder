/**
 * Resolve Docker repository path and tag from application config and optional CLI overrides.
 * Precedence: --image (full ref), --registry CLI, image.registry in manifest, else unqualified name.
 *
 * For refs like localhost:5000/repo without an explicit tag, prefer --image with :tag (parse ambiguity).
 *
 * @fileoverview Shared Docker image reference resolution for run, compose, and version checks
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { parseImageOverride } = require('./parse-image-ref');

/**
 * Repository path without host (same rules as compose-generator getImageName).
 * @param {Object} appConfig - Application configuration
 * @param {string} appName - Application name fallback
 * @returns {string}
 */
function getRepositoryPathFromConfig(appConfig, appName) {
  if (!appConfig || typeof appConfig !== 'object') {
    return appName;
  }
  if (typeof appConfig.image === 'string') {
    return appConfig.image.split(':')[0];
  }
  if (appConfig.image?.name) {
    return appConfig.image.name;
  }
  if (appConfig.app?.key) {
    return appConfig.app.key;
  }
  return appName;
}

/**
 * @param {Object} [appConfig]
 * @returns {string}
 */
function imageTagFromConfig(appConfig) {
  return (appConfig && appConfig.image && appConfig.image.tag) || 'latest';
}

/**
 * Trim and strip trailing slashes from a registry host/prefix. Empty/whitespace → ''.
 * @param {string|undefined|null|number} registry - Registry host or prefix
 * @returns {string}
 */
function normalizeDockerRegistryPrefix(registry) {
  if (registry === null || registry === undefined) {
    return '';
  }
  if (typeof registry !== 'string') {
    return normalizeDockerRegistryPrefix(String(registry));
  }
  const t = registry.trim();
  if (!t) {
    return '';
  }
  return t.replace(/\/+$/, '');
}

/**
 * Effective image repository (may include registry prefix) and tag for Docker.
 * @param {string} appName - Application name
 * @param {Object} appConfig - Loaded application manifest
 * @param {Object} [runOptions] - Run/deploy options
 * @param {string} [runOptions.image] - Full image ref override
 * @param {string} [runOptions.registry] - CLI registry prefix (wins over manifest)
 * @returns {{ imageName: string, imageTag: string }}
 */
function resolveDockerImageRef(appName, appConfig, runOptions = {}) {
  const opts = runOptions || {};
  if (opts.image) {
    const parsed = parseImageOverride(opts.image);
    return {
      imageName: parsed ? parsed.name : getRepositoryPathFromConfig(appConfig, appName),
      imageTag: parsed ? parsed.tag : imageTagFromConfig(appConfig)
    };
  }

  const baseRepo = getRepositoryPathFromConfig(appConfig, appName);
  const imageTag = imageTagFromConfig(appConfig);
  const prefix =
    normalizeDockerRegistryPrefix(opts.registry) ||
    normalizeDockerRegistryPrefix(appConfig?.image?.registry ?? '');
  if (prefix) {
    return { imageName: `${prefix}/${baseRepo}`, imageTag };
  }
  return { imageName: baseRepo, imageTag };
}

/**
 * Full image string for compose when manifest/CLI registry applies; else null (use template defaults).
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {Object} [options] - Run options (image, imageOverride, tag, registry)
 * @returns {string|null}
 */
function resolveComposeImageOverrideString(appName, appConfig, options = {}) {
  if (options.image) return options.image;
  if (options.imageOverride) return options.imageOverride;
  const runOpts = { registry: options.registry, image: undefined };
  if (options.tag) {
    const { imageName } = resolveDockerImageRef(appName, appConfig, runOpts);
    return `${imageName}:${options.tag}`;
  }
  const { imageName, imageTag } = resolveDockerImageRef(appName, appConfig, runOpts);
  const shortName = getRepositoryPathFromConfig(appConfig, appName);
  const shortTag = imageTagFromConfig(appConfig);
  if (imageName === shortName && imageTag === shortTag) {
    return null;
  }
  return `${imageName}:${imageTag}`;
}

module.exports = {
  resolveDockerImageRef,
  resolveComposeImageOverrideString,
  normalizeDockerRegistryPrefix,
  getRepositoryPathFromConfig
};
