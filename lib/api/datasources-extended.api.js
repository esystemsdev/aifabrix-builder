/**
 * @fileoverview Datasources Extended API functions (records, grants, policies, sync, documents). All require Dataplane; scope per endpoint in dataplane OpenAPI.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/** @requiresPermission {Dataplane} external-system:read (records) */
async function listRecords(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/records`, { params: options });
}
/** @requiresPermission {Dataplane} external-system:create */
async function createRecord(dataplaneUrl, sourceIdOrKey, authConfig, recordData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/records`, { body: recordData });
}
/** @requiresPermission {Dataplane} external-system:read */
async function getRecord(dataplaneUrl, sourceIdOrKey, recordIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/records/${recordIdOrKey}`);
}
/** @requiresPermission {Dataplane} external-system:update */
async function updateRecord(dataplaneUrl, sourceIdOrKey, recordIdOrKey, authConfig, updateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.put(`/api/v1/external/${sourceIdOrKey}/records/${recordIdOrKey}`, { body: updateData });
}
/** @requiresPermission {Dataplane} external-system:delete */
async function deleteRecord(dataplaneUrl, sourceIdOrKey, recordIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.delete(`/api/v1/external/${sourceIdOrKey}/records/${recordIdOrKey}`);
}
/** @requiresPermission {Dataplane} external-system:read (grants) */
async function listGrants(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/grants`, { params: options });
}
/** @requiresPermission {Dataplane} external-system:update */
async function createGrant(dataplaneUrl, sourceIdOrKey, authConfig, grantData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/grants`, { body: grantData });
}
/** @requiresPermission {Dataplane} external-system:read */
async function getGrant(dataplaneUrl, sourceIdOrKey, grantIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/grants/${grantIdOrKey}`);
}
/** @requiresPermission {Dataplane} external-system:update */
async function updateGrant(dataplaneUrl, sourceIdOrKey, grantIdOrKey, authConfig, updateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.put(`/api/v1/external/${sourceIdOrKey}/grants/${grantIdOrKey}`, { body: updateData });
}
async function deleteGrant(dataplaneUrl, sourceIdOrKey, grantIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.delete(`/api/v1/external/${sourceIdOrKey}/grants/${grantIdOrKey}`);
}
/** @requiresPermission {Dataplane} external-system:read (policies) */
async function listPolicies(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/policies`, { params: options });
}
/** @requiresPermission {Dataplane} external-system:update */
async function attachPolicy(dataplaneUrl, sourceIdOrKey, authConfig, policyData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/policies`, { body: policyData });
}
async function detachPolicy(dataplaneUrl, sourceIdOrKey, policyIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.delete(`/api/v1/external/${sourceIdOrKey}/policies/${policyIdOrKey}`);
}
/** @requiresPermission {Dataplane} external-system:read (sync) */
async function listSyncJobs(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/sync`, { params: options });
}
async function createSyncJob(dataplaneUrl, sourceIdOrKey, authConfig, syncData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/sync`, { body: syncData });
}
/** @requiresPermission {Dataplane} external-system:read */
async function getSyncJob(dataplaneUrl, sourceIdOrKey, syncJobId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/${sourceIdOrKey}/sync/${syncJobId}`);
}
/** @requiresPermission {Dataplane} external-system:update */
async function updateSyncJob(dataplaneUrl, sourceIdOrKey, syncJobId, authConfig, updateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.put(`/api/v1/external/${sourceIdOrKey}/sync/${syncJobId}`, { body: updateData });
}
async function executeSyncJob(dataplaneUrl, sourceIdOrKey, syncJobId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${sourceIdOrKey}/sync/${syncJobId}/execute`);
}
/** @requiresPermission {Dataplane} document-record or external-system scope */
async function validateDocuments(dataplaneUrl, sourceIdOrKey, authConfig, validateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/data-sources/${sourceIdOrKey}/documents/validate`, { body: validateData });
}
/** @requiresPermission {Dataplane} document-record or external-system scope */
async function bulkDocuments(dataplaneUrl, sourceIdOrKey, authConfig, bulkData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/data-sources/${sourceIdOrKey}/documents/bulk`, { body: bulkData });
}
/** @requiresPermission {Dataplane} document-record:read or external-system:read */
async function listDocuments(dataplaneUrl, sourceIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/data-sources/${sourceIdOrKey}/documents`, { params: options });
}

module.exports = {
  listRecords,
  createRecord,
  getRecord,
  updateRecord,
  deleteRecord,
  listGrants,
  createGrant,
  getGrant,
  updateGrant,
  deleteGrant,
  listPolicies,
  attachPolicy,
  detachPolicy,
  listSyncJobs,
  createSyncJob,
  getSyncJob,
  updateSyncJob,
  executeSyncJob,
  validateDocuments,
  bulkDocuments,
  listDocuments
};

