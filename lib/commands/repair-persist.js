/**
 * Persistence helpers for repair: write config files, regenerate manifest, regenerate README.
 *
 * Extracted from repair.js to keep file size under 500 lines.
 *
 * @fileoverview External integration repair helpers (persistence)
 */

'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');
const { getDeployJsonPath } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { writeConfigFile, writeYamlPreservingComments, isYamlPath } = require('../utils/config-format');
const { backupIntegrationFile } = require('../utils/integration-file-backup');
const { trackRepairWrite } = require('./repair-changed-files');
const logger = require('../utils/logger');
const generator = require('../generator');
const { generateReadmeFromDeployJson } = require('../generator/split-readme');

/**
 * README "Files" section should match integration config format on disk (YAML vs JSON).
 * @param {string} appPath - Integration directory
 * @returns {string} '.yaml' or '.json'
 */
function inferExternalReadmeFileExt(appPath) {
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    const ext = path.extname(configPath).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') return '.yaml';
  } catch {
    /* use default */
  }
  return '.json';
}

async function regenerateManifest(appName, appPath, changes, backupCtx) {
  try {
    const deployPath = getDeployJsonPath(appName, 'external', true);
    trackRepairWrite(deployPath, backupCtx);
    backupIntegrationFile(deployPath, backupCtx);
    const outPath = await generator.generateDeployJson(appName, { appPath });
    changes.push(`Regenerated ${path.basename(outPath)}`);
    return true;
  } catch (err) {
    logger.log(chalk.yellow(`⚠ Manifest regeneration skipped: ${err.message}`));
    return false;
  }
}

/**
 * Regenerates README.md from deployment manifest when options.doc is set.
 * @param {string} appName - Application name
 * @param {string} appPath - Application path
 * @param {Object} options - Options (doc, dryRun)
 * @param {string[]} changes - Array to append change messages to
 * @returns {Promise<boolean>} True if README was regenerated
 */
async function regenerateReadmeIfRequested(appName, appPath, options, changes) {
  if (!options.doc) return false;
  const deployJsonPath = getDeployJsonPath(appName, 'external', true);
  if (!fs.existsSync(deployJsonPath) && !options.dryRun) {
    await regenerateManifest(appName, appPath, changes, options.backupCtx);
  }
  if (!fs.existsSync(deployJsonPath)) return false;
  try {
    const deployment = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
    const fileExt = inferExternalReadmeFileExt(appPath);
    const readmeContent = generateReadmeFromDeployJson(deployment, { fileExt });
    const readmePath = path.join(appPath, 'README.md');
    trackRepairWrite(readmePath, options.backupCtx);
    if (!options.dryRun) {
      backupIntegrationFile(readmePath, options.backupCtx);
      fs.writeFileSync(readmePath, readmeContent, { mode: 0o644, encoding: 'utf8' });
    }
    changes.push('Regenerated README.md from deployment manifest');
    return true;
  } catch (err) {
    logger.log(chalk.yellow(`⚠ Could not regenerate README: ${err.message}`));
    return false;
  }
}

function persistChangesAndRegenerate(opts) {
  const { configPath, variables, appName, appPath, changes, originalYamlContent, backupCtx } = opts;
  trackRepairWrite(configPath, backupCtx);
  backupIntegrationFile(configPath, backupCtx);
  if (originalYamlContent !== null && originalYamlContent !== undefined && typeof originalYamlContent === 'string' && isYamlPath(configPath)) {
    writeYamlPreservingComments(configPath, originalYamlContent, variables);
  } else {
    writeConfigFile(configPath, variables);
  }
  logger.log(formatSuccessLine(`Updated ${path.basename(configPath)}`));
  changes.forEach(c => logger.log(chalk.gray(`  ${c}`)));
  return regenerateManifest(appName, appPath, changes, backupCtx);
}

module.exports = {
  persistChangesAndRegenerate,
  regenerateReadmeIfRequested
};

