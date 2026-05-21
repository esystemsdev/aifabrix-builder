/**
 * @fileoverview Map dataplane agent metadata validation API payloads to CLI trust runs.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {string} trustDecision
 * @returns {'ok'|'warn'|'fail'}
 */
function trustDecisionToRowStatus(trustDecision) {
  const td = String(trustDecision || '').trim();
  if (td === 'trusted') return 'ok';
  if (td === 'usableWithWarnings') return 'warn';
  return 'fail';
}

/**
 * @param {Object} result - AgentMetadataValidationResult from dataplane
 * @returns {string[]}
 */
function highLevelWarningsFromResult(result) {
  if (!result || !Array.isArray(result.findings)) return [];
  return result.findings
    .filter(f => f && (f.severity === 'warning' || f.severity === 'error'))
    .slice(0, 8)
    .map(f => {
      const code = f.code ? String(f.code) : 'FINDING';
      const msg = f.message ? String(f.message) : '';
      return msg ? `${code} — ${msg}` : code;
    });
}

/**
 * @param {Object} params
 * @param {string} params.datasourceKey
 * @param {string} params.systemKey
 * @param {Object} params.runResponse - POST run response body
 * @returns {Object} AgentTrustRun-shaped object for CLI display/exit
 */
function mapRunResponseToTrustRun({ datasourceKey, systemKey, runResponse }) {
  const body = runResponse && typeof runResponse === 'object' ? runResponse : {};
  const result = body.result && typeof body.result === 'object' ? body.result : {};
  const trustDecision = result.trustDecision || 'pending';
  return {
    datasourceKey,
    systemKey,
    status: trustDecisionToRowStatus(trustDecision),
    trustDecision,
    validationStatus: result.status || 'pending',
    confidence: typeof result.confidence === 'number' ? result.confidence : 0,
    summary: result.summary || '',
    validatedAt: result.validatedAt || '',
    inputHash: result.inputHash || '',
    contractVersion: result.contractVersion || '',
    cacheHit: body.reused === true,
    highLevelWarnings: highLevelWarningsFromResult(result),
    findings: Array.isArray(result.findings) ? result.findings : [],
    observedBusinessModel: result.observedBusinessModel || null,
    runId: body.id || null
  };
}

/**
 * @param {Object} params
 * @param {string} params.datasourceKey
 * @param {string} params.systemKey
 * @param {Object} params.latestResult - GET /agent-validation body
 * @returns {Object}
 */
function mapLatestResultToTrustRun({ datasourceKey, systemKey, latestResult }) {
  const result = latestResult && typeof latestResult === 'object' ? latestResult : {};
  const trustDecision = result.trustDecision || 'pending';
  return {
    datasourceKey,
    systemKey,
    status: trustDecisionToRowStatus(trustDecision),
    trustDecision,
    validationStatus: result.status || 'pending',
    confidence: typeof result.confidence === 'number' ? result.confidence : 0,
    summary: result.summary || '',
    validatedAt: result.validatedAt || '',
    inputHash: result.inputHash || '',
    contractVersion: result.contractVersion || '',
    cacheHit: true,
    highLevelWarnings: highLevelWarningsFromResult(result),
    findings: Array.isArray(result.findings) ? result.findings : [],
    observedBusinessModel: result.observedBusinessModel || null,
    runId: null,
    readLatest: true
  };
}

module.exports = {
  trustDecisionToRowStatus,
  highLevelWarningsFromResult,
  mapRunResponseToTrustRun,
  mapLatestResultToTrustRun
};
