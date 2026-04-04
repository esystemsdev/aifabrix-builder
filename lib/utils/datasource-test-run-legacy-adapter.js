/**
 * @fileoverview Map DatasourceTestRun envelope → legacy CLI display shapes (integration + E2E).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * @param {Object|null} envelope
 * @returns {string|null}
 */
function firstIssueMessage(envelope) {
  const v = envelope && envelope.validation;
  const issues = v && Array.isArray(v.issues) ? v.issues : [];
  const first = issues.find(i => i && (i.message || i.hint));
  if (first) return String(first.message || first.hint);
  const integ = envelope && envelope.integration;
  const steps = integ && Array.isArray(integ.stepResults) ? integ.stepResults : [];
  const bad = steps.find(s => s && s.success === false && (s.message || s.error));
  if (bad) return String(bad.message || bad.error || 'Integration step failed');
  return null;
}

/**
 * Legacy integration result for displayIntegrationTestResults / verbose details.
 * @param {Object|null} envelope
 * @param {string} datasourceKey
 * @returns {Object}
 */
function integrationResultFromEnvelope(envelope, datasourceKey) {
  if (!envelope || typeof envelope !== 'object') {
    return {
      key: datasourceKey,
      systemKey: 'unknown',
      success: false,
      skipped: false,
      validationResults: {},
      fieldMappingResults: {},
      endpointTestResults: {},
      error: 'No report envelope',
      envelope: null
    };
  }
  const success = envelope.status !== 'fail';
  const err = success ? undefined : firstIssueMessage(envelope) || `status: ${envelope.status}`;
  return {
    key: datasourceKey,
    systemKey: envelope.systemKey || 'unknown',
    success,
    skipped: false,
    error: err,
    envelope
  };
}

/**
 * Map integration.stepResults → E2E-style steps for displayE2EResults.
 * @param {Object|null} envelope
 * @returns {{ steps: Object[], success: boolean, status?: string, error?: string }}
 */
function e2eShapeFromEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return { steps: [], success: false, error: 'No report envelope' };
  }
  const integ = envelope.integration;
  const raw = integ && Array.isArray(integ.stepResults) ? integ.stepResults : [];
  const steps = raw.map(s => ({
    name: s.name || 'step',
    step: s.name,
    success: s.success !== false,
    message: s.message,
    error: s.success === false ? s.message || 'failed' : undefined
  }));
  const success = envelope.status !== 'fail';
  let status;
  if (envelope.status === 'fail') status = 'failed';
  else if (envelope.reportCompleteness && envelope.reportCompleteness !== 'full') {
    status = 'completed';
  } else {
    status = 'completed';
  }
  return {
    steps,
    success,
    status,
    error: success ? undefined : firstIssueMessage(envelope) || undefined
  };
}

module.exports = {
  integrationResultFromEnvelope,
  e2eShapeFromEnvelope,
  firstIssueMessage
};
