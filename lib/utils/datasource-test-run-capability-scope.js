/**
 * @fileoverview Single-capability CLI contract when --capability is set (plan 115 §2.3).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * @param {Object|null|undefined} envelope - DatasourceTestRun-like
 * @param {string|undefined|null} requestedCapabilityKey - From CLI --capability
 * @returns {{ violated: boolean, message?: string, count?: number }}
 */
function analyzeCapabilityScope(envelope, requestedCapabilityKey) {
  const key =
    requestedCapabilityKey !== undefined &&
    requestedCapabilityKey !== null &&
    String(requestedCapabilityKey).trim() !== ''
      ? String(requestedCapabilityKey).trim()
      : '';
  if (!key) {
    return { violated: false };
  }
  const caps =
    envelope && typeof envelope === 'object' && Array.isArray(envelope.capabilities)
      ? envelope.capabilities
      : [];
  if (caps.length <= 1) {
    return { violated: false };
  }
  const keys = caps.map(c =>
    c && c.key !== undefined && c.key !== null ? String(c.key) : '?'
  );
  const preview = keys.slice(0, 8).join(', ');
  const suffix = keys.length > 8 ? ', …' : '';
  return {
    violated: true,
    count: caps.length,
    message: `Capabilities scope: with --capability "${key}", expected a single row in capabilities[]; server returned ${caps.length} (${preview}${suffix}).`
  };
}

module.exports = {
  analyzeCapabilityScope
};
