/**
 * @fileoverview Orchestrate audit evidence verification after E2E or from saved logs
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { resolveAppKeyForDatasource } = require('./resolve-app');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { getConfig } = require('../core/config');
const {
  extractAuditEvidenceContext,
  loadEnvelopeFromLatestE2eLog
} = require('./audit-evidence-extract');
const { verifyAuditEvidenceMatrix } = require('./audit-evidence-verify');
const {
  displayAuditEvidenceMatrixTTY,
  printAuditEvidenceVerificationJson
} = require('./audit-evidence-display');

/**
 * @param {string} datasourceKey
 * @param {Object} options
 * @returns {Promise<{ authConfig: Object, dataplaneUrl: string }>}
 */
async function resolveAuditVerifyAuth(datasourceKey, options) {
  if (options.authConfig && options.dataplaneUrl) {
    return { authConfig: options.authConfig, dataplaneUrl: options.dataplaneUrl };
  }
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  const configObj = await getConfig();
  const auth = await setupIntegrationTestAuth(appKey, options, configObj);
  return { authConfig: auth.authConfig, dataplaneUrl: auth.dataplaneUrl };
}

/**
 * @param {Object} envelope
 * @param {string} datasourceKey
 * @param {Object} [opts]
 * @returns {Object}
 */
function buildVerifyContext(envelope, datasourceKey, opts = {}) {
  const ctx = extractAuditEvidenceContext(envelope);
  if (datasourceKey) ctx.datasourceKey = String(datasourceKey).trim();
  if (opts.correlationId) ctx.correlationId = String(opts.correlationId).trim();
  if (opts.executionId) {
    const id = String(opts.executionId).trim();
    if (id && !ctx.executionIds.includes(id)) ctx.executionIds.unshift(id);
  }
  return ctx;
}

/**
 * @async
 * @param {string} datasourceKey
 * @param {Object} envelope - DatasourceTestRun
 * @param {Object} options
 * @returns {Promise<{ verification: import('../api/types/audit.types').AuditEvidenceVerification, exitCode: number }>}
 */
async function runAuditEvidenceVerification(datasourceKey, envelope, options = {}) {
  const ctx = buildVerifyContext(envelope, datasourceKey, options);
  if (!ctx.executionIds.length && !ctx.correlationId) {
    const verification = failedVerification(
      datasourceKey,
      ctx,
      'missing audit.executionIds and testRunId/correlationId',
      'auditIdsMissing'
    );
    emitVerificationOutput(verification, options);
    return { verification, exitCode: 1 };
  }
  let auth;
  try {
    auth = await resolveAuditVerifyAuth(datasourceKey, options);
  } catch (err) {
    const verification = failedVerification(datasourceKey, ctx, err.message, 'authFailed');
    emitVerificationOutput(verification, options);
    return { verification, exitCode: 3 };
  }

  try {
    const verification = await verifyAuditEvidenceMatrix({
      dataplaneUrl: auth.dataplaneUrl,
      authConfig: auth.authConfig,
      datasourceKey: ctx.datasourceKey,
      correlationId: ctx.correlationId,
      executionIds: ctx.executionIds,
      expectedOperations: ctx.expectedOperations,
      maxWaitMs: options.auditPollMaxWaitMs,
      intervalMs: options.auditPollIntervalMs
    });
    emitVerificationOutput(verification, options);
    return { verification, exitCode: verification.status === 'passed' ? 0 : 1 };
  } catch (err) {
    const verification = failedVerification(datasourceKey, ctx, err.message, 'verifyError');
    emitVerificationOutput(verification, options);
    const code = err.status === 401 || err.status === 403 ? 3 : 1;
    return { verification, exitCode: code };
  }
}

/**
 * @param {string} datasourceKey
 * @param {Object} ctx
 * @param {string} message
 * @param {string} code
 * @returns {import('../api/types/audit.types').AuditEvidenceVerification}
 */
function failedVerification(datasourceKey, ctx, message, code) {
  return {
    status: 'failed',
    datasourceKey,
    correlationId: ctx.correlationId || null,
    executionIds: ctx.executionIds || [],
    matrix: [{ row: 0, status: 'failed', detail: message, code }]
  };
}

/**
 * @param {import('../api/types/audit.types').AuditEvidenceVerification} verification
 * @param {Object} options
 */
function emitVerificationOutput(verification, options) {
  if (options.json) {
    printAuditEvidenceVerificationJson(verification);
    return;
  }
  if (!options.quiet) {
    displayAuditEvidenceMatrixTTY(verification, options.verbose === true);
  }
}

/**
 * Run audit matrix when E2E succeeded and --verify-audit is set.
 * @param {number} e2eExitCode
 * @param {string} datasourceKey
 * @param {Object|null} envelope
 * @param {Object} options
 * @returns {Promise<number>}
 */
async function maybeVerifyAuditAfterE2E(e2eExitCode, datasourceKey, envelope, options = {}) {
  const enabled =
    options.verifyAudit === true && options.noVerifyAudit !== true;
  if (!enabled || e2eExitCode !== 0 || !envelope) {
    return e2eExitCode;
  }
  const pollMsRaw = parseInt(String(options.auditPollMs || options.auditPollMaxWaitMs || '15000'), 10);
  const pollInterval = parseInt(
    String(options.auditPollIntervalMs || '2000'),
    10
  );
  const ctx = buildVerifyContext(envelope, datasourceKey, options);
  const pollMs = Math.max(
    Number.isFinite(pollMsRaw) ? pollMsRaw : 15000,
    (ctx.executionIds && ctx.executionIds.length >= 7) ? 30000 : 0
  );
  const { exitCode } = await runAuditEvidenceVerification(datasourceKey, envelope, {
    app: options.app,
    env: options.env,
    verbose: options.verbose,
    json: options.json,
    authConfig: options.authConfig,
    dataplaneUrl: options.dataplaneUrl,
    auditPollMaxWaitMs: pollMs,
    auditPollIntervalMs: Number.isFinite(pollInterval) ? pollInterval : 2000
  });
  return exitCode;
}

module.exports = {
  runAuditEvidenceVerification,
  maybeVerifyAuditAfterE2E,
  loadEnvelopeFromLatestE2eLog,
  buildVerifyContext,
  resolveAuditVerifyAuth
};
