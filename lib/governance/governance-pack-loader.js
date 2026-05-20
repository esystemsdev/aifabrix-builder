/**
 * @fileoverview Load governance scenario pack YAML from integration folder
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { getIntegrationPath } = require('../utils/paths');

/**
 * Resolve pack file path for test-governance.
 * @param {string} systemKey
 * @param {Object} options
 * @param {string} [options.pack] - Explicit path (absolute or relative to integration root)
 * @param {string} [options.app] - Integration folder override
 * @returns {string}
 */
function resolveGovernancePackPath(systemKey, options = {}) {
  const integrationPath = options.app
    ? path.isAbsolute(options.app)
      ? options.app
      : path.resolve(process.cwd(), options.app)
    : getIntegrationPath(systemKey);

  if (options.pack) {
    const packPath = path.isAbsolute(options.pack)
      ? options.pack
      : path.join(integrationPath, options.pack);
    if (!fs.existsSync(packPath)) {
      throw new Error(`Scenario pack not found: ${packPath}`);
    }
    return packPath;
  }

  const candidates = [
    path.join(integrationPath, 'scenarios', 'default.yaml'),
    path.join(integrationPath, 'scenarios', `${systemKey}-v1.yaml`)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `No scenario pack found under ${path.join(integrationPath, 'scenarios')}. ` +
      'Use --pack <path> (e.g. scenarios/protection-test-v1.yaml).'
  );
}

/**
 * @param {string} packPath
 * @returns {Object}
 */
function loadGovernancePackYaml(packPath) {
  const raw = fs.readFileSync(packPath, 'utf8');
  const doc = yaml.load(raw);
  if (!doc || typeof doc !== 'object') {
    throw new Error(`Invalid scenario pack YAML: ${packPath}`);
  }
  return doc;
}

module.exports = {
  resolveGovernancePackPath,
  loadGovernancePackYaml
};
