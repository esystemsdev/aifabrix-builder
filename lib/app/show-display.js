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
    ? `Source: offline (${summary.path || '—'})`
    : `Source: online (${summary.controllerUrl || '—'})`;
  logger.log(sourceLabel);
  logger.log('');
}

function logApplicationRequired(a) {
  logger.log('📱 Application');
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

function logApplicationExternalIntegration(ei) {
  logger.log('  External integration:');
  logger.log(`    schemaBasePath: ${ei.schemaBasePath}`);
  logger.log(`    systems: [${(ei.systems || []).join(', ')}]`);
  logger.log(`    dataSources: [${(ei.dataSources || []).join(', ')}]`);
  logger.log(chalk.gray('\n  For external system data as on dataplane, run: aifabrix show <appKey> --online or aifabrix app show <appKey>.'));
}

function logApplicationSection(a, isExternal) {
  logApplicationFields(a);
  if (isExternal && a.externalIntegration) {
    logApplicationExternalIntegration(a.externalIntegration);
  }
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
  logger.log('🔗 External system (dataplane)');
  logger.log(`  Dataplane:     ${ext.dataplaneUrl}`);
  logger.log(`  System key:    ${ext.systemKey}`);
  logger.log(`  Display name:  ${ext.displayName}`);
  logger.log(`  Type:          ${ext.type}`);
  logger.log(`  Status:        ${ext.status}`);
  logger.log(`  Version:       ${ext.version ?? '—'}`);
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
 * REST: /api/v1/rest/{systemKey}/docs; MCP: /api/v1/mcp/{systemKey}/{resourceType}/docs per dataSource.
 * @param {Object} ext - External system result (dataplaneUrl, systemKey, dataSources, openapiFiles, openapiEndpoints)
 */
function logExternalSystemServiceLinks(ext) {
  if (!ext || !ext.dataplaneUrl || !ext.systemKey) return;
  const base = ext.dataplaneUrl.replace(/\/$/, '');
  const sk = ext.systemKey;
  const hasOpenApi = (ext.openapiFiles && ext.openapiFiles.length > 0) ||
    (ext.openapiEndpoints && ext.openapiEndpoints.length > 0);
  const dataSources = ext.dataSources || [];
  const hasMcp = dataSources.length > 0;
  if (!hasOpenApi && !hasMcp) return;

  logger.log('  Service links:');
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

function logExternalSystemSection(ext) {
  if (!ext) return;
  logger.log('');
  if (ext.error) {
    logger.log('🔗 External system (dataplane): not available (dataplane unreachable or not found).');
    return;
  }
  logExternalSystemMain(ext);
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

/**
 * Format and print human-readable show output (offline or online).
 * @param {Object} summary - Unified summary (buildOfflineSummaryFromDeployJson or buildOnlineSummary)
 * @param {Object} [options] - Display options
 * @param {boolean} [options.permissionsOnly] - When true, output only source and Permissions section
 */
function display(summary, options = {}) {
  const a = summary.application;
  const roles = summary.roles ?? a.roles ?? [];
  const permissions = summary.permissions ?? a.permissions ?? [];
  const authentication = summary.authentication ?? a.authentication;
  const portalInputConfigurations = summary.portalInputConfigurations ?? a.portalInputConfigurations ?? [];
  const databases = summary.databases ?? a.databases ?? [];
  const dbNames = Array.isArray(databases) ? databases.map((d) => (d && d.name) || d).filter(Boolean) : [];

  logSourceAndHeader(summary);
  if (options.permissionsOnly) {
    logPermissionsSection(permissions, { showWhenEmpty: true });
    logger.log('');
    return;
  }
  logApplicationSection(a, summary.isExternal);
  logRolesSection(roles);
  /* Permissions section shown only when --permissions is set (permissionsOnly mode) */
  logAuthSection(authentication);
  logConfigurationsSection(portalInputConfigurations);
  logDatabasesSection(dbNames);
  logExternalSystemSection(summary.externalSystem);
  logger.log('');
}

module.exports = { display };
