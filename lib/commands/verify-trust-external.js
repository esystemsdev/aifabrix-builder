/**
 * @fileoverview verify-trust orchestration with product-model rollup (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { runTestTrustForExternalSystem } = require('./test-trust-external');
const {
  VERDICT,
  verdictFromPassed,
  worstConfidencePercent
} = require('../lifecycle/product-model');

/**
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
function mapTrustDatasourceRows(rows) {
  return (rows || []).map(row => {
    const tr = row.trustRun;
    const confidencePercent =
      tr && typeof tr.confidence === 'number' ? Math.round(tr.confidence * 100) : null;
    const verdict = row.success ? VERDICT.VERIFIED : VERDICT.FAILED;
    return {
      datasourceKey: row.key,
      verdict,
      confidencePercent,
      trustDecision: tr?.trustDecision,
      error: row.error
    };
  });
}

/**
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runVerifyTrustForExternalSystem(systemKey, options = {}) {
  const { success, results, systemKey: resolvedKey } = await runTestTrustForExternalSystem(
    systemKey,
    options
  );
  const datasourceRows = mapTrustDatasourceRows(results);
  const confidences = datasourceRows
    .map(r => (typeof r.confidencePercent === 'number' ? r.confidencePercent / 100 : null))
    .filter(v => v !== null);
  const businessContextConfidencePercent = worstConfidencePercent(confidences);
  const verdict = verdictFromPassed(success);

  return {
    systemKey: resolvedKey || systemKey,
    command: 'verify-trust',
    verdict,
    businessContextConfidencePercent,
    datasourceRows,
    results
  };
}

module.exports = {
  runVerifyTrustForExternalSystem,
  mapTrustDatasourceRows
};
