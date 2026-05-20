/**
 * @fileoverview Tests for user-groups.api
 */

jest.mock('../../../lib/api/index', () => ({
  ApiClient: jest.fn()
}));

const { ApiClient } = require('../../../lib/api/index');
const { addUserToGroup, removeUserFromGroup } = require('../../../lib/api/user-groups.api');

describe('user-groups.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addUserToGroup posts membership path', async() => {
    const client = { post: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await addUserToGroup('http://c', { token: 't' }, 'u1', 'g1', { role: 'member' });
    expect(client.post).toHaveBeenCalledWith('/api/v1/users/u1/groups/g1', {
      body: { role: 'member' }
    });
  });

  it('removeUserFromGroup deletes membership path', async() => {
    const client = { delete: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await removeUserFromGroup('http://c', { token: 't' }, 'u1', 'g1');
    expect(client.delete).toHaveBeenCalledWith('/api/v1/users/u1/groups/g1');
  });
});
