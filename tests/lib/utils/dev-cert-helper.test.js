/**
 * Tests for dev-cert-helper (CSR, cert dir, read cert).
 * @fileoverview Unit tests for lib/utils/dev-cert-helper.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

jest.mock('fs');
jest.mock('child_process', () => ({ execSync: jest.fn() }));

const { getCertDir, readClientCertPem } = require('../../../lib/utils/dev-cert-helper');
const { execSync } = require('child_process');

describe('dev-cert-helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCertDir', () => {
    it('returns path joining configDir, certs, and developerId', () => {
      expect(getCertDir('/home/.aifabrix', '01')).toBe(path.join('/home/.aifabrix', 'certs', '01'));
      expect(getCertDir('/x', '0')).toBe(path.join('/x', 'certs', '0'));
    });
  });

  describe('readClientCertPem', () => {
    it('returns cert content when cert.pem exists', () => {
      const certDir = '/certs/01';
      const certPath = path.join(certDir, 'cert.pem');
      const content = '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----';
      fs.readFileSync.mockReturnValue(content);
      expect(readClientCertPem(certDir)).toBe(content);
      expect(fs.readFileSync).toHaveBeenCalledWith(certPath, 'utf8');
    });

    it('returns null when cert.pem does not exist', () => {
      fs.readFileSync.mockImplementation(() => {
        const err = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });
      expect(readClientCertPem('/certs/01')).toBeNull();
    });

    it('rethrows when read fails for non-ENOENT', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      expect(() => readClientCertPem('/certs/01')).toThrow('EACCES');
    });
  });

  describe('generateCSR', () => {
    const devCertHelper = require('../../../lib/utils/dev-cert-helper');

    it('throws when developerId is missing or not a string', () => {
      expect(() => devCertHelper.generateCSR('')).toThrow('developerId is required');
      expect(() => devCertHelper.generateCSR(null)).toThrow('developerId is required');
      expect(() => devCertHelper.generateCSR(123)).toThrow('developerId is required');
    });

    it('creates temp dir, runs openssl, returns csr and key PEMs', () => {
      fs.mkdirSync.mockReturnValue(undefined);
      fs.readFileSync.mockImplementation((p) => {
        if (String(p).endsWith('key.pem')) return '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
        if (String(p).endsWith('csr.pem')) return '-----BEGIN CERTIFICATE REQUEST-----\ncsr\n-----END CERTIFICATE REQUEST-----';
        return '';
      });
      fs.unlinkSync.mockImplementation(() => {});
      fs.rmdirSync.mockImplementation(() => {});

      const result = devCertHelper.generateCSR('01');

      expect(result).toHaveProperty('csrPem');
      expect(result).toHaveProperty('keyPem');
      expect(result.keyPem).toContain('PRIVATE KEY');
      expect(result.csrPem).toContain('CERTIFICATE REQUEST');
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('openssl req'),
        expect.any(Object)
      );
      expect(execSync.mock.calls[0][0]).toContain('/CN=dev-01');
    });

    it('throws user-friendly error when openssl not found', () => {
      fs.mkdirSync.mockReturnValue(undefined);
      execSync.mockImplementation(() => {
        const err = new Error('openssl not found');
        err.message = 'openssl not found';
        throw err;
      });
      fs.unlinkSync.mockImplementation(() => {});
      fs.rmdirSync.mockImplementation(() => {});

      expect(() => devCertHelper.generateCSR('01')).toThrow('OpenSSL is required');
    });
  });
});
