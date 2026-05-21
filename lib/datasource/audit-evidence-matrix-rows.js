/**
 * @fileoverview Plan 407.1 nine-row audit evidence matrix checks (pure helpers)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const CAPTURED = 'captured';

const RBAC_SKIP_REASON_PREFIXES = [
  'rbacAuditInternalPath',
  'rbacAuditApiKeyBypass',
  'rbacAudit'
];

/**
 * @param {import('../api/types/audit.types').AuditEvidenceMatrixRow} row
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function passRow(row, detail, code) {
  const out = { ...row, status: 'passed', detail };
  if (code) {
    out.code = code;
  }
  return out;
}

/**
 * @param {import('../api/types/audit.types').AuditEvidenceMatrixRow} row
 * @param {string} detail
 * @param {string} [code]
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function failRow(row, detail, code) {
  return { ...row, status: 'failed', detail, code: code || row.code };
}

/**
 * @param {*} ref
 * @returns {boolean}
 */
function hasFkRef(ref) {
  if (!ref || typeof ref !== 'object') return false;
  const id = ref.id !== undefined && ref.id !== null ? String(ref.id).trim() : '';
  const key = ref.key !== undefined && ref.key !== null ? String(ref.key).trim() : '';
  return Boolean(id || key);
}

/**
 * @param {Object} item
 * @returns {boolean}
 */
function executionRowCaptured(item) {
  if (!item || typeof item !== 'object') return false;
  const rbacOk = item.rbacAuditStatus === CAPTURED && hasFkRef(item.rbacDecision);
  const abacOk = item.abacAuditStatus === CAPTURED && hasFkRef(item.abacTrace);
  return rbacOk && abacOk;
}

/**
 * Row 1 — executions by datasource.
 * @param {Object} input
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function checkRow1ExecutionsByDatasource(input) {
  const row = { row: 1, status: 'failed', detail: '', code: 'executionsByDatasource' };
  const { executions, minExpected } = input;
  const total = input.totalItems !== undefined ? input.totalItems : executions.length;
  if (total < minExpected) {
    return failRow(row, `executions=${total} expected>=${minExpected}`, 'executionsCountLow');
  }
  const captured = executions.filter(executionRowCaptured).length;
  if (captured < minExpected) {
    return failRow(
      row,
      `executions=${total} captured=${captured} (need captured rbac/abac FKs)`,
      'executionsNotCaptured'
    );
  }
  return passRow(row, `executions=${total} captured=${captured}`, 'executionsByDatasource');
}

/**
 * Row 2 — RBAC decisions list.
 * @param {Object} input
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function checkRow2RbacDecisionsList(input) {
  const row = { row: 2, status: 'failed', detail: '', code: 'rbacListEmpty' };
  const items = input.rbacItems || [];
  const total = input.totalItems !== undefined ? input.totalItems : items.length;
  if (total < 1 || items.length < 1) {
    return failRow(row, 'rbac-decisions list empty', 'rbacListEmpty');
  }
  const first = items[0];
  const execRef = first && first.executionId;
  if (!hasFkRef(execRef)) {
    return failRow(row, 'rbac row missing executionId ref', 'rbacMissingExecutionId');
  }
  const reason = first && first.reason ? String(first.reason) : '';
  const skipOk =
    reason &&
    RBAC_SKIP_REASON_PREFIXES.some(prefix => reason.startsWith(prefix) || reason.includes(prefix));
  if (!skipOk && !reason) {
    return failRow(row, 'rbac row missing skip/capture reason', 'rbacReasonMissing');
  }
  return passRow(row, `rbac rows=${total} reason=${reason || 'present'}`, 'rbacListOk');
}

/**
 * Row 3 — ABAC traces list.
 * @param {Object} input
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function checkRow3AbacTracesList(input) {
  const row = { row: 3, status: 'failed', detail: '', code: 'abacListEmpty' };
  const items = input.abacItems || [];
  const total = input.totalItems !== undefined ? input.totalItems : items.length;
  if (total < 1 || items.length < 1) {
    return failRow(row, 'abac-traces list empty', 'abacListEmpty');
  }
  const first = items[0];
  const decision = first && first.decision ? String(first.decision) : '';
  const reason = first && first.reason ? String(first.reason) : '';
  if (!reason) {
    return failRow(row, 'abac row missing reason', 'abacReasonMissing');
  }
  return passRow(row, `abac rows=${total} decision=${decision || 'n/a'} reason=${reason}`, 'abacListOk');
}

/**
 * Rows 4–7, 9 — per-execution sub-resources.
 * @param {number} rowNum
 * @param {string} code
 * @param {string} label
 * @param {*} payload
 * @param {(payload: *) => boolean} isValid
 * @returns {import('../api/types/audit.types').AuditEvidenceMatrixRow}
 */
function checkPerExecutionRow(rowNum, code, label, payload, isValid) {
  const row = { row: rowNum, status: 'failed', detail: '', code };
  if (!isValid(payload)) {
    return failRow(row, `${label} missing or invalid`, code);
  }
  return passRow(row, `${label} ok`, `${label}Ok`);
}

module.exports = {
  CAPTURED,
  RBAC_SKIP_REASON_PREFIXES,
  hasFkRef,
  executionRowCaptured,
  checkRow1ExecutionsByDatasource,
  checkRow2RbacDecisionsList,
  checkRow3AbacTracesList,
  checkPerExecutionRow
};
