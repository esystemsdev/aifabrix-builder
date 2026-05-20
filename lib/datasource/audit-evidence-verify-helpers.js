/**
 * @fileoverview Helpers for audit evidence matrix verification (sub-resource validators, rows 8–9)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { checkPerExecutionRow } = require('./audit-evidence-matrix-rows');
const {
  normalizeAuditOperation,
  executionsCoverExpectedOperations
} = require('./audit-evidence-operation-aliases');

/**
 * @param {Object} input
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function checkRow8CorrelationGroup(input) {
  const row = { row: 8, status: 'failed', detail: '', code: 'correlationGroup' };
  const items = input.executions || [];
  if (!items.length) {
    return {
      ...row,
      detail: input.correlationId
        ? 'no executions for correlation or datasource filter'
        : 'no correlationId and no executions',
      code: 'correlationEmpty'
    };
  }
  const expected = (input.expectedOperations || [])
    .map(normalizeAuditOperation)
    .filter(Boolean);
  if (expected.length && !executionsCoverExpectedOperations(items, expected)) {
    const ops = new Set(
      items.map(e => normalizeAuditOperation(e && e.operation)).filter(Boolean)
    );
    const missing = expected.filter(op => !ops.has(op));
    return {
      ...row,
      detail: `missing ops: ${missing.join(', ')}`,
      code: 'correlationOpsMissing'
    };
  }
  const opCount = new Set(
    items.map(e => normalizeAuditOperation(e && e.operation)).filter(Boolean)
  ).size;
  return {
    ...row,
    status: 'passed',
    detail: `correlation ops=${opCount || items.length}`,
    code: 'correlationGroup'
  };
}

/**
 * Prefer executions tied to this run (by id), then correlation query, then datasource list.
 * @param {Object} ctx
 * @param {Array} executions
 * @param {Array} corrQueryRows
 * @returns {Array}
 */
function resolveRow8Executions(ctx, executions, corrQueryRows) {
  const idSet = new Set(
    (ctx.executionIds || []).map(id => String(id).trim()).filter(Boolean)
  );
  let byId = [];
  if (idSet.size && executions && executions.length) {
    byId = executions.filter(e => e && e.id && idSet.has(String(e.id)));
  }
  const expected = ctx.expectedOperations || [];
  if (byId.length && executionsCoverExpectedOperations(byId, expected)) {
    return byId;
  }
  if (corrQueryRows && corrQueryRows.length && executionsCoverExpectedOperations(corrQueryRows, expected)) {
    return corrQueryRows;
  }
  if (byId.length) return byId;
  if (corrQueryRows && corrQueryRows.length) return corrQueryRows;
  return executions || [];
}

/**
 * @param {Set<string>} traceIds
 * @param {string[]} execIds
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function checkRow9Traces(traceIds, execIds) {
  const row = { row: 9, status: 'failed', detail: '', code: 'traceMismatch' };
  if (!execIds.length) {
    return { ...row, detail: 'no execution ids', code: 'auditIdsMissing' };
  }
  if (traceIds.size < 1) {
    return { ...row, detail: 'no trace payloads resolved', code: 'traceEmpty' };
  }
  if (traceIds.size < execIds.length) {
    return {
      ...row,
      detail: `distinct traces=${traceIds.size} executionIds=${execIds.length}`,
      code: 'traceCountLow'
    };
  }
  return { ...row, status: 'passed', detail: `traces=${traceIds.size} ids=${execIds.length}` };
}

function isRbacSubResourceValid(body) {
  return !!(body && typeof body === 'object' && (body.id || body.decision || body.summary));
}

function isAbacSubResourceValid(body) {
  return !!(body && typeof body === 'object' && (body.id || body.decision || body.traceId));
}

function isErrorsValid(body) {
  if (Array.isArray(body)) return true;
  if (body && typeof body === 'object' && Array.isArray(body.data)) return true;
  return body && typeof body === 'object';
}

function isStepsValid(body) {
  if (Array.isArray(body) && body.length > 0) return true;
  if (body && Array.isArray(body.steps) && body.steps.length > 0) return true;
  return body && typeof body === 'object' && Object.keys(body).length > 0;
}

/**
 * @param {Array} executions
 * @param {string[]} fallbackIds
 * @returns {string[]}
 */
function resolveExecutionIdsForChecks(executions, fallbackIds) {
  const fromRows = (executions || [])
    .map(e => (e && e.id ? String(e.id).trim() : ''))
    .filter(Boolean);
  return [...new Set(fromRows.concat(fallbackIds || []))];
}

/**
 * @param {Object} opts
 * @returns {Promise<import('../api/types/audit.types').AuditEvidenceMatrixRow>}
 */
async function checkPerExecutionSub(opts) {
  const { dataplaneUrl, authConfig, executionId, rowNum, label, fetcher, isValid } = opts;
  try {
    const body = await fetcher(dataplaneUrl, authConfig, executionId);
    return checkPerExecutionRow(rowNum, `${label}Null`, label, body, isValid);
  } catch (err) {
    return {
      row: rowNum,
      status: 'failed',
      detail: `${label}: ${err.message}`,
      code: `${label}Error`
    };
  }
}

module.exports = {
  checkRow8CorrelationGroup,
  resolveRow8Executions,
  checkRow9Traces,
  isRbacSubResourceValid,
  isAbacSubResourceValid,
  isErrorsValid,
  isStepsValid,
  resolveExecutionIdsForChecks,
  checkPerExecutionSub
};
