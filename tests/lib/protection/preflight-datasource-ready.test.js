'use strict';

jest.mock('../../../lib/api/datasources-core.api', () => ({
  getDatasource: jest.fn()
}));

const { getDatasource } = require('../../../lib/api/datasources-core.api');
const {
  assertDatasourceExistsOnDataplane,
  preflightDatasourceReady
} = require('../../../lib/protection/preflight-datasource-ready');

describe('preflight-datasource-ready', () => {
  const dataplaneUrl = 'http://localhost:3201';
  const authConfig = { type: 'bearer', token: 't' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when datasourceKey is empty', async() => {
    await expect(
      assertDatasourceExistsOnDataplane(dataplaneUrl, authConfig, '')
    ).rejects.toThrow('spec.datasourceKey is required');
  });

  it('throws when datasource is not on dataplane', async() => {
    getDatasource.mockResolvedValue({ success: false });
    await expect(
      assertDatasourceExistsOnDataplane(dataplaneUrl, authConfig, 'missing-ds')
    ).rejects.toThrow('not deployed on the dataplane');
  });

  it('passes when datasource exists', async() => {
    getDatasource.mockResolvedValue({ success: true, data: { key: 'hubspot-companies' } });
    await expect(
      preflightDatasourceReady(dataplaneUrl, authConfig, {
        spec: { datasourceKey: 'hubspot-companies' }
      })
    ).resolves.toBeUndefined();
    expect(getDatasource).toHaveBeenCalledWith(dataplaneUrl, 'hubspot-companies', authConfig);
  });
});
