/**
 * @fileoverview Dev-only mock trust runs when AIFABRIX_AGENT_TRUST_MOCK=1 (plan 143).
 * Not documented in user-facing CLI docs; for local CLI development without dataplane 404.5.
 */

'use strict';

/**
 * @returns {boolean}
 */
function isAgentTrustMockEnabled() {
  return String(process.env.AIFABRIX_AGENT_TRUST_MOCK || '').trim() === '1';
}

/**
 * @param {string} datasourceKey
 * @param {string} systemKey
 * @returns {Object}
 */
function buildMockTrustRun(datasourceKey, systemKey) {
  return {
    datasourceKey,
    systemKey,
    status: 'warn',
    trustDecision: 'usableWithWarnings',
    validationStatus: 'warning',
    confidence: 0.72,
    summary: 'Mock trust run (AIFABRIX_AGENT_TRUST_MOCK=1)',
    validatedAt: new Date().toISOString(),
    inputHash: 'mock-input-hash',
    contractVersion: '1.0.0',
    cacheHit: false,
    highLevelWarnings: ['MOCK_TRUST — set AIFABRIX_AGENT_TRUST_MOCK=0 for live dataplane validation'],
    findings: [],
    observedBusinessModel: null,
    runId: 'mock-run-id',
    mock: true
  };
}

module.exports = {
  isAgentTrustMockEnabled,
  buildMockTrustRun
};
