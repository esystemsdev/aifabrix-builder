/**
 * @fileoverview Datasources Core API functions (Dataplane /api/v1/external/). All functions require Dataplane auth; scope per endpoint in dataplane OpenAPI (e.g. external-system:read, external-system:create).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/** @requiresPermission {Dataplane} external-system:read (datasource list) */
async function listDatasources(dataplaneUrl, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get('/api/v1/external/', { params: options });
}
/** @requiresPermission {Dataplane} external-system:create */
async function createDatasource(dataplaneUrl, authConfig, datasourceData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/external/', { body: datasourceData });
}
/** @requiresPermission {Dataplane} external-system:read */
async function getDatasource(dataplaneUrl, sourceIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}`);
}
/** @requiresPermission {Dataplane} external-system:update */
async function updateDatasource(dataplaneUrl, sourceIdOrKey, authConfig, updateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.put(`/api/v1/external/${sourceIdOrKey}`, { body: updateData });
}
/** @requiresPermission {Dataplane} external-system:delete */
async function deleteDatasource(dataplaneUrl, sourceIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.delete(`/api/v1/external/${sourceIdOrKey}`);
}
/** @requiresPermission {Dataplane} external-system:read */
async function getDatasourceConfig(dataplaneUrl, sourceIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/config`);
}
/** @requiresPermission {Dataplane} external-system:update */
async function publishDatasource(dataplaneUrl, sourceIdOrKey, authConfig, publishData = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/publish`, { body: publishData });
}
/** @requiresPermission {Dataplane} external-system:update */
async function rollbackDatasource(dataplaneUrl, sourceIdOrKey, authConfig, rollbackData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/rollback`, { body: rollbackData });
}
/** @requiresPermission {Dataplane} external-system:read */
async function testDatasource(dataplaneUrl, sourceIdOrKey, authConfig, testData = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/test`, { body: testData });
}
/** @requiresPermission {Dataplane} external-system:read */
async function listDatasourceOpenAPIEndpoints(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/openapi-endpoints`, { params: options });
}
/** @requiresPermission {Dataplane} audit:read or external-system:read */
async function listExecutionLogs(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/executions`, { params: options });
}
/** @requiresPermission {Dataplane} audit:read or external-system:read */
async function getExecutionLog(dataplaneUrl, sourceIdOrKey, executionId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/executions/${executionId}`);
}
/** @requiresPermission {Dataplane} audit:read */
async function listAllExecutionLogs(dataplaneUrl, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get('/api/v1/external/executions', { params: options });
}
/** @requiresPermission {Dataplane} external-system:update */
async function bulkOperation(dataplaneUrl, sourceIdOrKey, authConfig, bulkData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/bulk`, { body: bulkData });
}
/** @requiresPermission {Dataplane} external-system:read */
async function getDatasourceStatus(dataplaneUrl, sourceIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/status`);
}

module.exports = {
  listDatasources,
  createDatasource,
  getDatasource,
  updateDatasource,
  deleteDatasource,
  getDatasourceConfig,
  publishDatasource,
  rollbackDatasource,
  testDatasource,
  listDatasourceOpenAPIEndpoints,
  listExecutionLogs,
  getExecutionLog,
  listAllExecutionLogs,
  bulkOperation,
  getDatasourceStatus
};

