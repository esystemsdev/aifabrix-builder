/**
 * Interprets deployToController / poll result for CLI messaging (status, errors).
 *
 * @fileoverview Controller pipeline deployment outcome parsing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * @typedef {Object} ControllerDeploymentOutcome
 * @property {boolean} ok - False only for terminal failure-like statuses from controller
 * @property {string|null} statusLabel - Raw status string when present
 * @property {string|null} message - Optional deployment message from API
 * @property {string|null} error - Optional error string from API
 */

/**
 * @param {unknown} value - Candidate string field
 * @returns {string|null} Trimmed non-empty string or null
 */
function nonEmptyTrimmed(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const t = String(value).trim();
  return t ? t : null;
}

/**
 * @param {Object} block - status object from API
 * @returns {string|null}
 */
function resolveRawStatusLabel(block) {
  if (typeof block.status === 'string') {
    return block.status;
  }
  if (typeof block.deploymentStatus === 'string') {
    return block.deploymentStatus;
  }
  return null;
}

/**
 * @param {Object|null|undefined} result - deployToController return value
 * @returns {ControllerDeploymentOutcome}
 */
function parseControllerDeploymentOutcome(result) {
  const block = result && result.status && typeof result.status === 'object' ? result.status : null;
  if (!block) {
    return { ok: true, statusLabel: null, message: null, error: null };
  }
  const raw = resolveRawStatusLabel(block);
  const message = nonEmptyTrimmed(block.message);
  const error = nonEmptyTrimmed(block.error);
  if (!raw) {
    return { ok: true, statusLabel: null, message, error };
  }
  const s = raw.toLowerCase();
  const failed = s === 'failed' || s === 'cancelled' || s === 'error';
  return {
    ok: !failed,
    statusLabel: raw,
    message,
    error
  };
}

module.exports = { parseControllerDeploymentOutcome };
