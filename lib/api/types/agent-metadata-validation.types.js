/**
 * @fileoverview Agent metadata validation API types (dataplane 404.5)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

/**
 * @typedef {'info' | 'warning' | 'error'} AgentValidationFindingSeverity
 */

/**
 * @typedef {Object} AgentValidationFinding
 * @property {AgentValidationFindingSeverity} severity
 * @property {string} code
 * @property {string} message
 * @property {string} [field]
 * @property {string} [recommendation]
 */

/**
 * @typedef {'pending' | 'passed' | 'warning' | 'failed'} AgentValidationStatus
 */

/**
 * @typedef {'trusted' | 'usableWithWarnings' | 'notTrusted' | 'pending'} AgentTrustDecision
 */

/**
 * @typedef {Object} AgentMetadataValidationResult
 * @property {AgentValidationStatus} status
 * @property {AgentTrustDecision} trustDecision
 * @property {number} confidence
 * @property {string} summary
 * @property {AgentValidationFinding[]} findings
 * @property {string} validatedAt - ISO 8601
 * @property {string} inputHash
 * @property {string} contractVersion
 */

/**
 * @typedef {Object} AgentMetadataValidationRunRequest
 * @property {boolean} [forceRevalidate]
 * @property {Object<string, Object>} [peerDatasourceConfigs]
 */

/**
 * @typedef {Object} AgentMetadataValidationRunResponse
 * @property {string} id
 * @property {string} externalDataSourceId
 * @property {string} datasourceKey
 * @property {AgentMetadataValidationResult} result
 * @property {boolean} [reused]
 */

/**
 * @typedef {Object} AgentMetadataValidationHistoryItem
 * @property {string} id
 * @property {string} inputHash
 * @property {string} contractVersion
 * @property {AgentTrustDecision} trustDecision
 * @property {AgentValidationStatus} validationStatus
 * @property {number} confidence
 * @property {string} validatedAt
 * @property {boolean} isLatest
 */

module.exports = {};
