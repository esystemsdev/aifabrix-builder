/**
 * @fileoverview Persist operations pillar to dataplane lifecycle (plan 150.0 / 419.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { resolveExternalIntegrationContext } = require('./test-e2e-external');
const { resolveIntegrationAuth } = require('../external-system/integration-auth-context');
const { postValidationRun } = require('../api/validation-run.api');
const { buildExternalDataSourceValidationRequest } = require('../utils/validation-run-request');

/**
 * Optional unit rollup stored in operations.details.reliability.unit.
 * @param {Object} stepResults
 * @returns {Object|undefined}
 */
function buildUnitTestSummary(stepResults) {
  if (!stepResults || stepResults.unit !== true) {
    return undefined;
  }
  return { passed: 1, failed: 0, skipped: 0 };
}

/**
 * POST validation/run runType=operations for each active datasource (persists resultOperations).
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @param {Object} stepResults
 * @returns {Promise<{ persisted: number }>}
 */
async function persistOperationsForSystem(systemKey, options, stepResults) {
  const { systemKey: resolvedKey, keys } = resolveExternalIntegrationContext(systemKey);
  if (keys.length === 0) {
    return { persisted: 0 };
  }

  const { authConfig, dataplaneUrl } = await resolveIntegrationAuth(systemKey, options);

  const timeoutMs = parseInt(String(options.timeout || '120000'), 10) || 120000;
  const unitTestSummary = buildUnitTestSummary(stepResults);
  let persisted = 0;

  for (const dsKey of keys) {
    const body = buildExternalDataSourceValidationRequest({
      systemKey: resolvedKey,
      datasourceKey: dsKey,
      runType: 'operations'
    });
    if (unitTestSummary) {
      body.unitTestSummary = unitTestSummary;
    }

    const res = await postValidationRun(dataplaneUrl, authConfig, body, { timeoutMs });
    if (!res || res.success === false) {
      const msg =
        (res &&
          res.error &&
          (res.error.formattedError || res.error.error || res.error.message)) ||
        res?.formattedError ||
        'Operations lifecycle persist failed';
      throw new Error(`${dsKey}: ${msg}`);
    }
    persisted += 1;
  }

  return { persisted };
}

module.exports = {
  persistOperationsForSystem,
  buildUnitTestSummary
};
