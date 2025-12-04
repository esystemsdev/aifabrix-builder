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
jest.mock('../../lib/utils/token-manager');
jest.mock('../../lib/config');

describe('Application Deploy Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Setup default mocks
    const configModule = require('../../lib/config');
    configModule.getCurrentEnvironment.mockResolvedValue('dev');
    configModule.setCurrentEnvironment.mockResolvedValue();

    const tokenManager = require('../../lib/utils/token-manager');
    tokenManager.getDeploymentAuth.mockResolvedValue({
      type: 'bearer',
      token: 'default-test-token',
      controller: 'https://controller.example.com'
    });

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
        .rejects.toThrow('Invalid ACR URL format');
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

    it('should authenticate with ACR when not already authenticated', async() => {
      jest.spyOn(require('../../lib/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'checkACRAuthentication').mockResolvedValue(false);
      jest.spyOn(require('../../lib/push'), 'authenticateACR').mockResolvedValue();
      jest.spyOn(require('../../lib/push'), 'tagImage').mockResolvedValue();
      jest.spyOn(require('../../lib/push'), 'pushImage').mockResolvedValue();

      await appDeploy.pushApp('test-app', {});

      expect(require('../../lib/push').authenticateACR).toHaveBeenCalledWith('myacr.azurecr.io');
      expect(require('../../lib/push').tagImage).toHaveBeenCalled();
    });
  });

  describe('deployApp error scenarios', () => {
    beforeEach(() => {
      // Create app directory structure
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Mock handleDeploymentErrors to throw the error it receives (for error tests)
      const deployer = require('../../lib/deployer');
      deployer.handleDeploymentErrors.mockImplementation(async(error) => {
        throw error;
      });

      // Setup default mocks for success scenarios
      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
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

    it('should error when controller URL is missing', async() => {
      // Create variables.yaml without deployment config
      const config = { app: { key: 'test-app', name: 'Test App' }, port: 3000 };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Controller URL is required');
    });

    it('should error when token cannot be retrieved', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockRejectedValue(
        new Error('No authentication method available')
      );

      await expect(appDeploy.deployApp('test-app', {}))
        .rejects.toThrow('Failed to get authentication');
    });

    it('should load deployment configuration from variables.yaml', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'tst'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('tst');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token-123',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {});

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
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com'
          // No environment specified
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token-456',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {});

      expect(configModule.getCurrentEnvironment).toHaveBeenCalled();
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

    it('should allow options to override variables.yaml configuration', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://yaml-controller.example.com',
          environment: 'tst'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('pro');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'option-token-789',
        controller: 'https://option-controller.example.com'
      });

      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockResolvedValue({ deploymentId: 'deploy-123' });

      await appDeploy.deployApp('test-app', {
        controller: 'https://option-controller.example.com',
        environment: 'pro'
      });

      expect(configModule.setCurrentEnvironment).toHaveBeenCalledWith('pro');
      expect(tokenManager.getDeploymentAuth).toHaveBeenCalledWith(
        'https://option-controller.example.com',
        'pro',
        'test-app'
      );
      expect(deployer.deployToController).toHaveBeenCalledWith(
        expect.any(Object),
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
      })).rejects.toThrow('not found in builder/');
    });

    it('should error when app directory access fails with non-ENOENT error', async() => {
      // Create app directory but make fs.access throw a different error
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Mock fs.access to throw a permission error
      const accessSpy = jest.spyOn(fs, 'access').mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow('EACCES: permission denied');

      accessSpy.mockRestore();
    });

    it('should error when variables.yaml cannot be read', async() => {
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Mock fs.readFile to throw an error only for variables.yaml
      const readFileSpy = jest.spyOn(fs, 'readFile').mockImplementation((filePath, ...args) => {
        const filePathStr = filePath && filePath.toString();
        if (filePathStr && filePathStr.includes('variables.yaml')) {
          return Promise.reject(new Error('EACCES: permission denied'));
        }
        // For other files, call the original fs.readFile
        return fsSync.promises.readFile(filePath, ...args);
      });

      await expect(appDeploy.deployApp('test-app', {
        controller: 'https://controller.example.com'
      })).rejects.toThrow('Failed to load configuration from variables.yaml');

      readFileSpy.mockRestore();
    });

    it('should error when token is missing after retrieval', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
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
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
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
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      // Mock generator to throw validation error (schema validation now happens in generateDeployJson)
      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockRejectedValue(
        new Error('Generated deployment JSON does not match schema:\nField "image": Missing required property')
      );

      await expect(appDeploy.deployApp('test-app', {})).rejects.toThrow('Generated deployment JSON does not match schema');
    });

    it('should handle controller deployment failures', async() => {
      // Setup app directory with deployment config
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      // Create manifest file
      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      // Mock generator
      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      // Mock deployer to fail
      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockRejectedValue(new Error('Controller error'));

      await expect(appDeploy.deployApp('test-app', {})).rejects.toThrow('Controller error');
    });

    it('should display warnings correctly', async() => {
      // Setup app directory with deployment config
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      // Create manifest file
      const manifestPath2 = path.join(tempDir, 'builder', 'test-app', 'aifabrix-deploy.json');
      await fs.writeFile(manifestPath2, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      // Mock generator - validation warnings no longer exposed separately
      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath2);

      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123'
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should display deployment URL when present', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../lib/deployer');
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
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        status: { status: 'completed' }
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should display deployment status when failed', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../lib/deployer');
      deployer.deployToController.mockResolvedValue({
        deploymentId: 'deploy-123',
        status: { status: 'failed' }
      });

      await appDeploy.deployApp('test-app', {});

      expect(deployer.deployToController).toHaveBeenCalled();
    });

    it('should display deployment status when in progress', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com',
          environment: 'dev'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'builder', 'test-app', 'variables.yaml'),
        yaml.dump(config)
      );

      const manifestPath = path.join(tempDir, 'builder', 'test-app', 'test-app-deploy.json');
      await fs.writeFile(manifestPath, JSON.stringify({
        key: 'test-app',
        displayName: 'Test App',
        image: 'test:latest',
        port: 3000
      }));

      const generator = require('../../lib/generator');
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(manifestPath);

      const configModule = require('../../lib/config');
      configModule.getCurrentEnvironment.mockResolvedValue('dev');
      configModule.setCurrentEnvironment.mockResolvedValue();

      const tokenManager = require('../../lib/utils/token-manager');
      tokenManager.getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'https://controller.example.com'
      });

      const deployer = require('../../lib/deployer');
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

    it('should error when registry URL format is invalid in validatePushPrerequisites', async() => {
      jest.spyOn(require('../../lib/push'), 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'checkAzureCLIInstalled').mockResolvedValue(true);
      jest.spyOn(require('../../lib/push'), 'validateRegistryURL').mockReturnValue(false);

      await expect(appDeploy.pushApp('test-app', {}))
        .rejects.toThrow(/Invalid registry URL format/);
    });
  });
});

