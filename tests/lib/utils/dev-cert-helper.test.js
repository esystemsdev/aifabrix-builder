/**
 * Tests for dev-cert-helper (CSR, cert dir, read cert).
 * @fileoverview Unit tests for lib/utils/dev-cert-helper.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

jest.mock('fs');
jest.mock('child_process', () => ({ execFileSync: jest.fn() }));

const {
  getCertDir,
  readClientCertPem,
  readClientKeyPem,
  readServerCaPem,
  getCertValidNotAfter,
  getCertSubjectDeveloperId,
  parseDeveloperIdFromX509SubjectOutput,
  developerIdsMatchNumeric,
  normalizePemNewlines,
  mergeCaPemBlocks
} = require('../../../lib/utils/dev-cert-helper');
const { execFileSync } = require('child_process');

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

  describe('readServerCaPem', () => {
    it('returns ca content when ca.pem exists', () => {
      const certDir = '/certs/01';
      const caPath = path.join(certDir, 'ca.pem');
      const content = '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----';
      fs.readFileSync.mockReturnValue(content);
      expect(readServerCaPem(certDir)).toBe(content);
      expect(fs.readFileSync).toHaveBeenCalledWith(caPath, 'utf8');
    });

    it('returns null when ca.pem does not exist', () => {
      fs.readFileSync.mockImplementation(() => {
        const err = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });
      expect(readServerCaPem('/certs/01')).toBeNull();
    });

    it('rethrows when read fails for non-ENOENT', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      expect(() => readServerCaPem('/certs/01')).toThrow('EACCES');
    });
  });

  describe('readClientKeyPem', () => {
    it('returns key content when key.pem exists', () => {
      const certDir = '/certs/01';
      const keyPath = path.join(certDir, 'key.pem');
      const content = '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----';
      fs.readFileSync.mockReturnValue(content);
      expect(readClientKeyPem(certDir)).toBe(content);
      expect(fs.readFileSync).toHaveBeenCalledWith(keyPath, 'utf8');
    });

    it('returns null when key.pem does not exist', () => {
      fs.readFileSync.mockImplementation(() => {
        const err = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });
      expect(readClientKeyPem('/certs/01')).toBeNull();
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
      expect(execFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=dev-01']),
        expect.objectContaining({ encoding: 'utf8' })
      );
    });

    it('throws user-friendly error when openssl not found', () => {
      fs.mkdirSync.mockReturnValue(undefined);
      execFileSync.mockImplementation(() => {
        const err = new Error('openssl not found');
        err.message = 'openssl not found';
        err.code = 'ENOENT';
        throw err;
      });
      fs.unlinkSync.mockImplementation(() => {});
      fs.rmdirSync.mockImplementation(() => {});

      expect(() => devCertHelper.generateCSR('01')).toThrow('OpenSSL is required');
    });
  });

  describe('parseDeveloperIdFromX509SubjectOutput', () => {
    it('parses CN = dev-01 style', () => {
      expect(parseDeveloperIdFromX509SubjectOutput('subject=C = US, CN = dev-01, O = Test')).toBe('01');
    });

    it('parses CN=dev-02 without spaces', () => {
      expect(parseDeveloperIdFromX509SubjectOutput('subject=CN=dev-02\n')).toBe('02');
    });

    it('returns null when CN dev-* missing', () => {
      expect(parseDeveloperIdFromX509SubjectOutput('subject=CN=example.com')).toBeNull();
      expect(parseDeveloperIdFromX509SubjectOutput('')).toBeNull();
      expect(parseDeveloperIdFromX509SubjectOutput(null)).toBeNull();
    });
  });

  describe('developerIdsMatchNumeric', () => {
    it('treats 2 and 02 as equal', () => {
      expect(developerIdsMatchNumeric('2', '02')).toBe(true);
      expect(developerIdsMatchNumeric('02', '2')).toBe(true);
    });

    it('returns false when integers differ', () => {
      expect(developerIdsMatchNumeric('1', '02')).toBe(false);
    });

    it('returns false for non-digit strings', () => {
      expect(developerIdsMatchNumeric('ab', '01')).toBe(false);
    });
  });

  describe('getCertSubjectDeveloperId', () => {
    it('returns null when cert.pem missing', () => {
      fs.existsSync.mockReturnValue(false);
      expect(getCertSubjectDeveloperId('/certs/01')).toBeNull();
      expect(execFileSync).not.toHaveBeenCalled();
    });

    it('returns developer id when openssl prints subject with CN', () => {
      const certPath = path.join('/certs/01', 'cert.pem');
      fs.existsSync.mockImplementation((p) => path.normalize(String(p)) === path.normalize(certPath));
      execFileSync.mockReturnValue('subject=C = US, CN = dev-07, O = Builder\n');
      expect(getCertSubjectDeveloperId('/certs/01')).toBe('07');
      expect(execFileSync).toHaveBeenCalledWith(
        expect.any(String),
        ['x509', '-subject', '-noout', '-in', path.normalize(certPath)],
        expect.objectContaining({ encoding: 'utf8' })
      );
    });

    it('returns null when openssl throws', () => {
      const certPath = path.join('/certs/01', 'cert.pem');
      fs.existsSync.mockImplementation((p) => path.normalize(String(p)) === path.normalize(certPath));
      execFileSync.mockImplementation(() => {
        throw new Error('bad cert');
      });
      expect(getCertSubjectDeveloperId('/certs/01')).toBeNull();
    });
  });

  describe('getCertValidNotAfter', () => {
    it('returns null when cert.pem does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(getCertValidNotAfter('/certs/01')).toBeNull();
      expect(execFileSync).not.toHaveBeenCalled();
    });

    it('returns Date when openssl returns notAfter', () => {
      const certPath = path.join('/certs/01', 'cert.pem');
      fs.existsSync.mockImplementation((p) => path.normalize(String(p)) === path.normalize(certPath));
      execFileSync.mockReturnValue('notAfter=Dec 31 23:59:59 2026 GMT\n');
      const result = getCertValidNotAfter('/certs/01');
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(11);
      expect(result.getUTCDate()).toBe(31);
      expect(execFileSync).toHaveBeenCalledWith(
        expect.any(String),
        ['x509', '-enddate', '-noout', '-in', path.normalize(certPath)],
        expect.objectContaining({ encoding: 'utf8' })
      );
    });

    it('returns null when openssl throws', () => {
      const certPath = path.join('/certs/01', 'cert.pem');
      fs.existsSync.mockImplementation((p) => path.normalize(String(p)) === path.normalize(certPath));
      execFileSync.mockImplementation(() => {
        throw new Error('openssl failed');
      });
      expect(getCertValidNotAfter('/certs/01')).toBeNull();
    });

    it('returns null when output has no notAfter line', () => {
      const certPath = path.join('/certs/01', 'cert.pem');
      fs.existsSync.mockImplementation((p) => path.normalize(String(p)) === path.normalize(certPath));
      execFileSync.mockReturnValue('invalid output');
      expect(getCertValidNotAfter('/certs/01')).toBeNull();
    });
  });

  describe('normalizePemNewlines', () => {
    it('returns non-strings unchanged', () => {
      expect(normalizePemNewlines(null)).toBeNull();
      expect(normalizePemNewlines(undefined)).toBeUndefined();
      expect(normalizePemNewlines(42)).toBe(42);
    });

    it('replaces JSON-style escaped newlines with real newlines', () => {
      const input = '-----BEGIN X-----\\nLINE\\n-----END X-----';
      expect(normalizePemNewlines(input)).toBe('-----BEGIN X-----\nLINE\n-----END X-----');
    });

    it('leaves already-normal PEM unchanged', () => {
      const pem = 'A\nB\nC';
      expect(normalizePemNewlines(pem)).toBe(pem);
    });
  });

  describe('mergeCaPemBlocks', () => {
    const blockA = '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----';
    const blockB = '-----BEGIN CERTIFICATE-----\nBBB\n-----END CERTIFICATE-----';

    it('returns null when no usable PEMs', () => {
      expect(mergeCaPemBlocks()).toBeNull();
      expect(mergeCaPemBlocks(null, undefined, '')).toBeNull();
      expect(mergeCaPemBlocks('   ')).toBeNull();
    });

    it('returns a single trimmed block unchanged', () => {
      expect(mergeCaPemBlocks(`  ${blockA}  `)).toBe(blockA);
    });

    it('joins distinct blocks with a blank line', () => {
      const out = mergeCaPemBlocks(blockA, blockB);
      expect(out).toBe(`${blockA}\n\n${blockB}`);
    });

    it('deduplicates identical blocks after trim and newline normalization', () => {
      const escaped = '-----BEGIN CERTIFICATE-----\\nSAME\\n-----END CERTIFICATE-----';
      const plain = '-----BEGIN CERTIFICATE-----\nSAME\n-----END CERTIFICATE-----';
      expect(mergeCaPemBlocks(escaped, plain)).toBe(plain);
    });

    it('preserves first-seen order when merging multiple unique blocks', () => {
      const out = mergeCaPemBlocks(blockB, blockA, blockB);
      expect(out).toBe(`${blockB}\n\n${blockA}`);
    });
  });
});
