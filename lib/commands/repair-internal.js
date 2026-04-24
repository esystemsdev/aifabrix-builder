/**
 * Internal helpers for repair command: file discovery and datasource list building.
 *
 * @fileoverview Repair discovery and datasource helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');

/** Matches *-datasource-*.(yaml|yml|json) or datasource-*.(yaml|yml|json) */
function isDatasourceFileName(name) {
  if (!/\.(yaml|yml|json)$/i.test(name)) return false;
  return /-datasource-.+\.(yaml|yml|json)$/i.test(name) || /^datasource-.+\.(yaml|yml|json)$/i.test(name);
}

/**
 * Discovers system and datasource files in app directory
 * @param {string} appPath - Application directory path
 * @returns {{ systemFiles: string[], datasourceFiles: string[] }}
 */
function discoverIntegrationFiles(appPath) {
  if (!fs.existsSync(appPath)) {
    return { systemFiles: [], datasourceFiles: [] };
  }
  const entries = fs.readdirSync(appPath);
  const systemFiles = [];
  const datasourceFiles = [];
  for (const name of entries) {
    if (!/^[a-z0-9_.-]+\.(yaml|yml|json)$/i.test(name)) continue;
    if (/-system\.(yaml|yml|json)$/i.test(name)) {
      systemFiles.push(name);
    } else if (isDatasourceFileName(name)) {
      datasourceFiles.push(name);
    }
  }
  systemFiles.sort();
  return { systemFiles, datasourceFiles };
}

/**
 * Builds the effective datasource file list from application.yaml and discovered files.
 * @param {string} appPath - Application directory path
 * @param {string[]} discoveredDatasourceFiles - Filenames from discoverIntegrationFiles
 * @param {string[]} [existingDataSources] - externalIntegration.dataSources from application config
 * @returns {string[]} Deduplicated list of datasource filenames (application order first, then remaining discovered files in directory order)
 */
function buildEffectiveDatasourceFiles(appPath, discoveredDatasourceFiles, existingDataSources) {
  const existing = Array.isArray(existingDataSources) ? existingDataSources : [];
  const seen = new Set();
  const result = [];
  for (const name of existing) {
    if (!name || typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    const filePath = path.join(appPath, trimmed);
    if (fs.existsSync(filePath)) {
      result.push(trimmed);
      seen.add(trimmed);
    } else {
      logger.log(chalk.yellow(`⚠ Datasource file referenced in application.yaml not found: ${trimmed}`));
    }
  }
  for (const name of discoveredDatasourceFiles) {
    if (seen.has(name)) continue;
    const filePath = path.join(appPath, name);
    if (fs.existsSync(filePath)) {
      result.push(name);
      seen.add(name);
    }
  }
  return result;
}

module.exports = {
  discoverIntegrationFiles,
  buildEffectiveDatasourceFiles
};
