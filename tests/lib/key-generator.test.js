/**
 * Tests for AI Fabrix Builder Key Generator Module
 *
 * @fileoverview Unit tests for key-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const keyGenerator = require('../../lib/key-generator');

// Mock fs module
jest.mock('fs');

describe('Key Generator Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDeploymentKey', () => {
    it('should generate deployment key from variables.yaml', async() => {
      const appName = 'testapp';
      const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
      const mockContent = 'key: testapp\ndisplayName: Test App';
      const expectedHash = crypto.createHash('sha256').update(mockContent, 'utf8').digest('hex');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockContent);

      const result = await keyGenerator.generateDeploymentKey(appName);

      expect(fs.existsSync).toHaveBeenCalledWith(variablesPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(variablesPath, 'utf8');
      expect(result).toBe(expectedHash);
    });

    it('should throw error if app name is invalid', async() => {
      await expect(keyGenerator.generateDeploymentKey()).rejects.toThrow('App name is required and must be a string');
      await expect(keyGenerator.generateDeploymentKey(123)).rejects.toThrow('App name is required and must be a string');
      await expect(keyGenerator.generateDeploymentKey('')).rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error if variables.yaml not found', async() => {
      const appName = 'testapp';
      const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

      fs.existsSync.mockReturnValue(false);

      await expect(keyGenerator.generateDeploymentKey(appName)).rejects.toThrow(`variables.yaml not found: ${variablesPath}`);
    });
  });

  describe('generateDeploymentKeyFromContent', () => {
    it('should generate SHA256 hash from content', () => {
      const content = 'key: testapp\ndisplayName: Test App';
      const expectedHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

      const result = keyGenerator.generateDeploymentKeyFromContent(content);

      expect(result).toBe(expectedHash);
    });

    it('should generate consistent hash for same content', () => {
      const content = 'key: testapp\ndisplayName: Test App';

      const hash1 = keyGenerator.generateDeploymentKeyFromContent(content);
      const hash2 = keyGenerator.generateDeploymentKeyFromContent(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const content1 = 'key: testapp\ndisplayName: Test App';
      const content2 = 'key: testapp\ndisplayName: Different App';

      const hash1 = keyGenerator.generateDeploymentKeyFromContent(content1);
      const hash2 = keyGenerator.generateDeploymentKeyFromContent(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should throw error if content is invalid', () => {
      expect(() => keyGenerator.generateDeploymentKeyFromContent()).toThrow('Content is required and must be a string');
      expect(() => keyGenerator.generateDeploymentKeyFromContent(null)).toThrow('Content is required and must be a string');
      expect(() => keyGenerator.generateDeploymentKeyFromContent(123)).toThrow('Content is required and must be a string');
    });

    it('should handle empty content', () => {
      const content = '';
      const expectedHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

      const result = keyGenerator.generateDeploymentKeyFromContent(content);

      expect(result).toBe(expectedHash);
    });

    it('should handle special characters in content', () => {
      const content = 'key: test-app\ndisplayName: "Test App with Special Chars: @#$%"';
      const expectedHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

      const result = keyGenerator.generateDeploymentKeyFromContent(content);

      expect(result).toBe(expectedHash);
    });
  });

  describe('generateDeploymentKeyFromJson', () => {
    it('should generate SHA256 hash from deployment object', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        type: 'webapp',
        port: 3000
      };

      const result = keyGenerator.generateDeploymentKeyFromJson(deployment);

      expect(result).toMatch(/^[a-f0-9]{64}$/);
      expect(result).toHaveLength(64);
    });

    it('should exclude deploymentKey field when generating hash', () => {
      const deployment1 = {
        key: 'testapp',
        displayName: 'Test App',
        deploymentKey: 'should-be-ignored-1234567890123456789012345678901234567890123456789012345678901234'
      };

      const deployment2 = {
        key: 'testapp',
        displayName: 'Test App',
        deploymentKey: 'different-key-should-still-match-123456789012345678901234567890123456789012345678901234567890'
      };

      const hash1 = keyGenerator.generateDeploymentKeyFromJson(deployment1);
      const hash2 = keyGenerator.generateDeploymentKeyFromJson(deployment2);

      // Should generate same hash regardless of deploymentKey value
      expect(hash1).toBe(hash2);
    });

    it('should generate consistent hash for same object', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        type: 'webapp',
        port: 3000
      };

      const hash1 = keyGenerator.generateDeploymentKeyFromJson(deployment);
      const hash2 = keyGenerator.generateDeploymentKeyFromJson(deployment);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different objects', () => {
      const deployment1 = {
        key: 'testapp',
        displayName: 'Test App',
        port: 3000
      };

      const deployment2 = {
        key: 'testapp',
        displayName: 'Different App',
        port: 3000
      };

      const hash1 = keyGenerator.generateDeploymentKeyFromJson(deployment1);
      const hash2 = keyGenerator.generateDeploymentKeyFromJson(deployment2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle nested objects and arrays', () => {
      const deployment = {
        key: 'testapp',
        configuration: [
          { name: 'VAR1', value: 'value1' },
          { name: 'VAR2', value: 'value2' }
        ],
        authentication: {
          type: 'azure',
          enableSSO: true
        }
      };

      const result = keyGenerator.generateDeploymentKeyFromJson(deployment);

      expect(result).toMatch(/^[a-f0-9]{64}$/);
      expect(result).toHaveLength(64);
    });

    it('should use deterministic key ordering', () => {
      const deployment1 = {
        b: 'second',
        a: 'first',
        c: 'third'
      };

      const deployment2 = {
        a: 'first',
        b: 'second',
        c: 'third'
      };

      const hash1 = keyGenerator.generateDeploymentKeyFromJson(deployment1);
      const hash2 = keyGenerator.generateDeploymentKeyFromJson(deployment2);

      // Should generate same hash regardless of key order
      expect(hash1).toBe(hash2);
    });

    it('should throw error if deployment object is invalid', () => {
      expect(() => keyGenerator.generateDeploymentKeyFromJson()).toThrow('Deployment object is required and must be an object');
      expect(() => keyGenerator.generateDeploymentKeyFromJson(null)).toThrow('Deployment object is required and must be an object');
      expect(() => keyGenerator.generateDeploymentKeyFromJson(123)).toThrow('Deployment object is required and must be an object');
      expect(() => keyGenerator.generateDeploymentKeyFromJson('string')).toThrow('Deployment object is required and must be an object');
    });

    it('should handle empty object', () => {
      const deployment = {};
      const result = keyGenerator.generateDeploymentKeyFromJson(deployment);

      expect(result).toMatch(/^[a-f0-9]{64}$/);
      expect(result).toHaveLength(64);
    });
  });

  describe('validateDeploymentKey', () => {
    it('should return true for valid SHA256 hash', () => {
      const validKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

      const result = keyGenerator.validateDeploymentKey(validKey);

      expect(result).toBe(true);
    });

    it('should return true for valid SHA256 hash with uppercase letters', () => {
      const validKey = 'A1B2C3D4E5F6789012345678901234567890ABCDEF1234567890ABCDEF123456';

      const result = keyGenerator.validateDeploymentKey(validKey);

      expect(result).toBe(true);
    });

    it('should return false for invalid key formats', () => {
      expect(keyGenerator.validateDeploymentKey()).toBe(false);
      expect(keyGenerator.validateDeploymentKey(null)).toBe(false);
      expect(keyGenerator.validateDeploymentKey(123)).toBe(false);
      expect(keyGenerator.validateDeploymentKey('')).toBe(false);
      expect(keyGenerator.validateDeploymentKey('short')).toBe(false);
      expect(keyGenerator.validateDeploymentKey('a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345')).toBe(false); // 63 chars
      expect(keyGenerator.validateDeploymentKey('a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567')).toBe(false); // 65 chars
      expect(keyGenerator.validateDeploymentKey('g1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456')).toBe(false); // invalid hex char
    });

    it('should return false for non-hex characters', () => {
      const invalidKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345g';

      const result = keyGenerator.validateDeploymentKey(invalidKey);

      expect(result).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(keyGenerator.validateDeploymentKey('0'.repeat(64))).toBe(true);
      expect(keyGenerator.validateDeploymentKey('f'.repeat(64))).toBe(true);
      expect(keyGenerator.validateDeploymentKey('A'.repeat(64))).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should work end-to-end: generate key from file and validate it', async() => {
      const appName = 'testapp';
      const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
      const mockContent = 'key: testapp\ndisplayName: Test App';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockContent);

      const key = await keyGenerator.generateDeploymentKey(appName);
      const isValid = keyGenerator.validateDeploymentKey(key);

      expect(isValid).toBe(true);
      expect(key).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(key)).toBe(true);
    });

    it('should generate same key for identical content', async() => {
      const content = 'key: testapp\ndisplayName: Test App';

      const key1 = keyGenerator.generateDeploymentKeyFromContent(content);
      const key2 = keyGenerator.generateDeploymentKeyFromContent(content);

      expect(key1).toBe(key2);
      expect(keyGenerator.validateDeploymentKey(key1)).toBe(true);
      expect(keyGenerator.validateDeploymentKey(key2)).toBe(true);
    });
  });
});
