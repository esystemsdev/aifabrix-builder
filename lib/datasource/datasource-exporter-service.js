/**
 * @fileoverview Export governed records via Records Search (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { searchRecords } = require('../api/records-search.api');
const { resolveLoadExportContext } = require('./datasource-load-export-context');
const { resolveExportOptions } = require('./datasource-exporter-resolve');

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;

/**
 * @param {Object[]} data
 * @param {string[]|undefined} fields
 * @returns {Object[]}
 */
function projectExportRows(data, fields) {
  if (!fields || !fields.length) {
    return data;
  }
  return data.map(row => {
    if (!row || typeof row !== 'object') {
      return row;
    }
    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata
        : row;
    const out = {};
    fields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(meta, field)) {
        out[field] = meta[field];
      }
    });
    return out;
  });
}

/**
 * @param {string} filePath
 * @param {'json'|'ndjson'} format
 * @param {Object[]} rows
 */
function writeExportFile(filePath, format, rows) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (format === 'ndjson') {
    const body = rows.map(row => JSON.stringify(row)).join('\n');
    fs.writeFileSync(filePath, body.length ? `${body}\n` : '', 'utf8');
    return;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
}

/**
 * @async
 * @param {string} datasourceKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runDatasourceExport(datasourceKey, options = {}) {
  const ctx = await resolveLoadExportContext(datasourceKey, options);
  const resolved = resolveExportOptions({
    ...options,
    systemKey: ctx.systemKey,
    entitySuffix: ctx.entitySuffix
  });

  const searchBody = {
    intent: resolved.intent,
    datasourceKeys: [ctx.datasourceKey],
    searchMode: 'full',
    limit: resolved.limit
  };
  if (resolved.filters) {
    searchBody.filters = resolved.filters;
  }

  const response = await searchRecords(ctx.dataplaneUrl, ctx.authConfig, searchBody);
  const data = Array.isArray(response.data) ? response.data : [];
  const projected = projectExportRows(data, resolved.fields);
  writeExportFile(resolved.outputPath, resolved.format, projected);

  const meta = response.meta && typeof response.meta === 'object' ? response.meta : {};
  const excluded = meta.excluded && typeof meta.excluded === 'object' ? meta.excluded : {};

  return {
    datasourceKey: ctx.datasourceKey,
    systemKey: ctx.systemKey,
    appKey: ctx.appKey,
    outputFile: resolved.outputPath,
    format: resolved.format,
    recordCount: projected.length,
    limit: resolved.limit,
    intent: resolved.intent,
    filters: resolved.filters || null,
    fields: resolved.fields || null,
    meta: { excluded, auditRef: meta.auditRef },
    hitLimitCap: projected.length >= resolved.limit,
    context: ctx
  };
}

module.exports = {
  runDatasourceExport,
  projectExportRows,
  writeExportFile,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
