/**
 * Human-readable display for aifabrix show command.
 * Single display function for offline and online (unified summary shape).
 *
 * @fileoverview Display formatting for show command
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');

function logSourceAndHeader(summary) {
  const isOffline = summary.source === 'offline';
  const sourceLabel = isOffline
    ? `🔴 Source: offline (${summary.path || '—'})`
    : `🟢 Source: online (${summary.controllerUrl || '—'})`;
  logger.log(sourceLabel);
  logger.log('');
}

function logApplicationRequired(a) {
  const typeLabel = (a.type && String(a.type).toLowerCase()) || 'webapp';
  logger.log(`📱 Application - ${typeLabel}`);
  logger.log(`  Key:           ${a.key ?? '—'}`);
  logger.log(`  Display name:  ${a.displayName ?? '—'}`);
  logger.log(`  Description:   ${a.description ?? '—'}`);
  logger.log(`  Type:          ${a.type ?? '—'}`);
  const port = (a.port !== undefined && a.port !== null) ? a.port : '—';
  logger.log(`  Port:          ${port}`);
}

const APPLICATION_OPTIONAL_FIELDS = [
  { key: 'deploymentKey', label: 'Deployment' },
  { key: 'image', label: 'Image' },
  { key: 'registryMode', label: 'Registry' },
  { key: 'healthCheck', label: 'Health' },
  { key: 'build', label: 'Build' },
  { key: 'status', label: 'Status' },
  { key: 'url', label: 'URL' },
  { key: 'internalUrl', label: 'Internal URL' }
];

function logApplicationOptional(a) {
  APPLICATION_OPTIONAL_FIELDS.forEach(({ key, label }) => {
    if (a[key] !== undefined) logger.log(`  ${(label + ':').padEnd(16)} ${a[key] ?? '—'}`);
  });
}

function logApplicationFields(a) {
  logApplicationRequired(a);
  logApplicationOptional(a);
}

/** Application section for online + external: Key, Display name, Description, Deployment, Status (no Type; Dataplane block follows). */
function logApplicationFieldsOnlineExternal(a) {
  logger.log('🧷 Application - external');
  logger.log(`  Key:           ${a.key ?? '—'}`);
  logger.log(`  Display name:  ${a.displayName ?? '—'}`);
  logger.log(`  Description:   ${a.description ?? '—'}`);
  logger.log('  Deployment:    —');
  if (a.status !== undefined && a.status !== '—') logger.log(`  Status:        ${a.status}`);
}

/** Application section for offline + external: Key, Display name, Description, Deployment, Status, Version when present. */
function logApplicationFieldsOfflineExternal(a) {
  logger.log('🧷 Application - external');
  logger.log(`  Key:           ${a.key ?? '—'}`);
  logger.log(`  Display name:  ${a.displayName ?? '—'}`);
  logger.log(`  Description:   ${a.description ?? '—'}`);
  logger.log('  Deployment:    —');
  if (a.status !== undefined && a.status !== '—') logger.log(`  Status:        ${a.status}`);
  if (a.version !== undefined && a.version !== null) logger.log(`  Version:       ${a.version}`);
}

function logApplicationExternalIntegration(ei, options = {}) {
  logger.log('  External integration:');
  logger.log(`    schemaBasePath: ${ei.schemaBasePath}`);
  logger.log(`    systems: [${(ei.systems || []).join(', ')}]`);
  logger.log(`    dataSources: [${(ei.dataSources || []).join(', ')}]`);
  if (!options.skipHint) {
    logger.log(chalk.gray('\n  For external system data as on dataplane, run: aifabrix show <appKey> --online or aifabrix app show <appKey>.'));
  }
}

function logApplicationSection(a, summary) {
  const isExternal = summary.isExternal;
  const onlineExternal = summary.source === 'online' && isExternal;
  const offlineExternal = summary.source === 'offline' && isExternal;
  if (onlineExternal) {
    logApplicationFieldsOnlineExternal(a);
  } else if (offlineExternal) {
    logApplicationFieldsOfflineExternal(a);
  } else {
    logApplicationFields(a);
  }
  /* External integration is logged after Dataplane block in display() when external */
}

function logRolesSection(roles) {
  if (roles.length === 0) return;
  logger.log('');
  logger.log('👥 Roles');
  roles.forEach((r) => {
    const ro = typeof r === 'object' ? r : { name: r, value: r };
    const name = ro.name ?? ro.value ?? '—';
    const value = ro.value ?? ro.name ?? '—';
    logger.log(`  • ${name} (${value})`);
    if (ro.description) logger.log(`  \t${ro.description}`);
    if (ro.groups && ro.groups.length > 0) logger.log(`  \tgroups: [${ro.groups.join(', ')}]`);
  });
}

function logPermissionsSection(permissions, opts = {}) {
  const showWhenEmpty = opts.showWhenEmpty || false;
  if (permissions.length === 0 && !showWhenEmpty) return;
  logger.log('');
  logger.log('🛡️ Permissions');
  if (permissions.length === 0) {
    logger.log('  (none)');
    return;
  }
  permissions.forEach((p) => {
    const name = p.name ?? '—';
    const roleList = (p.roles || []).join(', ');
    logger.log(`  • ${name}`);
    logger.log(`  \troles: [${roleList}]`);
    if (p.description) logger.log(`  \t${p.description}`);
  });
}

function logAuthSection(authentication) {
  if (!authentication) return;
  logger.log('');
  logger.log('🔐 Authentication');
  const sso = authentication.enableSSO ? 'enabled' : 'disabled';
  logger.log(`  SSO: ${sso}   type: ${authentication.type ?? '—'}   requiredRoles: [${(authentication.requiredRoles || []).join(', ')}]`);
}

function logConfigurationsSection(portalInputConfigurations) {
  if (portalInputConfigurations.length === 0) return;
  logger.log('');
  logger.log('📝 Configurations');
  portalInputConfigurations.forEach((c) => {
    logger.log(`  ${c.label ?? c.name ?? '—'}:  ${c.value ?? '—'}`);
  });
}

function logDatabasesSection(dbNames) {
  if (dbNames.length === 0) return;
  logger.log('');
  logger.log('🗄️ Databases');
  logger.log(`  ${dbNames.join(', ')}`);
}

function logExternalSystemMain(ext) {
  logger.log('🧩 Dataplane');
  logger.log(`  Version:       ${ext.version ?? '—'}`);
  logger.log(`  Credential:    ${ext.credentialId ?? '—'}`);
  logger.log(`  Status:        ${ext.status ?? '—'}`);
  logger.log(`  API docs:      ${ext.openApiDocsPageUrl ?? ext.apiDocumentUrl ?? '—'}`);
  logger.log(`  MCP server:   ${ext.mcpServerUrl ?? '—'}`);
  logger.log(`  OpenAPI spec:  ${ext.apiDocumentUrl ?? '—'}`);
}

function logExternalSystemDataSources(dataSources) {
  if (!dataSources || dataSources.length === 0) return;
  logger.log('  DataSources:');
  dataSources.forEach((ds) => {
    logger.log(`    • ${ds.key}  ${ds.displayName ?? ''} (systemKey: ${ds.systemKey ?? '—'})`);
  });
}

/**
 * Log OpenAPI and MCP documentation links for external system (dataplane endpoints).
 * Uses openApiDocsPageUrl from dataplane when available; otherwise REST/MCP constructed URLs.
 * @param {Object} ext - External system result (dataplaneUrl, systemKey, dataSources, openapiFiles, openapiEndpoints, openApiDocsPageUrl)
 */
function logExternalSystemServiceLinks(ext) {
  if (!ext || !ext.dataplaneUrl || !ext.systemKey) return;
  const base = ext.dataplaneUrl.replace(/\/$/, '');
  const sk = ext.systemKey;
  const hasOpenApi = (ext.openapiFiles && ext.openapiFiles.length > 0) ||
    (ext.openapiEndpoints && ext.openapiEndpoints.length > 0);
  const dataSources = ext.dataSources || [];
  const hasMcp = dataSources.length > 0;
  const openApiDocsPageUrl = ext.openApiDocsPageUrl;
  if (!hasOpenApi && !hasMcp && !openApiDocsPageUrl) return;

  logger.log('  Service links:');
  if (openApiDocsPageUrl) {
    logger.log(`    OpenAPI docs page: ${openApiDocsPageUrl}`);
  }
  logger.log(`    REST OpenAPI:  ${base}/api/v1/rest/${sk}/docs`);
  if (hasMcp) {
    dataSources.forEach((ds) => {
      const resourceType = ds.key || ds.systemKey || sk;
      logger.log(`    MCP ${resourceType}:  ${base}/api/v1/mcp/${sk}/${resourceType}/docs`);
    });
  }
}

function logExternalSystemApplication(ap) {
  if (!ap) return;
  logger.log('  Application (from dataplane):');
  logger.log(`    key: ${ap.key}   displayName: ${ap.displayName}   type: ${ap.type}`);
  if (ap.roles) logger.log(`    roles: ${Array.isArray(ap.roles) ? ap.roles.join(', ') : ap.roles}`);
  if (ap.permissions) logger.log(`    permissions: ${Array.isArray(ap.permissions) ? ap.permissions.join(', ') : ap.permissions}`);
}

function logExternalSystemSection(ext, options = {}) {
  if (!ext) return;
  if (!options.afterApplication) logger.log('');
  if (ext.error) {
    logger.log('🧩 Dataplane: not available (dataplane unreachable or not found).');
    return;
  }
  logExternalSystemMain(ext);
  if (!options.compact) {
    logExternalSystemDataSources(ext.dataSources);
    logExternalSystemApplication(ext.application);
    if (ext.openapiFiles && ext.openapiFiles.length > 0) {
      logger.log(`  OpenAPI files: ${ext.openapiFiles.length}`);
    }
    if (ext.openapiEndpoints && ext.openapiEndpoints.length > 0) {
      const sample = ext.openapiEndpoints.slice(0, 3).map((e) => `${e.method || 'GET'} ${e.path || e.pathPattern || e}`).join(', ');
      logger.log(`  OpenAPI endpoints: ${ext.openapiEndpoints.length} (e.g. ${sample}${ext.openapiEndpoints.length > 3 ? ' …' : ''})`);
    }
    logExternalSystemServiceLinks(ext);
  }
}

function getDisplayContext(summary) {
  const a = summary.application;
  const databases = summary.databases ?? a.databases ?? [];
  const dbNames = Array.isArray(databases) ? databases.map((d) => (d && d.name) || d).filter(Boolean) : [];
  return {
    a,
    roles: summary.roles ?? a.roles ?? [],
    permissions: summary.permissions ?? a.permissions ?? [],
    authentication: summary.authentication ?? a.authentication,
    portalInputConfigurations: summary.portalInputConfigurations ?? a.portalInputConfigurations ?? [],
    dbNames
  };
}

function displayExternalAppBlock(summary) {
  logger.log('');
  if (summary.externalSystem && !summary.externalSystem.error) {
    logExternalSystemSection(summary.externalSystem, { afterApplication: true, compact: true });
  } else {
    const reason = summary.externalSystem && summary.externalSystem.error ? ` (${summary.externalSystem.error})` : '';
    logger.log(`🧩 Dataplane: not available${reason}`);
  }
  if (summary.application.externalIntegration) {
    logger.log('');
    const skipHint = summary.source === 'online' && summary.externalSystem && !summary.externalSystem.error;
    logApplicationExternalIntegration(summary.application.externalIntegration, { skipHint });
  }
}

/**
 * Format and print human-readable show output (offline or online).
 * @param {Object} summary - Unified summary (buildOfflineSummaryFromDeployJson or buildOnlineSummary)
 * @param {Object} [options] - Display options
 * @param {boolean} [options.permissionsOnly] - When true, output only source and Permissions section
 */
function display(summary, options = {}) {
  const ctx = getDisplayContext(summary);

  logSourceAndHeader(summary);
  if (options.permissionsOnly) {
    logPermissionsSection(ctx.permissions, { showWhenEmpty: true });
    logger.log('');
    return;
  }
  logApplicationSection(ctx.a, summary);
  if (summary.isExternal) displayExternalAppBlock(summary);
  logRolesSection(ctx.roles);
  logAuthSection(ctx.authentication);
  logConfigurationsSection(ctx.portalInputConfigurations);
  logDatabasesSection(ctx.dbNames);
  if (!summary.isExternal) logExternalSystemSection(summary.externalSystem);
  logger.log('');
}

module.exports = { display };
