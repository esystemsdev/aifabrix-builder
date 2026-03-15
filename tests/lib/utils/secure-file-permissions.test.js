/**
 * Tests for secure file permissions utility (ISO 27001).
 *
 * @fileoverview Unit tests for lib/utils/secure-file-permissions.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  chmodSync: jest.fn()
}));

const {
  ensureSecureFilePermissions,
  ensureSecureDirPermissions,
  SECRET_FILE_MODE,
  CONFIG_FILE_MODE
} = require('../../../lib/utils/secure-file-permissions');

describe('secure-file-permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureSecureFilePermissions', () => {
    it('returns false when filePath is empty', () => {
      expect(ensureSecureFilePermissions('')).toBe(false);
      expect(ensureSecureFilePermissions(null)).toBe(false);
      expect(ensureSecureFilePermissions(undefined)).toBe(false);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns false when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(ensureSecureFilePermissions('/tmp/secrets.local.yaml')).toBe(false);
      expect(fs.statSync).not.toHaveBeenCalled();
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns false when path is a directory', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => false, isDirectory: () => true, mode: 0o755 });
      expect(ensureSecureFilePermissions('/tmp/.aifabrix')).toBe(false);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns true and does not chmod when file already has 0o600', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true, mode: 0o600 });
      expect(ensureSecureFilePermissions('/tmp/secrets.local.yaml')).toBe(true);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns true and chmods when file has group/other read (0o644)', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true, mode: 0o644 });
      expect(ensureSecureFilePermissions('/tmp/secrets.local.yaml')).toBe(true);
      expect(fs.chmodSync).toHaveBeenCalledWith('/tmp/secrets.local.yaml', 0o600);
    });

    it('returns true and chmods when file has 0o666', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true, mode: 0o666 });
      expect(ensureSecureFilePermissions('/tmp/admin-secrets.env')).toBe(true);
      expect(fs.chmodSync).toHaveBeenCalledWith('/tmp/admin-secrets.env', 0o600);
    });

    it('uses custom mode when provided', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true, mode: 0o644 });
      expect(ensureSecureFilePermissions('/tmp/config.yaml', 0o600)).toBe(true);
      expect(fs.chmodSync).toHaveBeenCalledWith('/tmp/config.yaml', 0o600);
    });

    it('resolves relative path', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true, mode: 0o644 });
      const resolved = path.resolve('secrets.local.yaml');
      ensureSecureFilePermissions('secrets.local.yaml');
      expect(fs.chmodSync).toHaveBeenCalledWith(resolved, 0o600);
    });

    it('returns false and does not chmod when statSync throws', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      expect(ensureSecureFilePermissions('/tmp/secrets.local.yaml')).toBe(false);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('exports SECRET_FILE_MODE and CONFIG_FILE_MODE as 0o600', () => {
      expect(SECRET_FILE_MODE).toBe(0o600);
      expect(CONFIG_FILE_MODE).toBe(0o600);
    });
  });

  describe('ensureSecureDirPermissions', () => {
    it('returns false when dirPath is empty', () => {
      expect(ensureSecureDirPermissions('')).toBe(false);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns false when directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(ensureSecureDirPermissions('/tmp/.aifabrix')).toBe(false);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns false when path is a file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true, isDirectory: () => false, mode: 0o644 });
      expect(ensureSecureDirPermissions('/tmp/file')).toBe(false);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns true and does not chmod when directory already has 0o700', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isDirectory: () => true, mode: 0o700 });
      expect(ensureSecureDirPermissions('/tmp/.aifabrix')).toBe(true);
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('returns true and chmods when directory has 0o755', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isDirectory: () => true, mode: 0o755 });
      expect(ensureSecureDirPermissions('/tmp/.aifabrix')).toBe(true);
      expect(fs.chmodSync).toHaveBeenCalledWith('/tmp/.aifabrix', 0o700);
    });
  });
});
