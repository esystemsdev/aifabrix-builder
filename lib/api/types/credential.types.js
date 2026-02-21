/**
 * @fileoverview Credential API type definitions (Dataplane secret store)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Single secret item for Dataplane credential secret store.
 * Key is the kv:// path; value must be plain (resolved), never a kv:// reference.
 * @typedef {Object} SecretStoreItem
 * @property {string} key - kv:// path (e.g. kv://secrets/client-secret)
 * @property {string} value - Plain secret value (encrypted at rest by dataplane)
 */

/**
 * Response from POST /api/v1/credential/secret (Dataplane).
 * @typedef {Object} SecretStoreResponse
 * @property {number} [stored] - Number of secrets stored
 * @property {boolean} [success] - Request success flag
 * @property {string} [error] - Error message when success is false
 */

module.exports = {};
