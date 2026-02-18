/**
 * Tests for ssh-key-helper (SSH dir, key paths, ensure key, read public key).
 * @fileoverview Unit tests for lib/utils/ssh-key-helper.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

jest.mock('fs');
jest.mock('os');
jest.mock('child_process', () => ({ execSync: jest.fn() }));

const osReal = jest.requireActual('os');
os.homedir.mockReturnValue('/home/user');

const sshKeyHelper = require('../../../lib/utils/ssh-key-helper');

describe('ssh-key-helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue('/home/user');
  });

  describe('getDefaultSshDir', () => {
    it('returns home/.ssh', () => {
      expect(sshKeyHelper.getDefaultSshDir()).toBe(path.join('/home/user', '.ssh'));
    });
  });

  describe('getDefaultEd25519PublicKeyPath', () => {
    it('returns home/.ssh/id_ed25519.pub', () => {
      expect(sshKeyHelper.getDefaultEd25519PublicKeyPath()).toBe(path.join('/home/user', '.ssh', 'id_ed25519.pub'));
    });
  });

  describe('getDefaultEd25519PrivateKeyPath', () => {
    it('returns home/.ssh/id_ed25519', () => {
      expect(sshKeyHelper.getDefaultEd25519PrivateKeyPath()).toBe(path.join('/home/user', '.ssh', 'id_ed25519'));
    });
  });

  describe('ensureSshDir', () => {
    it('returns dir when it exists', () => {
      fs.existsSync.mockReturnValue(true);
      expect(sshKeyHelper.ensureSshDir('/existing')).toBe('/existing');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('creates dir when it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(sshKeyHelper.ensureSshDir('/new')).toBe('/new');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/new', { recursive: true, mode: 0o700 });
    });
  });

  describe('readPublicKeyContent', () => {
    it('returns first line of ed25519 key when present', () => {
      const pubPath = path.join('/home/user', '.ssh', 'id_ed25519.pub');
      fs.existsSync.mockImplementation((p) => p === pubPath);
      fs.readFileSync.mockReturnValue('ssh-ed25519 AAAAxxx aifabrix\n');
      expect(sshKeyHelper.readPublicKeyContent()).toBe('ssh-ed25519 AAAAxxx aifabrix');
    });

    it('falls back to id_rsa.pub when ed25519 missing', () => {
      const sshDir = path.join('/home/user', '.ssh');
      const ed25519Path = path.join(sshDir, 'id_ed25519.pub');
      const rsaPath = path.join(sshDir, 'id_rsa.pub');
      fs.existsSync.mockImplementation((p) => p === rsaPath);
      fs.readFileSync.mockReturnValue('ssh-rsa AAAAyyy user@host\n');
      expect(sshKeyHelper.readPublicKeyContent()).toBe('ssh-rsa AAAAyyy user@host');
    });

    it('throws when no key found', () => {
      fs.existsSync.mockReturnValue(false);
      expect(() => sshKeyHelper.readPublicKeyContent()).toThrow('No SSH public key found');
    });

    it('throws when key file does not start with ssh-', () => {
      const pubPath = path.join('/home/user', '.ssh', 'id_ed25519.pub');
      fs.existsSync.mockImplementation((p) => p === pubPath);
      fs.readFileSync.mockReturnValue('not-a-key\n');
      expect(() => sshKeyHelper.readPublicKeyContent()).toThrow('Invalid SSH public key');
    });
  });

  describe('ensureEd25519Key', () => {
    it('returns pub path when both key files exist', () => {
      const privPath = path.join('/home/user', '.ssh', 'id_ed25519');
      const pubPath = privPath + '.pub';
      fs.existsSync.mockImplementation((p) => p === pubPath || p === privPath);
      expect(sshKeyHelper.ensureEd25519Key()).toBe(pubPath);
      expect(require('child_process').execSync).not.toHaveBeenCalled();
    });

    it('calls ssh-keygen when key does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const { execSync } = require('child_process');
      execSync.mockReturnValue(undefined);
      const pubPath = path.join('/home/user', '.ssh', 'id_ed25519.pub');
      expect(sshKeyHelper.ensureEd25519Key()).toBe(pubPath);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringMatching(/ssh-keygen -t ed25519.*-N ""/),
        expect.any(Object)
      );
    });
  });
});
