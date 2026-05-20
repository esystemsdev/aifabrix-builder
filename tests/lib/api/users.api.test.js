/**
 * @fileoverview Tests for users.api
 */

jest.mock('../../../lib/api/index', () => ({
  ApiClient: jest.fn()
}));

const { ApiClient } = require('../../../lib/api/index');
const { createUser, listUsers } = require('../../../lib/api/users.api');

describe('users.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ApiClient.mockImplementation(function MockClient() {
      this.post = jest.fn();
      this.get = jest.fn();
    });
  });

  it('createUser posts to /api/v1/users', async() => {
    const client = { post: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await createUser('http://c', { token: 't' }, { email: 'a@b.com' });
    expect(client.post).toHaveBeenCalledWith('/api/v1/users', {
      body: { email: 'a@b.com' }
    });
  });

  it('listUsers passes search query params', async() => {
    const client = { get: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await listUsers('http://c', { token: 't' }, { search: 'alice' });
    expect(client.get).toHaveBeenCalledWith('/api/v1/users', {
      params: { search: 'alice' }
    });
  });
});
