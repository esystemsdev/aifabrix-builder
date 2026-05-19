/**
 * @fileoverview Tests for records-search.api.js
 */

'use strict';

jest.mock('../../../lib/api/index', () => ({
  createDataplaneApiClient: jest.fn()
}));

const { createDataplaneApiClient } = require('../../../lib/api/index');
const { searchRecords } = require('../../../lib/api/records-search.api');

describe('records-search.api', () => {
  const dataplaneUrl = 'http://localhost:3001';
  const authConfig = { token: 'test-token' };
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { post: jest.fn().mockResolvedValue({ data: [], meta: {} }) };
    createDataplaneApiClient.mockReturnValue(mockClient);
  });

  it('posts to records search path', async() => {
    const body = {
      intent: 'validation',
      datasourceKeys: ['my-ds'],
      searchMode: 'full',
      limit: 100
    };
    await searchRecords(dataplaneUrl, authConfig, body);

    expect(createDataplaneApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/records/search', { body });
  });
});
