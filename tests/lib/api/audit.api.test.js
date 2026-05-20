/**
 * @fileoverview Tests for lib/api/audit.api.js
 */

'use strict';

const mockClient = {
  get: jest.fn()
};

jest.mock('../../../lib/api/index', () => ({
  createDataplaneApiClient: jest.fn(() => mockClient)
}));

const auditApi = require('../../../lib/api/audit.api');

describe('audit.api', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queryExecutions passes datasourceKey and correlationId query params', async() => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: { data: [], meta: { totalItems: 0 } }
    });

    await auditApi.queryExecutions(dataplaneUrl, authConfig, {
      datasourceKey: 'test-ds',
      correlationId: 'corr-99'
    });

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/audit/executions', {
      params: expect.objectContaining({
        page: 1,
        pageSize: 100,
        datasourceKey: 'test-ds',
        correlationId: 'corr-99'
      })
    });
  });

  it('queryRbacDecisions passes targetDatasourceKey', async() => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: { data: [], meta: { totalItems: 0 } }
    });

    await auditApi.queryRbacDecisions(dataplaneUrl, authConfig, {
      targetDatasourceKey: 'test-ds'
    });

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/audit/rbac-decisions', {
      params: expect.objectContaining({
        targetDatasourceKey: 'test-ds',
        sort: '-timestamp'
      })
    });
  });

  it('queryAbacTraces passes datasourceKey', async() => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: { data: [], meta: { totalItems: 0 } }
    });

    await auditApi.queryAbacTraces(dataplaneUrl, authConfig, {
      datasourceKey: 'test-ds'
    });

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/audit/abac-traces', {
      params: expect.objectContaining({ datasourceKey: 'test-ds' })
    });
  });
});
