/**
 * @fileoverview Map legacy validation runType to contract stage (dataplane 370.07).
 */

'use strict';

/** @typedef {'readiness'|'simulation'|'integration'|'e2e'} ValidationRunStage */

/** @type {Record<string, ValidationRunStage>} */
const RUN_TYPE_TO_STAGE = {
  test: 'readiness',
  integration: 'integration',
  e2e: 'e2e'
};

/**
 * Contract stage for a CLI/API runType (default product mapping).
 * @param {string} runType - test | integration | e2e
 * @returns {ValidationRunStage}
 */
function stageForRunType(runType) {
  const key = String(runType || 'test');
  return RUN_TYPE_TO_STAGE[key] || 'readiness';
}

/**
 * Attach stage to a validation/run POST body when absent.
 * @param {Object} body
 * @param {string} [runType]
 * @returns {Object}
 */
function withStageOnValidationRunBody(body, runType) {
  const out = { ...body };
  const rt = runType || out.runType || 'test';
  if (!out.stage) {
    out.stage = stageForRunType(rt);
  }
  return out;
}

module.exports = {
  RUN_TYPE_TO_STAGE,
  stageForRunType,
  withStageOnValidationRunBody
};
