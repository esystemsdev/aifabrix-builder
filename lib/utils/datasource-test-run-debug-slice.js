/**
 * @fileoverview Compact slice of DatasourceTestRun for debug JSON output (full/raw modes).
 */

'use strict';

/**
 * @param {Object|undefined|null} v
 * @returns {Object|undefined}
 */
function sliceValidationLayer(v) {
  if (!v || typeof v !== 'object') return undefined;
  return {
    status: v.status,
    summary: v.summary,
    dataReadiness: v.dataReadiness,
    metricsOutput: v.metricsOutput,
    issues: Array.isArray(v.issues) ? v.issues.slice(0, 50) : undefined
  };
}

/**
 * @param {Object|undefined|null} integ
 * @returns {Object|undefined}
 */
function sliceIntegration(integ) {
  if (!integ || typeof integ !== 'object') return undefined;
  return {
    status: integ.status,
    summary: integ.summary,
    stepResults: integ.stepResults
  };
}

/**
 * @param {Object|undefined|null} cert
 * @returns {Object|undefined}
 */
function sliceCertificate(cert) {
  if (!cert || typeof cert !== 'object') return undefined;
  return {
    status: cert.status,
    level: cert.level,
    summary: cert.summary,
    blockers: Array.isArray(cert.blockers) ? cert.blockers.slice(0, 30) : undefined
  };
}

/**
 * @param {Object|undefined|null} e2e
 * @returns {Object|undefined}
 */
function sliceCapabilityE2e(e2e) {
  if (!e2e || typeof e2e !== 'object') return undefined;
  return {
    status: e2e.status,
    strategy: e2e.strategy,
    steps: e2e.steps
  };
}

/**
 * @param {Array|undefined|null} capabilities
 * @returns {Array|undefined}
 */
function sliceCapabilities(capabilities) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) return undefined;
  return capabilities.map(c => ({
    key: c.key,
    status: c.status,
    permission: c.permission,
    e2e: sliceCapabilityE2e(c.e2e)
  }));
}

/**
 * @param {Object} envelope
 * @returns {Object}
 */
function buildDebugEnvelopeSlice(envelope) {
  return {
    audit: envelope.audit,
    debug: envelope.debug,
    developer: envelope.developer,
    validation: sliceValidationLayer(envelope.validation),
    integration: sliceIntegration(envelope.integration),
    certificate: sliceCertificate(envelope.certificate),
    capabilitySummary: envelope.capabilitySummary,
    capabilities: sliceCapabilities(envelope.capabilities)
  };
}

module.exports = { buildDebugEnvelopeSlice };
