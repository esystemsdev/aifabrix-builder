/**
 * @fileoverview verify-governance orchestration — DB scenario packs per datasource (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { runTestGovernanceForExternalSystem } = require('./test-governance-external');
const { runVerifyGovernanceFromDbPacks } = require('./verify-governance-db');
const { VERDICT, verdictFromPassed } = require('../lifecycle/product-model');

/**
 * @param {Array<Object>} rows
 * @returns {{ passed: number, total: number }}
 */
function sumEnforcementScenarios(rows) {
  let passed = 0;
  let total = 0;
  for (const row of rows) {
    if (row.scenarios) {
      passed += row.scenarios.passed || 0;
      total += row.scenarios.total || 0;
    }
  }
  return { passed, total };
}

/**
 * @param {Array<Object>} rows
 * @returns {{ policy: number|null, dimension: number|null }}
 */
function aggregateCoverage(rows) {
  const policyVals = rows.map(r => r.policyCoveragePercent).filter(v => typeof v === 'number');
  const dimVals = rows.map(r => r.dimensionCoveragePercent).filter(v => typeof v === 'number');
  const minOr100 = vals => (vals.length === 0 ? null : Math.min(...vals));
  return {
    policy: minOr100(policyVals),
    dimension: minOr100(dimVals)
  };
}

function buildPackOverrideResult(systemKey, result, packPath) {
  const summary = result.summary || {};
  return {
    systemKey,
    command: 'verify-governance',
    verdict: verdictFromPassed(summary.failed === 0),
    policyCoveragePercent: 100,
    dimensionCoveragePercent: 100,
    enforcementScenarios: {
      passed: summary.passed || 0,
      total: summary.total || 0
    },
    packPath,
    legacyResult: result,
    datasourceRows: []
  };
}

function buildDbPackResult(resolvedKey, datasourceRows) {
  const allVerified = datasourceRows.every(r => r.verdict === VERDICT.VERIFIED);
  const coverage = aggregateCoverage(datasourceRows);
  return {
    systemKey: resolvedKey,
    command: 'verify-governance',
    verdict: verdictFromPassed(allVerified),
    policyCoveragePercent: coverage.policy ?? (allVerified ? 100 : 0),
    dimensionCoveragePercent: coverage.dimension ?? (allVerified ? 100 : 0),
    enforcementScenarios: sumEnforcementScenarios(datasourceRows),
    datasourceRows
  };
}

/**
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runVerifyGovernanceForExternalSystem(systemKey, options = {}) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(systemKey).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'verify-governance applies to external integration folders only (integration/<systemKey>/).'
    );
  }

  if (options.pack) {
    const { result, packPath } = await runTestGovernanceForExternalSystem(systemKey, options);
    return buildPackOverrideResult(systemKey, result, packPath);
  }

  const { resolvedKey, datasourceRows } = await runVerifyGovernanceFromDbPacks(systemKey, options);
  if (datasourceRows.length === 0) {
    return {
      systemKey: resolvedKey,
      command: 'verify-governance',
      verdict: VERDICT.FAILED,
      policyCoveragePercent: 0,
      dimensionCoveragePercent: 0,
      enforcementScenarios: { passed: 0, total: 0 },
      datasourceRows: []
    };
  }

  return buildDbPackResult(resolvedKey, datasourceRows);
}

module.exports = {
  runVerifyGovernanceForExternalSystem,
  sumEnforcementScenarios,
  aggregateCoverage
};
