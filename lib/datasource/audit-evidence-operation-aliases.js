/**
 * @fileoverview Normalize CIP execution operation labels for Plan 407 audit matrix
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Align list API operation values with builder E2E expectations (matches e2e_audit_operation.py).
 * @param {*} operation
 * @returns {string}
 */
function normalizeAuditOperation(operation) {
  const raw = operation !== undefined && operation !== null ? String(operation).trim() : '';
  if (!raw) return '';
  let op = raw === 'updateBasic' ? 'updatebasic' : raw.toLowerCase();
  if (op === 'create') op = 'insert';
  return op;
}

/**
 * @param {Array<{ operation?: string }>} executions
 * @param {string[]} expectedOperations
 * @returns {boolean}
 */
/**
 * API filter values to try for a matrix-expected operation (DB may use create vs insert).
 * @param {string} expectedOp
 * @returns {string[]}
 */
function operationQueryVariants(expectedOp) {
  const n = normalizeAuditOperation(expectedOp);
  if (!n) return [];
  const variants = new Set([n]);
  if (n === 'insert') variants.add('create');
  if (n === 'updatebasic') {
    variants.add('updateBasic');
    variants.add('updatebasic');
  }
  if (n === 'updateaddress') {
    variants.add('updateAddress');
    variants.add('updateaddress');
  }
  return [...variants];
}

function executionsCoverExpectedOperations(executions, expectedOperations) {
  const expected = (expectedOperations || [])
    .map(normalizeAuditOperation)
    .filter(Boolean);
  if (!expected.length) return true;
  const ops = new Set(
    (executions || []).map(e => normalizeAuditOperation(e && e.operation)).filter(Boolean)
  );
  return expected.every(op => ops.has(op));
}

module.exports = {
  normalizeAuditOperation,
  operationQueryVariants,
  executionsCoverExpectedOperations
};
