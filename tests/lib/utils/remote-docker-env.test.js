/**
 * Tests for remote-docker-env (getRemoteDockerEnv).
 * @fileoverview Unit tests for lib/utils/remote-docker-env.js
 */

const path = require('path');

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/dev-cert-helper');
jest.mock('../../../lib/utils/paths', () => ({ getConfigDirForPaths: jest.fn(() => '/config') }));
jest.mock('fs', () => ({ existsSync: jest.fn() }));

const config = require('../../../lib/core/config');
const { getCertDir } = require('../../../lib/utils/dev-cert-helper');
const fs = require('fs');
const { getRemoteDockerEnv } = require('../../../lib/utils/remote-docker-env');

describe('remote-docker-env', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCertDir.mockReturnValue('/config/certs/01');
  });

  it('returns empty object when docker-endpoint not set', async() => {
    config.getDockerEndpoint.mockResolvedValue(null);
    const result = await getRemoteDockerEnv();
    expect(result).toEqual({});
  });

  it('returns empty object when endpoint is empty string', async() => {
    config.getDockerEndpoint.mockResolvedValue('  ');
    const result = await getRemoteDockerEnv();
    expect(result).toEqual({});
  });

  it('returns empty object when cert, key, or ca.pem missing', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    fs.existsSync.mockReturnValue(false);
    const result = await getRemoteDockerEnv();
    expect(result).toEqual({});
  });

  it('returns empty object when ca.pem missing (cert and key exist)', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    const certDir = '/config/certs/01';
    fs.existsSync.mockImplementation((p) => {
      return p === path.join(certDir, 'cert.pem') || p === path.join(certDir, 'key.pem');
    });
    const result = await getRemoteDockerEnv();
    expect(result).toEqual({});
  });

  it('returns DOCKER_HOST, DOCKER_TLS_VERIFY, DOCKER_CERT_PATH when cert, key, and ca.pem exist', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    const certDir = '/config/certs/01';
    fs.existsSync.mockImplementation((p) => {
      return p === path.join(certDir, 'cert.pem') || p === path.join(certDir, 'key.pem') || p === path.join(certDir, 'ca.pem');
    });
    const result = await getRemoteDockerEnv();
    expect(result).toEqual({
      DOCKER_HOST: 'tcp://host:2376',
      DOCKER_TLS_VERIFY: '1',
      DOCKER_CERT_PATH: certDir
    });
  });
});
