/**
 * Tests for External Test API
 * @fileoverview Tests for lib/api/external-test.api.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  post: jest.fn(),
  get: jest.fn()
};

jest.mock('../../../lib/api/index', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    post: mockClient.post,
    get: mockClient.get
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
    mockClient.get.mockResolvedValue({ success: true, data: {} });
  });

  describe('testDatasourceE2E', () => {
    it('should call POST /api/v1/external/{sourceIdOrKey}/test-e2e', async() => {
      await externalTestApi.testDatasourceE2E(dataplaneUrl, sourceIdOrKey, authConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/external/${sourceIdOrKey}/test-e2e`,
        { body: {} }
      );
    });

    it('should pass asyncRun query param when options.asyncRun is true', async() => {
      await externalTestApi.testDatasourceE2E(dataplaneUrl, sourceIdOrKey, authConfig, { includeDebug: true }, { asyncRun: true });

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/external/${sourceIdOrKey}/test-e2e`,
        { body: { includeDebug: true }, params: { asyncRun: 'true' } }
      );
    });

    it('should return response with data (sync or async start body)', async() => {
      const syncBody = { steps: [{ name: 'config', success: true }], success: true };
      mockClient.post.mockResolvedValue({ success: true, data: syncBody });
      const result = await externalTestApi.testDatasourceE2E(dataplaneUrl, sourceIdOrKey, authConfig);
      expect(result.data).toEqual(syncBody);

      const asyncStart = { testRunId: 'run-123', status: 'running', startedAt: '2026-01-01T00:00:00Z' };
      mockClient.post.mockResolvedValue({ success: true, data: asyncStart, status: 202 });
      const asyncResult = await externalTestApi.testDatasourceE2E(dataplaneUrl, sourceIdOrKey, authConfig, {}, { asyncRun: true });
      expect(asyncResult.data).toEqual(asyncStart);
    });

    it('should throw when auth has no token or apiKey', async() => {
      await expect(
        externalTestApi.testDatasourceE2E(dataplaneUrl, sourceIdOrKey, {})
      ).rejects.toThrow('E2E tests require Bearer token or API key');
    });
  });

  describe('getE2ETestRun', () => {
    it('should call GET with sourceIdOrKey and testRunId', async() => {
      const testRunId = 'run-456';
      const pollBody = { status: 'completed', steps: [{ name: 'config', success: true }], success: true };
      mockClient.get.mockResolvedValue({ success: true, data: pollBody });

      const result = await externalTestApi.getE2ETestRun(dataplaneUrl, sourceIdOrKey, testRunId, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/external/${sourceIdOrKey}/test-e2e/${testRunId}`
      );
      expect(result).toEqual(pollBody);
    });

    it('should throw when auth has no token or apiKey', async() => {
      await expect(
        externalTestApi.getE2ETestRun(dataplaneUrl, sourceIdOrKey, 'run-1', {})
      ).rejects.toThrow('E2E poll requires Bearer token or API key');
    });

    it('should throw when testRunId is missing', async() => {
      await expect(
        externalTestApi.getE2ETestRun(dataplaneUrl, sourceIdOrKey, '', authConfig)
      ).rejects.toThrow('testRunId is required');
    });

    it('should throw clear error on 404 (run not found or expired)', async() => {
      mockClient.get.mockResolvedValue({
        success: false,
        status: 404,
        error: 'Not Found',
        formattedError: 'E2E test run not found'
      });

      await expect(
        externalTestApi.getE2ETestRun(dataplaneUrl, sourceIdOrKey, 'run-404', authConfig)
      ).rejects.toThrow(/not found or expired/);
    });
  });
});
