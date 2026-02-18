/**
 * Tests for dev init command (runDevInit).
 * @fileoverview Unit tests for lib/commands/dev-init.js
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({
  setDeveloperId: jest.fn().mockResolvedValue(undefined),
  setRemoteServer: jest.fn().mockResolvedValue(undefined),
  getDeveloperId: jest.fn().mockResolvedValue('01'),
  mergeRemoteSettings: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../../lib/utils/paths', () => ({ getConfigDirForPaths: jest.fn(() => '/config') }));
jest.mock('../../../lib/utils/dev-cert-helper', () => ({
  generateCSR: jest.fn(),
  getCertDir: jest.fn((dir, id) => `${dir}/certs/${id}`),
  readClientCertPem: jest.fn(),
  readClientKeyPem: jest.fn()
}));
jest.mock('../../../lib/utils/remote-dev-auth', () => ({ getRemoteDevAuth: jest.fn() }));
jest.mock('../../../lib/utils/ssh-key-helper', () => ({ getOrCreatePublicKeyContent: jest.fn(() => 'ssh-ed25519 AAAA key') }));
jest.mock('../../../lib/api/dev.api');

const fs = require('fs').promises;
jest.mock('fs', () => ({ promises: { mkdir: jest.fn(), writeFile: jest.fn() } }));

const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const { generateCSR, readClientCertPem, readClientKeyPem } = require('../../../lib/utils/dev-cert-helper');
const { getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const { runDevInit, runDevRefresh } = require('../../../lib/commands/dev-init');

describe('dev-init command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.setDeveloperId.mockResolvedValue(undefined);
    config.setRemoteServer.mockResolvedValue(undefined);
    config.getDeveloperId.mockResolvedValue('01');
    config.mergeRemoteSettings.mockResolvedValue(undefined);
    devApi.getHealth.mockResolvedValue(undefined);
    generateCSR.mockReturnValue({ csrPem: '-----BEGIN CERTIFICATE REQUEST-----\n-----END CERTIFICATE REQUEST-----', keyPem: '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----' });
    devApi.issueCert.mockResolvedValue({ certificate: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----' });
    devApi.getSettings.mockResolvedValue({ 'remote-server': 'https://dev.example.com' });
    devApi.addSshKey.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
  });

  it('throws when --developer-id is missing', async() => {
    await expect(runDevInit({ server: 'https://dev.example.com', pin: '123456' })).rejects.toThrow('--developer-id is required');
  });

  it('throws when --developer-id is not digit string', async() => {
    await expect(runDevInit({ developerId: 'abc', server: 'https://dev.example.com', pin: '123' })).rejects.toThrow('digit string');
  });

  it('throws when --server is missing', async() => {
    await expect(runDevInit({ developerId: '01', pin: '123456' })).rejects.toThrow('--server is required');
  });

  it('throws when --pin is missing', async() => {
    await expect(runDevInit({ developerId: '01', server: 'https://dev.example.com' })).rejects.toThrow('--pin is required');
  });

  it('throws when health check fails', async() => {
    devApi.getHealth.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' }))
      .rejects.toThrow('Cannot reach Builder Server');
  });

  it('throws when issue-cert returns 401', async() => {
    const err = new Error('Unauthorized');
    err.status = 401;
    devApi.issueCert.mockRejectedValue(err);
    await expect(runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' }))
      .rejects.toThrow('Invalid or expired PIN');
  });

  it('saves cert, updates config, fetches settings, registers SSH key on success', async() => {
    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });

    expect(devApi.getHealth).toHaveBeenCalledWith('https://dev.example.com');
    expect(generateCSR).toHaveBeenCalledWith('01');
    expect(devApi.issueCert).toHaveBeenCalledWith('https://dev.example.com', expect.objectContaining({ developerId: '01', pin: '123456' }));
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    expect(config.setDeveloperId).toHaveBeenCalledWith('01');
    expect(config.setRemoteServer).toHaveBeenCalledWith('https://dev.example.com');
    expect(config.mergeRemoteSettings).toHaveBeenCalled();
    expect(devApi.addSshKey).toHaveBeenCalled();
  });

  it('accepts developer-id via kebab-case option (developer-id)', async() => {
    await runDevInit({ 'developer-id': '02', server: 'https://dev.example.com', pin: '999888' });
    expect(generateCSR).toHaveBeenCalledWith('02');
    expect(devApi.issueCert).toHaveBeenCalledWith('https://dev.example.com', expect.objectContaining({ developerId: '02', pin: '999888' }));
    expect(config.setDeveloperId).toHaveBeenCalledWith('02');
  });

  it('saves ca.pem when issue-cert response includes caCertificate', async() => {
    devApi.issueCert.mockResolvedValue({
      certificate: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
      caCertificate: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'
    });
    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });
    const writeCalls = fs.writeFile.mock.calls.map(c => c[0]);
    expect(writeCalls.some(p => String(p).endsWith('ca.pem'))).toBe(true);
  });

  it('when getSettings returns 400, logs warning with 400/nginx hint and completes init', async() => {
    const err = new Error('Bad Request');
    err.status = 400;
    devApi.getSettings.mockRejectedValue(err);
    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });
    expect(config.mergeRemoteSettings).not.toHaveBeenCalled();
    expect(devApi.addSshKey).toHaveBeenCalled();
    const warnCalls = logger.log.mock.calls.filter(c => String(c[0]).includes('Could not fetch settings'));
    expect(warnCalls.length).toBeGreaterThanOrEqual(1);
    expect(warnCalls.some(c => String(c[0]).includes('literal newlines') || String(c[0]).includes('nginx njs'))).toBe(true);
  });

  it('when addSshKey returns 400, logs warning with 400/nginx hint and completes init', async() => {
    const err = new Error('Bad Request');
    err.status = 400;
    devApi.addSshKey.mockRejectedValue(err);
    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });
    const warnCalls = logger.log.mock.calls.filter(c => String(c[0]).includes('Could not register SSH key'));
    expect(warnCalls.length).toBeGreaterThanOrEqual(1);
    expect(warnCalls.some(c => String(c[0]).includes('literal newlines') || String(c[0]).includes('nginx njs'))).toBe(true);
  });

  describe('runDevRefresh', () => {
    beforeEach(() => {
      config.getDeveloperId.mockResolvedValue('01');
      getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://builder01.aifabrix.dev', clientCertPem: 'cert-pem' });
      readClientCertPem.mockReturnValue('cert-pem');
      readClientKeyPem.mockReturnValue('key-pem');
      devApi.getSettings.mockResolvedValue({
        'docker-endpoint': 'tcp://builder01.aifabrix.dev:2376',
        'sync-ssh-host': 'builder01.aifabrix.dev'
      });
    });

    it('throws when remote server not configured', async() => {
      getRemoteDevAuth.mockResolvedValue(null);
      await expect(runDevRefresh()).rejects.toThrow('Remote server is not configured');
    });

    it('throws when client certificate not found', async() => {
      readClientCertPem.mockReturnValue(null);
      await expect(runDevRefresh()).rejects.toThrow('Client certificate not found');
    });

    it('fetches settings and merges into config', async() => {
      await runDevRefresh();
      expect(devApi.getSettings).toHaveBeenCalledWith('https://builder01.aifabrix.dev', 'cert-pem', 'key-pem');
      expect(config.mergeRemoteSettings).toHaveBeenCalledWith({
        'docker-endpoint': 'tcp://builder01.aifabrix.dev:2376',
        'sync-ssh-host': 'builder01.aifabrix.dev'
      });
    });
  });
});
