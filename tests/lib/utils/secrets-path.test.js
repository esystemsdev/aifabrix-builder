/**
 * Tests for AI Fabrix Builder Secrets Path Resolution Module
 *
 * @fileoverview Unit tests for secrets-path.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock config BEFORE requiring secrets-path
jest.mock('../../../lib/core/config', () => ({
  getAifabrixSecretsPath: jest.fn().mockResolvedValue(null)
}));

const secretsPath = require('../../../lib/utils/secrets-path');

// Mock fs module
jest.mock('fs');
jest.mock('os');

describe('Secrets Path Module', () => {
  const mockHomeDir = '/home/test';
  const mockCwd = '/project/root';

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    process.cwd = jest.fn().mockReturnValue(mockCwd);
    // Reset canonical path mock before each test to avoid leakage
    const config = require('../../../lib/core/config');
    if (config.getAifabrixSecretsPath && typeof config.getAifabrixSecretsPath.mockResolvedValue === 'function') {
      config.getAifabrixSecretsPath.mockResolvedValue(null);
    }
  });

  describe('resolveSecretsPath', () => {
    it('should return provided path when path is given', () => {
      const result = secretsPath.resolveSecretsPath('/custom/path/secrets.yaml');
      expect(result).toBe('/custom/path/secrets.yaml');
    });

    it('should resolve relative path starting with ..', () => {
      const relativePath = '../../secrets.local.yaml';
      const expectedPath = path.resolve(mockCwd, relativePath);
      const result = secretsPath.resolveSecretsPath(relativePath);
      expect(result).toBe(expectedPath);
    });

    it('should return default location when no common locations exist', () => {
      fs.existsSync.mockReturnValue(false); // Not used in new logic but keep harmless
      const expectedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      const result = secretsPath.resolveSecretsPath();
      expect(result).toBe(expectedPath);
    });
  });

  describe('getActualSecretsPath', () => {
    it('should return object with resolved path when explicit path provided', async() => {
      const explicitPath = '/custom/path/secrets.yaml';
      fs.existsSync.mockReturnValue(true);

      const result = await secretsPath.getActualSecretsPath(explicitPath);
      expect(result).toEqual({
        userPath: explicitPath,
        buildPath: null
      });
    });

    it('should use canonical aifabrix-secrets absolute path when build.secrets not set', async() => {
      const config = require('../../../lib/core/config');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const canonicalPath = '/abs/canonical/secrets.yaml';
      config.getAifabrixSecretsPath.mockResolvedValue(canonicalPath);
      fs.existsSync.mockReturnValue(false);

      const result = await secretsPath.getActualSecretsPath(undefined, 'app');
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: canonicalPath
      });
    });

    it('should resolve relative canonical aifabrix-secrets path against cwd', async() => {
      const config = require('../../../lib/core/config');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const relativeCanonical = './relative/secrets.yaml';
      const resolvedCanonical = path.resolve(mockCwd, relativeCanonical);
      config.getAifabrixSecretsPath.mockResolvedValue(relativeCanonical);
      fs.existsSync.mockReturnValue(false);

      const result = await secretsPath.getActualSecretsPath(undefined, 'app');
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: resolvedCanonical
      });
    });

    it('should return object with user secrets path when it exists', async() => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === userSecretsPath;
      });

      const result = await secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with buildPath from config.yaml when aifabrix-secrets is set', async() => {
      const appName = 'test-app';
      const buildSecretsPath = '/custom/secrets.yaml';
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      const config = require('../../../lib/core/config');
      config.getAifabrixSecretsPath.mockResolvedValue(buildSecretsPath);

      const result = await secretsPath.getActualSecretsPath(undefined, appName);
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: buildSecretsPath
      });
    });

    it('should return object with null buildPath when aifabrix-secrets is not set', async() => {
      const appName = 'test-app';
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      const config = require('../../../lib/core/config');
      config.getAifabrixSecretsPath.mockResolvedValue(null);

      const result = await secretsPath.getActualSecretsPath(undefined, appName);
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with null buildPath when error reading application.yaml', async() => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'application.yaml');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        if (filePath === variablesPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          throw new Error('Read error');
        }
        return '';
      });

      const result = await secretsPath.getActualSecretsPath(undefined, appName);
      // Should return userPath with null buildPath despite error
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with null buildPath when parsing invalid YAML in application.yaml', async() => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'application.yaml');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        if (filePath === variablesPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return 'invalid: yaml: content: [';
        }
        return '';
      });

      const result = await secretsPath.getActualSecretsPath(undefined, appName);
      // Should return userPath with null buildPath despite YAML parse error
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with userPath when user file does not exist', async() => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        return false;
      });

      const result = await secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with userPath as fallback when no files exist', async() => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockReturnValue(false);

      const result = await secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with null buildPath when appName is not provided', async() => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        return false;
      });

      const result = await secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });
});

