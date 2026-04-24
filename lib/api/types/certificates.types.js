/**
 * @fileoverview JSDoc typedefs for dataplane Trust / integration certificate APIs (camelCase).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Integration certificate artifact (dataplane OpenAPI **CertificateArtifactResponse**).
 *
 * @typedef {Object} CertificateArtifactResponse
 * @property {string|{id?: string}} [certificateId]
 * @property {string} [systemKey]
 * @property {string} [datasourceKey]
 * @property {string} [version]
 * @property {string|null} [certificateVersion]
 * @property {string|null} [systemVersion]
 * @property {string} [certificationLevel]
 * @property {Object} [metrics]
 * @property {string|null} [contractHash]
 * @property {string|null} [integrationHash]
 * @property {string} [issuedAt]
 * @property {string} [issuedBy]
 * @property {string} [licenseLevelIssuer]
 * @property {string} [dataplaneVersion]
 * @property {'RS256'} [algorithm] Integration certificate signing algorithm (RS256 only)
 * @property {string|null} [publicKey]
 * @property {string|null} [publicKeyFingerprint]
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} CertificateVerificationResponse
 * @property {boolean} validSignature
 * @property {boolean} validHash
 * @property {boolean} overallValid
 * @property {string[]} [reasons]
 */

/**
 * @typedef {Object} CertificateVerifyRequest
 * @property {string|null} [certificateId]
 * @property {Object|null} [certificate]
 * @property {boolean} [verifyHash]
 * @property {string|null} [systemIdOrKey]
 * @property {string|null} [datasourceKey]
 */

module.exports = {};
