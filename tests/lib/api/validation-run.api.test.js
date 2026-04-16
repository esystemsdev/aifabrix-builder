/**
 * @fileoverview Tests for lib/api/validation-run.api.js
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

const validationRunApi = require('../../../lib/api/validation-run.api');

describe('validation-run.api', () => {
  const dataplaneUrl = 'https://dp.example.com';
  const auth = { type: 'bearer', token: 't' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockResolvedValue({ success: true, data: {}, status: 200 });
    mockClient.get.mockResolvedValue({ success: true, data: {}, status: 200 });
  });

  it('postValidationRun posts to /api/v1/validation/run', async() => {
    const body = {
      validationScope: 'externalDataSource',
      systemIdOrKey: 'hubspot',
      datasourceKey: 'hubspot.deals',
      runType: 'test'
    };
    await validationRunApi.postValidationRun(dataplaneUrl, auth, body);
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/validation/run', { body });
  });

  it('getValidationRun encodes testRunId in path', async() => {
    await validationRunApi.getValidationRun(dataplaneUrl, auth, 'run/a');
    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/validation/run/run%2Fa', { headers: undefined });
  });

  it('extractTestRunId reads string testRunId', () => {
    expect(validationRunApi.extractTestRunId({ testRunId: 'abc' })).toBe('abc');
    expect(validationRunApi.extractTestRunId({})).toBeNull();
  });

  it('normalizeDataplaneAuth maps apiKey to token', () => {
    const n = validationRunApi.normalizeDataplaneAuth({ apiKey: 'k' });
    expect(n.token).toBe('k');
    expect(n.type).toBe('bearer');
  });

  it('normalizeDataplaneAuth throws without token or apiKey', () => {
    expect(() => validationRunApi.normalizeDataplaneAuth({})).toThrow(/Bearer token or API key/);
  });
});
