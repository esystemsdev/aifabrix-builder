/**
 * Comprehensive Tests for AI Fabrix Builder Application Module
 *
 * Similar structure to cli.js tests - comprehensive coverage of all app.js functions
 *
 * @fileoverview Comprehensive tests for app.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const app = require('../../lib/app');
const build = require('../../lib/build');
const appRun = require('../../lib/app-run');
const pushUtils = require('../../lib/push');
const appDeploy = require('../../lib/app-deploy');

// Mock dependencies
jest.mock('../../lib/build');
jest.mock('../../lib/app-run');
jest.mock('../../lib/push');
jest.mock('../../lib/app-deploy');
jest.mock('../../lib/templates');
jest.mock('../../lib/env-reader');
jest.mock('../../lib/github-generator');

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

describe('Application Module - Comprehensive Tests', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    jest.clearAllMocks();

    // Mock inquirer to return default values
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValue({
      port: '3000',
      language: 'typescript',
      database: false,
      redis: false,
      storage: false,
      authentication: false
    });

    // Setup default mocks
    build.buildApp.mockResolvedValue('test-app:latest');
    build.detectLanguage.mockReturnValue('typescript');
    build.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
    appRun.runApp.mockResolvedValue();
    pushUtils.validateRegistryURL.mockReturnValue(true);
    pushUtils.checkLocalImageExists.mockResolvedValue(true);
    pushUtils.checkAzureCLIInstalled.mockResolvedValue(true);
    pushUtils.checkACRAuthentication.mockResolvedValue(true);
    pushUtils.tagImage.mockResolvedValue();
    pushUtils.pushImage.mockResolvedValue();
    appDeploy.deployApp.mockResolvedValue({ deploymentId: 'deploy-123' });
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    // Retry cleanup on Windows (handles EBUSY errors)
    let retries = 3;
    while (retries > 0) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (error.code === 'EBUSY' && retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries--;
        } else {
          break;
        }
      }
    }
  });

  describe('buildApp', () => {
    it('should delegate to build.buildApp', async() => {
      const result = await app.buildApp('test-app', { language: 'typescript' });
      expect(build.buildApp).toHaveBeenCalledWith('test-app', { language: 'typescript' });
      expect(result).toBe('test-app:latest');
    });

    it('should handle build errors', async() => {
      build.buildApp.mockRejectedValueOnce(new Error('Build failed'));
      await expect(app.buildApp('test-app', {})).rejects.toThrow('Build failed');
    });

    it('should pass options to build module', async() => {
      await app.buildApp('test-app', { forceTemplate: true, tag: 'v1.0.0' });
      expect(build.buildApp).toHaveBeenCalledWith('test-app', { forceTemplate: true, tag: 'v1.0.0' });
    });
  });

  describe('runApp', () => {
    it('should delegate to appRun.runApp', async() => {
      await app.runApp('test-app', { port: 3001 });
      expect(appRun.runApp).toHaveBeenCalledWith('test-app', { port: 3001 });
    });

    it('should handle run errors', async() => {
      appRun.runApp.mockRejectedValueOnce(new Error('Image not found'));
      await expect(app.runApp('test-app', {})).rejects.toThrow('Image not found');
    });

    it('should pass options correctly', async() => {
      await app.runApp('test-app', { port: 8080 });
      expect(appRun.runApp).toHaveBeenCalledWith('test-app', { port: 8080 });
    });
  });

  describe('detectLanguage', () => {
    it('should delegate to build.detectLanguage', () => {
      const result = app.detectLanguage('/path/to/app');
      expect(build.detectLanguage).toHaveBeenCalledWith('/path/to/app');
      expect(result).toBe('typescript');
    });

    it('should handle detection errors', () => {
      build.detectLanguage.mockImplementationOnce(() => {
        throw new Error('Language not detected');
      });
      expect(() => app.detectLanguage('/invalid/path')).toThrow('Language not detected');
    });

    it('should detect different languages', () => {
      build.detectLanguage.mockReturnValueOnce('python');
      expect(app.detectLanguage('/python/app')).toBe('python');
    });
  });

  describe('generateDockerfile', () => {
    it('should delegate to build.generateDockerfile', async() => {
      const config = { port: 3000, language: 'typescript' };
      const result = await app.generateDockerfile('/app/path', 'typescript', config);
      expect(build.generateDockerfile).toHaveBeenCalledWith('/app/path', 'typescript', config);
      expect(result).toBe('/path/to/Dockerfile');
    });

    it('should handle generation errors', async() => {
      build.generateDockerfile.mockRejectedValueOnce(new Error('Template not found'));
      await expect(app.generateDockerfile('/app/path', 'typescript', {})).rejects.toThrow('Template not found');
    });
  });

  describe('generateDockerfileForApp', () => {
    beforeEach(() => {
      // Create app directory structure
      const appPath = path.join('builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: 'test-app', name: 'Test App' },
          port: 3000,
          build: { language: 'typescript' }
        })
      );
    });

    it('should generate Dockerfile for application', async() => {
      // Create a temp Dockerfile that build.generateDockerfile would return
      const tempDockerfile = path.join(tempDir, '.aifabrix', 'Dockerfile.typescript');
      fsSync.mkdirSync(path.dirname(tempDockerfile), { recursive: true });
      fsSync.writeFileSync(tempDockerfile, '# Generated Dockerfile');
      build.generateDockerfile.mockResolvedValueOnce(tempDockerfile);

      const result = await app.generateDockerfileForApp('test-app', {});
      // detectLanguage is only called if language is not provided in config or options
      // Since we have build.language in config, it uses that instead
      expect(build.generateDockerfile).toHaveBeenCalled();
      expect(result).toContain('Dockerfile');
    });

    it('should validate app name', async() => {
      await expect(app.generateDockerfileForApp('Invalid App', {})).rejects.toThrow('Application name');
    });

    it('should handle missing variables.yaml', async() => {
      await fs.rm(path.join('builder', 'test-app', 'variables.yaml'));
      await expect(app.generateDockerfileForApp('test-app', {})).rejects.toThrow();
    });

    it('should use language from options if provided', async() => {
      // Create temp Dockerfile
      const tempDockerfile = path.join(tempDir, '.aifabrix', 'Dockerfile.python');
      fsSync.mkdirSync(path.dirname(tempDockerfile), { recursive: true });
      fsSync.writeFileSync(tempDockerfile, '# Generated Dockerfile');
      build.generateDockerfile.mockResolvedValueOnce(tempDockerfile);

      await app.generateDockerfileForApp('test-app', { language: 'python' });
      expect(build.generateDockerfile).toHaveBeenCalledWith(
        expect.any(String),
        'python',
        expect.any(Object)
      );
    });

    it('should handle existing Dockerfile without force flag', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.writeFileSync(path.join(appPath, 'Dockerfile'), '# Existing Dockerfile');
      await expect(app.generateDockerfileForApp('test-app', {})).rejects.toThrow('already exists');
    });

    it('should overwrite existing Dockerfile with force flag', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.writeFileSync(path.join(appPath, 'Dockerfile'), '# Old Dockerfile');

      // Create temp Dockerfile
      const tempDockerfile = path.join(tempDir, '.aifabrix', 'Dockerfile.typescript');
      fsSync.mkdirSync(path.dirname(tempDockerfile), { recursive: true });
      fsSync.writeFileSync(tempDockerfile, '# New Dockerfile');
      build.generateDockerfile.mockResolvedValueOnce(tempDockerfile);

      await app.generateDockerfileForApp('test-app', { force: true });
      expect(build.generateDockerfile).toHaveBeenCalled();
    });

    it('should handle generation errors', async() => {
      build.generateDockerfile.mockRejectedValueOnce(new Error('Template error'));
      await expect(app.generateDockerfileForApp('test-app', {})).rejects.toThrow('Failed to generate Dockerfile');
    });
  });

  describe('pushApp', () => {
    beforeEach(() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: 'test-app', name: 'Test App' },
          image: { registry: 'myacr.azurecr.io' }
        })
      );
    });

    it('should push app successfully', async() => {
      await app.pushApp('test-app', {});
      expect(pushUtils.validateRegistryURL).toHaveBeenCalled();
      expect(pushUtils.checkLocalImageExists).toHaveBeenCalledWith('test-app', 'latest');
      expect(pushUtils.tagImage).toHaveBeenCalled();
      expect(pushUtils.pushImage).toHaveBeenCalled();
    });

    it('should validate app name', async() => {
      await expect(app.pushApp('Invalid App', {})).rejects.toThrow('Application name');
    });

    it('should handle missing variables.yaml', async() => {
      await fs.rm(path.join('builder', 'test-app', 'variables.yaml'));
      await expect(app.pushApp('test-app', {})).rejects.toThrow('Failed to load configuration');
    });

    it('should use registry from options', async() => {
      await app.pushApp('test-app', { registry: 'custom.azurecr.io' });
      expect(pushUtils.validateRegistryURL).toHaveBeenCalledWith('custom.azurecr.io');
    });

    it('should handle missing registry', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({ app: { key: 'test-app' } })
      );
      await expect(app.pushApp('test-app', {})).rejects.toThrow('Registry URL is required');
    });

    it('should validate registry URL format', async() => {
      pushUtils.validateRegistryURL.mockReturnValueOnce(false);
      await expect(app.pushApp('test-app', { registry: 'invalid.com' }))
        .rejects.toThrow('Invalid registry URL format');
    });

    it('should handle missing local image', async() => {
      pushUtils.checkLocalImageExists.mockResolvedValueOnce(false);
      await expect(app.pushApp('test-app', {})).rejects.toThrow('Docker image');
    });

    it('should handle missing Azure CLI', async() => {
      pushUtils.checkAzureCLIInstalled.mockResolvedValueOnce(false);
      await expect(app.pushApp('test-app', {})).rejects.toThrow('Azure CLI is not installed');
    });

    it('should authenticate if not already authenticated', async() => {
      pushUtils.checkACRAuthentication.mockResolvedValueOnce(false);
      await app.pushApp('test-app', {});
      expect(pushUtils.authenticateACR).toHaveBeenCalled();
    });

    it('should push multiple tags', async() => {
      await app.pushApp('test-app', { tag: 'v1.0.0,v1.0.1,latest' });
      expect(pushUtils.tagImage).toHaveBeenCalledTimes(3);
      expect(pushUtils.pushImage).toHaveBeenCalledTimes(3);
    });

    it('should handle push errors', async() => {
      pushUtils.pushImage.mockRejectedValueOnce(new Error('Push failed'));
      await expect(app.pushApp('test-app', {})).rejects.toThrow('Failed to push application');
    });
  });

  describe('deployApp', () => {
    it('should delegate to appDeploy.deployApp', async() => {
      const options = { controller: 'https://controller.example.com', environment: 'dev' };
      const result = await app.deployApp('test-app', options);
      expect(appDeploy.deployApp).toHaveBeenCalledWith('test-app', options);
      expect(result).toEqual({ deploymentId: 'deploy-123' });
    });

    it('should handle deployment errors', async() => {
      appDeploy.deployApp.mockRejectedValueOnce(new Error('Deployment failed'));
      await expect(app.deployApp('test-app', {})).rejects.toThrow('Deployment failed');
    });

    it('should pass all options correctly', async() => {
      const options = {
        controller: 'https://controller.example.com',
        environment: 'pro',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        poll: false
      };
      await app.deployApp('test-app', options);
      expect(appDeploy.deployApp).toHaveBeenCalledWith('test-app', options);
    });
  });

  describe('Exported appRun functions', () => {
    it('should export checkImageExists', () => {
      expect(app.checkImageExists).toBe(appRun.checkImageExists);
    });

    it('should export checkContainerRunning', () => {
      expect(app.checkContainerRunning).toBe(appRun.checkContainerRunning);
    });

    it('should export stopAndRemoveContainer', () => {
      expect(app.stopAndRemoveContainer).toBe(appRun.stopAndRemoveContainer);
    });

    it('should export checkPortAvailable', () => {
      expect(app.checkPortAvailable).toBe(appRun.checkPortAvailable);
    });

    it('should export generateDockerCompose', () => {
      expect(app.generateDockerCompose).toBe(appRun.generateDockerCompose);
    });

    it('should export waitForHealthCheck', () => {
      expect(app.waitForHealthCheck).toBe(appRun.waitForHealthCheck);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle pushApp with authentication error', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: 'test-app' },
          image: { registry: 'myacr.azurecr.io' }
        })
      );
      // Reset and setup mocks for this specific test
      pushUtils.checkLocalImageExists.mockResolvedValueOnce(true);
      pushUtils.checkAzureCLIInstalled.mockResolvedValueOnce(true);
      pushUtils.checkACRAuthentication.mockResolvedValueOnce(false);
      pushUtils.authenticateACR.mockRejectedValueOnce(new Error('Authentication failed'));
      await expect(app.pushApp('test-app', {})).rejects.toThrow('Failed to push application');
    });

    it('should handle pushApp with tag error', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: 'test-app' },
          image: { registry: 'myacr.azurecr.io' }
        })
      );
      // Reset and setup mocks for this specific test
      pushUtils.checkLocalImageExists.mockResolvedValueOnce(true);
      pushUtils.checkAzureCLIInstalled.mockResolvedValueOnce(true);
      pushUtils.checkACRAuthentication.mockResolvedValueOnce(true);
      pushUtils.tagImage.mockRejectedValueOnce(new Error('Tagging failed'));
      await expect(app.pushApp('test-app', {})).rejects.toThrow('Failed to push application');
    });

    it('should handle generateDockerfileForApp with detection error', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: 'test-app' },
          build: { language: 'typescript' }
        })
      );
      // build.detectLanguage is not called when language is in config, but let's test with options.language
      build.generateDockerfile.mockImplementationOnce(() => {
        throw new Error('Template error');
      });
      await expect(app.generateDockerfileForApp('test-app', {})).rejects.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full push workflow', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: 'test-app' },
          image: { registry: 'myacr.azurecr.io' }
        })
      );

      await app.pushApp('test-app', { tag: 'v1.0.0' });

      expect(pushUtils.validateRegistryURL).toHaveBeenCalled();
      expect(pushUtils.checkLocalImageExists).toHaveBeenCalled();
      expect(pushUtils.checkAzureCLIInstalled).toHaveBeenCalled();
      expect(pushUtils.checkACRAuthentication).toHaveBeenCalled();
      expect(pushUtils.tagImage).toHaveBeenCalledWith('test-app:latest', 'myacr.azurecr.io/test-app:v1.0.0');
      expect(pushUtils.pushImage).toHaveBeenCalledWith('myacr.azurecr.io/test-app:v1.0.0');
    });

    it('should handle full deployment workflow', async() => {
      const options = {
        controller: 'https://controller.example.com',
        environment: 'dev',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        poll: true
      };
      const result = await app.deployApp('test-app', options);
      expect(appDeploy.deployApp).toHaveBeenCalledWith('test-app', options);
      expect(result.deploymentId).toBe('deploy-123');
    });

    it('should handle build and push sequence', async() => {
      const appPath = path.join('builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: 'test-app' },
          image: { registry: 'myacr.azurecr.io' }
        })
      );

      // Build
      await app.buildApp('test-app', {});
      expect(build.buildApp).toHaveBeenCalled();

      // Push
      await app.pushApp('test-app', {});
      expect(pushUtils.pushImage).toHaveBeenCalled();
    });
  });
});

