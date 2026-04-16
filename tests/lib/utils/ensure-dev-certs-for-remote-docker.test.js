/**
 * @fileoverview Tests for ensure-dev-certs-for-remote-docker
 */

const fs = require('node:fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/core/config', () => ({
  getDockerEndpoint: jest.fn(),
  getRemoteServer: jest.fn(),
  getDeveloperId: jest.fn(),
  getDockerTlsSkipVerify: jest.fn(),
  setDeveloperId: jest.fn().mockResolvedValue()
}));

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

jest.mock('../../../lib/api/dev.api', () => ({
  getHealth: jest.fn().mockResolvedValue({}),
  issueCert: jest.fn()
}));

jest.mock('../../../lib/utils/dev-cert-helper', () => {
  const p = require('path');
  return {
    generateCSR: jest.fn(() => ({ csrPem: 'CSR', keyPem: 'KEY' })),
    getCertDir: jest.fn((d, id) => p.join(d, 'certs', id)),
    mergeCaPemBlocks: jest.fn((a, b, c) => [a, b, c].filter(Boolean).join('\n') || null),
    normalizePemNewlines: jest.fn((s) => s)
  };
});

jest.mock('../../../lib/utils/paths', () => ({
  getConfigDirForPaths: jest.fn(() =>
    require('path').join(require('os').tmpdir(), 'aifx-ensure-test-cfg'))
}));

jest.mock('../../../lib/utils/dev-ca-install', () => ({
  isSslUntrustedError: jest.fn(() => false),
  fetchInstallCa: jest.fn()
}));

const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const {
  readIssueCertPin,
  ensureDevCertsIfNeededForRemoteDocker
} = require('../../../lib/utils/ensure-dev-certs-for-remote-docker');

describe('ensure-dev-certs-for-remote-docker', () => {
  describe('readIssueCertPin', () => {
    beforeEach(() => {
      // CI / developer shells may export PIN env; this suite must not inherit them.
      delete process.env.AIFABRIX_DEV_ISSUE_PIN;
      delete process.env.AIFABRIX_ISSUE_CERT_PIN;
      delete process.env.AIFABRIX_DEV_ISSUE_PIN_FILE;
    });

    afterEach(() => {
      delete process.env.AIFABRIX_DEV_ISSUE_PIN;
      delete process.env.AIFABRIX_ISSUE_CERT_PIN;
      delete process.env.AIFABRIX_DEV_ISSUE_PIN_FILE;
    });

    it('prefers AIFABRIX_DEV_ISSUE_PIN over AIFABRIX_ISSUE_CERT_PIN', () => {
      process.env.AIFABRIX_DEV_ISSUE_PIN = 'pin-a';
      process.env.AIFABRIX_ISSUE_CERT_PIN = 'pin-b';
      expect(readIssueCertPin()).toBe('pin-a');
    });

    it('reads first non-empty line from AIFABRIX_DEV_ISSUE_PIN_FILE', () => {
      const disk = jest.requireActual('node:fs');
      const dir = disk.mkdtempSync(path.join(os.tmpdir(), 'aifx-pin-'));
      const tmp = path.join(dir, 'pin.txt');
      disk.writeFileSync(tmp, '\n  abc123  \n', 'utf8');
      process.env.AIFABRIX_DEV_ISSUE_PIN_FILE = tmp;
      try {
        expect(readIssueCertPin()).toBe('abc123');
      } finally {
        try {
          disk.rmSync(dir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    });
  });

  describe('ensureDevCertsIfNeededForRemoteDocker', () => {
    /** Spies on node:fs.promises — nodeFs() rebinds each call, so spy the real module. */
    let mkdirSpy;
    let writeFileSpy;

    beforeEach(() => {
      // Only this block uses fs spies; restore here so readIssueCertPin is not affected.
      jest.restoreAllMocks();
      jest.clearAllMocks();
      config.getDockerEndpoint.mockResolvedValue(null);
      config.getRemoteServer.mockResolvedValue('https://builder.example.com');
      config.getDeveloperId.mockResolvedValue('02');
      config.getDockerTlsSkipVerify.mockResolvedValue(false);
      devApi.issueCert.mockResolvedValue({
        certificate: 'CERT-PEM',
        caCertificate: 'CA-PEM'
      });
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      mkdirSpy = jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    });

    afterEach(() => {
      fs.existsSync.mockRestore();
      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
      delete process.env.AIFABRIX_DEV_ISSUE_PIN;
    });

    it('no-ops when docker-endpoint is unset', async() => {
      await ensureDevCertsIfNeededForRemoteDocker();
      expect(devApi.issueCert).not.toHaveBeenCalled();
    });

    it('no-ops when cert.pem and key.pem already exist', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://x.local:2376');
      fs.existsSync.mockImplementation((p) => String(p).endsWith('cert.pem') || String(p).endsWith('key.pem'));
      await ensureDevCertsIfNeededForRemoteDocker();
      expect(devApi.issueCert).not.toHaveBeenCalled();
    });

    it('no-ops when no PIN and getDockerTlsSkipVerify is true', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://x.local:2376');
      config.getDockerTlsSkipVerify.mockResolvedValue(true);
      await ensureDevCertsIfNeededForRemoteDocker();
      expect(devApi.issueCert).not.toHaveBeenCalled();
    });

    it('throws when no PIN and TLS verify required', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://x.example.com:2376');
      await expect(ensureDevCertsIfNeededForRemoteDocker()).rejects.toThrow(/AIFABRIX_DEV_ISSUE_PIN/);
    });

    it('calls issue-cert and writes files when PIN is set', async() => {
      process.env.AIFABRIX_DEV_ISSUE_PIN = 'one-time';
      config.getDockerEndpoint.mockResolvedValue('tcp://x.example.com:2376');
      await ensureDevCertsIfNeededForRemoteDocker();
      expect(devApi.getHealth).toHaveBeenCalled();
      expect(devApi.issueCert).toHaveBeenCalledWith(
        'https://builder.example.com',
        expect.objectContaining({ developerId: '02', pin: 'one-time', csr: 'CSR' }),
        undefined
      );
      expect(writeFileSpy).toHaveBeenCalled();
      expect(config.setDeveloperId).toHaveBeenCalledWith('02');
    });
  });
});
