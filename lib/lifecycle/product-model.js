/**
 * @fileoverview Enterprise AI Certification product vocabulary (plan 150.0).
 * Defines verdict enums, tier labels, and operational readiness weights — product model drives API mapping.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/** @typedef {'VERIFIED'|'FAILED'|'NOT_VERIFIED'} LifecycleVerdict */

/** @typedef {'BRONZE'|'SILVER'|'GOLD'|'PLATINUM'|'NONE'} CertificationLevel */

/** @typedef {'TECHNICALLY_READY'|'AI_READY'|'ENTERPRISE_AI_READY'|'REGULATED_ENTERPRISE_READY'|'NOT_CERTIFIED'} CertificationStatus */

const VERDICT = Object.freeze({
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  NOT_VERIFIED: 'NOT_VERIFIED'
});

const CERTIFICATION_LEVEL = Object.freeze({
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
  NONE: 'NONE'
});

const CERTIFICATION_STATUS = Object.freeze({
  TECHNICALLY_READY: 'TECHNICALLY_READY',
  AI_READY: 'AI_READY',
  ENTERPRISE_AI_READY: 'ENTERPRISE_AI_READY',
  REGULATED_ENTERPRISE_READY: 'REGULATED_ENTERPRISE_READY',
  NOT_CERTIFIED: 'NOT_CERTIFIED'
});

/** Display labels for certification status (aligned with dataplane 419 enum). */
const STATUS_DISPLAY = Object.freeze({
  TECHNICALLY_READY: 'TECHNICALLY READY',
  AI_READY: 'AI READY',
  ENTERPRISE_AI_READY: 'ENTERPRISE AI READY',
  REGULATED_ENTERPRISE_READY: 'REGULATED ENTERPRISE READY',
  NOT_CERTIFIED: 'NOT CERTIFIED'
});

/**
 * v1 operational readiness weights (sum = 100).
 * connectivity + contracts + runtime + reliability groups from plan 150.
 */
const OPERATIONS_WEIGHTS = Object.freeze({
  credentials: 10,
  authentication: 10,
  authorization: 10,
  openApi: 8,
  mappings: 7,
  sync: 5,
  crud: 5,
  execution: 5,
  validation: 10,
  unitTests: 10,
  integrationTests: 10,
  e2eTests: 10
});

const WARNING_CODES = Object.freeze({
  TRUST_NOT_VERIFIED: 'TRUST_NOT_VERIFIED',
  GOVERNANCE_NOT_VERIFIED: 'GOVERNANCE_NOT_VERIFIED',
  OPERATIONS_NOT_VERIFIED: 'OPERATIONS_NOT_VERIFIED',
  LIFECYCLE_API_UNAVAILABLE: 'LIFECYCLE_API_UNAVAILABLE'
});

const RECOMMENDATION_COMMAND_BY_CODE = Object.freeze({
  OPERATIONS_NOT_VERIFIED: 'verify-operations',
  TRUST_NOT_VERIFIED: 'verify-trust',
  GOVERNANCE_NOT_VERIFIED: 'verify-governance'
});

/**
 * @param {string} systemKey
 * @param {string} command e.g. verify-trust
 * @returns {string}
 */
function actionHint(systemKey, command) {
  return `aifabrix ${command} ${systemKey}`;
}

/**
 * Normalize lifecycle recommendation to a copy-pastable CLI command.
 * @param {string} systemKey
 * @param {{ code?: string, action?: string }} rec
 * @returns {string}
 */
function formatRecommendationAction(systemKey, rec) {
  const action = String(rec.action || '').trim();
  if (action.startsWith('aifabrix ')) {
    return action;
  }
  const fromCode = RECOMMENDATION_COMMAND_BY_CODE[rec.code];
  if (fromCode && systemKey) {
    return actionHint(systemKey, fromCode);
  }
  const legacy = /^Run\s+(verify-[a-z-]+)$/i.exec(action);
  if (legacy && systemKey) {
    return actionHint(systemKey, legacy[1]);
  }
  return action || rec.code || '';
}

/**
 * @param {boolean} passed
 * @returns {LifecycleVerdict}
 */
function verdictFromPassed(passed) {
  return passed ? VERDICT.VERIFIED : VERDICT.FAILED;
}

/**
 * @param {string} [status]
 * @returns {string}
 */
function formatCertificationStatusDisplay(status) {
  if (!status) return STATUS_DISPLAY.NOT_CERTIFIED;
  return STATUS_DISPLAY[status] || String(status).replace(/_/g, ' ');
}

/**
 * Compute operational readiness percent from weighted check map.
 * @param {Record<string, boolean>} checks
 * @returns {number}
 */
function computeOperationalReadinessPercent(checks) {
  let earned = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(OPERATIONS_WEIGHTS)) {
    total += weight;
    if (checks[key] === true) {
      earned += weight;
    }
  }
  if (total === 0) return 0;
  return Math.round((earned / total) * 100);
}

/**
 * Derive connectivity/runtime checks from step outcomes (v1 inference rules).
 * @param {{ validation?: boolean, unit?: boolean, integration?: boolean, e2e?: boolean }} steps
 * @returns {Record<string, boolean>}
 */
function buildOperationsChecksFromSteps(steps) {
  const validation = steps.validation === true;
  const unit = steps.unit === true;
  const integration = steps.integration === true;
  const e2e = steps.e2e === true;
  return {
    credentials: integration || e2e,
    authentication: integration || e2e,
    authorization: integration || e2e,
    openApi: validation,
    mappings: validation,
    sync: e2e,
    crud: e2e,
    execution: e2e,
    validation,
    unitTests: unit,
    integrationTests: integration,
    e2eTests: e2e
  };
}

/**
 * Worst-of rollup for datasource confidence values (0–1).
 * @param {number[]} values
 * @returns {number|null}
 */
function worstConfidencePercent(values) {
  const nums = values.filter(v => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return Math.round(Math.min(...nums) * 100);
}

module.exports = {
  VERDICT,
  CERTIFICATION_LEVEL,
  CERTIFICATION_STATUS,
  STATUS_DISPLAY,
  OPERATIONS_WEIGHTS,
  WARNING_CODES,
  actionHint,
  formatRecommendationAction,
  verdictFromPassed,
  formatCertificationStatusDisplay,
  computeOperationalReadinessPercent,
  buildOperationsChecksFromSteps,
  worstConfidencePercent
};
