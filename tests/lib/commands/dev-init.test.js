/**
 * Tests for dev init command (runDevInit).
 * @fileoverview Unit tests for lib/commands/dev-init.js
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({
  setDeveloperId: jest.fn().mockResolvedValue(undefined),
  setRemoteServer: jest.fn().mockResolvedValue(undefined),
  getDeveloperId: jest.fn().mockResolvedValue('01'),
  getSyncSshHost: jest.fn().mockResolvedValue(null),
  getSyncSshUser: jest.fn().mockResolvedValue(null),
  mergeRemoteSettings: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../../lib/utils/paths', () => ({ getConfigDirForPaths: jest.fn(() => '/config') }));
jest.mock('../../../lib/utils/dev-cert-helper', () => {
  const actual = jest.requireActual('../../../lib/utils/dev-cert-helper');
  return {
    generateCSR: jest.fn(),
    getCertDir: jest.fn((dir, id) => `${dir}/certs/${id}`),
    readClientCertPem: jest.fn(),
    readClientKeyPem: jest.fn(),
    getCertValidNotAfter: jest.fn(),
    normalizePemNewlines: actual.normalizePemNewlines,
    mergeCaPemBlocks: actual.mergeCaPemBlocks
  };
});
jest.mock('../../../lib/utils/remote-dev-auth', () => ({ getRemoteDevAuth: jest.fn() }));
jest.mock('../../../lib/utils/ssh-key-helper', () => ({ getOrCreatePublicKeyContent: jest.fn(() => 'ssh-ed25519 AAAA key') }));
jest.mock('../../../lib/api/dev.api');
jest.mock('../../../lib/utils/dev-ca-install', () => ({
  isSslUntrustedError: jest.fn(),
  isSslHostnameMismatchError: jest.fn(),
  fetchInstallCa: jest.fn(),
  installCaPlatform: jest.fn(),
  promptInstallCa: jest.fn()
}));
jest.mock('../../../lib/utils/dev-hosts-helper', () => ({
  runOptionalHostsSetup: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../../lib/utils/dev-ssh-config-helper', () => ({
  ensureDevSshConfigBlock: jest.fn().mockResolvedValue({
    ok: true,
    configPath: '/home/user/.ssh/config',
    hostAlias: 'dev01.dev.example.com'
  })
}));

const fs = require('fs').promises;
jest.mock('fs', () => ({ promises: { mkdir: jest.fn(), writeFile: jest.fn() } }));

const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const devCaInstall = require('../../../lib/utils/dev-ca-install');
const devHostsHelper = require('../../../lib/utils/dev-hosts-helper');
const devSshConfigHelper = require('../../../lib/utils/dev-ssh-config-helper');
const { generateCSR, readClientCertPem, readClientKeyPem, getCertValidNotAfter } = require('../../../lib/utils/dev-cert-helper');
const { getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const { runDevInit, runDevRefresh } = require('../../../lib/commands/dev-init');

describe('dev-init command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    devHostsHelper.runOptionalHostsSetup.mockResolvedValue(undefined);
    devSshConfigHelper.ensureDevSshConfigBlock.mockResolvedValue({
      ok: true,
      configPath: '/home/user/.ssh/config',
      hostAlias: 'dev01.dev.example.com'
    });
    devCaInstall.isSslUntrustedError.mockReturnValue(false);
    devCaInstall.isSslHostnameMismatchError.mockReturnValue(false);
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

  it('when --add-hosts, runs hosts helper before health check', async() => {
    await runDevInit({
      developerId: '01',
      server: 'https://builder02.local',
      pin: '123456',
      addHosts: true,
      hostsIp: '192.168.1.25',
      y: true
    });
    expect(devHostsHelper.runOptionalHostsSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://builder02.local',
        developerId: '01',
        hostsIp: '192.168.1.25',
        skipConfirm: true
      })
    );
    expect(devApi.getHealth).toHaveBeenCalled();
  });

  it('throws when health check fails', async() => {
    devApi.getHealth.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' }))
      .rejects.toThrow('Cannot reach Builder Server');
  });

  it('when GET /health returns HTTP 503 without SSL issues, warns and continues init', async() => {
    const e503 = new Error('Service Unavailable');
    e503.status = 503;
    devApi.getHealth.mockRejectedValueOnce(e503);
    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });
    expect(devApi.issueCert).toHaveBeenCalled();
    const warn = logger.log.mock.calls.map(c => String(c[0])).find(s => s.includes('GET /health returned HTTP 503'));
    expect(warn).toBeDefined();
  });

  it('when SSL then CA install then GET /health returns 503, warns and continues with server CA PEM', async() => {
    const sslErr = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    const e503 = new Error('Service Unavailable');
    e503.status = 503;
    devApi.getHealth.mockRejectedValueOnce(sslErr).mockRejectedValueOnce(e503);
    devCaInstall.isSslUntrustedError.mockReturnValue(true);
    devCaInstall.promptInstallCa.mockResolvedValue(true);
    devCaInstall.fetchInstallCa.mockResolvedValue(Buffer.from('-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'));
    devCaInstall.installCaPlatform.mockResolvedValue(undefined);

    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });

    expect(devApi.issueCert).toHaveBeenCalledWith(
      'https://dev.example.com',
      expect.objectContaining({ developerId: '01', pin: '123456' }),
      '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'
    );
  });

  it('when GET /health returns HTTP 404, error mentions HTTP response not generic reachability', async() => {
    const e404 = new Error('Not Found');
    e404.status = 404;
    devApi.getHealth.mockRejectedValue(e404);
    await expect(runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' }))
      .rejects.toThrow(/returned HTTP 404/);
  });

  it('when TLS hostname mismatch, throws hint without CA install path', async() => {
    devApi.getHealth.mockRejectedValue(new Error('TLS mismatch'));
    devCaInstall.isSslHostnameMismatchError.mockReturnValue(true);
    await expect(runDevInit({ developerId: '01', server: 'https://builder02.local', pin: '123456' }))
      .rejects.toThrow('TLS hostname does not match');
    expect(devCaInstall.fetchInstallCa).not.toHaveBeenCalled();
  });

  it('when SSL error and --no-install-ca, throws with manual instructions', async() => {
    const sslErr = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    devApi.getHealth.mockRejectedValue(sslErr);
    devCaInstall.isSslUntrustedError.mockReturnValue(true);
    await expect(runDevInit({
      developerId: '01',
      server: 'https://dev.example.com',
      pin: '123456',
      'no-install-ca': true
    })).rejects.toThrow('Server certificate not trusted. Install CA manually: https://dev.example.com/install-ca');
    expect(devCaInstall.promptInstallCa).not.toHaveBeenCalled();
    expect(devCaInstall.fetchInstallCa).not.toHaveBeenCalled();
  });

  it('when SSL error and user declines, throws with manual instructions', async() => {
    const sslErr = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    devApi.getHealth.mockRejectedValue(sslErr);
    devCaInstall.isSslUntrustedError.mockReturnValue(true);
    devCaInstall.promptInstallCa.mockResolvedValue(false);
    await expect(runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' }))
      .rejects.toThrow('Server certificate not trusted. Install CA manually: https://dev.example.com/install-ca');
    expect(devCaInstall.fetchInstallCa).not.toHaveBeenCalled();
  });

  it('when SSL error and user accepts, fetches CA, installs, retries, init succeeds', async() => {
    const sslErr = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    devApi.getHealth
      .mockRejectedValueOnce(sslErr)
      .mockResolvedValueOnce(undefined);
    devCaInstall.isSslUntrustedError.mockReturnValue(true);
    devCaInstall.promptInstallCa.mockResolvedValue(true);
    devCaInstall.fetchInstallCa.mockResolvedValue(Buffer.from('-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'));
    devCaInstall.installCaPlatform.mockResolvedValue(undefined);

    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });

    expect(devCaInstall.fetchInstallCa).toHaveBeenCalledWith('https://dev.example.com');
    expect(devCaInstall.installCaPlatform).toHaveBeenCalledWith(expect.any(Buffer), 'https://dev.example.com');
    expect(devApi.getHealth).toHaveBeenCalledTimes(2);
    expect(devApi.issueCert).toHaveBeenCalled();
  });

  it('when SSL error and --yes, auto-installs CA without prompt', async() => {
    const sslErr = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    devApi.getHealth
      .mockRejectedValueOnce(sslErr)
      .mockResolvedValueOnce(undefined);
    devCaInstall.isSslUntrustedError.mockReturnValue(true);
    devCaInstall.fetchInstallCa.mockResolvedValue(Buffer.from('-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'));
    devCaInstall.installCaPlatform.mockResolvedValue(undefined);

    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456', yes: true });

    expect(devCaInstall.promptInstallCa).not.toHaveBeenCalled();
    expect(devCaInstall.fetchInstallCa).toHaveBeenCalledWith('https://dev.example.com');
    expect(devApi.issueCert).toHaveBeenCalled();
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
    expect(devApi.issueCert).toHaveBeenCalledWith(
      'https://dev.example.com',
      expect.objectContaining({ developerId: '01', pin: '123456' }),
      undefined
    );
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    expect(config.setDeveloperId).toHaveBeenCalledWith('01');
    expect(config.setRemoteServer).toHaveBeenCalledWith('https://dev.example.com');
    expect(config.mergeRemoteSettings).toHaveBeenCalled();
    expect(devApi.addSshKey).toHaveBeenCalled();
    expect(devSshConfigHelper.ensureDevSshConfigBlock).toHaveBeenCalled();
    const sshHint = logger.log.mock.calls.map(c => String(c[0])).find(s => s.includes('ssh dev01.dev.example.com'));
    expect(sshHint).toBeDefined();
  });

  it('when SSH config already has the same user@host, logs unchanged and suggests existing Host alias', async() => {
    devSshConfigHelper.ensureDevSshConfigBlock.mockResolvedValue({
      ok: true,
      configPath: '/home/user/.ssh/config',
      hostAlias: 'mybuilder',
      skippedDuplicate: true
    });
    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });
    const unchanged = logger.log.mock.calls.map(c => String(c[0])).find(s => s.includes('already has'));
    expect(unchanged).toBeDefined();
    expect(unchanged).toContain('dev01@dev.example.com');
    expect(unchanged).toContain('mybuilder');
    const sshHint = logger.log.mock.calls.map(c => String(c[0])).find(s => s.includes('ssh mybuilder'));
    expect(sshHint).toBeDefined();
  });

  it('accepts developer-id via kebab-case option (developer-id)', async() => {
    await runDevInit({ 'developer-id': '02', server: 'https://dev.example.com', pin: '999888' });
    expect(generateCSR).toHaveBeenCalledWith('02');
    expect(devApi.issueCert).toHaveBeenCalledWith(
      'https://dev.example.com',
      expect.objectContaining({ developerId: '02', pin: '999888' }),
      undefined
    );
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

  it('merges install-ca TLS PEM with issue-cert caCertificate in ca.pem (both trust roots)', async() => {
    const sslErr = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    devApi.getHealth
      .mockRejectedValueOnce(sslErr)
      .mockResolvedValueOnce(undefined);
    devCaInstall.isSslUntrustedError.mockReturnValue(true);
    devCaInstall.fetchInstallCa.mockResolvedValue(
      Buffer.from('-----BEGIN CERTIFICATE-----\ntls-dev-root\n-----END CERTIFICATE-----')
    );
    devCaInstall.installCaPlatform.mockResolvedValue(undefined);
    devCaInstall.promptInstallCa.mockResolvedValue(true);
    devApi.issueCert.mockResolvedValue({
      certificate: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
      caCertificate: '-----BEGIN CERTIFICATE-----\ninternal-signing-ca\n-----END CERTIFICATE-----'
    });

    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });

    const caCall = fs.writeFile.mock.calls.find(c => String(c[0]).endsWith('ca.pem'));
    expect(caCall).toBeDefined();
    expect(caCall[1]).toContain('tls-dev-root');
    expect(caCall[1]).toContain('internal-signing-ca');
  });

  it('normalizes escaped newlines in certificate and caCertificate when saving', async() => {
    devApi.issueCert.mockResolvedValue({
      certificate: '-----BEGIN CERTIFICATE-----\\ndata\\n-----END CERTIFICATE-----',
      caCertificate: '-----BEGIN CERTIFICATE-----\\nca\\n-----END CERTIFICATE-----'
    });
    await runDevInit({ developerId: '01', server: 'https://dev.example.com', pin: '123456' });
    const writeCalls = fs.writeFile.mock.calls;
    const certCall = writeCalls.find(c => String(c[0]).endsWith('cert.pem'));
    const caCall = writeCalls.find(c => String(c[0]).endsWith('ca.pem'));
    expect(certCall[1]).toContain('-----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----');
    expect(caCall[1]).toContain('-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----');
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
      getRemoteDevAuth.mockResolvedValue({
        serverUrl: 'https://builder01.aifabrix.dev',
        clientCertPem: 'cert-pem',
        serverCaPem: null
      });
      readClientCertPem.mockReturnValue('cert-pem');
      readClientKeyPem.mockReturnValue('key-pem');
      devApi.getSettings.mockResolvedValue({
        'docker-endpoint': 'tcp://builder01.aifabrix.dev:2376',
        'sync-ssh-host': 'builder01.aifabrix.dev'
      });
      devApi.createPin = jest.fn().mockResolvedValue({ pin: '654321', expiresAt: '2026-12-31T00:00:00Z' });
      getCertValidNotAfter.mockReturnValue(new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)); // 20 days from now
    });

    it('throws when remote server not configured', async() => {
      getRemoteDevAuth.mockResolvedValue(null);
      await expect(runDevRefresh()).rejects.toThrow('Remote server is not configured');
    });

    it('throws when client certificate not found', async() => {
      readClientCertPem.mockReturnValue(null);
      await expect(runDevRefresh()).rejects.toThrow('Client certificate not found');
    });

    it('fetches settings and merges when cert valid for 20+ days', async() => {
      await runDevRefresh();
      expect(devApi.getSettings).toHaveBeenCalledWith(
        'https://builder01.aifabrix.dev',
        'cert-pem',
        'key-pem',
        undefined
      );
      expect(config.mergeRemoteSettings).toHaveBeenCalledWith({
        'docker-endpoint': 'tcp://builder01.aifabrix.dev:2376',
        'sync-ssh-host': 'builder01.aifabrix.dev'
      });
      expect(devApi.createPin).not.toHaveBeenCalled();
      expect(devApi.issueCert).not.toHaveBeenCalled();
    });

    it('refreshes certificate when cert expires within 14 days', async() => {
      getCertValidNotAfter.mockReturnValue(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)); // 5 days
      await runDevRefresh();
      expect(devApi.createPin).toHaveBeenCalledWith('https://builder01.aifabrix.dev', 'cert-pem', '01', undefined);
      expect(devApi.issueCert).toHaveBeenCalledWith(
        'https://builder01.aifabrix.dev',
        expect.objectContaining({ developerId: '01', pin: '654321' }),
        undefined
      );
      expect(config.mergeRemoteSettings).toHaveBeenCalled();
      expect(devApi.getSettings).toHaveBeenCalled();
    });

    it('refreshes certificate when runDevRefresh called with --cert', async() => {
      await runDevRefresh({ cert: true });
      expect(devApi.createPin).toHaveBeenCalledWith('https://builder01.aifabrix.dev', 'cert-pem', '01', undefined);
      expect(devApi.issueCert).toHaveBeenCalledWith(
        'https://builder01.aifabrix.dev',
        expect.objectContaining({ developerId: '01', pin: '654321' }),
        undefined
      );
    });

    it('refreshes certificate when getCertValidNotAfter returns null (unknown expiry)', async() => {
      getCertValidNotAfter.mockReturnValue(null);
      await runDevRefresh();
      expect(devApi.createPin).toHaveBeenCalled();
      expect(devApi.issueCert).toHaveBeenCalled();
    });
  });
});
