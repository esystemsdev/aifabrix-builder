/**
 * @fileoverview Exit code matrix for DatasourceTestRun after successful HTTP (plan §3.1).
 * HTTP/transport failures are exit 3 (handled by callers).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Compute CLI exit code from parsed DatasourceTestRun envelope.
 * Ordering: status / warnings-as-errors → require-cert (§3.1).
 * @param {import('../api/types/validation-run.types').DatasourceTestRunLike|null|undefined} body
 * @param {Object} [opts]
 * @param {boolean} [opts.warningsAsErrors]
 * @param {boolean} [opts.requireCert]
 * @returns {number} 0 | 1 | 2 | 3 (3 = treat as parse/body unusable)
 */
function computeExitCodeFromDatasourceTestRun(body, opts = {}) {
  if (!body || typeof body !== 'object') {
    return 3;
  }
  const status = body.status;
  if (status === 'fail') {
    return 1;
  }
  if (status === 'warn' && opts.warningsAsErrors === true) {
    return 1;
  }
  if (status === 'ok' || status === 'skipped' || status === 'warn') {
    if (opts.requireCert === true) {
      const cert = body.certificate;
      if (!cert) {
        return 2;
      }
      if (cert.status === 'not_passed') {
        return 2;
      }
    }
    return 0;
  }
  return 3;
}

/**
 * Exit code for poll timeout with last envelope (plan §3.4).
 * @param {import('../api/types/validation-run.types').DatasourceTestRunLike|null} lastBody
 * @returns {number} 1 if root fail, else 3
 */
function exitCodeForPollTimeout(lastBody) {
  if (lastBody && typeof lastBody === 'object' && lastBody.status === 'fail') {
    return 1;
  }
  return 3;
}

module.exports = {
  computeExitCodeFromDatasourceTestRun,
  exitCodeForPollTimeout
};
