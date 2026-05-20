/**
 * @fileoverview Tests for groups.api
 */

jest.mock('../../../lib/api/index', () => ({
  ApiClient: jest.fn()
}));

const { ApiClient } = require('../../../lib/api/index');
const { createGroup, getGroup, listGroups, listGroupMembers } = require('../../../lib/api/groups.api');

describe('groups.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createGroup posts to /api/v1/groups', async() => {
    const client = { post: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await createGroup('http://c', { token: 't' }, { name: 'g1' });
    expect(client.post).toHaveBeenCalledWith('/api/v1/groups', { body: { name: 'g1' } });
  });

  it('listGroups passes query params', async() => {
    const client = { get: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await listGroups('http://c', { token: 't' }, { search: 'sales' });
    expect(client.get).toHaveBeenCalledWith('/api/v1/groups', { params: { search: 'sales' } });
  });

  it('getGroup encodes id and includeMembers', async() => {
    const client = { get: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await getGroup('http://c', { token: 't' }, 'my group', { includeMembers: true });
    expect(client.get).toHaveBeenCalledWith('/api/v1/groups/my%20group', {
      params: { includeMembers: 'true' }
    });
  });

  it('listGroupMembers uses members subpath', async() => {
    const client = { get: jest.fn().mockResolvedValue({ success: true }) };
    ApiClient.mockImplementation(() => client);
    await listGroupMembers('http://c', { token: 't' }, 'gid');
    expect(client.get).toHaveBeenCalledWith('/api/v1/groups/gid/members');
  });
});
