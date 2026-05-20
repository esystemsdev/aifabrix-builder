/**
 * @fileoverview Governance scenario acceptance API types
 * @author AI Fabrix Team
 * @version 1.0.0
 */

/**
 * @typedef {Object} GovernanceScenariosRunRequest
 * @property {string} systemKey
 * @property {Object} pack - Inline governance scenario pack document
 * @property {string[]} [scenarios] - Optional subset of scenario ids
 */

/**
 * @typedef {Object} GovernanceScenarioResult
 * @property {string} id
 * @property {'pass'|'fail'} status
 * @property {string} verdict
 * @property {string} subjectUserId
 * @property {string} subjectDisplayName
 * @property {string[]} subjectGroups
 * @property {number} visibleKeyCount
 * @property {string[]} unexpectedVisibleKeys
 * @property {string[]} missingRequiredKeys
 * @property {number} excludedAbac
 * @property {number} excludedFilter
 * @property {string} [failureReason]
 * @property {string} [fixHint]
 * @property {string} [auditRef]
 */

/**
 * @typedef {Object} GovernanceScenariosRunResponse
 * @property {string} packKey
 * @property {{ total: number, passed: number, failed: number }} summary
 * @property {GovernanceScenarioResult[]} scenarios
 */

module.exports = {};
