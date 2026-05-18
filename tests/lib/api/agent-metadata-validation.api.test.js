/**
 * Tests for agent metadata validation API (404.5)
 *
 * @fileoverview Tests for lib/api/agent-metadata-validation.api.js
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => ({
  baseUrl,
  authConfig,
  get: mockClient.get,
  post: mockClient.post
}));

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient,
  createDataplaneApiClient: mockApiClient
}));

const agentMetadataApi = require('../../../lib/api/agent-metadata-validation.api');

describe('Agent metadata validation API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };
  const sourceKey = 'hubspot-companies';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: {} });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
  });

  describe('runAgentMetadataValidation', () => {
    it('posts to agent-metadata-validation with body', async () => {
      const body = { forceRevalidate: true };
      await agentMetadataApi.runAgentMetadataValidation(
        dataplaneUrl,
        sourceKey,
        authConfig,
        body
      );

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/external/hubspot-companies/agent-metadata-validation',
        { body }
      );
    });
  });

  describe('getLatestAgentMetadataValidation', () => {
    it('gets latest agent-validation', async () => {
      await agentMetadataApi.getLatestAgentMetadataValidation(
        dataplaneUrl,
        sourceKey,
        authConfig
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/external/hubspot-companies/agent-validation'
      );
    });
  });

  describe('listAgentMetadataValidationHistory', () => {
    it('gets agent-validation history', async () => {
      await agentMetadataApi.listAgentMetadataValidationHistory(
        dataplaneUrl,
        sourceKey,
        authConfig
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/external/hubspot-companies/agent-validation/history'
      );
    });
  });
});
