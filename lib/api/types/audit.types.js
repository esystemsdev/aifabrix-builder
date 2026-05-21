/**
 * @fileoverview Audit API type definitions (dataplane read-only audit queries)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

/**
 * Paginated list meta (miso-client shape).
 * @typedef {Object} AuditListMeta
 * @property {number} totalItems
 * @property {number} [currentPage]
 * @property {number} [pageSize]
 */

/**
 * CIP execution list item (abbreviated).
 * @typedef {Object} AuditExecutionListItem
 * @property {string} id
 * @property {string} [datasourceKey]
 * @property {string} [operation]
 * @property {string} [correlationId]
 * @property {'captured'|'disabled'} rbacAuditStatus
 * @property {'captured'|'disabled'} abacAuditStatus
 * @property {import('./audit.types').ForeignKeyReference} [rbacDecision]
 * @property {import('./audit.types').ForeignKeyReference} [abacTrace]
 */

/**
 * @typedef {Object} ForeignKeyReference
 * @property {string} [id]
 * @property {string} [key]
 * @property {string} [name]
 */

/**
 * RBAC decision list item.
 * @typedef {Object} AuditRbacDecisionListItem
 * @property {string} id
 * @property {import('./audit.types').ForeignKeyReference} [executionId]
 * @property {string} [reason]
 * @property {string} [decision]
 */

/**
 * ABAC trace list item.
 * @typedef {Object} AuditAbacTraceListItem
 * @property {string} id
 * @property {import('./audit.types').ForeignKeyReference} [executionId]
 * @property {string} [decision]
 * @property {string} [reason]
 */

/**
 * One matrix row result.
 * @typedef {Object} AuditEvidenceMatrixRow
 * @property {number} row
 * @property {'passed'|'failed'} status
 * @property {string} detail
 * @property {string} [code]
 */

/**
 * Verifier output (407.3).
 * @typedef {Object} AuditEvidenceVerification
 * @property {'passed'|'failed'} status
 * @property {string} datasourceKey
 * @property {string|null} correlationId
 * @property {string[]} executionIds
 * @property {AuditEvidenceMatrixRow[]} matrix
 */

module.exports = {};
