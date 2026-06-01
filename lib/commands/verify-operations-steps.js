/**
 * @fileoverview verify-operations step runners (plan 150.0).
 */

'use strict';

const { syncLocalIfRequested } = require('./test-e2e-external');
const { cliOptsSkipSync } = require('../utils/cli-sync-options');
const { buildOperationsVerifyStepPlan } = require('./verify-operations-step-plan');
const { runWithVerifyStepProgress } = require('../lifecycle/verify-step-progress');

const STEP_PROGRESS = {
  validation: 'Validating local integration',
  unit: 'Running unit tests',
  integration: 'Running integration tests on dataplane',
  e2e: 'Running E2E tests'
};

/**
 * @param {Object} options
 * @param {Object} uploadCtx
 */
function attachUploadAuthToOptions(options, uploadCtx) {
  if (!uploadCtx?.authConfig || !uploadCtx?.dataplaneUrl) {
    return;
  }
  options.authConfig = uploadCtx.authConfig;
  options.dataplaneUrl = uploadCtx.dataplaneUrl;
  options.silentResolve = true;
}

/**
 * @param {Function} runner
 * @param {Function} isSuccess
 * @param {Object} options
 * @returns {Promise<boolean>}
 */
async function runVerifyStep(runner, isSuccess) {
  const outcome = await runner();
  return isSuccess(outcome);
}

/**
 * @param {Object} stepResults
 * @param {string} key
 * @param {boolean} passed
 * @param {boolean} continueOnFail
 * @returns {boolean} false when the verify flow should stop early
 */
function recordVerifyStep(stepResults, key, passed, continueOnFail) {
  stepResults[key] = passed;
  return passed || continueOnFail;
}

/**
 * @param {Object} stepResults
 * @param {Object} step
 * @param {boolean} continueOnFail
 * @param {Object} options
 * @returns {Promise<boolean>}
 */
async function runTrackedVerifyStep(stepResults, step, continueOnFail, options) {
  const label = STEP_PROGRESS[step.key] || step.key;
  const passed = await runWithVerifyStepProgress(
    label,
    async(progress) => runVerifyStep(() => step.run(progress), step.ok),
    options
  );
  return recordVerifyStep(stepResults, step.key, passed, continueOnFail);
}

/**
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<{ stepResults: Object, hardFailure: boolean, stoppedEarly: boolean }>}
 */
async function runOperationsVerifySteps(systemKey, options) {
  const stepResults = { validation: false, unit: false, integration: false, e2e: false };
  const continueOnFail = options.continue === true;
  const plan = buildOperationsVerifyStepPlan(systemKey, options);

  for (const step of plan.beforeSync) {
    if (!(await runTrackedVerifyStep(stepResults, step, continueOnFail, options))) {
      return { stepResults, hardFailure: true, stoppedEarly: true };
    }
  }

  if (!cliOptsSkipSync(options)) {
    const uploadCtx = await syncLocalIfRequested(systemKey, options);
    attachUploadAuthToOptions(options, uploadCtx);
  }

  for (const step of plan.afterSync) {
    if (!(await runTrackedVerifyStep(stepResults, step, continueOnFail, options))) {
      return { stepResults, hardFailure: true, stoppedEarly: true };
    }
  }

  const e2eLabel = STEP_PROGRESS.e2e;
  stepResults.e2e = await runWithVerifyStepProgress(
    e2eLabel,
    async(progress) => runVerifyStep(() => plan.e2e.run(progress), plan.e2e.ok),
    options
  );
  return { stepResults, hardFailure: !stepResults.e2e, stoppedEarly: false };
}

module.exports = {
  runOperationsVerifySteps
};
