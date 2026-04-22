/**
 * Docker Compose Generation Utilities
 *
 * This module handles Docker Compose configuration generation for application running.
 * Separated from app-run.js to maintain file size limits.
 *
 * @fileoverview Docker Compose generation utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fsSync = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const config = require('../core/config');
const { readDatabasePasswords } = require('./compose-db-passwords');
const { getContainerPort } = require('./port-resolver');
const { parseImageOverride } = require('./parse-image-ref');
const { resolveComposeImageOverrideString } = require('./resolve-docker-image-ref');
const { registerComposeHelpers } = require('./compose-handlebars-helpers');
const { isVectorDatabaseName } = require('./compose-vector-helper');
const { resolveMisoEnvironment } = require('./compose-miso-env');
const {
  buildScopedLocalContainerName,
  composeTraefikServiceKey
} = require('./environment-scoped-resources');
const {
  derivePathFromPattern,
  buildDevUsernameForFrontDoorHost,
  expandFrontDoorHostPlaceholders,
  buildTraefikIngressBase,
  computeTraefikStripPathPrefix
} = require('./compose-traefik-ingress-base');
const { parseDeveloperIdNum } = require('./declarative-url-ports');

registerComposeHelpers();
/**
 * Loads and compiles Docker Compose template
 * @param {string} language - Language type
 * @returns {Function} Compiled Handlebars template
 * @throws {Error} If template not found
 */
function loadDockerComposeTemplate(language) {
  // Use getProjectRoot to reliably find templates in all environments
  const { getProjectRoot } = require('./paths');
  const projectRoot = getProjectRoot();
  const templatePath = path.join(projectRoot, 'templates', language, 'docker-compose.hbs');

  if (!fsSync.existsSync(templatePath)) {
    // Provide helpful error message with actual paths checked
    const errorMessage = `Docker Compose template not found for language: ${language}\n` +
      `  Expected path: ${templatePath}\n` +
      `  Project root: ${projectRoot}\n` +
      `  Templates directory: ${path.join(projectRoot, 'templates', language)}\n` +
      `  Global PROJECT_ROOT: ${typeof global !== 'undefined' && global.PROJECT_ROOT ? global.PROJECT_ROOT : 'not set'}`;
    throw new Error(errorMessage);
  }

  const templateContent = fsSync.readFileSync(templatePath, 'utf8');
  return handlebars.compile(templateContent);
}
/**
 * Extracts image name from configuration (same logic as build.js)
 * @param {Object} config - Application configuration
 * @param {string} appName - Application name (fallback)
 * @returns {string} Image name
 */
function getImageName(config, appName) {
  if (typeof config.image === 'string') {
    return config.image.split(':')[0];
  } else if (config.image?.name) {
    return config.image.name;
  } else if (config.app?.key) {
    return config.app.key;
  }
  return appName;
}
/**
 * Builds app configuration section
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {Object} App configuration
 */
function buildAppConfig(appName, config, composeKeyOverride = null) {
  return {
    key: composeKeyOverride || appName,
    name: config.displayName || appName
  };
}
/**
 * Builds image configuration section
 * @param {Object} config - Application configuration
 * @param {string} appName - Application name
 * @param {string} [imageOverride] - Optional full image reference (registry/name:tag) to use instead of config
 * @returns {Object} Image configuration
 */
function buildImageConfig(config, appName, imageOverride) {
  const parsed = imageOverride ? parseImageOverride(imageOverride) : null;
  if (parsed) {
    return { name: parsed.name, tag: parsed.tag };
  }
  const imageName = getImageName(config, appName);
  const imageTag = config.image?.tag || 'latest';
  return {
    name: imageName,
    tag: imageTag
  };
}

/**
 * Docker/local readiness path: same Traefik PathPrefix as url://vdir-public (frontDoorRouting + Plan 117 scope) + suffix.
 * @param {Object} config - Application configuration (application.yaml shape)
 * @param {string|number} devId - Developer id for host expansion
 * @param {Object|null} scopeOpts - Env-scoped Traefik path (effectiveEnvironmentScopedResources, runEnvKey)
 * @param {string|null|undefined} remoteServer - For ${REMOTE_HOST}
 * @param {string|null|undefined} [readinessSuffix] - Path after vdir (default /health/ready or healthCheck.readinessPathSuffix)
 * @returns {string} Absolute path starting with /
 */
function computeAlignedHealthCheckPath(config, devId, scopeOpts, remoteServer, readinessSuffix) {
  const hc = config.healthCheck || {};
  let suffix = '/health/ready';
  if (
    readinessSuffix !== undefined &&
    readinessSuffix !== null &&
    String(readinessSuffix).trim().startsWith('/')
  ) {
    suffix = String(readinessSuffix).trim();
  } else if (typeof hc.readinessPathSuffix === 'string' && hc.readinessPathSuffix.startsWith('/')) {
    suffix = hc.readinessPathSuffix;
  }
  const traefik = buildTraefikIngressBase(config, devId, scopeOpts, remoteServer);
  if (traefik.enabled === true) {
    const p = traefik.path;
    if (!p || p === '/') {
      return suffix;
    }
    return `${String(p).replace(/\/+$/, '')}${suffix}`;
  }
  const fd = config.frontDoorRouting;
  if (!fd || fd.enabled !== true) {
    return suffix;
  }
  const base = derivePathFromPattern(fd.pattern);
  if (!base || base === '/') {
    return suffix;
  }
  return `${String(base).replace(/\/+$/, '')}${suffix}`;
}

/**
 * When `frontDoorRouting.enabled` is true, resolves the same vdir as Traefik labels / url://vdir-public
 * (pattern + optional /dev|/tst from scopeOpts) and prepends it to healthCheck.path unless path already starts with that vdir.
 *
 * @param {Object} config - Application configuration (application.yaml shape)
 * @param {string|number} devId - Developer id
 * @param {Object|null} scopeOpts - Env-scoped Traefik path (effectiveEnvironmentScopedResources, runEnvKey)
 * @param {string|null|undefined} remoteServer - For ${REMOTE_HOST}
 * @param {{ skipVdirMergeWhenPathIsBareHealth?: boolean }} [opts] - When `skipVdirMergeWhenPathIsBareHealth`, path `/health` is left as-is (in-container probe; ingress strips vdir for miso/dataplane). Deployment JSON health paths do **not** use this helper — see `buildHealthCheck` in `builders.js` (YAML paths only).
 * @returns {string} Absolute path starting with /
 */
function resolveHealthCheckPathWithFrontDoorVdir(config, devId, scopeOpts, remoteServer, opts) {
  const hc = config.healthCheck || {};
  const raw = typeof hc.path === 'string' && hc.path.startsWith('/') ? hc.path : '/health';
  const fd = config.frontDoorRouting;
  if (!fd || fd.enabled !== true) {
    return raw;
  }
  if (opts && opts.skipVdirMergeWhenPathIsBareHealth === true && raw === '/health') {
    return raw;
  }
  const traefik = buildTraefikIngressBase(config, devId, scopeOpts, remoteServer);
  if (traefik.enabled !== true) {
    return raw;
  }
  const vdirRaw = traefik.path;
  const vdir =
    !vdirRaw || vdirRaw === '/'
      ? ''
      : String(vdirRaw).replace(/\/+$/, '');
  if (!vdir) {
    return computeAlignedHealthCheckPath(config, devId, scopeOpts, remoteServer, raw);
  }
  if (raw === vdir || raw.startsWith(`${vdir}/`)) {
    return raw;
  }
  return `${vdir}${raw}`;
}

/**
 * Builds health check configuration section
 * @param {Object} config - Application configuration
 * @param {string|number} devId - Developer id
 * @param {Object|null} scopeOpts - Env-scoped compose options
 * @param {string|null|undefined} remoteServer - Remote server URL
 * @returns {Object} Health check configuration
 */
function buildHealthCheckConfig(config, devId, scopeOpts, remoteServer) {
  const hc = config.healthCheck || {};
  const path = resolveHealthCheckPathWithFrontDoorVdir(config, devId, scopeOpts, remoteServer, {
    skipVdirMergeWhenPathIsBareHealth: true
  });
  return {
    path,
    interval: hc.interval || 30,
    bashProbe: hc.bashProbe === true
  };
}

/**
 * Builds developer username from developer ID
 * @param {string|number} devId - Developer ID
 * @returns {string} Developer username (dev, dev01, dev02, ...)
 */
function buildDevUsername(devId) {
  if (devId === undefined || devId === null) {
    return 'dev';
  }
  const devIdString = String(devId);
  if (devIdString === '0') {
    return 'dev';
  }
  const paddedId = devIdString.length === 1 ? devIdString.padStart(2, '0') : devIdString;
  return `dev${paddedId}`;
}

/**
 * Builds Traefik ingress configuration from frontDoorRouting
 * @param {Object} config - Application configuration
 * @param {string|number} devId - Developer ID
 * @param {Object|null} scopeOpts - Env-scoped Traefik path
 * @param {string|null|undefined} remoteServer - From config (for ${REMOTE_HOST})
 * @param {string|undefined} [resolvedHealthPathForStrip] - Compose health path; when omitted, derived via resolveHealthCheckPathWithFrontDoorVdir (same as probe)
 * @returns {Object} Traefik configuration object
 */
function buildTraefikConfig(config, devId, scopeOpts = null, remoteServer = null, resolvedHealthPathForStrip) {
  const base = buildTraefikIngressBase(config, devId, scopeOpts, remoteServer);
  if (!base.enabled) {
    return { enabled: false };
  }
  const resolvedHealth =
    resolvedHealthPathForStrip !== undefined && resolvedHealthPathForStrip !== null
      ? String(resolvedHealthPathForStrip)
      : resolveHealthCheckPathWithFrontDoorVdir(config, devId, scopeOpts, remoteServer, {
        skipVdirMergeWhenPathIsBareHealth: true
      });
  const devNum = parseDeveloperIdNum(devId);
  // Shared builder host: nginx terminates TLS on :443 and proxies HTTP to per-dev Traefik :80 (e.g. 280).
  // Traefik must only attach routers to `web` for developer-id > 0; `websecure`+tls labels without
  // matching certs break routing on Traefik 3.6+ for HTTP traffic (404 on PathPrefix).
  const terminateTlsAtTraefik = base.tls === true && devNum === 0;
  return {
    enabled: true,
    host: base.host,
    path: base.path,
    tls: terminateTlsAtTraefik,
    certStore: terminateTlsAtTraefik ? base.certStore || null : null,
    stripPathPrefix: computeTraefikStripPathPrefix(base.path, resolvedHealth)
  };
}

/**
 * Builds requires configuration section
 * @param {Object} config - Application configuration
 * @returns {Object} Requires configuration
 */
function buildRequiresConfig(config) {
  const hasDatabases = config.requires?.databases || config.databases;
  return {
    requiresDatabase: config.requires?.database || config.services?.database || !!hasDatabases || false,
    requiresStorage: config.requires?.storage || config.services?.storage || false,
    requiresRedis: config.requires?.redis || config.services?.redis || false
  };
}

/**
 * Builds service configuration for template data
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {number} port - Application port
 * @param {string|number} devId - Developer ID
 * @param {Object} [runExtras] - Optional compose run fields
 * @param {string} [runExtras.imageOverride] - Full image reference for run (e.g. from --image)
 * @param {Object|null} [runExtras.scopeOpts] - Traefik / scoped compose options
 * @param {string|null|undefined} [runExtras.remoteServer] - For ${REMOTE_HOST} in frontDoorRouting.host
 * @returns {Object} Service configuration
 */
function buildServiceConfig(appName, config, port, devId, runExtras = {}) {
  const { imageOverride = null, scopeOpts = null, remoteServer = null } = runExtras;
  const containerPortValue = getContainerPort(config, 3000);
  const hostPort = port;
  const useTraefikScope =
    scopeOpts &&
    scopeOpts.effectiveEnvironmentScopedResources &&
    scopeOpts.runEnvKey &&
    (scopeOpts.runEnvKey === 'dev' || scopeOpts.runEnvKey === 'tst');
  const composeAppKey = useTraefikScope
    ? composeTraefikServiceKey(appName, scopeOpts.runEnvKey)
    : null;
  const scopeForHealthAndTraefik = useTraefikScope ? scopeOpts : null;
  const healthCheck = buildHealthCheckConfig(config, devId, scopeForHealthAndTraefik, remoteServer);
  return {
    app: buildAppConfig(appName, config, composeAppKey),
    image: buildImageConfig(config, appName, imageOverride),
    port: containerPortValue, // Container port (for health check and template)
    containerPort: containerPortValue, // Container port (always set, equals containerPort if exists, else port)
    hostPort: hostPort, // Host port (options.port if provided, else config.port)
    healthCheck,
    traefik: buildTraefikConfig(
      config,
      devId,
      scopeForHealthAndTraefik,
      remoteServer,
      healthCheck.path
    ),
    ...buildRequiresConfig(config)
  };
}

/**
 * Builds volumes configuration for template data
 * @param {string} appName - Application name
 * @returns {Object} Volumes configuration
 */
function buildVolumesConfig(appName) {
  return { mountVolume: path.join(process.cwd(), 'data', appName).replace(/\\/g, '/') };
}

/**
 * Builds networks configuration for template data
 * @param {Object} config - Application configuration
 * @returns {Object} Networks configuration with databases array
 */
function buildNetworksConfig(config) {
  return { databases: config.requires?.databases || config.databases || [] };
}

/**
 * Gets developer ID and calculates numeric ID
 * @async
 * @function getDeveloperIdAndNumeric
 * @returns {Promise<Object>} Object with devId and idNum
 */
async function getDeveloperIdAndNumeric() {
  const devId = await config.getDeveloperId();
  return { devId, idNum: typeof devId === 'string' ? parseInt(devId, 10) : devId };
}

/**
 * Builds network and container names
 * @function buildNetworkAndContainerNames
 * @param {string} appName - Application name
 * @param {string|number} devId - Developer ID
 * @param {number} idNum - Numeric developer ID
 * @returns {Object} Object with networkName and containerName
 */
function buildNetworkAndContainerNames(appName, devId, idNum, scopeOpts = null) {
  const networkName = idNum === 0 ? 'infra-aifabrix-network' : `infra-dev${devId}-aifabrix-network`;
  let containerName;
  if (
    scopeOpts &&
    scopeOpts.effectiveEnvironmentScopedResources &&
    scopeOpts.runEnvKey &&
    (scopeOpts.runEnvKey === 'dev' || scopeOpts.runEnvKey === 'tst')
  ) {
    containerName = buildScopedLocalContainerName(appName, devId, idNum, scopeOpts.runEnvKey);
  } else {
    containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${devId}-${appName}`;
  }
  return { networkName, containerName };
}

const { createGenerateDockerCompose } = require('./compose-generate-docker-compose');
async function getRemoteServerForCompose() {
  try {
    const rs = await config.getRemoteServer();
    return rs && String(rs).trim() ? String(rs).trim() : null;
  } catch {
    return null;
  }
}

const generateDockerCompose = createGenerateDockerCompose({
  loadDockerComposeTemplate,
  resolveComposeImageOverrideString,
  getDeveloperIdAndNumeric,
  getRemoteServerForCompose,
  buildNetworkAndContainerNames,
  buildServiceConfig,
  buildVolumesConfig,
  buildNetworksConfig,
  readDatabasePasswords
});

module.exports = {
  generateDockerCompose,
  getImageName,
  derivePathFromPattern,
  buildTraefikConfig,
  computeAlignedHealthCheckPath,
  resolveHealthCheckPathWithFrontDoorVdir,
  buildDevUsername,
  buildDevUsernameForFrontDoorHost,
  expandFrontDoorHostPlaceholders,
  isVectorDatabaseName,
  resolveMisoEnvironment
};
