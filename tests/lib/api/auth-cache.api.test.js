/**
 * @fileoverview Tests for auth-cache.api
 */

jest.mock('../../../lib/api/index', () => ({
  ApiClient: jest.fn()
}));

const { ApiClient } = require('../../../lib/api/index');
const { clearAuthCache, invalidateAuthCache } = require('../../../lib/api/auth-cache.api');

describe('auth-cache.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clearAuthCache posts to cache clear path', async() => {
    const client = { post: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await clearAuthCache('http://c', { token: 't' });
    expect(client.post).toHaveBeenCalledWith('/api/v1/auth/cache/clear');
  });

  it('invalidateAuthCache sends pattern body', async() => {
    const client = { post: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await invalidateAuthCache('http://c', { token: 't' }, 'permissions:*');
    expect(client.post).toHaveBeenCalledWith('/api/v1/auth/cache/invalidate', {
      body: { pattern: 'permissions:*' }
    });
  });
});
