/**
 * @fileoverview Tests for dataplane-sync.api
 */

jest.mock('../../../lib/api/index', () => ({
  ApiClient: jest.fn()
}));

const { ApiClient } = require('../../../lib/api/index');
const { fullSyncToDataplane } = require('../../../lib/api/dataplane-sync.api');

describe('dataplane-sync.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fullSyncToDataplane posts env-scoped full sync path', async() => {
    const client = { post: jest.fn().mockResolvedValue({ success: true, data: { usersProcessed: 3 } }) };
    ApiClient.mockImplementation(() => client);
    await fullSyncToDataplane('http://c', { token: 't' }, 'dev');
    expect(client.post).toHaveBeenCalledWith('/api/v1/sync/dataplane/dev/full');
  });
});
