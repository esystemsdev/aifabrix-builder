/**
 * @fileoverview Upload local governance scenario YAML packs to dataplane (419.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync
} = require('../internal/fs-real-sync');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { upsertDatasourceGovernancePack } = require('../api/governance-scenario-pack.api');
const { formatSuccessLine, formatWarningLine } = require('../utils/cli-test-layout-chalk');

/**
 * @param {string} scenariosDir
 * @returns {string[]}
 */
function listScenarioYamlFiles(scenariosDir) {
  if (!existsSync(scenariosDir)) return [];
  return readdirSync(scenariosDir)
    .filter(name => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map(name => path.join(scenariosDir, name));
}

/**
 * Extract datasource keys referenced in a pack document.
 * @param {Object} pack
 * @returns {string[]}
 */
function datasourceKeysFromPack(pack) {
  const keys = new Set();
  const scenarios = pack?.spec?.scenarios || [];
  for (const scenario of scenarios) {
    const dsKeys = scenario?.search?.datasourceKeys || [];
    for (const k of dsKeys) {
      if (k && typeof k === 'string') keys.add(k.trim());
    }
  }
  return [...keys];
}

/**
 * @param {string} filePath
 * @returns {Object}
 */
function loadPackFromFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const doc = yaml.load(raw);
  if (!doc || typeof doc !== 'object') {
    throw new Error(`Invalid scenario pack YAML: ${filePath}`);
  }
  return doc;
}

/**
 * Upload scenario packs under integration/<systemKey>/scenarios/ to dataplane.
 * @async
 * @param {string} systemKey
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {{ silent?: boolean }} [opts]
 * @returns {Promise<number>} count of packs uploaded
 */
async function uploadGovernanceScenarioPacks(systemKey, dataplaneUrl, authConfig, opts = {}) {
  const scenariosDir = path.join(getIntegrationPath(systemKey), 'scenarios');
  const files = listScenarioYamlFiles(scenariosDir);
  if (files.length === 0) return 0;

  let uploaded = 0;
  for (const filePath of files) {
    const pack = loadPackFromFile(filePath);
    const dsKeys = datasourceKeysFromPack(pack);
    if (dsKeys.length === 0) {
      if (!opts.silent) {
        logger.log(
          formatWarningLine(
            `Skipping ${path.basename(filePath)} — no datasourceKeys in scenarios`
          )
        );
      }
      continue;
    }
    for (const dsKey of dsKeys) {
      await upsertDatasourceGovernancePack(dataplaneUrl, authConfig, dsKey, pack);
      uploaded += 1;
      if (!opts.silent) {
        logger.log(
          formatSuccessLine(
            `Governance scenario pack uploaded for ${dsKey} (${path.basename(filePath)})`
          )
        );
      }
    }
  }
  return uploaded;
}

/**
 * Write governance scenario packs from dataplane to integration/<systemKey>/scenarios/.
 * @async
 * @param {string} systemKey
 * @param {string[]} datasourceKeys
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @returns {Promise<number>}
 */
async function downloadGovernanceScenarioPacks(
  systemKey,
  datasourceKeys,
  dataplaneUrl,
  authConfig
) {
  const { getDatasourceGovernancePack } = require('../api/governance-scenario-pack.api');
  const scenariosDir = path.join(getIntegrationPath(systemKey), 'scenarios');
  if (!existsSync(scenariosDir)) {
    mkdirSync(scenariosDir, { recursive: true });
  }

  let written = 0;
  for (const dsKey of datasourceKeys) {
    try {
      const row = await getDatasourceGovernancePack(dataplaneUrl, authConfig, dsKey);
      if (!row || !row.pack) continue;
      const packKey = row.packKey || row.pack?.metadata?.key || dsKey;
      const outPath = path.join(scenariosDir, `${packKey}.yaml`);
      writeFileSync(outPath, yaml.dump(row.pack, { lineWidth: 120 }), 'utf8');
      written += 1;
      logger.log(formatSuccessLine(`Scenario pack saved: ${outPath}`));
    } catch (err) {
      logger.log(chalk.gray(`  No scenario pack for ${dsKey}: ${err.message}`));
    }
  }
  return written;
}

/**
 * Download governance packs for all datasource keys on a running manifest.
 * @async
 * @param {string} systemKey
 * @param {Object} manifest
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @returns {Promise<number>}
 */
async function downloadGovernanceScenarioPacksFromManifest(
  systemKey,
  manifest,
  dataplaneUrl,
  authConfig
) {
  const dsKeys = (manifest.dataSources || []).map((ds) => ds && ds.key).filter(Boolean);
  if (dsKeys.length === 0) {
    return 0;
  }
  try {
    return await downloadGovernanceScenarioPacks(systemKey, dsKeys, dataplaneUrl, authConfig);
  } catch (err) {
    logger.log(formatWarningLine(`Governance scenario download skipped: ${err.message}`));
    return 0;
  }
}

module.exports = {
  listScenarioYamlFiles,
  datasourceKeysFromPack,
  loadPackFromFile,
  uploadGovernanceScenarioPacks,
  downloadGovernanceScenarioPacks,
  downloadGovernanceScenarioPacksFromManifest
};
