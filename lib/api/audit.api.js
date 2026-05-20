/**
 * @fileoverview Dataplane audit read API (Plan 407.1 / 407.3 evidence matrix)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { createDataplaneApiClient } = require('./index');
const { unwrapPaginatedAuditList, unwrapExecutionSubresource } = require('./audit-api-helpers');

const AUDIT_BASE = '/api/v1/audit';
const DEFAULT_PAGE_SIZE = 100;

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {Object} [query]
 * @returns {Promise<{ data: import('./types/audit.types').AuditExecutionListItem[], meta: import('./types/audit.types').AuditListMeta|null }>}
 * @requiresPermission {Dataplane} audit:read
 */
async function queryExecutions(dataplaneUrl, authConfig, query = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/executions`, {
    params: {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      ...query
    }
  });
  return unwrapPaginatedAuditList(res);
}

/**
 * @requiresPermission {Dataplane} audit:read
 */
async function queryRbacDecisions(dataplaneUrl, authConfig, query = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/rbac-decisions`, {
    params: {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: '-timestamp',
      ...query
    }
  });
  return unwrapPaginatedAuditList(res);
}

/**
 * @requiresPermission {Dataplane} audit:read
 */
async function queryAbacTraces(dataplaneUrl, authConfig, query = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/abac-traces`, {
    params: {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      ...query
    }
  });
  return unwrapPaginatedAuditList(res);
}

/**
 * @requiresPermission {Dataplane} audit:read
 */
async function getExecutionRbac(dataplaneUrl, authConfig, executionId) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/executions/${executionId}/rbac`);
  return unwrapExecutionSubresource(res);
}

/**
 * @requiresPermission {Dataplane} audit:read
 */
async function getExecutionAbac(dataplaneUrl, authConfig, executionId) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/executions/${executionId}/abac`);
  return unwrapExecutionSubresource(res);
}

/**
 * @requiresPermission {Dataplane} audit:read
 */
async function getExecutionTrace(dataplaneUrl, authConfig, executionId) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/executions/${executionId}/trace`);
  return unwrapExecutionSubresource(res);
}

/**
 * @requiresPermission {Dataplane} audit:read
 */
async function getExecutionSteps(dataplaneUrl, authConfig, executionId) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/executions/${executionId}/steps`);
  return unwrapExecutionSubresource(res);
}

/**
 * @requiresPermission {Dataplane} audit:read
 */
async function getExecutionErrors(dataplaneUrl, authConfig, executionId) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${AUDIT_BASE}/executions/${executionId}/errors`);
  return unwrapExecutionSubresource(res);
}

module.exports = {
  queryExecutions,
  queryRbacDecisions,
  queryAbacTraces,
  getExecutionRbac,
  getExecutionAbac,
  getExecutionTrace,
  getExecutionSteps,
  getExecutionErrors
};
