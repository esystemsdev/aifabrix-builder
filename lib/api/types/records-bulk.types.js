/**
 * @fileoverview Types for dataplane bulk record sync API
 * @author AI Fabrix Team
 * @version 1.0.0
 */

/**
 * Single record in a bulk sync request
 * @typedef {Object} ExternalBulkRecord
 * @property {string} key - External record key
 * @property {string} displayName - Human-readable label
 * @property {string} recordType - Resource type from datasource manifest
 * @property {Object} metadata - Record metadata payload
 */

/**
 * Bulk sync request body
 * @typedef {Object} ExternalRecordBulkRequest
 * @property {'incremental'|'bulk'|'validate'} syncType - Sync mode
 * @property {boolean} [sync] - Create linked sync job when true
 * @property {ExternalBulkRecord[]} records - Records to process
 */

/**
 * Bulk sync response
 * @typedef {Object} ExternalRecordBulkResponse
 * @property {number} insertedCount
 * @property {number} updatedCount
 * @property {number} deletedCount
 * @property {number} totalProcessed
 * @property {number} [skippedCount]
 * @property {Object} [recordSkipSummary]
 */

module.exports = {};
