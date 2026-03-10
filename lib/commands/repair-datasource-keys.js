/**
 * Normalize datasource keys and filenames to canonical form during repair.
 *
 * Key: <systemKey>-<resourceType> or <systemKey>-<resourceType>-2, -3 for duplicates.
 * Filename: <systemKey>-datasource-<suffix>.<ext> where suffix = key without leading systemKey-.
 * Skips keys/filenames that already match the valid pattern (e.g. customer-extra, customer-1).
 *
 * @fileoverview Datasource key and filename normalization for repair
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');

/**
 * Returns suffix from a canonical-format filename: <systemKey>-datasource-<suffix>.<ext>.
 *
 * @param {string} fileName - Filename
 * @param {string} systemKey - System key
 * @returns {string|null} Suffix or null if not in canonical format
 */
function suffixFromCanonicalFilename(fileName, systemKey) {
  const base = path.basename(fileName);
  const ext = path.extname(fileName);
  const withoutExt = base.slice(0, -ext.length);
  const prefix = `${systemKey}-datasource-`;
  if (!withoutExt.startsWith(prefix)) return null;
  return withoutExt.slice(prefix.length) || null;
}

/**
 * Returns true if the key already matches canonical form and should not be changed.
 * Valid: <systemKey>-<resourceType> or <systemKey>-<resourceType>-<extra> (e.g. customer-extra, customer-1).
 * When fileName is provided and is canonical, key may be just the suffix (e.g. record-storage).
 * Invalid (will normalize): key ending with redundant -datasource (e.g. hubspot-demo-companies-datasource).
 *
 * @param {string} key - Datasource key
 * @param {string} systemKey - System key
 * @param {string} [fileName] - Optional filename; if canonical, key can be suffix-only
 * @returns {boolean}
 */
function isKeyAlreadyCanonical(key, systemKey, fileName) {
  if (!key || !systemKey) return false;
  if (fileName && isFilenameAlreadyCanonical(fileName, systemKey)) {
    const suffixFromFile = suffixFromCanonicalFilename(fileName, systemKey);
    if (suffixFromFile && (key === suffixFromFile || key === `${systemKey}-${suffixFromFile}`)) {
      return true;
    }
  }
  if (!key.startsWith(systemKey + '-')) return false;
  const suffix = key.slice(systemKey.length + 1);
  if (!suffix) return false;
  if (suffix.endsWith('-datasource')) return false;
  return true;
}

/**
 * Derives resourceType slug from key: strip systemKey prefix, then strip trailing -datasource if present.
 *
 * @param {string} key - Current datasource key
 * @param {string} systemKey - System key
 * @returns {string}
 */
function slugFromKey(key, systemKey) {
  if (!key || !systemKey || !key.startsWith(systemKey + '-')) return key || '';
  let suffix = key.slice(systemKey.length + 1);
  if (suffix.endsWith('-datasource')) suffix = suffix.slice(0, -'-datasource'.length);
  return suffix || key;
}

/**
 * Returns canonical filename for a datasource: <systemKey>-datasource-<suffix>.<ext>.
 *
 * @param {string} canonicalKey - Canonical datasource key
 * @param {string} systemKey - System key
 * @param {string} ext - File extension including dot (e.g. .json)
 * @returns {string}
 */
function canonicalDatasourceFilename(canonicalKey, systemKey, ext) {
  const suffix = canonicalKey.startsWith(systemKey + '-')
    ? canonicalKey.slice(systemKey.length + 1)
    : canonicalKey;
  return `${systemKey}-datasource-${suffix}${ext}`;
}

/**
 * Returns true if filename already matches canonical pattern <systemKey>-datasource-<suffix>.<ext>.
 *
 * @param {string} fileName - Current filename
 * @param {string} systemKey - System key
 * @returns {boolean}
 */
function isFilenameAlreadyCanonical(fileName, systemKey) {
  const base = path.basename(fileName);
  const ext = path.extname(fileName);
  const withoutExt = base.slice(0, -ext.length);
  const prefix = `${systemKey}-datasource-`;
  if (!withoutExt.startsWith(prefix)) return false;
  const suffix = withoutExt.slice(prefix.length);
  if (!suffix || suffix.endsWith('-datasource')) return false;
  return true;
}

/**
 * Normalizes datasource keys and filenames to canonical form. Runs early in repair.
 * Updates file contents (key property), renames files when needed, and updates variables.externalIntegration.dataSources.
 *
 * @param {string} appPath - Application directory path
 * @param {string[]} datasourceFiles - Current list of datasource filenames
 * @param {string} systemKey - System key
 * @param {Object} variables - Application variables (mutated: externalIntegration.dataSources updated)
 * @param {boolean} dryRun - If true, do not write or rename
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {{ updated: boolean, datasourceFiles: string[] }} Updated flag and new list of datasource filenames
 */
/* eslint-disable max-lines-per-function, max-statements, complexity -- Normalization loops and branching per file */
function normalizeDatasourceKeysAndFilenames(appPath, datasourceFiles, systemKey, variables, dryRun, changes) {
  if (!datasourceFiles || datasourceFiles.length === 0) {
    return { updated: false, datasourceFiles: datasourceFiles || [] };
  }

  const slugCounts = new Map();
  const fileInfos = [];

  for (const fileName of datasourceFiles) {
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    let parsed;
    try {
      parsed = loadConfigFile(filePath);
    } catch (err) {
      fileInfos.push({ fileName, key: null, skip: true });
      continue;
    }
    const key = (parsed && typeof parsed.key === 'string' && parsed.key.trim()) ? parsed.key.trim() : null;
    if (isKeyAlreadyCanonical(key, systemKey, fileName) && isFilenameAlreadyCanonical(fileName, systemKey)) {
      fileInfos.push({ fileName, key, skip: true });
      continue;
    }
    const slug = slugFromKey(key || fileName, systemKey);
    fileInfos.push({
      fileName,
      parsed,
      key,
      slug,
      canonicalKey: null,
      skip: false
    });
  }

  for (const info of fileInfos) {
    if (info.skip) continue;
    const slug = info.slug;
    const n = (slugCounts.get(slug) || 0) + 1;
    slugCounts.set(slug, n);
    info.canonicalKey = n === 1 ? `${systemKey}-${slug}` : `${systemKey}-${slug}-${n}`;
  }

  let updated = false;
  const newDatasourceFiles = [];

  for (const info of fileInfos) {
    if (info.skip) {
      newDatasourceFiles.push(info.fileName);
      continue;
    }
    const { fileName, parsed, canonicalKey } = info;
    const ext = path.extname(fileName);
    const canonicalFileName = canonicalDatasourceFilename(canonicalKey, systemKey, ext);

    if (parsed.key !== canonicalKey) {
      parsed.key = canonicalKey;
      if (!dryRun) writeConfigFile(path.join(appPath, fileName), parsed);
      changes.push(`${fileName}: key → ${canonicalKey}`);
      updated = true;
    }
    if (fileName !== canonicalFileName) {
      const oldPath = path.join(appPath, fileName);
      const newPath = path.join(appPath, canonicalFileName);
      if (!dryRun && fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
      }
      changes.push(`Renamed ${fileName} → ${canonicalFileName}`);
      updated = true;
      newDatasourceFiles.push(canonicalFileName);
    } else {
      newDatasourceFiles.push(fileName);
    }
  }

  if (updated && variables.externalIntegration && Array.isArray(variables.externalIntegration.dataSources)) {
    variables.externalIntegration.dataSources = [...newDatasourceFiles].sort();
  }

  return { updated, datasourceFiles: newDatasourceFiles };
}

module.exports = {
  normalizeDatasourceKeysAndFilenames,
  isKeyAlreadyCanonical,
  slugFromKey,
  canonicalDatasourceFilename,
  isFilenameAlreadyCanonical
};
