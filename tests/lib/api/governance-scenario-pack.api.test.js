/**
 * @fileoverview Tests for governance scenario pack API (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/api/index', () => ({
  createDataplaneApiClient: jest.fn()
}));

const { createDataplaneApiClient } = require('../../../lib/api/index');
const {
  upsertDatasourceGovernancePack,
  runDatasourceGovernanceScenarios
} = require('../../../lib/api/governance-scenario-pack.api');

describe('governance-scenario-pack.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUT upserts pack for datasource', async() => {
    const mockPut = jest.fn().mockResolvedValue({
      success: true,
      data: { datasourceKey: 'ds-a', packKey: 'pack-v1' }
    });
    createDataplaneApiClient.mockReturnValue({ put: mockPut });

    const pack = { metadata: { key: 'pack-v1' } };
    const result = await upsertDatasourceGovernancePack(
      'http://localhost:3201',
      { token: 't' },
      'ds-a',
      pack
    );

    expect(mockPut).toHaveBeenCalledWith('/api/v1/external/ds-a/governance-scenarios', {
      body: { pack }
    });
    expect(result.packKey).toBe('pack-v1');
  });

  it('POST runs persisted pack for datasource', async() => {
    const mockPost = jest.fn().mockResolvedValue({
      success: true,
      data: { summary: { total: 2, passed: 2, failed: 0 }, scenarios: [] }
    });
    createDataplaneApiClient.mockReturnValue({ post: mockPost });

    const result = await runDatasourceGovernanceScenarios(
      'http://localhost:3201',
      { token: 't' },
      'ds-a'
    );

    expect(mockPost).toHaveBeenCalledWith('/api/v1/external/ds-a/governance-scenarios/run', {
      body: {}
    });
    expect(result.summary.passed).toBe(2);
  });
});
