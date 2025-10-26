/**
 * Tests for AI Fabrix Builder Push Utilities
 *
 * @fileoverview Unit tests for push.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const pushUtils = require('../../lib/push');
const { exec } = require('child_process');
const { promisify } = require('util');

// Mock child_process exec
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn)
}));

describe('Push Utilities', () => {
  let execAsync;
  let originalConsoleLog;

  beforeEach(() => {
    execAsync = promisify(exec);
    jest.spyOn(require('util'), 'promisify').mockReturnValue(execAsync);
    originalConsoleLog = console.log;
    console.log = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.log = originalConsoleLog;
  });

  describe('checkAzureCLIInstalled', () => {
    it('should return true when Azure CLI is installed', async() => {
      execAsync.mockResolvedValueOnce({ stdout: 'azure-cli 2.50.0', stderr: '' });

      const result = await pushUtils.checkAzureCLIInstalled();

      expect(result).toBe(true);
      expect(execAsync).toHaveBeenCalledWith('az --version');
    });

    it('should return false when Azure CLI is not installed', async() => {
      execAsync.mockRejectedValueOnce(new Error('command not found: az'));

      const result = await pushUtils.checkAzureCLIInstalled();

      expect(result).toBe(false);
    });

    it('should return false on any error', async() => {
      execAsync.mockRejectedValueOnce(new Error('Unknown error'));

      const result = await pushUtils.checkAzureCLIInstalled();

      expect(result).toBe(false);
    });
  });

  describe('validateRegistryURL', () => {
    it('should accept valid ACR URLs', () => {
      expect(pushUtils.validateRegistryURL('myacr.azurecr.io')).toBe(true);
      expect(pushUtils.validateRegistryURL('test-registry.azurecr.io')).toBe(true);
      expect(pushUtils.validateRegistryURL('a.azurecr.io')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(pushUtils.validateRegistryURL('invalid.com')).toBe(false);
      expect(pushUtils.validateRegistryURL('myacr.com')).toBe(false);
      expect(pushUtils.validateRegistryURL('azurecr.io')).toBe(false);
      expect(pushUtils.validateRegistryURL('myacr.azurecr.com')).toBe(false);
      expect(pushUtils.validateRegistryURL('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(pushUtils.validateRegistryURL('myacr')).toBe(false);
      // validateRegistryURL only checks the domain format, not protocol
      expect(pushUtils.validateRegistryURL('not-a-url')).toBe(false);
    });
  });

  describe('extractRegistryName', () => {
    it('should extract registry name from valid ACR URL', () => {
      expect(pushUtils.extractRegistryName('myacr.azurecr.io')).toBe('myacr');
      expect(pushUtils.extractRegistryName('test-registry.azurecr.io')).toBe('test-registry');
    });

    it('should throw error for invalid URL format', () => {
      expect(() => pushUtils.extractRegistryName('invalid.com'))
        .toThrow('Invalid ACR URL format');

      expect(() => pushUtils.extractRegistryName('azurecr.io'))
        .toThrow('Invalid ACR URL format');

      expect(() => pushUtils.extractRegistryName(''))
        .toThrow('Invalid ACR URL format');
    });

    it('should handle URLs with paths', () => {
      // extractRegistryName only extracts the base domain
      expect(() => pushUtils.extractRegistryName('myacr.azurecr.io/v1'))
        .toThrow('Invalid ACR URL format');
    });
  });

  describe('checkACRAuthentication', () => {
    it('should return true when authenticated', async() => {
      execAsync.mockResolvedValueOnce({ stdout: 'registry info', stderr: '' });

      const result = await pushUtils.checkACRAuthentication('myacr.azurecr.io');

      expect(result).toBe(true);
      expect(execAsync).toHaveBeenCalledWith('az acr show --name myacr');
    });

    it('should return false when not authenticated', async() => {
      execAsync.mockRejectedValueOnce(new Error('Not authenticated'));

      const result = await pushUtils.checkACRAuthentication('myacr.azurecr.io');

      expect(result).toBe(false);
    });

    it('should handle authentication errors gracefully', async() => {
      execAsync.mockRejectedValueOnce(new Error('Service principal not found'));

      const result = await pushUtils.checkACRAuthentication('myacr.azurecr.io');

      expect(result).toBe(false);
    });
  });

  describe('authenticateACR', () => {
    it('should authenticate successfully', async() => {
      execAsync.mockResolvedValueOnce({ stdout: 'Login succeeded', stderr: '' });

      await pushUtils.authenticateACR('myacr.azurecr.io');

      expect(execAsync).toHaveBeenCalledWith('az acr login --name myacr');
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw error on authentication failure', async() => {
      execAsync.mockRejectedValueOnce(new Error('Authentication failed'));

      await expect(pushUtils.authenticateACR('myacr.azurecr.io'))
        .rejects.toThrow('Failed to authenticate');
    });

    it('should handle invalid registry name', async() => {
      execAsync.mockRejectedValueOnce(new Error('Registry not found'));

      await expect(pushUtils.authenticateACR('invalid.azurecr.io'))
        .rejects.toThrow('Failed to authenticate');
    });
  });

  describe('checkLocalImageExists', () => {
    it('should return true when image exists', async() => {
      execAsync.mockResolvedValueOnce({
        stdout: 'myapp:latest',
        stderr: ''
      });

      const result = await pushUtils.checkLocalImageExists('myapp', 'latest');

      expect(result).toBe(true);
      expect(execAsync).toHaveBeenCalledWith(
        'docker images --format "{{.Repository}}:{{.Tag}}" | grep "^myapp:latest$"'
      );
    });

    it('should return false when image does not exist', async() => {
      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await pushUtils.checkLocalImageExists('nonexistent', 'latest');

      expect(result).toBe(false);
    });

    it('should return false on error', async() => {
      execAsync.mockRejectedValueOnce(new Error('grep failed'));

      const result = await pushUtils.checkLocalImageExists('myapp', 'latest');

      expect(result).toBe(false);
    });

  });

  describe('tagImage', () => {
    it('should tag image successfully', async() => {
      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await pushUtils.tagImage('myapp:latest', 'myacr.azurecr.io/myapp:latest');

      expect(execAsync).toHaveBeenCalledWith(
        'docker tag myapp:latest myacr.azurecr.io/myapp:latest'
      );
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw error on tagging failure', async() => {
      execAsync.mockRejectedValueOnce(new Error('Tag failed'));

      await expect(pushUtils.tagImage('myapp:latest', 'myacr.azurecr.io/myapp:latest'))
        .rejects.toThrow('Failed to tag image');
    });

    it('should handle invalid image names', async() => {
      execAsync.mockRejectedValueOnce(new Error('invalid reference format'));

      await expect(pushUtils.tagImage('invalid', 'target'))
        .rejects.toThrow('Failed to tag image');
    });
  });

  describe('pushImage', () => {
    it('should push image successfully', async() => {
      execAsync.mockResolvedValueOnce({ stdout: 'Pushed', stderr: '' });

      await pushUtils.pushImage('myacr.azurecr.io/myapp:latest');

      expect(execAsync).toHaveBeenCalledWith('docker push myacr.azurecr.io/myapp:latest');
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw error on push failure', async() => {
      execAsync.mockRejectedValueOnce(new Error('Push failed'));

      await expect(pushUtils.pushImage('myacr.azurecr.io/myapp:latest'))
        .rejects.toThrow('Failed to push image');
    });

    it('should handle authentication errors', async() => {
      execAsync.mockRejectedValueOnce(new Error('unauthorized'));

      await expect(pushUtils.pushImage('myacr.azurecr.io/myapp:latest'))
        .rejects.toThrow('Failed to push image');
    });

    it('should handle network errors', async() => {
      execAsync.mockRejectedValueOnce(new Error('connection refused'));

      await expect(pushUtils.pushImage('myacr.azurecr.io/myapp:latest'))
        .rejects.toThrow('Failed to push image');
    });
  });
});

