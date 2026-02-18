/**
 * AI Fabrix Builder - App Show Command
 *
 * Displays application info from local builder/integration (offline) or from
 * controller (--online). Does not run schema validation; use aifabrix validate for that.
 *
 * @fileoverview App show command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-lines -- show: offline/online summary builders, auth, display wiring */

'use strict';

const path = require('path');
const logger = require('../utils/logger');
const { detectAppType, resolveApplicationConfigPath } = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');
const generator = require('../generator');
const { getConfig, normalizeControllerUrl } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { resolveControllerUrl } = require('../utils/controller-url');
const { resolveEnvironment } = require('../core/config');
const { getApplication } = require('../api/applications.api');
const {
  getExternalSystem,
  getExternalSystemConfig,
  listOpenAPIFiles,
  listOpenAPIEndpoints
} = require('../api/external-systems.api');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { formatApiError } = require('../utils/api-error-handler');
const { formatAuthenticationError } = require('../utils/error-formatters/http-status-errors');
const { display: displayShow } = require('./show-display');

/** Truncate deployment key for display */
const DEPLOYMENT_KEY_TRUNCATE_LEN = 12;

/**
 * Load application config from app path (no validation).
 * Uses resolver + converter; supports application.yaml, application.json, or legacy variables.yaml.
 * @param {string} appPath - Application directory path
 * @returns {Object} Parsed config object
 * @throws {Error} If config not found or invalid
 */
function loadVariablesFromPath(appPath) {
  const configPath = resolveApplicationConfigPath(appPath);
  try {
    const parsed = loadConfigFile(configPath);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Application config is empty or invalid');
    }
    return parsed;
  } catch (error) {
    if (error.message.includes('Application config') || error.message.includes('not found')) throw error;
    throw new Error(`Invalid application config: ${error.message}`);
  }
}

/**
 * Collect portal input configuration entries (label + value; masked as "(masked)" if portalInput.masked).
 * @param {Object} variables - Parsed variables
 * @returns {Array<{label: string, value: string}>}
 */
function getPortalInputConfigurations(variables) {
  const out = [];
  const add = (configList) => {
    if (!configList || !Array.isArray(configList)) return;
    configList.forEach((item) => {
      if (item.portalInput) {
        const label = item.portalInput.label || item.name || item.portalInput.field || '—';
        const value = item.portalInput.masked ? '(masked)' : (item.value ?? '');
        out.push({ label, value });
      }
    });
  };
  add(variables.configuration);
  (variables.conditionalConfiguration || []).forEach((block) => {
    add(block.configuration);
  });
  return out;
}

function truncateDeploymentKey(key) {
  if (!key || key.length <= DEPLOYMENT_KEY_TRUNCATE_LEN) return key ?? '—';
  return `${key.slice(0, DEPLOYMENT_KEY_TRUNCATE_LEN)}...`;
}

function healthStrFromDeploy(deploy) {
  const health = deploy.healthCheck;
  if (!health || !health.path) return '—';
  return `${health.path} (interval ${health.intervalSeconds ?? health.interval ?? 30}s)`;
}

function buildStrFromDeploy(deploy) {
  const build = deploy.build;
  if (!build || (!build.dockerfile && !build.envOutputPath)) return '—';
  return `${build.dockerfile ? 'dockerfile' : '—'}, envOutputPath: ${build.envOutputPath ?? '—'}`;
}

function buildApplicationFromDeploy(deploy) {
  const truncatedDeploy = truncateDeploymentKey(deploy.deploymentKey);
  const application = {
    key: deploy.key ?? '—',
    displayName: deploy.displayName ?? '—',
    description: deploy.description ?? '—',
    type: deploy.type ?? 'webapp',
    deploymentKey: truncatedDeploy,
    image: deploy.image ?? '—',
    registryMode: deploy.registryMode ?? '—',
    port: (deploy.port !== undefined && deploy.port !== null) ? deploy.port : '—',
    healthCheck: healthStrFromDeploy(deploy),
    build: buildStrFromDeploy(deploy)
  };
  const extInt = deploy.externalIntegration;
  if (deploy.type === 'external' && extInt) {
    application.externalIntegration = {
      schemaBasePath: extInt.schemaBasePath,
      systems: extInt.systems || [],
      dataSources: extInt.dataSources || []
    };
  }
  return application;
}

function getDatabasesFromDeploy(deploy) {
  if (Array.isArray(deploy.databases)) {
    return deploy.databases.map((d) => (d && d.name) || d).filter(Boolean);
  }
  if (deploy.requiresDatabase && deploy.databases) {
    return deploy.databases.map((d) => (d && d.name) || d).filter(Boolean);
  }
  return [];
}

/**
 * Build offline summary from deployment manifest (same sections as online).
 * @param {Object} deploy - Parsed deploy JSON
 * @param {string} sourcePath - Path to deploy JSON for display
 * @returns {Object} Summary with application, roles, permissions, etc.
 */
function buildOfflineSummaryFromDeployJson(deploy, sourcePath) {
  const application = buildApplicationFromDeploy(deploy);
  const configList = deploy.configuration || deploy.system?.configuration || [];
  const condConfig = deploy.conditionalConfiguration || deploy.system?.conditionalConfiguration || [];
  const portalInputConfigurations = getPortalInputConfigurations(
    { configuration: configList, conditionalConfiguration: Array.isArray(condConfig) ? condConfig : [] }
  );
  const databases = getDatabasesFromDeploy(deploy);
  const authentication = deploy.authentication ?? deploy.system?.authentication ?? null;
  return {
    source: 'offline',
    path: sourcePath,
    appKey: deploy.key,
    application,
    roles: deploy.roles || [],
    permissions: deploy.permissions || [],
    authentication,
    portalInputConfigurations,
    databases,
    isExternal: deploy.type === 'external'
  };
}

function healthStrFromVariables(variables) {
  const health = variables.healthCheck;
  if (!health || !health.path) return '—';
  return `${health.path} (interval ${health.intervalSeconds || 30}s)`;
}

function buildStrFromVariables(variables) {
  const build = variables.build;
  if (!build) return '—';
  const port = variables.port ?? build.containerPort;
  const portStr = (port !== undefined && port !== null) ? `port ${port}` : '';
  return [build.language || '—', portStr].filter(Boolean).join(', ') || '—';
}

function buildApplicationFromVariables(variables) {
  const app = variables.app || {};
  const deploymentKey = app.deploymentKey;
  const truncatedDeploy = (deploymentKey && deploymentKey.length > DEPLOYMENT_KEY_TRUNCATE_LEN)
    ? `${deploymentKey.slice(0, DEPLOYMENT_KEY_TRUNCATE_LEN)}...`
    : (deploymentKey || '—');
  const application = {
    key: app.key,
    displayName: app.displayName,
    description: app.description,
    type: app.type || 'webapp',
    deploymentKey: truncatedDeploy,
    image: app.image || '—',
    registryMode: app.registryMode || '—',
    port: (app.port !== undefined && app.port !== null) ? app.port : '—',
    healthCheck: healthStrFromVariables(variables),
    build: buildStrFromVariables(variables)
  };
  const extInt = variables.externalIntegration;
  if (app.type === 'external' && extInt) {
    application.externalIntegration = {
      schemaBasePath: extInt.schemaBasePath,
      systems: extInt.systems || [],
      dataSources: extInt.dataSources || []
    };
  }
  return application;
}

/**
 * Build offline summary object from application config (for display and JSON).
 * @param {Object} variables - Parsed application config (application.yaml/application.json)
 * @param {string} sourcePath - Path to application config for display
 * @returns {Object} Summary with application, roles, permissions, etc.
 */
function buildOfflineSummary(variables, sourcePath) {
  const application = buildApplicationFromVariables(variables);
  const app = variables.app || {};
  const databases = variables.requiresDatabase && variables.databases
    ? variables.databases.map((d) => (d && d.name) || d).filter(Boolean)
    : [];
  return {
    source: 'offline',
    path: sourcePath,
    appKey: app.key,
    application,
    roles: variables.roles || [],
    permissions: variables.permissions || [],
    authentication: variables.authentication || null,
    portalInputConfigurations: getPortalInputConfigurations(variables),
    databases,
    isExternal: app.type === 'external'
  };
}

/**
 * Get auth token for show --online (same pattern as list).
 * @param {string} controllerUrl - Controller URL
 * @param {Object} config - Config from getConfig()
 * @returns {Promise<{token: string, actualControllerUrl: string}|null>}
 */
async function getShowAuthToken(controllerUrl, config) {
  const tryController = async(url) => {
    const normalized = normalizeControllerUrl(url);
    const deviceToken = await getOrRefreshDeviceToken(normalized);
    if (deviceToken && deviceToken.token) {
      return { token: deviceToken.token, actualControllerUrl: normalized };
    }
    return null;
  };

  if (controllerUrl) {
    const result = await tryController(controllerUrl);
    if (result) return result;
    const formatted = formatAuthenticationError({
      controllerUrl,
      message: 'No valid authentication found'
    });
    logger.error(formatted);
    throw new Error('Authentication required for --online. Run aifabrix login.');
  }

  if (config.device && typeof config.device === 'object') {
    for (const storedUrl of Object.keys(config.device)) {
      const result = await tryController(storedUrl);
      if (result) return result;
    }
  }

  const formatted = formatAuthenticationError({
    controllerUrl: controllerUrl || undefined,
    message: 'No valid authentication found'
  });
  logger.error(formatted);
  throw new Error('Authentication required for --online. Run aifabrix login.');
}

async function fetchOpenApiLists(dataplaneUrl, appKey, authConfig) {
  let openapiFiles = [];
  let openapiEndpoints = [];
  try {
    const filesRes = await listOpenAPIFiles(dataplaneUrl, appKey, authConfig);
    const filesData = filesRes.data || filesRes;
    openapiFiles = Array.isArray(filesData) ? filesData : (filesData.items || filesData.data || []);
  } catch {
    // optional
  }
  try {
    const endpointsRes = await listOpenAPIEndpoints(dataplaneUrl, appKey, authConfig);
    const endData = endpointsRes.data || endpointsRes;
    openapiEndpoints = Array.isArray(endData) ? endData : (endData.items || endData.data || []);
  } catch {
    // optional
  }
  return { openapiFiles, openapiEndpoints };
}

/**
 * Normalize GET /api/v1/external/systems/{id} response to the entity object.
 * Handles: (1) our API client shape { success, data }; (2) body wrapped in .data by dataplane.
 * @param {Object} systemResponse - Raw response from getExternalSystem
 * @returns {Object|null} Entity object (id, key, displayName, status, config, ...) or null
 */
function normalizeExternalSystemResponse(systemResponse) {
  if (!systemResponse) return null;
  const body = systemResponse.data ?? systemResponse;
  if (!body || typeof body !== 'object') return null;
  return body.data ?? body;
}

function pickExternalDisplayName(res, system, application, appKey) {
  return (res && res.displayName) || system.displayName || application.displayName || appKey;
}

function pickExternalType(res, config, system, application) {
  return (res && res.type) || config.type || system.type || application.type || '—';
}

function pickExternalStatus(system, res) {
  return system.status || (res && res.status) || '—';
}

function pickExternalVersion(res, config, system) {
  return (res && res.version) ?? config.version ?? system.version ?? '—';
}

function resolveExternalSystemMeta(res, config, system, application, appKey) {
  return {
    displayName: pickExternalDisplayName(res, system, application, appKey),
    type: pickExternalType(res, config, system, application),
    status: pickExternalStatus(system, res),
    version: pickExternalVersion(res, config, system)
  };
}

function buildBaseExternalResult(configData, appKey, openapiFiles, openapiEndpoints, res) {
  const system = configData.system || configData;
  const dataSources = configData.dataSources || configData.dataSources || [];
  const application = configData.application || configData.app || {};
  const config = res && res.config && typeof res.config === 'object' ? res.config : {};
  const meta = resolveExternalSystemMeta(res, config, system, application, appKey);
  return {
    dataplaneUrl: null,
    systemKey: appKey,
    displayName: meta.displayName,
    type: meta.type,
    status: meta.status,
    version: meta.version,
    dataSources: dataSources.map((ds) => ({
      key: ds.key,
      displayName: ds.displayName,
      systemKey: ds.systemKey || appKey
    })),
    application: {
      key: application.key || appKey,
      displayName: application.displayName,
      type: application.type,
      roles: application.roles,
      permissions: application.permissions
    },
    openapiFiles,
    openapiEndpoints
  };
}

function applySystemResponseToResult(result, res) {
  result.dataplaneStatus = res.status;
  if (res.credentialId !== undefined && res.credentialId !== null) result.credentialId = res.credentialId;
  if (res.showOpenApiDocs !== undefined) result.showOpenApiDocs = res.showOpenApiDocs;
  if (res.mcpServerUrl !== undefined && res.mcpServerUrl !== null) result.mcpServerUrl = res.mcpServerUrl;
  if (res.apiDocumentUrl !== undefined && res.apiDocumentUrl !== null) result.apiDocumentUrl = res.apiDocumentUrl;
  if (res.openApiDocsPageUrl !== undefined && res.openApiDocsPageUrl !== null) result.openApiDocsPageUrl = res.openApiDocsPageUrl;
}

/**
 * Build external system result from config and optional ExternalSystemResponse.
 * Dataplane GET /api/v1/external/systems/{id} returns: id, key, displayName, description,
 * credentialId, config (optional type, description, dataSources), status, version,
 * showOpenApiDocs, mcpServerUrl, apiDocumentUrl, openApiDocsPageUrl.
 * @param {Object} configData - Config response (system, dataSources, application)
 * @param {string} appKey - Application/system key
 * @param {Array} openapiFiles - OpenAPI files list
 * @param {Array} openapiEndpoints - OpenAPI endpoints list
 * @param {Object} [systemResponse] - Optional GET /api/v1/external/systems/{id} response
 * @returns {Object} Result with dataplaneStatus, credentialId, showOpenApiDocs, URLs when systemResponse present
 */
function buildExternalSystemResult(configData, appKey, openapiFiles, openapiEndpoints, systemResponse) {
  const res = normalizeExternalSystemResponse(systemResponse);
  const result = buildBaseExternalResult(configData, appKey, openapiFiles, openapiEndpoints, res);
  if (res) applySystemResponseToResult(result, res);
  return result;
}

/**
 * Fetch external system section from dataplane (for --online and type external).
 * Calls getExternalSystem (ExternalSystemResponse) and getExternalSystemConfig, then merges into one result.
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} appKey - Application key (system key)
 * @param {Object} authConfig - Auth config
 * @returns {Promise<Object|null>} externalSystem object or null if unreachable
 */
async function fetchExternalSystemFromDataplane(dataplaneUrl, appKey, authConfig) {
  try {
    let systemResponse = null;
    try {
      systemResponse = await getExternalSystem(dataplaneUrl, appKey, authConfig);
    } catch {
      // optional: continue with config only
    }
    const configRes = await getExternalSystemConfig(dataplaneUrl, appKey, authConfig);
    const data = configRes.data || configRes;
    const configData = data.data || data;
    const { openapiFiles, openapiEndpoints } = await fetchOpenApiLists(dataplaneUrl, appKey, authConfig);
    const result = buildExternalSystemResult(
      configData, appKey, openapiFiles, openapiEndpoints, systemResponse
    );
    result.dataplaneUrl = dataplaneUrl;
    return result;
  } catch (error) {
    return { error: error.message || 'dataplane unreachable or not found' };
  }
}

/**
 * Format healthCheck for display (same as offline manifest).
 * @param {Object} health - healthCheck object
 * @returns {string}
 */
function formatHealthCheckForDisplay(health) {
  if (!health) return '—';
  const path = health.path ?? health.probePath ?? '—';
  const interval = health.interval ?? health.intervalSeconds ?? health.probeIntervalInSeconds ?? 30;
  return path !== '—' ? `${path} (interval ${interval}s)` : '—';
}

/**
 * Format build for display (same as offline manifest).
 * @param {Object} build - build object
 * @returns {string}
 */
function formatBuildForDisplay(build) {
  if (!build) return '—';
  const parts = [];
  if (build.language) parts.push(build.language);
  const port = build.port ?? build.localPort;
  if (port !== undefined && port !== null) parts.push(`port ${port}`);
  if (build.dockerfile) parts.push('dockerfile');
  if (build.envOutputPath) parts.push(`envOutputPath: ${build.envOutputPath}`);
  return parts.length ? parts.join(', ') : '—';
}

function getAppAndCfgFromApiApp(apiApp) {
  const app = apiApp.data || apiApp;
  const cfg = app.configuration && typeof app.configuration === 'object' ? app.configuration : {};
  return { app, cfg };
}

function getPortalInputFromAppCfg(app, cfg) {
  const configArray = cfg.configuration || app.configuration;
  const configList = Array.isArray(configArray) ? configArray : [];
  const condConfig = cfg.conditionalConfiguration || app.conditionalConfiguration || [];
  return getPortalInputConfigurations(
    { configuration: configList, conditionalConfiguration: Array.isArray(condConfig) ? condConfig : [] }
  );
}

function resolvePortFromAppCfg(app, cfg) {
  if (cfg.port !== undefined && cfg.port !== null) return cfg.port;
  if (app.port !== undefined && app.port !== null) return app.port;
  return '—';
}

function resolveDatabasesFromAppCfg(app, cfg) {
  if (Array.isArray(cfg.databases)) return cfg.databases;
  if (Array.isArray(app.databases)) return app.databases;
  return [];
}

function pickAppCfg(key, app, cfg, fallback) {
  const v = cfg[key] ?? app[key];
  return v !== undefined && v !== null ? v : fallback;
}

function buildApplicationFromAppCfg(app, cfg, portalInputConfigurations) {
  const deploymentKey = cfg.deploymentKey ?? app.deploymentKey;
  const truncatedDeploy = truncateDeploymentKey(deploymentKey) || (deploymentKey ?? '—');
  const version = pickAppCfg('version', app, cfg, undefined);
  const application = {
    key: pickAppCfg('key', app, cfg, '—'),
    displayName: pickAppCfg('displayName', app, cfg, '—'),
    description: pickAppCfg('description', app, cfg, '—'),
    type: pickAppCfg('type', app, cfg, '—'),
    deploymentKey: truncatedDeploy,
    image: pickAppCfg('image', app, cfg, '—'),
    registryMode: pickAppCfg('registryMode', app, cfg, '—'),
    port: resolvePortFromAppCfg(app, cfg),
    healthCheck: formatHealthCheckForDisplay(cfg.healthCheck ?? app.healthCheck),
    build: formatBuildForDisplay(cfg.build ?? app.build),
    status: pickAppCfg('status', app, cfg, '—'),
    url: pickAppCfg('url', app, cfg, '—'),
    internalUrl: pickAppCfg('internalUrl', app, cfg, '—'),
    roles: cfg.roles ?? app.roles,
    permissions: cfg.permissions ?? app.permissions,
    authentication: cfg.authentication ?? app.authentication,
    portalInputConfigurations,
    databases: resolveDatabasesFromAppCfg(app, cfg)
  };
  if (version !== undefined && version !== null) application.version = version;
  return application;
}

function addExternalIntegrationToApplication(application, app, cfg) {
  const isExternal = (app.type ?? cfg.type) === 'external';
  const extInt = cfg.externalIntegration ?? app.externalIntegration;
  if (!isExternal || !extInt) return;
  application.externalIntegration = {
    schemaBasePath: extInt.schemaBasePath,
    systems: extInt.systems || [],
    dataSources: extInt.dataSources || []
  };
}

function buildApplicationFromApiApp(apiApp) {
  const { app, cfg } = getAppAndCfgFromApiApp(apiApp);
  const portalInputConfigurations = getPortalInputFromAppCfg(app, cfg);
  const application = buildApplicationFromAppCfg(app, cfg, portalInputConfigurations);
  addExternalIntegrationToApplication(application, app, cfg);
  return application;
}

function normalizeExternalSystemForSummary(externalSystem) {
  if (!externalSystem) return null;
  if (!externalSystem.error) return externalSystem;
  return { error: externalSystem.error };
}

/**
 * Build online summary from getApplication response (same application schema as offline).
 * Controller returns Application with nested configuration (ApplicationConfig = full manifest);
 * validate and use app.configuration so we get deploymentKey, healthCheck, build, roles, etc.
 * @param {Object} apiApp - Application from getApplication response (e.g. response.data)
 * @param {string} controllerUrl - Controller URL
 * @param {Object|null} externalSystem - From dataplane when type external
 * @returns {Object} Summary for display/JSON (same shape as offline)
 */
function buildOnlineSummary(apiApp, controllerUrl, externalSystem) {
  const application = buildApplicationFromApiApp(apiApp);
  const roles = application.roles || [];
  const permissions = application.permissions || [];
  const isExternal = application.type === 'external';
  return {
    source: 'online',
    controllerUrl,
    appKey: application.key,
    application,
    roles,
    permissions,
    authentication: application.authentication || null,
    portalInputConfigurations: application.portalInputConfigurations,
    databases: application.databases || [],
    isExternal,
    externalSystem: normalizeExternalSystemForSummary(externalSystem)
  };
}

/**
 * Run show in offline mode: generate manifest (same as aifabrix json) and use it; else fall back to application config.
 * @param {string} appKey - Application key
 * @param {boolean} json - Output as JSON
 * @param {boolean} [permissionsOnly] - When true, output only permissions
 * @throws {Error} If application config not found or invalid
 */
async function runOffline(appKey, json, permissionsOnly) {
  let summary;

  try {
    const { deployment, appPath } = await generator.buildDeploymentManifestInMemory(appKey);
    const sourcePath = path.relative(process.cwd(), appPath) || appPath;
    summary = buildOfflineSummaryFromDeployJson(deployment, sourcePath);
  } catch (_err) {
    const { appPath } = await detectAppType(appKey);
    const configPath = resolveApplicationConfigPath(appPath);
    const variables = loadVariablesFromPath(appPath);
    const sourcePath = path.relative(process.cwd(), configPath) || configPath;
    summary = buildOfflineSummary(variables, sourcePath);
  }

  if (json) {
    if (permissionsOnly) {
      const out = {
        source: summary.source,
        path: summary.path,
        appKey: summary.appKey,
        permissions: summary.permissions || []
      };
      logger.log(JSON.stringify(out, null, 2));
      return;
    }
    const out = {
      source: summary.source,
      path: summary.path,
      appKey: summary.appKey,
      application: {
        ...summary.application,
        roles: summary.roles,
        permissions: summary.permissions,
        authentication: summary.authentication,
        portalInputConfigurations: summary.portalInputConfigurations,
        databases: summary.databases
      }
    };
    logger.log(JSON.stringify(out, null, 2));
    return;
  }
  displayShow(summary, { permissionsOnly: !!permissionsOnly });
}

async function resolveOnlineAuth(controllerUrl) {
  const config = await getConfig();
  const authResult = await getShowAuthToken(controllerUrl, config);
  return { authConfig: { type: 'bearer', token: authResult.token }, authResult };
}

function ensureApplicationResponse(response, appKey, authResult) {
  if (!response.success) {
    if (response.status === 404) {
      throw new Error(`Application "${appKey}" not found on controller.`);
    }
    const formatted = response.formattedError || formatApiError(response, authResult.actualControllerUrl);
    logger.error(formatted);
    throw new Error('Failed to get application from controller.');
  }
  return response.data || response;
}

async function fetchExternalSystemForOnline(controllerUrl, appKey, authConfig) {
  try {
    const environment = await resolveEnvironment();
    const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
    return await fetchExternalSystemFromDataplane(dataplaneUrl, appKey, authConfig);
  } catch (err) {
    return { error: err.message || 'dataplane unreachable or not found' };
  }
}

function outputOnlineJson(summary, permissionsOnly) {
  if (permissionsOnly) {
    const out = {
      source: summary.source,
      controllerUrl: summary.controllerUrl,
      appKey: summary.appKey,
      permissions: summary.permissions || []
    };
    logger.log(JSON.stringify(out, null, 2));
    return;
  }
  const app = summary.application;
  const out = {
    source: summary.source,
    controllerUrl: summary.controllerUrl,
    appKey: summary.appKey,
    application: {
      key: app.key,
      displayName: app.displayName,
      description: app.description,
      type: app.type,
      status: app.status,
      url: app.url,
      internalUrl: app.internalUrl,
      port: app.port,
      configuration: app.configuration,
      roles: app.roles,
      permissions: app.permissions,
      authentication: app.authentication,
      portalInputConfigurations: app.portalInputConfigurations,
      databases: app.databases
    }
  };
  if (app.version !== undefined && app.version !== null) out.application.version = app.version;
  if (summary.externalSystem !== undefined && summary.externalSystem !== null) {
    out.externalSystem = summary.externalSystem && summary.externalSystem.error
      ? { error: summary.externalSystem.error }
      : summary.externalSystem;
  }
  logger.log(JSON.stringify(out, null, 2));
}

/**
 * Run show in online mode: getApplication, optionally dataplane for external, display or JSON.
 * @param {string} appKey - Application key
 * @param {boolean} json - Output as JSON
 * @param {boolean} [permissionsOnly] - When true, output only permissions
 * @throws {Error} On auth failure, 404, or API error
 */
async function runOnline(appKey, json, permissionsOnly) {
  const controllerUrl = await resolveControllerUrl();
  if (!controllerUrl) {
    throw new Error('Controller URL is required for --online. Run aifabrix login to set the controller URL in config.yaml.');
  }
  const { authConfig, authResult } = await resolveOnlineAuth(controllerUrl);
  const response = await getApplication(controllerUrl, appKey, authConfig);
  const apiApp = ensureApplicationResponse(response, appKey, authResult);
  const appData = apiApp.data || apiApp;
  const cfg = appData.configuration && typeof appData.configuration === 'object' ? appData.configuration : {};
  const isExternalApp = appData.type === 'external' || cfg.type === 'external';
  const externalSystem = isExternalApp
    ? await fetchExternalSystemForOnline(controllerUrl, appKey, authConfig)
    : null;
  const summary = buildOnlineSummary(apiApp, authResult.actualControllerUrl, externalSystem);
  if (json) {
    outputOnlineJson(summary, permissionsOnly);
    return;
  }
  displayShow(summary, { permissionsOnly: !!permissionsOnly });
}

/**
 * Show application info (offline by default, or from controller with --online).
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - Options
 * @param {boolean} [options.online] - Fetch from controller
 * @param {boolean} [options.json] - Output as JSON
 * @param {boolean} [options.permissions] - When true, output only permissions (app show --permissions)
 * @throws {Error} If file missing/invalid (offline) or API/auth error (online)
 */
async function showApp(appKey, options = {}) {
  if (!appKey || typeof appKey !== 'string') {
    throw new Error('appKey is required');
  }

  const online = Boolean(options.online);
  const json = Boolean(options.json);
  const permissions = Boolean(options.permissions);

  if (online) {
    await runOnline(appKey, json, permissions);
  } else {
    await runOffline(appKey, json, permissions);
  }
}

module.exports = {
  showApp,
  loadVariablesFromPath,
  getPortalInputConfigurations,
  buildOfflineSummary,
  buildOfflineSummaryFromDeployJson,
  buildOnlineSummary,
  formatHealthCheckForDisplay,
  formatBuildForDisplay,
  getShowAuthToken
};
