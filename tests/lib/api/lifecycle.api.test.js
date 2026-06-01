/**
 * @fileoverview Tests for lifecycle.api client (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/api/index', () => ({
  createDataplaneApiClient: jest.fn()
}));

const { createDataplaneApiClient } = require('../../../lib/api/index');
const {
  getSystemLifecycleReport,
  runSystemLifecycle
} = require('../../../lib/api/lifecycle.api');

describe('lifecycle.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET system lifecycle report', async() => {
    const report = {
      systemKey: 'acme-crm',
      certification: { level: 'BRONZE', status: 'TECHNICALLY_READY' }
    };
    const mockGet = jest.fn().mockResolvedValue({ success: true, data: report });
    createDataplaneApiClient.mockReturnValue({ get: mockGet });

    const result = await getSystemLifecycleReport('http://localhost:3201', { token: 't' }, 'acme-crm', {
      summary: true
    });

    expect(mockGet).toHaveBeenCalledWith('/api/v1/external/systems/acme-crm/lifecycle', {
      params: { summary: true }
    });
    expect(result.systemKey).toBe('acme-crm');
  });

  it('POST lifecycle run', async() => {
    const runRes = { report: { systemKey: 'acme-crm' }, stepsRun: [] };
    const mockPost = jest.fn().mockResolvedValue({ success: true, data: runRes });
    createDataplaneApiClient.mockReturnValue({ post: mockPost });

    const result = await runSystemLifecycle('http://localhost:3201', { token: 't' }, 'acme-crm', {});

    expect(mockPost).toHaveBeenCalledWith('/api/v1/external/systems/acme-crm/lifecycle/run', {
      body: {}
    });
    expect(result.report.systemKey).toBe('acme-crm');
  });
});
