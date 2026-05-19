/**
 * @fileoverview Resolve integration/.data/ paths for datasource load/export (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { getCwdIntegrationRoot, getIntegrationRoot } = require('../utils/paths');

const DATA_DIR_NAME = '.data';

/**
 * Absolute path to integration/.data (cwd integration root preferred).
 * @returns {string}
 */
function getIntegrationDataDir() {
  const cwdRoot = getCwdIntegrationRoot();
  const base = cwdRoot || getIntegrationRoot();
  return path.join(base, DATA_DIR_NAME);
}

/**
 * Entity suffix from datasource key and system key.
 * @param {string} systemKey
 * @param {string} datasourceKey
 * @returns {string}
 */
function computeEntitySuffix(systemKey, datasourceKey) {
  const sys = String(systemKey || '').trim();
  const key = String(datasourceKey || '').trim();
  const prefix = `${sys}-`;
  if (sys && key.startsWith(prefix)) {
    return key.slice(prefix.length) || key;
  }
  const lastHyphen = key.lastIndexOf('-');
  if (lastHyphen > 0) {
    return key.slice(lastHyphen + 1);
  }
  return key;
}

/**
 * Default fixture basename (without extension).
 * @param {string} systemKey
 * @param {string} entitySuffix
 * @returns {string}
 */
function defaultDataBasename(systemKey, entitySuffix) {
  return `${systemKey}-data-${entitySuffix}`;
}

/**
 * @param {string} dir
 * @param {string} basename
 * @param {'json'|'ndjson'} format
 * @returns {string}
 */
function dataFilePath(dir, basename, format) {
  const ext = format === 'ndjson' ? '.ndjson' : '.json';
  return path.join(dir, `${basename}${ext}`);
}

/**
 * Infer format from file extension.
 * @param {string} filePath
 * @returns {'json'|'ndjson'}
 */
function inferFormatFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ndjson' || ext === '.jsonl') {
    return 'ndjson';
  }
  return 'json';
}

/**
 * Resolve data file: --file override or default integration/.data paths.
 * @param {Object} opts
 * @param {string} opts.systemKey
 * @param {string} opts.entitySuffix
 * @param {string} [opts.file] - CLI --file
 * @param {'json'|'ndjson'} [opts.format] - explicit format
 * @returns {{ filePath: string, format: 'json'|'ndjson' }}
 */
function resolveDataFilePath(opts) {
  if (opts.file && String(opts.file).trim()) {
    const filePath = path.resolve(String(opts.file).trim());
    const format = opts.format || inferFormatFromPath(filePath);
    return { filePath, format };
  }

  const dir = getIntegrationDataDir();
  const basename = defaultDataBasename(opts.systemKey, opts.entitySuffix);
  const jsonPath = dataFilePath(dir, basename, 'json');
  const ndjsonPath = dataFilePath(dir, basename, 'ndjson');

  if (opts.format === 'json' && fs.existsSync(jsonPath)) {
    return { filePath: jsonPath, format: 'json' };
  }
  if (opts.format === 'ndjson' && fs.existsSync(ndjsonPath)) {
    return { filePath: ndjsonPath, format: 'ndjson' };
  }
  if (!opts.format || opts.format === 'json') {
    if (fs.existsSync(jsonPath)) {
      return { filePath: jsonPath, format: 'json' };
    }
  }
  if (!opts.format || opts.format === 'ndjson') {
    if (fs.existsSync(ndjsonPath)) {
      return { filePath: ndjsonPath, format: 'ndjson' };
    }
  }

  throw new Error(
    `No local data file found. Expected one of:\n  ${jsonPath}\n  ${ndjsonPath}\n` +
      'Use --file <path> to override.'
  );
}

module.exports = {
  getIntegrationDataDir,
  computeEntitySuffix,
  defaultDataBasename,
  inferFormatFromPath,
  resolveDataFilePath
};
