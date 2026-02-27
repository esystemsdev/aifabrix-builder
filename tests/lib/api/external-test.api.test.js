/**
 * Tests for External Test API
 * @fileoverview Tests for lib/api/external-test.api.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  post: jest.fn()
};

jest.mock('../../../lib/api/index', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    post: mockClient.post
  }))
}));

const externalTestApi = require('../../../lib/api/external-test.api');

describe('External Test API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const sourceIdOrKey = 'hubspot-contacts';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockResolvedValue({ success: true, data: {} });
  });

  describe('testDatasourceE2E', () => {
    it('should call POST /api/v1/external/{sourceIdOrKey}/test-e2e', async() => {
      await externalTestApi.testDatasourceE2E(dataplaneUrl, sourceIdOrKey, authConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/external/${sourceIdOrKey}/test-e2e`,
        { body: {} }
      );
    });

    it('should throw when auth has no token or apiKey', async() => {
      await expect(
        externalTestApi.testDatasourceE2E(dataplaneUrl, sourceIdOrKey, {})
      ).rejects.toThrow('E2E tests require Bearer token or API key');
    });
  });
});
