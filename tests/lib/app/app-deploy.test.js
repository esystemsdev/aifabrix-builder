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
const app = require('../../../lib/app');
const appDeploy = require('../../../lib/app/deploy');

// Mock dependencies
jest.mock('../../../lib/deployment/deployer');
jest.mock('../../../lib/generator');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/external-system/deploy', () => ({
  deployExternalSystem: jest.fn()
}));
jest.mock('../../../lib/api/applications.api', () => ({
  getApplicationStatus: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => {
  const pathMod = require('path');
  const actual = jest.requireActual('../../../lib/utils/paths');
  return {
    ...actual,
    detectAppType: jest.fn().mockImplementation(async(appName) => {
      if (appName === 'nonexistent-app') {
        throw new Error(`App '${appName}' not found in integration/${appName} or builder/${appName}`);
      }
      if (appName === 'external-app') {
        return actual.detectAppType(appName);
      }
      if (appName === 'test-app') {
        return {
          isExternal: false,
          appPath: pathMod.join(process.cwd(), 'builder', appName),
          appType: 'regular',
          baseDir: 'builder'
        };
      }
      return actual.detectAppType(appName);
    })
  };
});

describe('Application Deploy Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Setup default mocks
    const configModule = require('../../../lib/core/config');
    configModule.getCurrentEnvironment.mockResolvedValue('dev');
    configModule.setCurrentEnvironment.mockResolvedValue();
    configModule.resolveEnvironment = jest.fn().mockResolvedValue('dev');

    const tokenManager = require('../../../lib/utils/token-manager');
    tokenManager.getDeploymentAuth.mockResolvedValue({
      type: 'bearer',
      token: 'default-test-token',
      controller: 'https://controller.example.com'
    });

    const controllerUrl = require('../../../lib/utils/controller-url');
    // New signature: resolveControllerUrl() - no parameters, uses config
    controllerUrl.resolveControllerUrl.mockResolvedValue('http://localhost:3000');

    // Clear all mocks to prevent leakage between tests
    jest.clearAllMocks();
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
          // Ignore cleanup errors in test environment
          break;
        }
      }
    }
  });

  describe('pushApp error scenarios', () => {
    beforeEach(() => {
      // Create app directory structure
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Create application.yaml
      const variablesYaml = `
app:
  key: test-app
  name: Test App
image:
  name: test-app
  registry: myacr.azurecr.io
`;
      fsSync.writeFileSync(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        variablesYaml
      );
    });

    it('should error when app configuration is missing', async() => {
      await expect(appDeploy.pushApp('nonexistent-app', {}))
        .rejects.toThrow(/Failed to load configuration|not found in integration|not found in builder/);
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
        path.join(tempDir, 'builder', 'test-app-no-registry', 'application.yaml'),
        variablesYaml
      );

      await expect(appDeploy.pushApp('test-app-no-registry', {}))
        .rejects.toThrow('Registry URL is required');
    });

    it('should error when registry URL is invalid', async() => {
      await expect(appDeploy.pushApp('test-app', { registry: 'invalid.com' }))
        .rejects.toThrow('Invalid ACR URL format');
    });

    it('should error when image does not exist locally', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(false);

      await expect(appDeploy.pushApp('test-app', {}))
        .rejects.toThrow('Docker image');
    });

    it('should error when Azure CLI is not installed', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkAzureCLIInstalled').mockResolvedValue(false);

      await expect(appDeploy.pushApp('test-app', {}))
        .rejects.toThrow('Azure CLI is not installed');
    });

    it('should handle multiple tags', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkACRAuthentication').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'tagImage').mockResolvedValue();
      jest.spyOn(require('../../../lib/deployment/push'), 'pushImage').mockResolvedValue();

      await appDeploy.pushApp('test-app', { tag: 'v1.0.0,v1.0.1,latest' });

      expect(require('../../../lib/deployment/push').tagImage).toHaveBeenCalledTimes(3);
    });

    it('should authenticate with ACR when not already authenticated', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkACRAuthentication').mockResolvedValue(false);
      jest.spyOn(require('../../../lib/deployment/push'), 'authenticateACR').mockResolvedValue();
      jest.spyOn(require('../../../lib/deployment/push'), 'tagImage').mockResolvedValue();
      jest.spyOn(require('../../../lib/deployment/push'), 'pushImage').mockResolvedValue();

      await appDeploy.pushApp('test-app', {});

      expect(require('../../../lib/deployment/push').authenticateACR).toHaveBeenCalledWith('myacr.azurecr.io');
      expect(require('../../../lib/deployment/push').tagImage).toHaveBeenCalled();
    });
  });

  describe('deployApp error scenarios', () => {
    beforeEach(() => {
      // Create app directory structure
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Mock handleDeploymentErrors to throw the error it receives (for error tests)
      const deployer = require('../../../lib/deployment/deployer');
      // Ensure handleDeploymentErrors is a mock function
      if (!deployer.handleDeploymentErrors || typeof deployer.handleDeploymentErrors.mockImplementation !== 'function') {
        deployer.handleDeploymentErrors = jest.fn();
      }
      deployer.handleDeploymentErrors.mockImplementation(async(error) => {
        throw error;
      });

      // Setup default mocks for success scenarios
      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'default-test-token',
        controller: 'https://controller.example.com'
      });
    });

    it('should error when app name is missing', async() => {
      await expect(appDeploy.deployApp('', { controller: 'https://controller.example.com' }))
        .rejects.toThrow('App name is required');
    });

    it('should route external apps to external system deployment', async() => {
      const integrationPath = path.join(tempDir, 'integration', 'external-app');
      fsSync.mkdirSync(integrationPath, { recursive: true });

      const variablesYaml = `
app:
  key: external-app
  name: External App
  type: external
`;
      fsSync.writeFileSync(path.join(integrationPath, 'application.yaml'), variablesYaml);

      const externalDeploy = require('../../../lib/external-system/deploy');
      externalDeploy.deployExternalSystem.mockResolvedValue();

      const outcome = await appDeploy.deployApp('external-app', {
        controller: 'https://controller.example.com',
        environment: 'dev'
      });

      expect(externalDeploy.deployExternalSystem).toHaveBeenCalledWith('external-app', expect.any(Object));
      const deployer = require('../../../lib/deployment/deployer');
      expect(deployer.deployToController).not.toHaveBeenCalled();
      expect(outcome.result).toEqual({ success: true, type: 'external' });
      expect(outcome.usedExternalDeploy).toBe(true);
    });

    it('should deploy from integration when only integration folder exists', async() => {
      const integrationPath = path.join(tempDir, 'integration', 'test-e2e-hubspot');
      fsSync.mkdirSync(integrationPath, { recursive: true });
      const variablesYaml = `
app:
  key: test-e2e-hubspot
  name: Test E2E HubSpot
  type: external
`;
      fsSync.writeFileSync(path.join(integrationPath, 'application.yaml'), variablesYaml);

      const externalDeploy = require('../../../lib/external-system/deploy');
      externalDeploy.deployExternalSystem.mockResolvedValue();

      const outcome = await appDeploy.deployApp('test-e2e-hubspot', {});

      expect(externalDeploy.deployExternalSystem).toHaveBeenCalledWith('test-e2e-hubspot', expect.any(Object));
      const deployer = require('../../../lib/deployment/deployer');
      expect(deployer.deployToController).not.toHaveBeenCalled();
      expect(outcome.result).toEqual({ success: true, type: 'external' });
      expect(outcome.usedExternalDeploy).toBe(true);
    });

    it('should error when controller URL is missing', async() => {
      // Create application.yaml without deployment config
      const config = { app: { key: 'test-app', name: 'Test App' }, port: 3000 };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      // Override mock to return null when no controller URL is provided
      const controllerUrl = require('../../../lib/utils/controller-url');
      controllerUrl.resolveControllerUrl.mockResolvedValue(null);

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Controller URL is required');
    });

    it('should error when token cannot be retrieved', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockRejectedValue(
        new Error('No authentication method available')
      );

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Failed to get authentication');
    });

    it('should use current environment from config when not specified in options', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.resolveEnvironment = jest.fn().mockResolvedValue('tst');

      const controllerUrl = require('../../../lib/utils/controller-url');
      controllerUrl.resolveControllerUrl.mockResolvedValue('https://controller.example.com');

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token-123',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {});

      expect(configModule.resolveEnvironment).toHaveBeenCalled();
      expect(tokenManager.getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'tst',
        'test-app'
      );
      expect(deployer.deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        'https://controller.example.com',
        'tst',
        expect.objectContaining({
          type: 'bearer',
          token: 'test-token-123',
          controller: 'https://controller.example.com'
        }),
        expect.any(Object)
      );
    });

    it('should use current environment from config when not specified', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.resolveEnvironment = jest.fn().mockResolvedValue('dev');

      const controllerUrl = require('../../../lib/utils/controller-url');
      controllerUrl.resolveControllerUrl.mockResolvedValue('https://controller.example.com');

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token-456',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {});

      expect(generator.generateDeployJson).toHaveBeenCalledWith('test-app', {});

      expect(configModule.resolveEnvironment).toHaveBeenCalled();
      expect(tokenManager.getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'test-app'
      );
      expect(deployer.deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        'https://controller.example.com',
        'dev',
        expect.objectContaining({
          type: 'bearer',
          token: 'test-token-456',
          controller: 'https://controller.example.com'
        }),
        expect.any(Object)
      );
    });

    it('should call generateDeployJson with app name and options', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.resolveEnvironment = jest.fn().mockResolvedValue('dev');

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {});

      expect(generator.generateDeployJson).toHaveBeenCalledWith('test-app', expect.any(Object));
    });

    it('should allow options to override default configuration', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.resolveEnvironment = jest.fn().mockResolvedValue('pro');

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'option-token-789',
        controller: 'https://option-controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {
        controller: 'https://option-controller.example.com',
        environment: 'pro'
      });

      // Controller/environment flags are no longer supported for public commands.
      // Controller/environment are resolved from config via resolveControllerUrl()/resolveEnvironment().
      expect(configModule.resolveEnvironment).toHaveBeenCalled();
      expect(tokenManager.getDeploymentAuth).toHaveBeenCalledWith(
        'http://localhost:3000',
        'pro',
        'test-app'
      );
      expect(deployer.deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        // deploy uses the controller URL returned by getDeploymentAuth
        'https://option-controller.example.com',
        'pro',
        expect.objectContaining({
          type: 'bearer',
          token: 'option-token-789',
          controller: 'https://option-controller.example.com'
        }),
        expect.any(Object)
      );
    });

    it('should error when app not found in builder', async() => {
      await expect(appDeploy.deployApp('nonexistent-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow(/not found in (integration\/.* or )?builder\/|App 'nonexistent-app' not found/);
    });

    it('should error when app directory access fails with non-ENOENT error', async() => {
      // Create app directory and minimal config so detectAppType resolves to builder
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });
      fsSync.writeFileSync(path.join(tempDir, 'builder', 'test-app', 'application.yaml'), 'app: { key: test-app, name: Test App }\nport: 3000');

      // Mock fs.access to throw a permission error
      const accessSpy = jest.spyOn(fs, 'access').mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow('EACCES: permission denied');

      accessSpy.mockRestore();
    });

    it('should error when application.yaml cannot be read', async() => {
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });
      fsSync.writeFileSync(path.join(tempDir, 'builder', 'test-app', 'application.yaml'), 'app: { key: test-app, name: Test App }\nport: 3000');

      // Mock fs.readFile to throw an error only for application.yaml (after detectAppType has run)
      const realReadFile = jest.requireActual('fs').promises.readFile;
      const readFileSpy = jest.spyOn(fs, 'readFile').mockImplementation((filePath, ...args) => {
        const filePathStr = filePath && filePath.toString();
        if (filePathStr && filePathStr.includes('application.yaml')) {
          return Promise.reject(new Error('EACCES: permission denied'));
        }
        return realReadFile(filePath, ...args);
      });

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow(/Failed to load configuration|ENOENT|permission denied/);

      readFileSpy.mockRestore();
    });

    it('should error when token is missing after retrieval', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      // Return null token to trigger validation error
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: null,
        controller: 'https://controller.example.com'
      });

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Authentication is required');
    });

    it('should error when controller URL is missing after token retrieval', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      // Return null/undefined controller to trigger validation error
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: null
      });

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Invalid authentication configuration: missing controller URL');
    });

    it('should error on validation failures', async() => {
      // Setup app directory with deployment config
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      // Mock generator to throw validation error (schema validation now happens in generateDeployJson)
      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockRejectedValue(
        new Error('Generated deployment JSON does not match schema:\nField "image": Missing required property')
      );

      await expect(appDeploy.deployApp('test-app', {})).rejects.toThrow('Generated deployment JSON does not match schema');
    });

    it('should handle controller deployment failures', async() => {
      // Setup app directory with deployment config
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      // Create manifest file
      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      // Mock generator
      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      // Mock deployer to fail
      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockRejectedValue(new Error('Controller error'));

      await expect(appDeploy.deployApp('test-app', {})).rejects.toThrow('Controller error');
    });

    it('should display warnings correctly', async() => {
      // Setup app directory with deployment config
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      // Create manifest file
      const manifestPath2 = path.join(tempDir, 'builder', 'test-app', 'aifabrix-deploy.json');
      await fs.writeFile(manifestPath2, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      // Mock generator - validation warnings no longer exposed separately
      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath2);

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123'
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should display deployment URL when present', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        deploymentUrl: 'https://test-app.example.com'
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should display deployment status when completed', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        status: { status: 'completed' }
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should show app URL from status port (not controller URL) when status returns port', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3001
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3001
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const controllerUrl = require('../../../lib/utils/controller-url');
      controllerUrl.resolveControllerUrl.mockResolvedValue('http://localhost:3600');

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3600'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        status: { status: 'completed' }
      });

      const applicationsApi = require('../../../lib/api/applications.api');
      applicationsApi.getApplicationStatus.mockResolvedValue({
        success: true,
        data: { port: 3601 }
      });

      const logger = require('../../../lib/utils/logger');
      const logSpy = jest.spyOn(logger, 'log');

      await appDeploy.deployApp('test-app', {});

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3601')
      );
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/App running at http:\/\/localhost:3600\b/)
      );
      logSpy.mockRestore();
    });

    it('should display deployment status when failed', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        status: { status: 'failed' }
      });

      await expect(appDeploy.deployApp('test-app', {})).rejects.toThrow('Deployment failed');
      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should display deployment status when in progress', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        status: { status: 'pending' }
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
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

    it('should reject null or undefined app names', () => {
      expect(() => appDeploy.validateAppName(null)).toThrow('App name is required');
      expect(() => appDeploy.validateAppName(undefined)).toThrow('App name is required');
      expect(() => appDeploy.validateAppName('')).toThrow('App name is required');
    });

    it('should reject non-string app names', () => {
      expect(() => appDeploy.validateAppName(123)).toThrow('App name is required');
      expect(() => appDeploy.validateAppName({})).toThrow('App name is required');
      expect(() => appDeploy.validateAppName([])).toThrow('App name is required');
    });

    it('should reject app names starting or ending with dash', () => {
      expect(() => appDeploy.validateAppName('-myapp')).toThrow('Application name cannot start or end with a dash');
      expect(() => appDeploy.validateAppName('myapp-')).toThrow('Application name cannot start or end with a dash');
      expect(() => appDeploy.validateAppName('-myapp-')).toThrow('Application name cannot start or end with a dash');
    });

    it('should reject app names with consecutive dashes', () => {
      expect(() => appDeploy.validateAppName('my--app')).toThrow('Application name cannot have consecutive dashes');
      expect(() => appDeploy.validateAppName('my---app')).toThrow('Application name cannot have consecutive dashes');
    });
  });

  describe('pushApp registry validation', () => {
    beforeEach(() => {
      // Create app directory structure
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Create application.yaml
      const variablesYaml = `
app:
  key: test-app
  name: Test App
image:
  name: test-app
  registry: myacr.azurecr.io
`;
      fsSync.writeFileSync(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        variablesYaml
      );
    });

    it('should error when registry URL format is invalid in validatePushPrerequisites', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'validateRegistryURL').mockReturnValue(false);

      await expect(appDeploy.pushApp('test-app', {}))
        .rejects.toThrow(/Invalid registry URL format/);
    });

    it('should authenticate with ACR when not authenticated in executePush', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'validateRegistryURL').mockReturnValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkACRAuthentication').mockResolvedValue(false);
      jest.spyOn(require('../../../lib/deployment/push'), 'authenticateACR').mockResolvedValue();
      jest.spyOn(require('../../../lib/deployment/push'), 'tagImage').mockResolvedValue();
      jest.spyOn(require('../../../lib/deployment/push'), 'pushImage').mockResolvedValue();

      await appDeploy.pushApp('test-app', {});

      expect(require('../../../lib/deployment/push').authenticateACR).toHaveBeenCalledWith('myacr.azurecr.io');
    });

    it('should handle multiple tags in executePush', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'validateRegistryURL').mockReturnValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkACRAuthentication').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'tagImage').mockResolvedValue();
      jest.spyOn(require('../../../lib/deployment/push'), 'pushImage').mockResolvedValue();

      await appDeploy.pushApp('test-app', { tag: 'v1.0.0,v1.0.1,v1.0.2' });

      expect(require('../../../lib/deployment/push').tagImage).toHaveBeenCalledTimes(3);
      expect(require('../../../lib/deployment/push').pushImage).toHaveBeenCalledTimes(3);
    });

    it('should handle tags with whitespace', async() => {
      jest.spyOn(require('../../../lib/deployment/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'validateRegistryURL').mockReturnValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'checkACRAuthentication').mockResolvedValue(true);
      jest.spyOn(require('../../../lib/deployment/push'), 'tagImage').mockResolvedValue();
      jest.spyOn(require('../../../lib/deployment/push'), 'pushImage').mockResolvedValue();

      await appDeploy.pushApp('test-app', { tag: 'v1.0.0, v1.0.1 , v1.0.2' });

      expect(require('../../../lib/deployment/push').tagImage).toHaveBeenCalledTimes(3);
    });
  });

  describe('deployApp helper functions', () => {
    beforeEach(() => {
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });
    });

    it('should handle validateAppDirectory with ENOENT error', async() => {
      const deployer = require('../../../lib/deployment/deployer');
      deployer.handleDeploymentErrors = jest.fn().mockImplementation(async(error) => {
        throw error;
      });

      await expect(appDeploy.deployApp('nonexistent-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow(/not found in (integration\/.* or )?builder\/|App 'nonexistent-app' not found/);
    });

    it('should handle validateAppDirectory with non-ENOENT error', async() => {
      const deployer = require('../../../lib/deployment/deployer');
      deployer.handleDeploymentErrors = jest.fn().mockImplementation(async(error) => {
        throw error;
      });

      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });
      const accessSpy = jest.spyOn(fs, 'access').mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow('EACCES: permission denied');

      accessSpy.mockRestore();
    });

    it('should handle loadVariablesFile error', async() => {
      const deployer = require('../../../lib/deployment/deployer');
      deployer.handleDeploymentErrors = jest.fn().mockImplementation(async(error) => {
        throw error;
      });

      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });
      const readFileSpy = jest.spyOn(fs, 'readFile').mockImplementation((filePath) => {
        if (filePath.toString().includes('application.yaml') || filePath.toString().includes('application.yaml')) {
          return Promise.reject(new Error('EACCES: permission denied'));
        }
        return fsSync.promises.readFile(filePath);
      });

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow(/Failed to load configuration|ENOENT|permission denied/);

      readFileSpy.mockRestore();
    });

    it('should handle extractDeploymentConfig with options override', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('pro');
      configModule.setCurrentEnvironment.mockResolvedValue();
      configModule.resolveEnvironment = jest.fn().mockResolvedValue('pro');

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://option-controller.example.com'
      });

      const controllerUrl = require('../../../lib/utils/controller-url');
      controllerUrl.resolveControllerUrl.mockResolvedValue('https://option-controller.example.com');

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {
        controller: 'https://option-controller.example.com',
        environment: 'pro',
        poll: false,
        pollInterval: 10000,
        pollMaxAttempts: 30
      });

      expect(deployer.deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        'https://option-controller.example.com',
        'pro',
        expect.any(Object),
        expect.objectContaining({
          poll: false,
          pollInterval: 10000,
          pollMaxAttempts: 30
        })
      );
    });

    it('should use controller URL from config when no explicit option', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
        // No deployment.controllerUrl
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.resolveEnvironment = jest.fn().mockResolvedValue('dev');

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://config.controller.com'
      });

      const controllerUrl = require('../../../lib/utils/controller-url');
      // Mock resolveControllerUrl to return controller from config
      controllerUrl.resolveControllerUrl.mockResolvedValue('https://config.controller.com');

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {});

      expect(controllerUrl.resolveControllerUrl).toHaveBeenCalledWith();
      expect(configModule.resolveEnvironment).toHaveBeenCalledWith();
      expect(deployer.deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        'https://config.controller.com',
        'dev',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle validateDeploymentConfig missing controller URL', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
        // No deployment.controllerUrl
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const controllerUrl = require('../../../lib/utils/controller-url');
      // Mock resolveControllerUrl to return null to test validation path
      controllerUrl.resolveControllerUrl.mockResolvedValue(null);

      const deployer = require('../../../lib/deployment/deployer');
      deployer.handleDeploymentErrors = jest.fn().mockImplementation(async(error) => {
        throw error;
      });

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Controller URL is required');
    });

    it('should handle validateDeploymentConfig missing auth', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue(null);

      const deployer = require('../../../lib/deployment/deployer');
      deployer.handleDeploymentErrors = jest.fn().mockImplementation(async(error) => {
        throw error;
      });

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Failed to get authentication');
    });

    it('should handle generateAndValidateManifest error', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockRejectedValue(
        new Error('Schema validation failed')
      );

      const deployer = require('../../../lib/deployment/deployer');
      deployer.handleDeploymentErrors = jest.fn().mockImplementation(async(error) => {
        throw error;
      });

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Schema validation failed');
    });

    it('should throw when manifest image has no registry (not pullable)', () => {
      const { validateImageIsPullable } = appDeploy;
      expect(() => validateImageIsPullable('dataplane:latest', 'dataplane'))
        .toThrow('Deployed image must be pullable');
      const err = (() => {
        try {
          validateImageIsPullable('myapp:latest', 'myapp');
        } catch (e) {
          return e;
        }
      })();
      expect(err.message).toContain('builder/myapp');
      expect(err.message).toContain('<registry>/myapp:<tag>');
    });

    it('should handle displayDeploymentInfo with various manifest fields', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test Application',
        image: 'myacr.azurecr.io/test-app:v1.0.0',
        port: 8080
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should handle executeDeployment error', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockRejectedValue(new Error('Deployment failed'));

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Deployment failed');
    });

    it('should handle displayDeploymentResults with all fields', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'application.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'myreg.azurecr.io/test-app:latest',
        port: 3000
      }));

      const generator = require('../../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../../lib/core/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../../lib/deployment/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        deploymentUrl: 'https://app.example.com',
        status: { status: 'completed', progress: 100 }
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });
  });
});

