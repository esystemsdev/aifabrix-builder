/**
 * @fileoverview Normalize test-governance Commander flags
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { cliOptsSkipSync } = require('../utils/cli-sync-options');

/**
 * @param {string[]} [raw]
 * @param {string[]} [fallback]
 * @returns {string[]|undefined}
 */
function collectScenarioIds(raw, fallback) {
  const list = Array.isArray(raw) && raw.length > 0 ? raw : fallback;
  if (!list || list.length === 0) {
    return undefined;
  }
  return list.map(id => String(id).trim()).filter(Boolean);
}

/**
 * @param {Object} options
 * @param {import('commander').Command} [cmd]
 * @returns {Object}
 */
function normalizeTestGovernanceCliOptions(options, cmd) {
  const raw = cmd && Array.isArray(cmd.rawArgs) ? cmd.rawArgs : [];
  const has = flag => raw.includes(flag);
  return {
    ...options,
    env: options.env || 'dev',
    verbose: options.verbose === true || has('-v') || has('--verbose'),
    json: options.json === true || has('--json'),
    noSync: cliOptsSkipSync(options, cmd),
    pack: options.pack,
    app: options.app,
    scenarioIds: collectScenarioIds(options.scenario)
  };
}

module.exports = {
  normalizeTestGovernanceCliOptions,
  collectScenarioIds
};
