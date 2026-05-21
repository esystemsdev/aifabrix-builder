/**
 * @fileoverview Build matrix rows 1–9 for audit evidence verification
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const {
  queryExecutions,
  queryRbacDecisions,
  queryAbacTraces,
  getExecutionRbac,
  getExecutionAbac,
  getExecutionErrors,
  getExecutionSteps,
  getExecutionTrace
} = require('../api/audit.api');
const {
  checkRow1ExecutionsByDatasource,
  checkRow2RbacDecisionsList,
  checkRow3AbacTracesList
} = require('./audit-evidence-matrix-rows');
const {
  operationQueryVariants,
  executionsCoverExpectedOperations
} = require('./audit-evidence-operation-aliases');
const {
  checkRow8CorrelationGroup,
  resolveRow8Executions,
  checkRow9Traces,
  isRbacSubResourceValid,
  isAbacSubResourceValid,
  isErrorsValid,
  isStepsValid,
  resolveExecutionIdsForChecks,
  checkPerExecutionSub
} = require('./audit-evidence-verify-helpers');

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} correlationId
 * @param {string[]} expectedOperations
 * @returns {Promise<Array>}
 */
async function fetchCorrelationExecutionsByOperation(
  dataplaneUrl,
  authConfig,
  correlationId,
  expectedOperations
) {
  const deduped = new Map();
  for (const rawOp of expectedOperations) {
    const variants = operationQueryVariants(rawOp);
    for (const op of variants) {
      const res = await queryExecutions(dataplaneUrl, authConfig, {
        correlationId,
        operation: op,
        pageSize: 20
      });
      for (const row of res.data || []) {
        if (row && row.id) deduped.set(String(row.id), row);
      }
    }
  }
  const merged = [...deduped.values()];
  return executionsCoverExpectedOperations(merged, expectedOperations) ? merged : [];
}

/**
 * @param {Object} ctx
 * @param {Object} polled
 * @param {number} minExpected
 * @returns {Promise<import('../api/types/audit.types').AuditEvidenceMatrixRow[]>}
 */
async function buildListMatrixRows(ctx, polled, minExpected) {
  const executions = polled.data || [];
  const { dataplaneUrl, authConfig } = ctx;
  const totalItems =
    polled.meta && polled.meta.totalItems !== undefined
      ? polled.meta.totalItems
      : executions.length;
  const rows = [
    checkRow1ExecutionsByDatasource({
      executions,
      totalItems,
      minExpected
    })
  ];
  const rbacList = await queryRbacDecisions(dataplaneUrl, authConfig, {
    targetDatasourceKey: ctx.datasourceKey,
    pageSize: 100
  });
  rows.push(
    checkRow2RbacDecisionsList({
      rbacItems: rbacList.data,
      totalItems: rbacList.meta && rbacList.meta.totalItems
    })
  );
  const abacList = await queryAbacTraces(dataplaneUrl, authConfig, {
    datasourceKey: ctx.datasourceKey,
    pageSize: 100
  });
  rows.push(
    checkRow3AbacTracesList({
      abacItems: abacList.data,
      totalItems: abacList.meta && abacList.meta.totalItems
    })
  );
  return rows;
}

/**
 * @param {Object} ctx
 * @param {Array} executions
 * @param {string[]} executionIds
 * @returns {Promise<{ rows: import('../api/types/audit.types').AuditEvidenceMatrixRow[], execIds: string[] }>}
 */
async function buildPerExecutionAndTailRows(ctx, executions, executionIds) {
  const { dataplaneUrl, authConfig } = ctx;
  const execIds = resolveExecutionIdsForChecks(executions, executionIds);
  const sampleId = execIds[0];
  const base = { dataplaneUrl, authConfig, executionId: sampleId };
  const rows = await Promise.all([
    checkPerExecutionSub({ ...base, rowNum: 4, label: 'rbac', fetcher: getExecutionRbac, isValid: isRbacSubResourceValid }),
    checkPerExecutionSub({ ...base, rowNum: 5, label: 'abac', fetcher: getExecutionAbac, isValid: isAbacSubResourceValid }),
    checkPerExecutionSub({ ...base, rowNum: 6, label: 'errors', fetcher: getExecutionErrors, isValid: isErrorsValid }),
    checkPerExecutionSub({ ...base, rowNum: 7, label: 'steps', fetcher: getExecutionSteps, isValid: isStepsValid })
  ]);

  let corrQueryRows = [];
  if (ctx.correlationId) {
    const corr = await queryExecutions(dataplaneUrl, authConfig, {
      correlationId: ctx.correlationId,
      pageSize: 100
    });
    corrQueryRows = corr.data || [];
  }
  let row8Pool = corrQueryRows.length ? corrQueryRows : executions;
  const expected = ctx.expectedOperations || [];
  if (expected.length && ctx.correlationId) {
    const byOp = await fetchCorrelationExecutionsByOperation(
      dataplaneUrl,
      authConfig,
      ctx.correlationId,
      expected
    );
    if (byOp.length) row8Pool = byOp;
  }
  const row8Executions = resolveRow8Executions(ctx, executions, row8Pool);
  rows.push(
    checkRow8CorrelationGroup({
      correlationId: ctx.correlationId,
      executions: row8Executions,
      expectedOperations: ctx.expectedOperations
    })
  );

  const traceIds = new Set();
  for (const id of execIds.slice(0, Math.min(execIds.length, 12))) {
    try {
      const tr = await getExecutionTrace(dataplaneUrl, authConfig, id);
      if (tr && tr.executionId) traceIds.add(String(tr.executionId));
      else if (tr && tr.id) traceIds.add(String(tr.id));
    } catch {
      /* row 9 may fail */
    }
  }
  rows.push(checkRow9Traces(traceIds, execIds));
  return { rows, execIds };
}

module.exports = {
  buildListMatrixRows,
  buildPerExecutionAndTailRows
};
