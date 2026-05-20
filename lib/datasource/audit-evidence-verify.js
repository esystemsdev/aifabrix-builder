/**
 * @fileoverview Run Plan 407.1 nine-row audit evidence matrix against dataplane APIs
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { queryExecutions } = require('../api/audit.api');
const { pollExecutionsUntilReady } = require('./audit-evidence-poll');
const {
  buildListMatrixRows,
  buildPerExecutionAndTailRows
} = require('./audit-evidence-verify-matrix');
const { checkRow8CorrelationGroup, checkRow9Traces } = require('./audit-evidence-verify-helpers');

/**
 * @param {Object} ctx
 * @returns {number}
 */
/**
 * E2E runs tag executions with testRunId as correlationId; prefer that for list poll.
 * @param {Object} ctx
 * @returns {Object}
 */
function buildExecutionsPollQuery(ctx) {
  const base = { pageSize: 100, sort: '-startedAt' };
  if (ctx.correlationId) {
    return { ...base, correlationId: ctx.correlationId };
  }
  return { ...base, datasourceKey: ctx.datasourceKey };
}

function resolveMinExpected(ctx) {
  const fromOps = ctx.expectedOperations && ctx.expectedOperations.length;
  const fromIds = ctx.executionIds && ctx.executionIds.length;
  if (fromIds && fromOps) {
    return Math.max(1, Math.min(fromOps, fromIds));
  }
  return Math.max(1, fromOps || fromIds || 1);
}

/**
 * @param {string} datasourceKey
 * @param {Object} ctx
 * @returns {import('../api/types/audit.types').AuditEvidenceVerification}
 */
function failedMissingIds(datasourceKey, ctx) {
  return {
    status: 'failed',
    datasourceKey,
    correlationId: ctx.correlationId || null,
    executionIds: [],
    matrix: [
      {
        row: 0,
        status: 'failed',
        detail: 'missing audit.executionIds in envelope',
        code: 'auditIdsMissing'
      }
    ]
  };
}

/**
 * @param {Object} ctx
 * @returns {Promise<import('../api/types/audit.types').AuditEvidenceVerification>}
 */
async function verifyAuditEvidenceMatrix(ctx) {
  const datasourceKey = ctx.datasourceKey || '';
  const executionIds = Array.isArray(ctx.executionIds) ? ctx.executionIds : [];
  if (!executionIds.length && !ctx.correlationId) {
    return failedMissingIds(datasourceKey, ctx);
  }

  const { dataplaneUrl, authConfig } = ctx;
  const minExpected = resolveMinExpected(ctx);
  const execQuery = buildExecutionsPollQuery(ctx);
  const polled = await pollExecutionsUntilReady({
    fetchExecutions: () => queryExecutions(dataplaneUrl, authConfig, execQuery),
    minExpected,
    executionIds,
    maxWaitMs: ctx.maxWaitMs,
    intervalMs: ctx.intervalMs
  });

  const executions = polled.data || [];
  const matrix = await buildListMatrixRows(ctx, polled, minExpected);
  const tail = await buildPerExecutionAndTailRows(ctx, executions, executionIds);
  matrix.push(...tail.rows);

  const passed = matrix.every(r => r.status === 'passed');
  return {
    status: passed ? 'passed' : 'failed',
    datasourceKey,
    correlationId: ctx.correlationId || null,
    executionIds: tail.execIds,
    matrix
  };
}

module.exports = {
  verifyAuditEvidenceMatrix,
  buildExecutionsPollQuery,
  resolveMinExpected,
  checkRow8CorrelationGroup,
  checkRow9Traces
};
