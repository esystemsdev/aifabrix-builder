/**
 * Shared helpers for plan 150.0 Enterprise AI Certification manual tests.
 *
 * @fileoverview Resolve system/datasource keys and run CLI for certification manual tests
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { getProjectRoot } = require('../../lib/utils/paths');
const { listExternalSystems } = require('../../lib/api/external-systems.api');
const { listDatasources, getDatasource } = require('../../lib/api/datasources-core.api');

/**
 * @param {unknown} listRes
 * @returns {unknown[]}
 */
function normalizeListItems(listRes) {
  if (!listRes?.success) {
    return [];
  }
  if (Array.isArray(listRes.data)) {
    return listRes.data;
  }
  const nested = listRes.data?.items ?? listRes.data?.data;
  return Array.isArray(nested) ? nested : [];
}

/**
 * @param {unknown} item
 * @returns {string|null}
 */
function systemKeyFromItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const key = item.key ?? item.id ?? item.systemKey;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/**
 * @param {unknown} item
 * @returns {string|null}
 */
function datasourceKeyFromItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const key = item.key ?? item.id ?? item.sourceKey;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/**
 * @param {string} systemKey
 * @returns {string}
 */
function integrationDirForSystem(systemKey) {
  return path.join(getProjectRoot(), 'integration', systemKey);
}

/**
 * @param {string} systemKey
 * @returns {boolean}
 */
function hasLocalIntegration(systemKey) {
  try {
    return fs.existsSync(path.join(integrationDirForSystem(systemKey), 'application.yaml'));
  } catch {
    return false;
  }
}

/**
 * First published system with a local integration folder, or MANUAL_CERTIFICATION_SYSTEM_KEY when set.
 * @async
 * @param {string|null} dataplaneUrl
 * @param {Object} authConfig
 * @returns {Promise<string|null>}
 */
async function resolveCertificationSystemKey(dataplaneUrl, authConfig) {
  const envKey = String(process.env.MANUAL_CERTIFICATION_SYSTEM_KEY || '').trim();
  if (envKey) {
    return envKey;
  }
  if (!dataplaneUrl) {
    return null;
  }
  const listRes = await listExternalSystems(dataplaneUrl, authConfig, { pageSize: 25 });
  const items = normalizeListItems(listRes);
  for (const item of items) {
    const key = systemKeyFromItem(item);
    if (key && hasLocalIntegration(key)) {
      return key;
    }
  }
  const first = systemKeyFromItem(items[0]);
  return first || null;
}

/**
 * @async
 * @param {string|null} dataplaneUrl
 * @param {Object} authConfig
 * @param {string|null} [systemKey]
 * @returns {Promise<string|null>}
 */
async function resolveFirstDatasourceKey(dataplaneUrl, authConfig, systemKey) {
  if (!dataplaneUrl) {
    return null;
  }
  const listRes = await listDatasources(dataplaneUrl, authConfig, { pageSize: 25 });
  const items = normalizeListItems(listRes);
  for (const item of items) {
    const dsKey = datasourceKeyFromItem(item);
    if (!dsKey) {
      continue;
    }
    if (!systemKey) {
      return dsKey;
    }
    let itemSystem = item.systemKey ?? item.systemIdOrKey;
    if (!itemSystem) {
      const dsRes = await getDatasource(dataplaneUrl, dsKey, authConfig);
      if (dsRes?.success && dsRes.data) {
        itemSystem = dsRes.data.systemKey ?? dsRes.data.systemIdOrKey;
      }
    }
    if (itemSystem === systemKey) {
      return dsKey;
    }
  }
  return datasourceKeyFromItem(items[0]);
}

/**
 * @param {string[]} args - CLI args after `aifabrix`
 * @param {{ timeoutMs?: number, env?: Object }} [options]
 * @returns {import('child_process').SpawnSyncReturns<string>}
 */
function runAifabrixCli(args, options = {}) {
  const projectRoot = getProjectRoot();
  const binPath = path.join(projectRoot, 'bin', 'aifabrix.js');
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 120000,
    env: { ...process.env, ...(options.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

/**
 * @param {import('child_process').SpawnSyncReturns<string>} result
 * @returns {Object|null}
 */
function parseJsonFromCliOutput(result) {
  const out = String(result.stdout || '').trim();
  const start = out.indexOf('{');
  if (start < 0) {
    return null;
  }
  try {
    return JSON.parse(out.slice(start));
  } catch {
    return null;
  }
}

module.exports = {
  normalizeListItems,
  systemKeyFromItem,
  datasourceKeyFromItem,
  hasLocalIntegration,
  resolveCertificationSystemKey,
  resolveFirstDatasourceKey,
  runAifabrixCli,
  parseJsonFromCliOutput
};
