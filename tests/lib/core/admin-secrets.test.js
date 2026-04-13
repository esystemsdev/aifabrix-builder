/**
 * Tests for admin-secrets read/decrypt and env serialization.
 *
 * @fileoverview Unit tests for lib/core/admin-secrets.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/core/config', () => ({
  getSecretsEncryptionKey: jest.fn().mockResolvedValue('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')
}));

jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/home/user'),
  getAifabrixSystemDir: jest.fn(() => '/home/.aifabrix')
}));

jest.mock('../../../lib/utils/secrets-encryption', () => ({
  decryptSecret: jest.fn((val) => val.replace(/^secure:\/\//, '')),
  isEncrypted: jest.fn((val) => typeof val === 'string' && val.startsWith('secure://'))
}));

jest.mock('../../../lib/internal/fs-real-sync', () => {
  const actual = jest.requireActual('../../../lib/internal/fs-real-sync');
  return {
    ...actual,
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => 'POSTGRES_PASSWORD=plain\nPGADMIN_DEFAULT_EMAIL=admin@aifabrix.dev\n'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    statSync: jest.fn(),
    readdirSync: jest.fn()
  };
});

const fsRealSync = require('../../../lib/internal/fs-real-sync');
const adminSecrets = require('../../../lib/core/admin-secrets');
const config = require('../../../lib/core/config');

describe('admin-secrets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getSecretsEncryptionKey.mockResolvedValue('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
    fsRealSync.existsSync.mockReturnValue(true);
    fsRealSync.readFileSync.mockReturnValue('POSTGRES_PASSWORD=plain\nPGADMIN_DEFAULT_EMAIL=admin@aifabrix.dev\n');
  });

  describe('readAndDecryptAdminSecrets', () => {
    it('reads and returns plain key-value object when no encrypted values', async() => {
      const result = await adminSecrets.readAndDecryptAdminSecrets();
      expect(result).toEqual({
        POSTGRES_PASSWORD: 'plain',
        PGADMIN_DEFAULT_EMAIL: 'admin@aifabrix.dev'
      });
    });

    it('decrypts secure:// values when encryption key is set', async() => {
      const { decryptSecret, isEncrypted } = require('../../../lib/utils/secrets-encryption');
      isEncrypted.mockImplementation((v) => v && v.startsWith('secure://'));
      decryptSecret.mockImplementation((v) => v.replace(/^secure:\/\//, 'decrypted-'));
      fsRealSync.readFileSync.mockReturnValue('POSTGRES_PASSWORD=secure://xxx\nPGADMIN_DEFAULT_EMAIL=admin@aifabrix.dev\n');

      const result = await adminSecrets.readAndDecryptAdminSecrets();
      expect(result.POSTGRES_PASSWORD).toBe('decrypted-xxx');
      expect(decryptSecret).toHaveBeenCalledWith('secure://xxx', expect.any(String));
    });

    it('throws when file does not exist', async() => {
      fsRealSync.existsSync.mockReturnValue(false);
      await expect(adminSecrets.readAndDecryptAdminSecrets()).rejects.toThrow(/Admin secrets file not found/);
    });

    it('uses legacy aifabrix-home admin-secrets.env when system dir file is missing', async() => {
      const pathsMod = require('../../../lib/utils/paths');
      fsRealSync.existsSync.mockImplementation((p) => p === '/home/user/admin-secrets.env');
      fsRealSync.readFileSync.mockReturnValue('POSTGRES_PASSWORD=legacy\n');

      const result = await adminSecrets.readAndDecryptAdminSecrets();
      expect(result.POSTGRES_PASSWORD).toBe('legacy');
      expect(fsRealSync.readFileSync).toHaveBeenCalledWith('/home/user/admin-secrets.env', 'utf8');
      expect(pathsMod.getAifabrixSystemDir).toHaveBeenCalled();
    });

    it('throws when encrypted value present but no encryption key', async() => {
      config.getSecretsEncryptionKey.mockResolvedValue(null);
      const { isEncrypted } = require('../../../lib/utils/secrets-encryption');
      isEncrypted.mockReturnValue(true);
      fsRealSync.readFileSync.mockReturnValue('POSTGRES_PASSWORD=secure://xxx\n');

      await expect(adminSecrets.readAndDecryptAdminSecrets()).rejects.toThrow(/no secrets-encryption key/);
    });
  });

  describe('envObjectToContent', () => {
    it('serializes object to KEY=value lines', () => {
      const out = adminSecrets.envObjectToContent({ A: '1', B: '2' });
      expect(out).toContain('A=1');
      expect(out).toContain('B=2');
    });

    it('handles empty string value', () => {
      const out = adminSecrets.envObjectToContent({ KEY: '' });
      expect(out).toContain('KEY=');
    });

    it('strips newlines from values', () => {
      const out = adminSecrets.envObjectToContent({ X: 'a\nb' });
      expect(out).toContain('X=a b');
    });
  });

  describe('readAndDecryptAdminSecrets with comments and blank lines', () => {
    it('skips comment lines and blank lines', async() => {
      fsRealSync.readFileSync.mockReturnValue(
        '# comment\n\nPOSTGRES_PASSWORD=secret\nPGADMIN_DEFAULT_EMAIL=admin@test\n'
      );
      const result = await adminSecrets.readAndDecryptAdminSecrets();
      expect(result.POSTGRES_PASSWORD).toBe('secret');
      expect(result.PGADMIN_DEFAULT_EMAIL).toBe('admin@test');
    });
  });
});
