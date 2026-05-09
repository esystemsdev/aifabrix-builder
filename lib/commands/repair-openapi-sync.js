/**
 * Upload OpenAPI specs (integration/<systemKey>/openapi/*.json) to dataplane so MCP generation
 * can resolve `openapi.documentKey` and store mcpContract per datasource.
 *
 * This is a *repair* action: upload should remain non-mutating.
 *
 * @fileoverview Repair action: sync OpenAPI files for MCP
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');

const { resolveControllerUrl } = require('../utils/controller-url');
const { getDeploymentAuth, requireBearerForDataplanePipeline } = require('../utils/token-manager');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { uploadFileAs } = require('../utils/file-upload');
const { listOpenAPIFiles } = require('../api/external-systems.api');

async function fileExistsAsync(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveDataplaneAndAuth(systemKey) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, systemKey);
  requireBearerForDataplanePipeline(authConfig);
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig, { silent: true });
  return { dataplaneUrl, authConfig };
}

function documentKeyToLocalOpenApiPath(appPath, systemKey, documentKey) {
  const openapiDir = path.join(appPath, 'openapi');
  const suffix = documentKey.startsWith(systemKey + '-') ? documentKey.slice(systemKey.length + 1) : documentKey;
  return path.join(openapiDir, `${suffix}.json`);
}

async function uploadOneOpenApiFile(dataplaneUrl, authConfig, systemKey, localPath, documentKey) {
  const url =
    `${dataplaneUrl.replace(/\/$/, '')}` +
    `/api/v1/openapi/upload?systemIdOrKey=${encodeURIComponent(systemKey)}`;
  const res = await uploadFileAs(url, localPath, `${documentKey}.json`, 'file', authConfig);
  if (!res || res.success !== true) {
    const msg = res && typeof res.formattedError === 'string'
      ? res.formattedError
      : (res && typeof res.error === 'string' ? res.error : 'OpenAPI upload failed');
    throw new Error(msg);
  }
}

/**
 * @param {Object|null|undefined} res
 * @param {string} fallback
 * @returns {string}
 */
function failureMessageFromApiResult(res, fallback) {
  if (res && typeof res.formattedError === 'string') return res.formattedError;
  if (res && typeof res.error === 'string') return res.error;
  return fallback;
}

/**
 * @param {Object} res
 * @returns {Array<unknown>}
 */
function extractOpenApiFileListItems(res) {
  const data = res && res.data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.items)) return data.items;
  if (res && Array.isArray(res.items)) return res.items;
  return [];
}

async function getExistingOpenApiKeys(dataplaneUrl, systemKey, authConfig) {
  // Note: this endpoint is system-scoped and does not require guessing externalSystemId.
  // Dataplane caps pageSize at 100 (OpenAPI route schema); keep within bounds.
  const res = await listOpenAPIFiles(dataplaneUrl, systemKey, authConfig, { pageSize: 100 });
  if (!res || res.success !== true) {
    throw new Error(failureMessageFromApiResult(res, 'Failed to list OpenAPI files'));
  }
  const keys = new Set();
  for (const it of extractOpenApiFileListItems(res)) {
    if (it && typeof it.key === 'string') keys.add(it.key);
  }
  return keys;
}

function readDatasourceDocumentKey(appPath, datasourceFileName) {
  const dsPath = path.join(appPath, datasourceFileName);
  if (!fs.existsSync(dsPath)) return null;
  const parsed = require('../utils/config-format').loadConfigFile(dsPath);
  const openapi = parsed && typeof parsed.openapi === 'object' && !Array.isArray(parsed.openapi) ? parsed.openapi : null;
  return openapi && typeof openapi.documentKey === 'string' ? openapi.documentKey : null;
}

/**
 * @param {Object} opts
 * @param {string} opts.appPath
 * @param {string} opts.systemKey
 * @param {string[]} opts.datasourceFiles
 * @returns {Promise<{ uploaded: number, skipped: number }>}
 */
async function syncOpenApiFilesForMcp(opts) {
  const { appPath, systemKey, datasourceFiles } = opts;
  const openapiDir = path.join(appPath, 'openapi');
  if (!(await fileExistsAsync(openapiDir))) return { uploaded: 0, skipped: 0 };

  const { dataplaneUrl, authConfig } = await resolveDataplaneAndAuth(systemKey);
  const existingKeys = await getExistingOpenApiKeys(dataplaneUrl, systemKey, authConfig);
  const uploadedKeys = new Set(existingKeys);
  let uploaded = 0;
  let skipped = 0;

  for (const fileName of datasourceFiles || []) {
    const documentKey = readDatasourceDocumentKey(appPath, fileName);
    if (!documentKey || uploadedKeys.has(documentKey)) continue;

    const localPath = documentKeyToLocalOpenApiPath(appPath, systemKey, documentKey);
    if (!(await fileExistsAsync(localPath))) {
      skipped += 1;
      continue;
    }

    await uploadOneOpenApiFile(dataplaneUrl, authConfig, systemKey, localPath, documentKey);
    uploadedKeys.add(documentKey);
    uploaded += 1;
  }

  return { uploaded, skipped };
}

/**
 * Repair wrapper that returns change-log lines (or []).
 * @param {Object} opts
 * @param {boolean} opts.enabled
 * @param {boolean} opts.dryRun
 * @param {string} opts.appPath
 * @param {string} opts.systemKey
 * @param {string[]} opts.datasourceFiles
 * @returns {Promise<string[]>}
 */
async function maybeSyncOpenApiFilesForMcp(opts) {
  if (!opts.enabled || opts.dryRun) return [];
  const r = await syncOpenApiFilesForMcp(opts);
  const lines = [];
  if (r.uploaded > 0) {
    lines.push(`Uploaded ${r.uploaded} OpenAPI file(s) for MCP (keyed by openapi.documentKey)`);
  }
  if (r.skipped > 0) {
    lines.push(
      `Skipped ${r.skipped} OpenAPI upload(s) (missing local integration/<systemKey>/openapi/<name>.json)`
    );
  }
  return lines;
}

module.exports = {
  documentKeyToLocalOpenApiPath,
  maybeSyncOpenApiFilesForMcp,
  syncOpenApiFilesForMcp
};

