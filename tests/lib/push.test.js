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
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });

    it('should return true when Azure CLI is installed', async() => {
      execAsync.mockResolvedValueOnce({ stdout: 'azure-cli 2.50.0', stderr: '' });

      const result = await pushUtils.checkAzureCLIInstalled();

      expect(result).toBe(true);
      // On non-Windows, no options; on Windows, shell: true
      // Both include timeout: 5000
      if (process.platform === 'win32') {
        expect(execAsync).toHaveBeenCalledWith('az --version', { shell: true, timeout: 5000 });
      } else {
        expect(execAsync).toHaveBeenCalledWith('az --version', { timeout: 5000 });
      }
    });

    it('should return false when Azure CLI is not installed', async() => {
      // Set platform to non-Windows to avoid fallback behavior
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      execAsync.mockRejectedValueOnce(new Error('command not found: az'));

      const result = await pushUtils.checkAzureCLIInstalled();

      expect(result).toBe(false);
    });

    it('should return false on any error', async() => {
      // Set platform to non-Windows to avoid fallback behavior
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      execAsync.mockRejectedValueOnce(new Error('Unknown error'));

      const result = await pushUtils.checkAzureCLIInstalled();

      expect(result).toBe(false);
    });

    it('should try az.cmd fallback on Windows when az fails', async() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      // First call fails, second succeeds with az.cmd
      execAsync.mockRejectedValueOnce(new Error('command not found: az'));
      execAsync.mockResolvedValueOnce({ stdout: 'azure-cli 2.50.0', stderr: '' });

      const result = await pushUtils.checkAzureCLIInstalled();

      expect(result).toBe(true);
      expect(execAsync).toHaveBeenCalledWith('az --version', { shell: true, timeout: 5000 });
      expect(execAsync).toHaveBeenCalledWith('az.cmd --version', { shell: true, timeout: 5000 });
    });

    it('should return false on Windows when both az and az.cmd fail', async() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      execAsync.mockRejectedValueOnce(new Error('command not found: az'));
      execAsync.mockRejectedValueOnce(new Error('command not found: az.cmd'));

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

    it('should accept external registries', () => {
      expect(pushUtils.validateRegistryURL('invalid.com')).toBe(true); // Generic hostname
      expect(pushUtils.validateRegistryURL('myacr.com')).toBe(true); // Generic hostname
      expect(pushUtils.validateRegistryURL('myacr.com:5000')).toBe(true); // With port
      expect(pushUtils.validateRegistryURL('ghcr.io')).toBe(true); // GitHub Container Registry
      expect(pushUtils.validateRegistryURL('docker.io')).toBe(true); // Docker Hub
      expect(pushUtils.validateRegistryURL('index.docker.io')).toBe(true); // Docker Hub alt
    });

    it('should reject invalid formats', () => {
      expect(pushUtils.validateRegistryURL('azurecr.io')).toBe(false); // Missing subdomain
      expect(pushUtils.validateRegistryURL('myacr.azurecr.com')).toBe(false); // Wrong TLD
      expect(pushUtils.validateRegistryURL('myacr')).toBe(false); // No domain
      expect(pushUtils.validateRegistryURL('')).toBe(false);
      expect(pushUtils.validateRegistryURL('http://example.com')).toBe(false); // Protocol not allowed
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
      // On Windows, includes shell: true option
      if (process.platform === 'win32') {
        expect(execAsync).toHaveBeenCalledWith('az acr show --name myacr', { shell: true });
      } else {
        expect(execAsync).toHaveBeenCalledWith('az acr show --name myacr', {});
      }
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

      // On Windows, includes shell: true option
      if (process.platform === 'win32') {
        expect(execAsync).toHaveBeenCalledWith('az acr login --name myacr', { shell: true });
      } else {
        expect(execAsync).toHaveBeenCalledWith('az acr login --name myacr', {});
      }
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
        'docker images --format "{{.Repository}}:{{.Tag}}" --filter "reference=myapp:latest"'
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

