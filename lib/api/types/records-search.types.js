/**
 * @fileoverview Types for dataplane Records Search API
 * @author AI Fabrix Team
 * @version 1.0.0
 */

/**
 * Records search request
 * @typedef {Object} RecordsSearchRequest
 * @property {'retrieval'|'grounding'|'analytics'|'validation'} intent
 * @property {string[]} [datasourceKeys]
 * @property {string[]} [resourceTypes]
 * @property {string|Object} [filters]
 * @property {string|Object} [exclude]
 * @property {'ids'|'full'} [searchMode]
 * @property {number} [limit]
 * @property {boolean} [dryRun]
 */

/**
 * Records search response
 * @typedef {Object} RecordsSearchResponse
 * @property {Array<string|Object>} data
 * @property {Object} meta
 * @property {Object} [links]
 */

module.exports = {};
