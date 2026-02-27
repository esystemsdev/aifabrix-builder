/**
 * Tests for dev-ca-install utilities (SSL detection, fetch CA, platform-specific install).
 * @fileoverview Unit tests for lib/utils/dev-ca-install.js
 */

const https = require('https');
const fs = require('fs').promises;
const { execFileSync } = require('child_process');
const readline = require('readline');

jest.mock('https');
jest.mock('fs', () => ({ promises: { writeFile: jest.fn(), unlink: jest.fn() } }));
jest.mock('child_process', () => ({ execFileSync: jest.fn() }));
jest.mock('readline', () => ({ createInterface: jest.fn() }));

const {
  isSslUntrustedError,
  fetchInstallCa,
  installCaPlatform,
  promptInstallCa
} = require('../../../lib/utils/dev-ca-install');

describe('dev-ca-install', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.writeFile.mockResolvedValue(undefined);
    fs.unlink.mockResolvedValue(undefined);
    execFileSync.mockReturnValue(undefined);
  });

  describe('isSslUntrustedError', () => {
    it('returns true for UNABLE_TO_VERIFY_LEAF_SIGNATURE via code', () => {
      expect(isSslUntrustedError({ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })).toBe(true);
    });

    it('returns true for DEPTH_ZERO_SELF_SIGNED_CERT via code', () => {
      expect(isSslUntrustedError({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })).toBe(true);
    });

    it('returns true for UNABLE_TO_VERIFY_LEAF_SIGNATURE via cause', () => {
      expect(isSslUntrustedError({ cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } })).toBe(true);
    });

    it('returns true when message contains UNABLE_TO_VERIFY_LEAF_SIGNATURE', () => {
      expect(isSslUntrustedError({ message: 'Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE' })).toBe(true);
    });

    it('returns true for SELF_SIGNED_CERT_IN_CHAIN', () => {
      expect(isSslUntrustedError({ code: 'SELF_SIGNED_CERT_IN_CHAIN' })).toBe(true);
    });

    it('returns false for ECONNREFUSED', () => {
      expect(isSslUntrustedError({ code: 'ECONNREFUSED' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isSslUntrustedError(null)).toBe(false);
      expect(isSslUntrustedError(undefined)).toBe(false);
    });
  });

  describe('fetchInstallCa', () => {
    it('fetches PEM from {baseUrl}/install-ca', async() => {
      const pem = '-----BEGIN CERTIFICATE-----\nMIIBkTCB\n-----END CERTIFICATE-----';
      const mockRes = {
        statusCode: 200,
        on: jest.fn((ev, handler) => {
          setImmediate(() => {
            if (ev === 'data') handler(Buffer.from(pem));
            if (ev === 'end') handler();
          });
          return mockRes;
        })
      };
      https.get.mockImplementation((url, opts, cb) => {
        if (typeof opts === 'function') cb(opts); else cb(mockRes);
        return { on: jest.fn(), destroy: jest.fn() };
      });

      const result = await fetchInstallCa('https://builder02.local');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString('utf8')).toContain('-----BEGIN CERTIFICATE-----');
      expect(https.get).toHaveBeenCalledWith(
        'https://builder02.local/install-ca',
        expect.objectContaining({ agent: expect.any(Object) }),
        expect.any(Function)
      );
    });

    it('rejects when response is not PEM', async() => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn((ev, cb) => {
          if (ev === 'data') cb(Buffer.from('not pem'));
          if (ev === 'end') cb();
          return mockRes;
        })
      };
      https.get.mockImplementation((url, opts, cb) => {
        cb(mockRes);
        return { on: jest.fn(), destroy: jest.fn() };
      });

      await expect(fetchInstallCa('https://builder02.local')).rejects.toThrow('Invalid CA response');
    });

    it('rejects for non-https URL', async() => {
      await expect(fetchInstallCa('http://builder02.local')).rejects.toThrow('https');
    });
  });

  describe('installCaPlatform', () => {
    const caPem = '-----BEGIN CERTIFICATE-----\nMIIBkTCB\n-----END CERTIFICATE-----';

    it('uses certutil on Windows', async() => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      await installCaPlatform(caPem, 'https://builder02.local');
      expect(execFileSync).toHaveBeenCalledWith('certutil', ['-addstore', '-user', 'ROOT', expect.any(String)], { stdio: 'inherit' });
      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    it('uses security on macOS', async() => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      await installCaPlatform(caPem, 'https://builder02.local');
      expect(execFileSync).toHaveBeenCalledWith('security', expect.arrayContaining(['add-trusted-cert', '-d', '-r', 'trustRoot']), { stdio: 'inherit' });
      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    it('uses update-ca-certificates on Linux', async() => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      await installCaPlatform(caPem, 'https://builder02.local');
      expect(execFileSync).toHaveBeenCalledWith('update-ca-certificates', [], { stdio: 'inherit' });
      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });
  });

  describe('promptInstallCa', () => {
    it('resolves true when user enters y', async() => {
      const mockRl = { question: jest.fn((msg, cb) => cb('y')), close: jest.fn() };
      readline.createInterface.mockReturnValue(mockRl);

      const result = await promptInstallCa();
      expect(result).toBe(true);
      expect(mockRl.close).toHaveBeenCalled();
    });

    it('resolves true when user enters yes', async() => {
      const mockRl = { question: jest.fn((msg, cb) => cb('yes')), close: jest.fn() };
      readline.createInterface.mockReturnValue(mockRl);

      const result = await promptInstallCa();
      expect(result).toBe(true);
    });

    it('resolves false when user enters n', async() => {
      const mockRl = { question: jest.fn((msg, cb) => cb('n')), close: jest.fn() };
      readline.createInterface.mockReturnValue(mockRl);

      const result = await promptInstallCa();
      expect(result).toBe(false);
    });
  });
});
