/**
 * Tests for remote-docker-env (getRemoteDockerEnv).
 * @fileoverview Unit tests for lib/utils/remote-docker-env.js
 */

const path = require('path');

jest.mock('../../../lib/core/config', () => ({
  getDockerEndpoint: jest.fn(),
  getDeveloperId: jest.fn(),
  getDockerTlsSkipVerify: jest.fn()
}));
jest.mock('../../../lib/utils/dev-cert-helper');
jest.mock('../../../lib/utils/paths', () => ({ getConfigDirForPaths: jest.fn(() => '/config') }));
jest.mock('fs', () => ({ existsSync: jest.fn() }));

const config = require('../../../lib/core/config');
const { getCertDir } = require('../../../lib/utils/dev-cert-helper');
const fs = require('fs');
const { getRemoteDockerEnv, getDockerExecEnv } = require('../../../lib/utils/remote-docker-env');

describe('remote-docker-env', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCertDir.mockReturnValue('/config/certs/01');
    config.getDockerTlsSkipVerify.mockResolvedValue(false);
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

  it('throws when client cert or key missing while docker-endpoint is set', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    fs.existsSync.mockReturnValue(false);
    await expect(getRemoteDockerEnv()).rejects.toThrow(/client TLS material is missing/);
  });

  it('throws when ca.pem missing and skip-verify is off (cert and key exist)', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    const certDir = '/config/certs/01';
    fs.existsSync.mockImplementation((p) => {
      return p === path.join(certDir, 'cert.pem') || p === path.join(certDir, 'key.pem');
    });
    await expect(getRemoteDockerEnv()).rejects.toThrow(/ca\.pem is missing/);
  });

  it('allows missing ca.pem when docker-tls-skip-verify is true', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    config.getDockerTlsSkipVerify.mockResolvedValue(true);
    const certDir = '/config/certs/01';
    fs.existsSync.mockImplementation((p) => {
      return p === path.join(certDir, 'cert.pem') || p === path.join(certDir, 'key.pem');
    });
    const result = await getRemoteDockerEnv();
    expect(result).toEqual({
      DOCKER_HOST: 'tcp://host:2376',
      DOCKER_TLS_VERIFY: '0',
      DOCKER_CERT_PATH: certDir
    });
  });

  it('verifies daemon (DOCKER_TLS_VERIFY 1) when ca.pem exists even if skip-verify flag is true', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    config.getDockerTlsSkipVerify.mockResolvedValue(true);
    const certDir = '/config/certs/01';
    fs.existsSync.mockImplementation((p) => {
      return p === path.join(certDir, 'cert.pem') || p === path.join(certDir, 'key.pem') || p === path.join(certDir, 'ca.pem');
    });
    const result = await getRemoteDockerEnv();
    expect(result.DOCKER_TLS_VERIFY).toBe('1');
    expect(result.DOCKER_CERT_PATH).toBe(certDir);
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

  it('getDockerExecEnv merges DOCKER_* into process.env when certs exist', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://host:2376');
    config.getDeveloperId.mockResolvedValue('01');
    const certDir = '/config/certs/01';
    fs.existsSync.mockImplementation((p) => {
      return p === path.join(certDir, 'cert.pem') || p === path.join(certDir, 'key.pem') || p === path.join(certDir, 'ca.pem');
    });
    const env = await getDockerExecEnv();
    expect(env.DOCKER_HOST).toBe('tcp://host:2376');
    expect(env.DOCKER_TLS_VERIFY).toBe('1');
    expect(env.DOCKER_CERT_PATH).toBe(certDir);
  });

  it('when skip-verify and no client certs, returns host and TLS off without DOCKER_CERT_PATH', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://builder02.local:2376');
    config.getDeveloperId.mockResolvedValue('02');
    config.getDockerTlsSkipVerify.mockResolvedValue(true);
    fs.existsSync.mockReturnValue(false);
    const result = await getRemoteDockerEnv();
    expect(result).toEqual({
      DOCKER_HOST: 'tcp://builder02.local:2376',
      DOCKER_TLS_VERIFY: '0'
    });
    expect(result.DOCKER_CERT_PATH).toBeUndefined();
  });

  it('getDockerExecEnv drops inherited DOCKER_CERT_PATH when remote overlay has no cert path', async() => {
    config.getDockerEndpoint.mockResolvedValue('tcp://builder02.local:2376');
    config.getDeveloperId.mockResolvedValue('02');
    config.getDockerTlsSkipVerify.mockResolvedValue(true);
    fs.existsSync.mockReturnValue(false);
    const prev = process.env.DOCKER_CERT_PATH;
    process.env.DOCKER_CERT_PATH = '/stale/certs';
    try {
      const env = await getDockerExecEnv();
      expect(env.DOCKER_HOST).toBe('tcp://builder02.local:2376');
      expect(env.DOCKER_TLS_VERIFY).toBe('0');
      expect(env.DOCKER_CERT_PATH).toBeUndefined();
    } finally {
      if (prev === undefined) {
        delete process.env.DOCKER_CERT_PATH;
      } else {
        process.env.DOCKER_CERT_PATH = prev;
      }
    }
  });
});
