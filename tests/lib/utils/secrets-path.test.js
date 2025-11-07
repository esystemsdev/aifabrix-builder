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

    it('should check common locations when no path provided', () => {
      const commonLocations = [
        path.join(mockCwd, '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, '..', '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, 'secrets.local.yaml'),
        path.join(mockCwd, '..', 'secrets.local.yaml'),
        path.join(mockHomeDir, '.aifabrix', 'secrets.yaml')
      ];

      // Test first location exists
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === commonLocations[0];
      });

      const result = secretsPath.resolveSecretsPath();
      expect(result).toBe(commonLocations[0]);
      expect(fs.existsSync).toHaveBeenCalledWith(commonLocations[0]);
    });

    it('should check second location when first does not exist', () => {
      const commonLocations = [
        path.join(mockCwd, '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, '..', '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, 'secrets.local.yaml'),
        path.join(mockCwd, '..', 'secrets.local.yaml'),
        path.join(mockHomeDir, '.aifabrix', 'secrets.yaml')
      ];

      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // First location doesn't exist, second does
        if (callCount === 1) return false;
        if (callCount === 2) return true;
        return false;
      });

      const result = secretsPath.resolveSecretsPath();
      expect(result).toBe(commonLocations[1]);
    });

    it('should check third location when first two do not exist', () => {
      const commonLocations = [
        path.join(mockCwd, '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, '..', '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, 'secrets.local.yaml'),
        path.join(mockCwd, '..', 'secrets.local.yaml'),
        path.join(mockHomeDir, '.aifabrix', 'secrets.yaml')
      ];

      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // First two don't exist, third does
        if (callCount <= 2) return false;
        if (callCount === 3) return true;
        return false;
      });

      const result = secretsPath.resolveSecretsPath();
      expect(result).toBe(commonLocations[2]);
    });

    it('should check fourth location when first three do not exist', () => {
      const commonLocations = [
        path.join(mockCwd, '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, '..', '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, 'secrets.local.yaml'),
        path.join(mockCwd, '..', 'secrets.local.yaml'),
        path.join(mockHomeDir, '.aifabrix', 'secrets.yaml')
      ];

      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // First three don't exist, fourth does
        if (callCount <= 3) return false;
        if (callCount === 4) return true;
        return false;
      });

      const result = secretsPath.resolveSecretsPath();
      expect(result).toBe(commonLocations[3]);
    });

    it('should check fifth location when first four do not exist', () => {
      const commonLocations = [
        path.join(mockCwd, '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, '..', '..', 'aifabrix-setup', 'secrets.local.yaml'),
        path.join(mockCwd, 'secrets.local.yaml'),
        path.join(mockCwd, '..', 'secrets.local.yaml'),
        path.join(mockHomeDir, '.aifabrix', 'secrets.yaml')
      ];

      let callCount = 0;
      fs.existsSync.mockImplementation((filePath) => {
        callCount++;
        // First four don't exist, fifth does
        if (callCount <= 4) return false;
        if (callCount === 5) return true;
        return false;
      });

      const result = secretsPath.resolveSecretsPath();
      expect(result).toBe(commonLocations[4]);
    });

    it('should return default location when no common locations exist', () => {
      fs.existsSync.mockReturnValue(false);
      const expectedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      const result = secretsPath.resolveSecretsPath();
      expect(result).toBe(expectedPath);
    });
  });

  describe('getActualSecretsPath', () => {
    it('should return object with resolved path when explicit path provided', () => {
      const explicitPath = '/custom/path/secrets.yaml';
      fs.existsSync.mockReturnValue(true);

      const result = secretsPath.getActualSecretsPath(explicitPath);
      expect(result).toEqual({
        userPath: explicitPath,
        buildPath: null
      });
    });

    it('should return object with user secrets path when it exists', () => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === userSecretsPath;
      });

      const result = secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with build.secrets path when appName provided and build.secrets is configured', () => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'variables.yaml');
      const buildSecretsPath = path.resolve(path.dirname(variablesPath), 'custom-secrets.yaml');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      const mockVariables = {
        build: {
          secrets: 'custom-secrets.yaml'
        }
      };

      fs.existsSync.mockImplementation((filePath) => {
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath === path.normalize(userSecretsPath)) return false;
        if (normalizedPath === path.normalize(variablesPath)) return true;
        if (normalizedPath === path.normalize(buildSecretsPath)) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (path.normalize(filePath) === path.normalize(variablesPath)) {
          return yaml.dump(mockVariables);
        }
        return '';
      });

      const result = secretsPath.getActualSecretsPath(undefined, appName);
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: buildSecretsPath
      });
      expect(fs.existsSync).toHaveBeenCalledWith(variablesPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(variablesPath, 'utf8');
    });

    it('should return object with buildPath even when build.secrets file does not exist', () => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'variables.yaml');
      const buildSecretsPath = path.resolve(path.dirname(variablesPath), 'custom-secrets.yaml');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      const mockVariables = {
        build: {
          secrets: 'custom-secrets.yaml'
        }
      };

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        if (filePath === variablesPath) return true;
        if (filePath === buildSecretsPath) return false; // Build secrets path doesn't exist
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump(mockVariables);
        }
        return '';
      });

      const result = secretsPath.getActualSecretsPath(undefined, appName);
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: buildSecretsPath
      });
    });

    it('should return object with null buildPath when variables.yaml does not exist', () => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'variables.yaml');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        if (filePath === variablesPath) return false; // variables.yaml doesn't exist
        return false;
      });

      const result = secretsPath.getActualSecretsPath(undefined, appName);
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with null buildPath when variables.yaml has no build.secrets', () => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'variables.yaml');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      const mockVariables = {
        build: {}
      };

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        if (filePath === variablesPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump(mockVariables);
        }
        return '';
      });

      const result = secretsPath.getActualSecretsPath(undefined, appName);
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with null buildPath when error reading variables.yaml', () => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'variables.yaml');
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

      const result = secretsPath.getActualSecretsPath(undefined, appName);
      // Should return userPath with null buildPath despite error
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with null buildPath when parsing invalid YAML in variables.yaml', () => {
      const appName = 'test-app';
      const variablesPath = path.join(mockCwd, 'builder', appName, 'variables.yaml');
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

      const result = secretsPath.getActualSecretsPath(undefined, appName);
      // Should return userPath with null buildPath despite YAML parse error
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with userPath when user file does not exist', () => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        return false;
      });

      const result = secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with userPath as fallback when no files exist', () => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockReturnValue(false);

      const result = secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
    });

    it('should return object with null buildPath when appName is not provided', () => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return false;
        return false;
      });

      const result = secretsPath.getActualSecretsPath();
      expect(result).toEqual({
        userPath: userSecretsPath,
        buildPath: null
      });
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });
});

