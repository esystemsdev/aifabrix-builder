/**
 * Tests for AI Fabrix Builder External System Deploy Module
 *
 * @fileoverview Unit tests for external-system-deploy.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

// Mock dependencies
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn()
    }
  };
});
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn()
}));
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://localhost:3000')
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../lib/validation/validate', () => ({
  validateExternalSystemComplete: jest.fn()
}));
jest.mock('../../../lib/validation/validate-display', () => ({
  displayValidationResults: jest.fn()
}));
jest.mock('../../../lib/generator/external-controller-manifest', () => ({
  generateControllerManifest: jest.fn()
}));
jest.mock('../../../lib/deployment/deployer', () => ({
  deployToController: jest.fn()
}));

const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { getConfig } = require('../../../lib/core/config');
const logger = require('../../../lib/utils/logger');
const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
const { displayValidationResults } = require('../../../lib/validation/validate-display');
const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
const { deployToController } = require('../../../lib/deployment/deployer');

describe('External System Deploy Module', () => {
  const appName = 'test-external-app';
  const appPath = path.join(process.cwd(), 'integration', appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  const mockManifest = {
    key: 'test-external-app',
    displayName: 'Test System',
    description: 'Test System Description',
    type: 'external',
    system: {
      key: 'test-external-app',
      displayName: 'Test System',
      type: 'openapi',
      authentication: {
        type: 'apikey',
        apiKey: 'test-key'
      }
    },
    dataSources: [
      {
        key: 'test-external-app-entity1',
        systemKey: 'test-external-app',
        entityKey: 'entity1'
      }
    ],
    deploymentKey: 'test-deployment-key'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getConfig.mockResolvedValue({
      deployment: {
        controllerUrl: 'http://localhost:3000'
      }
    });
    getDeploymentAuth.mockResolvedValue({
      type: 'bearer',
      token: 'test-token'
    });
    validateExternalSystemComplete.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });
    generateControllerManifest.mockResolvedValue(mockManifest);
    deployToController.mockResolvedValue({
      success: true,
      data: { key: 'test-external-app' }
    });
  });

  describe('deployExternalSystem', () => {
    it('should deploy external system successfully', async() => {
      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      const result = await deployExternalSystem(appName);

      expect(validateExternalSystemComplete).toHaveBeenCalledWith(appName);
      expect(generateControllerManifest).toHaveBeenCalledWith(appName);
      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'http://localhost:3000',
        'dev',
        appName
      );
      expect(deployToController).toHaveBeenCalledWith(
        mockManifest,
        'http://localhost:3000',
        'dev',
        { type: 'bearer', token: 'test-token' },
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should use controller URL from config', async() => {
      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      resolveControllerUrl.mockResolvedValueOnce('http://custom-controller:3000');

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await deployExternalSystem(appName, {});

      expect(resolveControllerUrl).toHaveBeenCalledWith();
      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'http://custom-controller:3000',
        'dev',
        appName
      );
      expect(deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        'http://custom-controller:3000',
        'dev',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should use environment from config', async() => {
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveEnvironment.mockResolvedValueOnce('prod');

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await deployExternalSystem(appName, {});

      expect(resolveEnvironment).toHaveBeenCalledWith();
      expect(getDeploymentAuth).toHaveBeenCalledWith(
        expect.any(String),
        'prod',
        appName
      );
      expect(deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        'prod',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should pass polling options to deployer', async() => {
      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await deployExternalSystem(appName, {
        poll: true,
        pollInterval: 5000,
        pollMaxAttempts: 10
      });

      expect(deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          poll: true,
          pollInterval: 5000,
          pollMaxAttempts: 10
        })
      );
    });

    it('should use 500ms default pollInterval for external systems', async() => {
      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await deployExternalSystem(appName, {});

      expect(deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          pollInterval: 500
        })
      );
    });

    it('should throw error if validation fails', async() => {
      validateExternalSystemComplete.mockResolvedValue({
        valid: false,
        errors: ['Validation error'],
        warnings: []
      });

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Validation failed. Fix errors before deploying.');

      expect(displayValidationResults).toHaveBeenCalled();
      expect(generateControllerManifest).not.toHaveBeenCalled();
      expect(deployToController).not.toHaveBeenCalled();
    });

    it('should throw error if authentication is missing', async() => {
      getDeploymentAuth.mockResolvedValue({});

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Authentication required');

      expect(validateExternalSystemComplete).toHaveBeenCalled();
      expect(generateControllerManifest).toHaveBeenCalled();
      expect(deployToController).not.toHaveBeenCalled();
    });

    it('should throw error if manifest generation fails', async() => {
      generateControllerManifest.mockRejectedValue(new Error('Manifest generation failed'));

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Manifest generation failed');

      expect(validateExternalSystemComplete).toHaveBeenCalled();
      expect(deployToController).not.toHaveBeenCalled();
    });

    it('should throw error if deployment fails', async() => {
      deployToController.mockRejectedValue(new Error('Deployment failed'));

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Deployment failed');

      expect(validateExternalSystemComplete).toHaveBeenCalled();
      expect(generateControllerManifest).toHaveBeenCalled();
      expect(deployToController).toHaveBeenCalled();
    });

    it('should use default controller URL from config', async() => {
      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      resolveControllerUrl.mockResolvedValueOnce('http://config-controller:3000');

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await deployExternalSystem(appName);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'http://config-controller:3000',
        'dev',
        appName
      );
      expect(deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        'http://config-controller:3000',
        'dev',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should use default controller URL if config is missing', async() => {
      getConfig.mockResolvedValue({});

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await deployExternalSystem(appName);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'http://localhost:3000',
        'dev',
        appName
      );
      expect(deployToController).toHaveBeenCalledWith(
        expect.any(Object),
        'http://localhost:3000',
        'dev',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle validation errors with display', async() => {
      validateExternalSystemComplete.mockResolvedValue({
        valid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
        steps: {
          application: { valid: false, errors: ['Error 1'] },
          components: { valid: false, errors: ['Error 2'] },
          manifest: { valid: true, errors: [] }
        }
      });

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Validation failed. Fix errors before deploying.');

      expect(displayValidationResults).toHaveBeenCalledWith({
        valid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
        steps: expect.any(Object)
      });
    });

    it('should prevent deployment when components have errors', async() => {
      validateExternalSystemComplete.mockResolvedValue({
        valid: false,
        errors: ['System file validation failed'],
        warnings: [],
        steps: {
          application: { valid: true, errors: [] },
          components: { valid: false, errors: ['System file validation failed'] },
          manifest: { valid: false, errors: [] }
        }
      });

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Validation failed. Fix errors before deploying.');

      expect(displayValidationResults).toHaveBeenCalled();
      expect(generateControllerManifest).not.toHaveBeenCalled();
      expect(deployToController).not.toHaveBeenCalled();
    });

    it('should prevent deployment when manifest validation fails', async() => {
      validateExternalSystemComplete.mockResolvedValue({
        valid: false,
        errors: ['Manifest validation failed'],
        warnings: [],
        steps: {
          application: { valid: true, errors: [] },
          components: { valid: true, errors: [] },
          manifest: { valid: false, errors: ['Manifest validation failed'] }
        }
      });

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Validation failed. Fix errors before deploying.');

      expect(displayValidationResults).toHaveBeenCalled();
      expect(generateControllerManifest).not.toHaveBeenCalled();
      expect(deployToController).not.toHaveBeenCalled();
    });

    it('should show same validation output as validate command', async() => {
      const validationResult = {
        valid: false,
        errors: ['Component error'],
        warnings: ['Warning message'],
        steps: {
          application: { valid: true, errors: [], warnings: [] },
          components: { valid: false, errors: ['Component error'], warnings: [] },
          manifest: { valid: false, errors: [], warnings: [] }
        }
      };
      validateExternalSystemComplete.mockResolvedValue(validationResult);

      const { deployExternalSystem } = require('../../../lib/external-system/deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system: Validation failed. Fix errors before deploying.');

      // Should display validation results exactly as validate command would
      expect(displayValidationResults).toHaveBeenCalledWith(validationResult);
    });
  });
});
