/**
 * @fileoverview JSDoc types for unified validation run (POST /api/v1/validation/run).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * @typedef {'externalSystem'|'externalDataSource'} ValidationScope
 */

/**
 * @typedef {'test'|'integration'|'e2e'} ValidationRunKind
 */

/**
 * Request body for POST /api/v1/validation/run (camelCase; see Dataplane OpenAPI).
 * @typedef {Object} ValidationRunRequestBody
 * @property {string} [systemIdOrKey]
 * @property {string} [systemKey]
 * @property {string[]} [datasourceKeys]
 * @property {string} [datasourceKey]
 * @property {boolean} [explain]
 * @property {boolean} [includeLiveChecks]
 * @property {boolean} [includeLiveDebug]
 * @property {boolean} [showCapabilities]
 * @property {boolean} [explainMetrics]
 * @property {boolean} [explainCertification]
 * @property {boolean} [includeMetrics]
 * @property {boolean} [includeCertification]
 * @property {Object} [systemConfig]
 * @property {Object[]} [datasourceConfigs]
 * @property {ValidationScope} [validationScope]
 * @property {ValidationRunKind} [runType]
 * @property {Object} [payloadTemplate]
 * @property {boolean} [asyncRun]
 * @property {Object} [e2eOptions]
 * @property {boolean} [includeDebug]
 */

/**
 * Minimal DatasourceTestRun shape for CLI exit / display (full schema in lib/schema).
 * @typedef {Object} DatasourceTestRunLike
 * @property {string} [reportVersion]
 * @property {string} datasourceKey
 * @property {string} systemKey
 * @property {ValidationRunKind} runType
 * @property {'ok'|'warn'|'fail'|'skipped'} status
 * @property {'minimal'|'partial'|'full'} [reportCompleteness]
 * @property {string} [runId]
 * @property {string} [testRunId]
 * @property {Object} [certificate]
 * @property {string} [certificate.status]
 * @property {Object} [developer]
 */

module.exports = {};
