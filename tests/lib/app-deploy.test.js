/**
 * Tests for AI Fabrix Builder Application Deploy Module
 *
 * @fileoverview Tests for app-deploy.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const app = require('../../lib/app');
const appDeploy = require('../../lib/app-deploy');

// Mock dependencies
jest.mock('../../lib/deployer');
jest.mock('../../lib/generator');

describe('Application Deploy Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('pushApp error scenarios', () => {
    beforeEach(() => {
      // Create app directory structure
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Create variables.yaml
      const variablesYaml = `
app:
  key: test-app
  name: Test App
image:
  name: test-app
  registry: myacr.azurecr.io
`;
      fsSync.writeFileSync(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        variablesYaml
      );
    });

    it('should error when app configuration is missing', async() => {
      await expect(appDeploy.pushApp('nonexistent-app', {}))
        .rejects.toThrow('Failed to load configuration');
    });

    it('should error when no registry is configured', async() => {
      // Create app without registry
      const variablesYaml = `
app:
  key: test-app-no-registry
  name: Test App
`;
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app-no-registry'));
      fsSync.writeFileSync(
        path.join(tempDir, 'builder', 'test-app-no-registry', 'variables.yaml'),
        variablesYaml
      );

      await expect(appDeploy.pushApp('test-app-no-registry', {}))
        .rejects.toThrow('Registry URL is required');
    });

    it('should error when registry URL is invalid', async() => {
      await expect(appDeploy.pushApp('test-app', { registry: 'invalid.com' }))
        .rejects.toThrow('Invalid registry URL format');
    });

    it('should error when image does not exist locally', async() => {
      jest.spyOn(require('../../lib/push'), 'checkLocalImageExists').mockResolvedValue(false);

      await expect(appDeploy.pushApp('test-app', {}))
        .rejects.toThrow('Docker image');
    });

    it('should error when Azure CLI is not installed', async() => {
      jest.spyOn(require('../../lib/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'checkAzureCLIInstalled').mockResolvedValue(false);

      await expect(appDeploy.pushApp('test-app', {}))
        .rejects.toThrow('Azure CLI is not installed');
    });

    it('should handle multiple tags', async() => {
      jest.spyOn(require('../../lib/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'checkACRAuthentication').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'tagImage').mockResolvedValue();
      jest.spyOn(require('../../lib/push'), 'pushImage').mockResolvedValue();

      await appDeploy.pushApp('test-app', { tag: 'v1.0.0,v1.0.1,latest' });

      expect(require('../../lib/push').tagImage).toHaveBeenCalledTimes(3);
    });
  });

  describe('deployApp error scenarios', () => {
    beforeEach(() => {
      // Create app directory structure
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });
    });

    it('should error when app name is missing', async() => {
      await expect(appDeploy.deployApp('', { controller: 'https://controller.example.com' }))
        .rejects.toThrow('App name is required');
    });

    it('should error when controller URL is missing', async() => {
      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Controller URL is required');
    });

    it('should error when app not found in builder', async() => {
      await expect(appDeploy.deployApp('nonexistent-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow('not found in builder/');
    });

    it('should error on validation failures', async() => {
      // Setup app directory
      const config = { app: { key: 'test-app', name: 'Test App' }, port: 3000 };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      // Mock generator to return invalid manifest
      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue('/path/to/manifest.json');
      jest.spyOn(generator, 'validateDeploymentJson').mockReturnValue({
        valid: false,
        errors: ['Missing required field: image'],
        warnings: []
      });

      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({ key: 'test-app' }));

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow('Deployment manifest validation failed');
    });

    it('should handle controller deployment failures', async() => {
      // Setup app directory
      const config = { app: { key: 'test-app', name: 'Test App' }, port: 3000 };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      // Mock generator to return valid manifest
      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue('/path/to/manifest.json');
      jest.spyOn(generator, 'validateDeploymentJson').mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      jest.spyOn(fs, 'readFile').mockResolvedValue(
        JSON.stringify({
          key: 'test-app',
          displayName: 'Test App',
          image: 'test:latest',
          port: 3000
        })
      );

      // Mock deployer to fail
      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockRejectedValue(new Error('Controller error'));

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow('Failed to deploy application');
    });

    it('should display warnings correctly', async() => {
      // Setup app directory
      const config = { app: { key: 'test-app', name: 'Test App' }, port: 3000 };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      // Mock generator to return warnings
      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue('/path/to/manifest.json');
      jest.spyOn(generator, 'validateDeploymentJson').mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Health check path should start with /']
      });

      jest.spyOn(fs, 'readFile').mockResolvedValue(
        JSON.stringify({
          key: 'test-app',
          displayName: 'Test App',
          image: 'test:latest',
          port: 3000
        })
      );

      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Warnings'));
      consoleSpy.mockRestore();
    });
  });

  describe('validateAppName in deploy module', () => {
    it('should accept valid app names', () => {
      expect(() => appDeploy.validateAppName('my-app')).not.toThrow();
      expect(() => appDeploy.validateAppName('myapp123')).not.toThrow();
    });

    it('should reject invalid characters', () => {
      expect(() => appDeploy.validateAppName('My App')).toThrow();
      expect(() => appDeploy.validateAppName('my_app')).toThrow();
    });
  });
});

