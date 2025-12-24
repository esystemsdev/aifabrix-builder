/**
 * @fileoverview Datasources Core API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

async function listDatasources(dataplaneUrl, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get('/api/v1/external/', { params: options });
}
async function createDatasource(dataplaneUrl, authConfig, datasourceData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/external/', { body: datasourceData });
}
async function getDatasource(dataplaneUrl, sourceIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}`);
}
async function updateDatasource(dataplaneUrl, sourceIdOrKey, authConfig, updateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.put(`/api/v1/external/${sourceIdOrKey}`, { body: updateData });
}
async function deleteDatasource(dataplaneUrl, sourceIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.delete(`/api/v1/external/${sourceIdOrKey}`);
}
async function getDatasourceConfig(dataplaneUrl, sourceIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/config`);
}
async function publishDatasource(dataplaneUrl, sourceIdOrKey, authConfig, publishData = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/publish`, { body: publishData });
}
async function rollbackDatasource(dataplaneUrl, sourceIdOrKey, authConfig, rollbackData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/rollback`, { body: rollbackData });
}
async function testDatasource(dataplaneUrl, sourceIdOrKey, authConfig, testData = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/test`, { body: testData });
}
async function listDatasourceOpenAPIEndpoints(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/openapi-endpoints`, { params: options });
}
async function listExecutionLogs(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/executions`, { params: options });
}
async function getExecutionLog(dataplaneUrl, sourceIdOrKey, executionId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/executions/${executionId}`);
}
async function listAllExecutionLogs(dataplaneUrl, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get('/api/v1/external/executions', { params: options });
}
async function bulkOperation(dataplaneUrl, sourceIdOrKey, authConfig, bulkData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/bulk`, { body: bulkData });
}
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

