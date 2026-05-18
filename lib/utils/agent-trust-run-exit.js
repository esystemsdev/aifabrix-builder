/**
 * @fileoverview Exit codes for agent metadata trust CLI runs (plan 143).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { trustDecisionToRowStatus } = require('../datasource/agent-trust-map');
const { deriveSystemStatus } = require('./external-system-system-test-tty');
const { computeExitCodeFromDatasourceTestRun } = require('./datasource-test-run-exit');

/**
 * @param {Object|null|undefined} run
 * @param {Object} [opts]
 * @param {boolean} [opts.warningsAsErrors]
 * @param {boolean} [opts.strict]
 * @returns {number}
 */
function computeExitCodeFromTrustRun(run, opts = {}) {
  if (!run || typeof run !== 'object') return 3;
  const td = run.trustDecision;
  if (run.validationStatus === 'failed' || td === 'notTrusted') return 1;
  if (opts.strict === true && td !== 'trusted') return 1;
  if (opts.warningsAsErrors === true && td === 'usableWithWarnings') return 1;
  if (td === 'trusted' || td === 'usableWithWarnings' || td === 'pending') return 0;
  return 3;
}

/**
 * @param {Array<{ success?: boolean, trustRun?: Object|null }>} rows
 * @param {Object} [opts]
 * @returns {number}
 */
function computeSystemExitCodeFromTrustRows(rows, opts = {}) {
  const list = Array.isArray(rows) ? rows : [];
  let worst = 0;
  for (const row of list) {
    const code = computeExitCodeFromTrustRun(row && row.trustRun, opts);
    if (code === 3) return 3;
    if (code > worst) worst = code;
  }
  if (worst > 0) return worst;
  const synthetic = list.map(r => {
    const tr = r && r.trustRun;
    const st = tr ? trustDecisionToRowStatus(tr.trustDecision) : 'fail';
    return { success: st !== 'fail', datasourceTestRun: { status: st } };
  });
  const rollup = deriveSystemStatus(synthetic);
  return computeExitCodeFromDatasourceTestRun(
    { status: rollup },
    { warningsAsErrors: opts.warningsAsErrors === true }
  );
}

module.exports = {
  computeExitCodeFromTrustRun,
  computeSystemExitCodeFromTrustRows
};
