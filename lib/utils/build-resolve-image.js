/**
 * Resolve Docker image repository for `aifabrix build` from manifest or local Docker.
 *
 * @fileoverview When application.yaml omits image, discover repository from `docker images`
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const { execWithDockerEnv } = require('./docker-exec');
const {
  resolveDockerImageRef,
  getRepositoryPathFromConfig
} = require('./resolve-docker-image-ref');

/**
 * True when build should try local Docker to infer the repository path.
 * @param {Object} variables - Loaded application manifest
 * @returns {boolean}
 */
function wantsLocalDockerImageDiscovery(variables) {
  const img = variables && variables.image;
  if (img === undefined || img === null) {
    return true;
  }
  if (typeof img === 'string') {
    return !img.trim();
  }
  if (typeof img !== 'object') {
    return false;
  }
  return Object.keys(img).length === 0;
}

/**
 * @param {string} repoPath
 * @returns {string}
 */
function repositoryTail(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') {
    return '';
  }
  const parts = repoPath.split('/');
  return parts[parts.length - 1] || repoPath;
}

/**
 * Strip dev-scoped or -extra suffix from a Docker repository path.
 * @param {string} repo
 * @returns {string}
 */
function baseRepositoryFromDevScoped(repo) {
  const devMatch = repo.match(/^(.*)-dev\d+$/);
  if (devMatch) {
    return devMatch[1];
  }
  if (repo.endsWith('-extra')) {
    return repo.slice(0, -'-extra'.length);
  }
  return repo;
}

/**
 * @param {string} appName
 * @param {string} repository - Docker repository (no tag)
 * @returns {boolean}
 */
function repoMatchesAppName(appName, repository) {
  const base = baseRepositoryFromDevScoped(repository);
  if (repository === appName || base === appName) {
    return true;
  }
  if (repositoryTail(base) === appName) {
    return true;
  }
  if (repositoryTail(repository) === appName) {
    return true;
  }
  return false;
}

/**
 * @param {string} appName
 * @param {string[]} lines - docker images output lines repository:tag
 * @param {string|number} developerId
 * @returns {string|null}
 */
function pickBaseFromDockerLines(appName, lines, developerId) {
  const candidates = [];
  for (const line of lines) {
    if (!line || line.includes('<none>')) {
      continue;
    }
    const colon = line.lastIndexOf(':');
    const repository = colon > 0 ? line.slice(0, colon) : line;
    if (!repository) {
      continue;
    }
    if (!repoMatchesAppName(appName, repository)) {
      continue;
    }
    candidates.push({
      repository,
      base: baseRepositoryFromDevScoped(repository)
    });
  }
  if (!candidates.length) {
    return null;
  }
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : Number(developerId);
  if (Number.isFinite(idNum) && idNum > 0) {
    const suffix = `-dev${idNum}`;
    const preferred = candidates.find((c) => c.repository.endsWith(suffix));
    if (preferred) {
      return preferred.base;
    }
  }
  return candidates[0].base;
}

/**
 * Infer repository path from local Docker images when manifest has no image block.
 * @param {string} appName
 * @param {string|number} developerId
 * @returns {Promise<string|null>}
 */
async function discoverLocalBaseImageRepository(appName, developerId) {
  try {
    const { stdout } = await execWithDockerEnv(
      'docker images --format "{{.Repository}}:{{.Tag}}"'
    );
    const lines = stdout.trim().split('\n').filter(Boolean);
    return pickBaseFromDockerLines(appName, lines, developerId);
  } catch {
    return null;
  }
}

/**
 * Repository path (may include registry prefix) used for `docker build -t`.
 * @param {string} appName
 * @param {Object} variables - application manifest
 * @param {string|number} developerId
 * @returns {Promise<string>}
 */
async function resolveBuildImageRepositoryName(appName, variables, developerId) {
  if (!wantsLocalDockerImageDiscovery(variables)) {
    return resolveDockerImageRef(appName, variables, {}).imageName;
  }
  const discovered = await discoverLocalBaseImageRepository(appName, developerId);
  if (discovered) {
    logger.log(chalk.blue(`Using image repository from local Docker: ${discovered}`));
    return discovered;
  }
  return getRepositoryPathFromConfig(variables, appName);
}

module.exports = {
  resolveBuildImageRepositoryName,
  wantsLocalDockerImageDiscovery,
  pickBaseFromDockerLines
};
