/**
 * @fileoverview Export path and search body helpers (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { resolveDefaultDataOutputPath, inferFormatFromPath } = require('./local-data-paths');

/**
 * @param {string|undefined} raw
 * @returns {Object|undefined}
 */
function parseFilterJson(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('filter must be a JSON object');
  } catch (err) {
    throw new Error(`Invalid --filter JSON: ${err.message}`);
  }
}

/**
 * @param {string|undefined} raw
 * @returns {string[]|undefined}
 */
function parseFieldsCsv(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return undefined;
  }
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * @param {Object} opts
 * @returns {{ outputPath: string, format: 'json'|'ndjson', limit: number, intent: string, filters: Object|undefined, fields: string[]|undefined }}
 */
function resolveExportOptions(opts) {
  let limit = opts.limit ? parseInt(String(opts.limit), 10) : 1000;
  if (Number.isNaN(limit) || limit < 1) {
    limit = 1000;
  }
  limit = Math.min(limit, 10000);

  const intent = opts.intent || 'validation';
  const filters = parseFilterJson(opts.filter);
  const fields = parseFieldsCsv(opts.fields);

  let outputPath;
  let format = opts.format;
  if (opts.file && String(opts.file).trim()) {
    outputPath = path.resolve(String(opts.file).trim());
    format = format || inferFormatFromPath(outputPath);
  } else {
    const resolved = resolveDefaultDataOutputPath({
      systemKey: opts.systemKey,
      entitySuffix: opts.entitySuffix,
      format: format || 'json'
    });
    outputPath = resolved.filePath;
    format = opts.format || resolved.format;
  }

  return { outputPath, format, limit, intent, filters, fields };
}

module.exports = {
  parseFilterJson,
  parseFieldsCsv,
  resolveExportOptions
};
