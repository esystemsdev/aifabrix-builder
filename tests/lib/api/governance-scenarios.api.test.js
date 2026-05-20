/**
 * @fileoverview Tests for governance scenarios API module
 */

jest.mock('../../../lib/api/index', () => ({
  createDataplaneApiClient: jest.fn()
}));

const { createDataplaneApiClient } = require('../../../lib/api/index');
const { runGovernanceScenarios } = require('../../../lib/api/governance-scenarios.api');

describe('governance-scenarios.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts inline pack to governance scenarios run', async() => {
    const payload = {
      packKey: 'p1',
      summary: { total: 0, passed: 0, failed: 0 },
      scenarios: []
    };
    const mockPost = jest.fn().mockResolvedValue({ success: true, data: payload });
    createDataplaneApiClient.mockReturnValue({ post: mockPost });

    const body = { systemKey: 'protection-test', pack: { kind: 'GovernanceScenarioPack' } };
    const result = await runGovernanceScenarios('http://localhost:3001', { token: 't', type: 'bearer' }, body);

    expect(createDataplaneApiClient).toHaveBeenCalledWith('http://localhost:3001', {
      token: 't',
      type: 'bearer'
    });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/governance/scenarios/run', { body });
    expect(result.packKey).toBe('p1');
  });
});
