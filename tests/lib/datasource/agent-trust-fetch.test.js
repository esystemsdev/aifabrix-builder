/**
 * @fileoverview Tests for agent trust dataplane fetch paths.
 */

jest.mock('../../../lib/api/agent-metadata-validation.api', () => ({
  runAgentMetadataValidation: jest.fn(),
  getLatestAgentMetadataValidation: jest.fn()
}));

const api = require('../../../lib/api/agent-metadata-validation.api');
const {
  shouldPreferLatestRead,
  fetchTrustRunFromDataplane,
  isLatestNotFoundError
} = require('../../../lib/datasource/agent-trust-fetch');

describe('agent-trust-fetch', () => {
  const base = {
    dataplaneUrl: 'https://dp.example',
    datasourceKey: 'hubspot-companies',
    systemKey: 'hubspot',
    authConfig: { type: 'bearer', token: 't' },
    options: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AIFABRIX_AGENT_TRUST_MOCK;
    api.runAgentMetadataValidation.mockResolvedValue({
      result: {
        trustDecision: 'trusted',
        status: 'passed',
        confidence: 0.9,
        summary: 'ok'
      },
      reused: false
    });
    api.getLatestAgentMetadataValidation.mockResolvedValue({
      trustDecision: 'trusted',
      status: 'passed',
      confidence: 0.85,
      summary: 'cached'
    });
  });

  it('shouldPreferLatestRead when summary without revalidate', () => {
    expect(shouldPreferLatestRead({ summary: true, revalidate: false })).toBe(true);
    expect(shouldPreferLatestRead({ summary: true, revalidate: true })).toBe(false);
    expect(shouldPreferLatestRead({ summary: false })).toBe(false);
  });

  it('posts validate by default', async() => {
    const run = await fetchTrustRunFromDataplane(base);
    expect(api.runAgentMetadataValidation).toHaveBeenCalled();
    expect(api.getLatestAgentMetadataValidation).not.toHaveBeenCalled();
    expect(run.trustDecision).toBe('trusted');
  });

  it('reads latest on summary fast path', async() => {
    const run = await fetchTrustRunFromDataplane({
      ...base,
      options: { summary: true }
    });
    expect(api.getLatestAgentMetadataValidation).toHaveBeenCalled();
    expect(api.runAgentMetadataValidation).not.toHaveBeenCalled();
    expect(run.readLatest).toBe(true);
    expect(run.cacheHit).toBe(true);
  });

  it('falls back to POST when latest is 404', async() => {
    api.getLatestAgentMetadataValidation.mockRejectedValue({
      statusCode: 404,
      message: 'No agent metadata validation found'
    });
    await fetchTrustRunFromDataplane({ ...base, options: { summary: true } });
    expect(api.getLatestAgentMetadataValidation).toHaveBeenCalled();
    expect(api.runAgentMetadataValidation).toHaveBeenCalled();
  });

  it('detects latest-not-found errors', () => {
    expect(isLatestNotFoundError({ statusCode: 404 })).toBe(true);
    expect(isLatestNotFoundError({ message: 'No agent metadata validation found' })).toBe(true);
    expect(isLatestNotFoundError({ statusCode: 500 })).toBe(false);
  });
});
