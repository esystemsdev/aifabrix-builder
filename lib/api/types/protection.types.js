/**
 * @fileoverview Protection API type definitions (dataplane /api/v1/protection/*).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

/**
 * @typedef {Object} ProtectionUploadRequest
 * @property {Object} manifest - Full protection manifest document
 */

/**
 * @typedef {Object} ProtectionValidateOptions
 * @property {boolean} [strict] - Promote WARN to FAIL
 * @property {boolean} [explain]
 * @property {number} [sampleSize] - For simulate
 */

/**
 * @typedef {Object} ProtectionDeployResponse
 * @property {string} protectionKey
 * @property {string} deploymentId
 * @property {number} revision
 * @property {string} configHash
 * @property {string} deployedAt
 * @property {Object} manifest
 */

/**
 * @typedef {Object} ProtectionManifestResponse
 * @property {string} key
 * @property {string} displayName
 * @property {Object} spec
 * @property {boolean} enabled
 * @property {string} datasourceKey
 * @property {number} [currentRevision]
 * @property {string} [lastDeployedAt]
 */

/**
 * @typedef {Object} ProtectionListResult
 * @property {ProtectionManifestResponse[]} items
 * @property {Object|null} meta
 * @property {*} raw
 */

/**
 * @typedef {Object} ProtectionGrantStatusSummary
 * @property {string} dimensionKey
 * @property {string} effectiveValueType
 * @property {string} projectionRuleKey
 */

/**
 * @typedef {Object} ProtectionStatusResponse
 * @property {string} protectionKey
 * @property {boolean} enabled
 * @property {string} datasourceKey
 * @property {number} [currentRevision]
 * @property {string} [configHash]
 * @property {string} [lastDeployedAt]
 * @property {string} [lastProjectionRunAt]
 * @property {string} [lastSuccessfulProjectionRunAt]
 * @property {number} [dynamicValueCount]
 * @property {number} [grantCount]
 * @property {ProtectionGrantStatusSummary[]} [grants]
 */

module.exports = {};
