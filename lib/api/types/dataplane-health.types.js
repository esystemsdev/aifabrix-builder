/**
 * @fileoverview Dataplane health API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Dataplane health JSON payload (public, no auth — `security: []` on dataplane).
 * Matches `app/schemas/common.py` `HealthResponse` in aifabrix-dataplane (plan 403.0).
 * @typedef {Object} DataplaneHealthPayload
 * @property {string} status - 'healthy' or 'unhealthy'
 * @property {string} service - Service name (e.g. 'dataplane')
 * @property {string} version - Dataplane semver (always present)
 * @property {string} [message] - Optional probe message (e.g. 'pong')
 * @property {string} [minBuilderCliVersion] - Minimum supported Builder CLI semver; omitted when not enforced
 */

/**
 * Parsed health snapshot used by Builder CLI cache + UX.
 * @typedef {Object} DataplaneHealthSnapshot
 * @property {string} status - 'healthy' / 'unhealthy' / 'unknown'
 * @property {string} [version] - Dataplane version (undefined when probe failed)
 * @property {string} [minBuilderCliVersion] - Trimmed minimum required Builder CLI semver (undefined when not enforced)
 * @property {string|null} [endpoint] - Dataplane endpoint path that answered (e.g. '/api/v1/health' or '/health')
 */

module.exports = {};
