/**
 * Shared helpers for installation.log (no append I/O).
 *
 * @fileoverview installation log core utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fsSync = require('fs');
const path = require('path');
const paths = require('./paths');
const { maskSensitiveData } = require('./log-redaction');
const { loadConfigFile } = require('./config-format');
const { resolveDockerImageRef } = require('./resolve-docker-image-ref');
const { parseImageOptions } = require('../commands/up-miso');

let opCounter = 0;
let opDay = '';

let cachedCliVersion = null;

/**
 * @returns {string}
 */
function getCliVersion() {
  if (cachedCliVersion) {
    return cachedCliVersion;
  }
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const raw = fsSync.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    cachedCliVersion = typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    cachedCliVersion = 'unknown';
  }
  return cachedCliVersion;
}

/**
 * @returns {string} e.g. op_20260513_001
 */
function createOperationId() {
  const d = new Date();
  const day = d.toISOString().slice(0, 10).replace(/-/g, '');
  if (day !== opDay) {
    opDay = day;
    opCounter = 0;
  }
  opCounter += 1;
  return `op_${day}_${String(opCounter).padStart(3, '0')}`;
}

/**
 * @param {string} ref
 * @returns {string}
 */
function stripDockerDigest(ref) {
  if (!ref || typeof ref !== 'string') {
    return ref;
  }
  return ref.replace(/@sha256:[a-f0-9]+$/i, '');
}

/**
 * @param {string|undefined} url
 * @returns {string|undefined}
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return undefined;
  }
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    let s = u.toString();
    if (s.endsWith('/')) {
      s = s.slice(0, -1);
    }
    return s;
  } catch {
    return maskSensitiveData(url);
  }
}

/**
 * @param {Object} [options]
 * @returns {'interactive'|'automation'}
 */
function resolveLogMode(options = {}) {
  const assume =
    options.yes === true ||
    options.assumeYes === true ||
    process.env.CI === 'true' ||
    process.env.CI === '1';
  if (assume) {
    return 'automation';
  }
  if (process.stdin && process.stdin.isTTY && process.stdout && process.stdout.isTTY) {
    return 'interactive';
  }
  return 'automation';
}

/**
 * @param {boolean|undefined} optVal
 * @returns {boolean}
 */
function cliBoolExplicit(optVal) {
  return optVal === true || optVal === false;
}

/**
 * @param {string} label
 * @param {boolean} value
 * @param {boolean} fromCli
 * @returns {string}
 */
function infraLine(label, value, fromCli) {
  const src = fromCli ? 'cli override' : 'config';
  return `  ${label}: ${value} (${src})`;
}

/**
 * @param {Object} cfg
 * @param {Object} options
 * @returns {{ lines: string[] }}
 */
function buildInfraSectionLines(cfg, options = {}) {
  const { computeEffectiveInfraOptionalFlags } = require('./infra-optional-service-flags');
  const effective = computeEffectiveInfraOptionalFlags(cfg, options);
  const tls = cfg.tlsEnabled === true;
  const tlsFromCli = cliBoolExplicit(options.tls);
  const lines = [
    'Infra',
    infraLine('traefik', effective.traefik, cliBoolExplicit(options.traefik)),
    infraLine('tlsEnabled', tls, tlsFromCli),
    infraLine('pgAdmin', effective.pgadmin, cliBoolExplicit(options.pgAdmin)),
    infraLine('redisCommander', effective.redisCommander, cliBoolExplicit(options.redisAdmin))
  ];
  return { lines };
}

/**
 * @param {string} appName
 * @returns {Object|null}
 */
function loadBuilderAppVariables(appName) {
  try {
    const dir = paths.getBuilderPath(appName);
    if (!fsSync.existsSync(dir)) {
      return null;
    }
    const configPath = paths.resolveApplicationConfigPath(dir);
    return loadConfigFile(configPath) || {};
  } catch {
    return null;
  }
}

/**
 * @param {string} appName
 * @param {Object} map
 * @param {Object} runOpts
 * @returns {void}
 */
function applyParsedImageMapToRunOpts(appName, map, runOpts) {
  if (appName === 'keycloak' && map.keycloak) {
    runOpts.image = map.keycloak;
  }
  if (appName === 'miso-controller' && map['miso-controller']) {
    runOpts.image = map['miso-controller'];
  }
  if (appName === 'dataplane' && map.dataplane) {
    runOpts.image = map.dataplane;
  }
}

/**
 * @param {string} appName
 * @param {Object} options
 * @returns {Object}
 */
function buildImageResolveOpts(appName, options) {
  const runOpts = {
    registry: options.registry || undefined,
    base: options.base !== false
  };
  const imageList = options.image;
  if (Array.isArray(imageList)) {
    applyParsedImageMapToRunOpts(appName, parseImageOptions(imageList), runOpts);
  } else if (typeof imageList === 'string' && imageList.trim()) {
    const t = imageList.trim();
    if (!t.includes('=') && appName === 'dataplane') {
      runOpts.image = t;
    } else if (t.includes('=')) {
      applyParsedImageMapToRunOpts(appName, parseImageOptions([t]), runOpts);
    }
  }
  return runOpts;
}

/**
 * @param {string} imageRef
 * @returns {string}
 */
function imageRefForLog(imageRef) {
  return stripDockerDigest(String(imageRef).trim());
}

/**
 * @param {string} appName
 * @param {Object} options
 * @returns {string}
 */
function resolveAppImageDisplay(appName, options) {
  const variables = loadBuilderAppVariables(appName);
  if (!variables) {
    return 'unknown';
  }
  try {
    const runOpts = buildImageResolveOpts(appName, options);
    const { imageName, imageTag } = resolveDockerImageRef(appName, variables, runOpts);
    return imageRefForLog(`${imageName}:${imageTag}`);
  } catch {
    return 'unknown';
  }
}

/**
 * @param {string[]} appNames
 * @param {Object} options
 * @returns {Record<string,string>}
 */
function collectPlatformAppImages(appNames, options = {}) {
  /** @type {Record<string,string>} */
  const out = {};
  for (const app of appNames) {
    out[app] = resolveAppImageDisplay(app, options);
  }
  return out;
}

/**
 * @param {Record<string,string>} platformApps
 * @returns {string}
 */
function derivePlatformVersion(platformApps) {
  const tags = new Set();
  for (const ref of Object.values(platformApps)) {
    if (!ref || ref === 'unknown') {
      continue;
    }
    const noDig = stripDockerDigest(ref);
    const idx = noDig.lastIndexOf(':');
    if (idx <= 0 || idx >= noDig.length - 1) {
      continue;
    }
    const tag = noDig.slice(idx + 1);
    if (!tag.includes('/')) {
      tags.add(tag);
    }
  }
  if (tags.size === 0) {
    return 'unknown';
  }
  return [...tags].sort().join('|');
}

module.exports = {
  getCliVersion,
  createOperationId,
  stripDockerDigest,
  sanitizeUrl,
  resolveLogMode,
  buildInfraSectionLines,
  collectPlatformAppImages,
  derivePlatformVersion
};
