/**
 * @fileoverview Datasources API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Pagination types - shared with other API modules

/**
 * External data source response
 * @typedef {Object} ExternalDataSourceResponse
 * @property {string} id - Datasource ID
 * @property {string} key - Datasource key (unique identifier)
 * @property {string} displayName - Display name
 * @property {string|null} description - Datasource description
 * @property {string} externalSystemId - External system ID
 * @property {string} resourceType - Resource type
 * @property {Object} fieldMappings - Field mappings configuration
 * @property {string} status - Status ('draft' | 'published' | 'archived')
 * @property {boolean} isActive - Whether datasource is active
 * @property {string} createdAt - Creation timestamp (ISO 8601)
 * @property {string} updatedAt - Update timestamp (ISO 8601)
 */

/**
 * External data source create request
 * @typedef {Object} ExternalDataSourceCreate
 * @property {string} key - Datasource key
 * @property {string} displayName - Display name
 * @property {string} [description] - Description
 * @property {string} externalSystemId - External system ID
 * @property {string} resourceType - Resource type
 * @property {Object} [fieldMappings] - Field mappings
 * @property {Object} [configuration] - Configuration
 */

/**
 * External data source update request
 * @typedef {Object} ExternalDataSourceUpdate
 * @property {string} [displayName] - Display name
 * @property {string} [description] - Description
 * @property {Object} [fieldMappings] - Field mappings
 * @property {Object} [configuration] - Configuration
 * @property {boolean} [isActive] - Active status
 */

/**
 * External data source config response (with MCP contract)
 * @typedef {Object} ExternalDataSourceConfigResponse
 * @property {ExternalDataSourceResponse} datasource - Datasource configuration
 * @property {Object} [mcpContract] - MCP contract if generated
 */

/**
 * List datasources request options
 * @typedef {Object} ListDatasourcesRequest
 * @property {number} [page] - Page number (default: 1)
 * @property {number} [pageSize] - Items per page (default: 20)
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 * @property {string} [search] - Search term
 */

/**
 * List datasources response
 * @typedef {Object} ListDatasourcesResponse
 * @property {ExternalDataSourceResponse[]} items - Array of datasources
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {PaginationLinks} links - Pagination links
 */

/** @typedef {ExternalDataSourceCreate} CreateDatasourceRequest */
/** @typedef {Object} CreateDatasourceResponse @property {ExternalDataSourceResponse} data */
/** @typedef {Object} GetDatasourceResponse @property {ExternalDataSourceResponse} data */
/** @typedef {ExternalDataSourceUpdate} UpdateDatasourceRequest */
/** @typedef {Object} UpdateDatasourceResponse @property {ExternalDataSourceResponse} data */
/** @typedef {Object} DeleteDatasourceResponse @property {null} data */

/**
 * Get datasource config response
 * @typedef {Object} GetDatasourceConfigResponse
 * @property {ExternalDataSourceConfigResponse} data - Full config with MCP contract
 */

/**
 * Publish datasource request
 * @typedef {Object} PublishDatasourceRequest
 * @property {boolean} [generateMcpContract] - Whether to generate MCP contract
 */

/**
 * Publish datasource response
 * @typedef {Object} PublishDatasourceResponse
 * @property {ExternalDataSourceResponse} data - Published datasource
 */

/**
 * Rollback datasource request
 * @typedef {Object} RollbackDatasourceRequest
 * @property {number} version - Version to rollback to
 */

/**
 * Rollback datasource response
 * @typedef {Object} RollbackDatasourceResponse
 * @property {ExternalDataSourceResponse} data - Rolled back datasource
 */

/**
 * Test datasource request
 * @typedef {Object} TestDatasourceRequest
 * @property {Object} [payloadTemplate] - Payload template for testing
 */

/**
 * Test datasource response
 * @typedef {Object} TestDatasourceResponse
 * @property {boolean} success - Test success flag
 * @property {Object} [data] - Test result data
 * @property {string} [message] - Test message
 */

/** @typedef {Object} ListDatasourceOpenAPIEndpointsRequest @property {number} [page] @property {number} [pageSize] @property {string} [sort] @property {string} [filter] */
/** @typedef {Object} ListDatasourceOpenAPIEndpointsResponse @property {Object[]} items @property {Object} meta @property {Object} links */

/**
 * CIP execution log response
 * @typedef {Object} CIPExecutionLogResponse
 * @property {string} id - Execution ID
 * @property {string} sourceId - Source ID
 * @property {string} status - Execution status
 * @property {Object} [result] - Execution result
 * @property {string} [error] - Error message if failed
 * @property {string} createdAt - Creation timestamp
 */

/** @typedef {Object} ListExecutionLogsRequest @property {number} [page] @property {number} [pageSize] @property {string} [sort] @property {string} [filter] */
/** @typedef {Object} ListExecutionLogsResponse @property {CIPExecutionLogResponse[]} items @property {Object} meta @property {Object} links */
/** @typedef {Object} GetExecutionLogResponse @property {CIPExecutionLogResponse} data */

/**
 * Bulk operation request
 * @typedef {Object} BulkOperationRequest
 * @property {string} operation - Operation type ('sync' | 'update' | 'delete')
 * @property {Object[]} [records] - Records to process
 * @property {Object} [options] - Operation options
 */

/**
 * Bulk operation response
 * @typedef {Object} BulkOperationResponse
 * @property {boolean} success - Operation success flag
 * @property {number} processed - Number of records processed
 * @property {Object} [result] - Operation result
 */

/**
 * Get datasource status response
 * @typedef {Object} GetDatasourceStatusResponse
 * @property {Object} data - Status data
 * @property {string} data.status - Sync status
 * @property {string} [data.lastSyncAt] - Last sync timestamp
 * @property {number} [data.recordCount] - Record count
 */

/**
 * External record response
 * @typedef {Object} ExternalRecordResponse
 * @property {string} id - Record ID
 * @property {string} key - Record key
 * @property {Object} data - Record data
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Update timestamp
 */

/** @typedef {Object} ListRecordsRequest @property {number} [page] @property {number} [pageSize] @property {string} [sort] @property {string} [filter] */
/** @typedef {Object} ListRecordsResponse @property {ExternalRecordResponse[]} items @property {Object} meta @property {Object} links */
/** @typedef {Object} CreateRecordRequest @property {string} key @property {Object} data */
/** @typedef {Object} CreateRecordResponse @property {ExternalRecordResponse} data */
/** @typedef {Object} GetRecordResponse @property {ExternalRecordResponse} data */
/** @typedef {Object} UpdateRecordRequest @property {Object} data */
/** @typedef {Object} UpdateRecordResponse @property {ExternalRecordResponse} data */
/** @typedef {Object} DeleteRecordResponse @property {null} data */

/**
 * Access grant response
 * @typedef {Object} AccessGrantResponse
 * @property {string} id - Grant ID
 * @property {string} key - Grant key
 * @property {string} userId - User ID
 * @property {string} [groupId] - Group ID
 * @property {Object} permissions - Permissions
 * @property {string} createdAt - Creation timestamp
 */

/** @typedef {Object} ListGrantsRequest @property {number} [page] @property {number} [pageSize] @property {string} [sort] @property {string} [filter] */
/** @typedef {Object} ListGrantsResponse @property {AccessGrantResponse[]} items @property {Object} meta @property {Object} links */
/** @typedef {Object} CreateGrantRequest @property {string} key @property {string} userId @property {string} [groupId] @property {Object} permissions */
/** @typedef {Object} CreateGrantResponse @property {AccessGrantResponse} data */
/** @typedef {Object} GetGrantResponse @property {AccessGrantResponse} data */
/** @typedef {Object} UpdateGrantRequest @property {Object} [permissions] */
/** @typedef {Object} UpdateGrantResponse @property {AccessGrantResponse} data */
/** @typedef {Object} DeleteGrantResponse @property {null} data */

/**
 * Policy response
 * @typedef {Object} PolicyResponse
 * @property {string} id - Policy ID
 * @property {string} key - Policy key
 * @property {string} name - Policy name
 * @property {Object} rules - Policy rules
 */

/** @typedef {Object} ListPoliciesRequest @property {number} [page] @property {number} [pageSize] @property {string} [sort] @property {string} [filter] */
/** @typedef {Object} ListPoliciesResponse @property {PolicyResponse[]} items @property {Object} meta @property {Object} links */
/** @typedef {Object} AttachPolicyRequest @property {string} policyIdOrKey */
/** @typedef {Object} AttachPolicyResponse @property {PolicyResponse} data */
/** @typedef {Object} DetachPolicyResponse @property {null} data */

/**
 * Sync job response
 * @typedef {Object} ExternalDataSourceSyncResponse
 * @property {string} id - Sync job ID
 * @property {string} sourceId - Source ID
 * @property {string} status - Sync status
 * @property {Object} [configuration] - Sync configuration
 * @property {string} [lastRunAt] - Last run timestamp
 * @property {string} createdAt - Creation timestamp
 */

/** @typedef {Object} ListSyncJobsRequest @property {number} [page] @property {number} [pageSize] @property {string} [sort] @property {string} [filter] */
/** @typedef {Object} ListSyncJobsResponse @property {ExternalDataSourceSyncResponse[]} items @property {Object} meta @property {Object} links */
/** @typedef {Object} CreateSyncJobRequest @property {string} key @property {Object} configuration */
/** @typedef {Object} CreateSyncJobResponse @property {ExternalDataSourceSyncResponse} data */
/** @typedef {Object} GetSyncJobResponse @property {ExternalDataSourceSyncResponse} data */
/** @typedef {Object} UpdateSyncJobRequest @property {Object} [configuration] @property {string} [status] */
/** @typedef {Object} UpdateSyncJobResponse @property {ExternalDataSourceSyncResponse} data */
/** @typedef {Object} ExecuteSyncJobResponse @property {boolean} success @property {Object} [result] */

/**
 * Validate documents request
 * @typedef {Object} ValidateDocumentsRequest
 * @property {Object[]} documents - Array of document metadata to validate
 */

/**
 * Validate documents response
 * @typedef {Object} ValidateDocumentsResponse
 * @property {Object[]} needsBinary - Documents that need binary retrieval
 * @property {Object[]} needsUpdate - Documents that need update
 * @property {Object[]} unchanged - Documents that are unchanged
 */

/**
 * Bulk documents request
 * @typedef {Object} BulkDocumentsRequest
 * @property {Object[]} documents - Array of documents with binary data
 */

/**
 * Bulk documents response
 * @typedef {Object} BulkDocumentsResponse
 * @property {boolean} success - Operation success flag
 * @property {number} processed - Number of documents processed
 * @property {Object} [result] - Operation result
 */

/** @typedef {Object} ListDocumentsRequest @property {number} [page] @property {number} [pageSize] @property {string} [sort] @property {string} [filter] */
/** @typedef {Object} ListDocumentsResponse @property {Object[]} items @property {Object} meta @property {Object} links */

module.exports = {};

