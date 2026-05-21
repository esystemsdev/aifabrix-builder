/**
 * @fileoverview Tests for records-bulk.api.js
 */

'use strict';

jest.mock('../../../lib/api/index', () => ({
  createDataplaneApiClient: jest.fn()
}));

const { createDataplaneApiClient } = require('../../../lib/api/index');
const { bulkSyncRecords } = require('../../../lib/api/records-bulk.api');

describe('records-bulk.api', () => {
  const dataplaneUrl = 'http://localhost:3001';
  const authConfig = { token: 'test-token' };
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { post: jest.fn().mockResolvedValue({ insertedCount: 1 }) };
    createDataplaneApiClient.mockReturnValue(mockClient);
  });

  it('posts to data-storage records bulk path', async() => {
    const body = { syncType: 'incremental', sync: false, records: [] };
    await bulkSyncRecords(dataplaneUrl, 'my-ds', authConfig, body);

    expect(createDataplaneApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/data-storage/my-ds/records/bulk', {
      body
    });
  });
});
