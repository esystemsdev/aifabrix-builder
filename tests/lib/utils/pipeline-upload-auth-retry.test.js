/**
 * @fileoverview Tests for pipeline-upload-auth-retry
 */

'use strict';

jest.mock('../../../lib/api/pipeline.api', () => ({
  uploadApplicationViaPipeline: jest.fn()
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn()
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://controller:3610')
}));
jest.mock('../../../lib/core/config', () => ({
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

const { uploadApplicationViaPipeline } = require('../../../lib/api/pipeline.api');
const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { uploadApplicationViaPipelineWithAuthRetry } = require('../../../lib/utils/pipeline-upload-auth-retry');

describe('pipeline-upload-auth-retry', () => {
  const dataplaneUrl = 'http://localhost:3611/data';
  const payload = { version: '1.0.0', application: { key: 'hubspot-e2e' }, dataSources: [] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retries with client-token when device bearer returns 401', async() => {
    uploadApplicationViaPipeline
      .mockResolvedValueOnce({ success: false, status: 401, formattedError: 'Invalid token' })
      .mockResolvedValueOnce({ success: true, data: { uploadId: 'u1' } });
    getDeploymentAuth.mockResolvedValue({
      type: 'client-token',
      token: 'app-token',
      controller: 'http://controller:3610'
    });

    const res = await uploadApplicationViaPipelineWithAuthRetry(
      dataplaneUrl,
      { type: 'bearer', token: 'device-token' },
      payload,
      'hubspot-e2e'
    );

    expect(uploadApplicationViaPipeline).toHaveBeenCalledTimes(2);
    expect(getDeploymentAuth).toHaveBeenCalledWith(
      'http://controller:3610',
      'dev',
      'hubspot-e2e',
      { deploymentAuth: 'client-credentials' }
    );
    expect(res.success).toBe(true);
  });

  it('does not retry when first call succeeds', async() => {
    uploadApplicationViaPipeline.mockResolvedValue({ success: true, data: {} });

    await uploadApplicationViaPipelineWithAuthRetry(
      dataplaneUrl,
      { type: 'bearer', token: 'device-token' },
      payload,
      'hubspot-e2e'
    );

    expect(uploadApplicationViaPipeline).toHaveBeenCalledTimes(1);
    expect(getDeploymentAuth).not.toHaveBeenCalled();
  });
});
