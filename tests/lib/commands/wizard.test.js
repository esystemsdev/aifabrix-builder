/**
 * Tests for Wizard Command Handler
 *
 * @fileoverview Tests for lib/commands/wizard.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock all dependencies before requiring wizard
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/datasource/deploy');
jest.mock('../../../lib/commands/wizard-dataplane');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/api/wizard.api');
jest.mock('../../../lib/generator/wizard-prompts');
jest.mock('../../../lib/generator/wizard');
jest.mock('inquirer');
jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis()
  };
  return jest.fn(() => mockSpinner);
});
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const fs = require('fs').promises;

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

const { handleWizard } = require('../../../lib/commands/wizard');
const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const tokenManager = require('../../../lib/utils/token-manager');
const datasourceDeploy = require('../../../lib/datasource/deploy');
const wizardDataplane = require('../../../lib/commands/wizard-dataplane');
const controllerUrl = require('../../../lib/utils/controller-url');
const wizardApi = require('../../../lib/api/wizard.api');
const wizardPrompts = require('../../../lib/generator/wizard-prompts');
const wizardGenerator = require('../../../lib/generator/wizard');
const inquirer = require('inquirer');

describe('Wizard Command Handler', () => {
  const mockOptions = {
    app: 'test-app'
  };

  const mockAuthConfig = {
    type: 'bearer',
    token: 'test-token',
    controller: 'https://controller.example.com'
  };

  const mockDataplaneUrl = 'https://dataplane.example.com';

  const mockSystemConfig = {
    key: 'test-system',
    displayName: 'Test System',
    description: 'Test system description',
    version: '1.0.0'
  };

  const mockDatasourceConfigs = [
    {
      key: 'ds1',
      systemKey: 'test-system',
      entityKey: 'entity1'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    config.getConfig.mockResolvedValue({});
    config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
    controllerUrl.resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    // Wizard uses device-only auth for new external systems
    tokenManager.getDeviceOnlyAuth.mockResolvedValue(mockAuthConfig);
    const dataplaneResolver = require('../../../lib/utils/dataplane-resolver');
    jest.spyOn(dataplaneResolver, 'resolveDataplaneUrl').mockResolvedValue(mockDataplaneUrl);
    fs.access.mockRejectedValue({ code: 'ENOENT' }); // Directory doesn't exist
    fs.mkdir.mockResolvedValue(undefined);

    // Wizard API mocks
    wizardApi.createWizardSession.mockResolvedValue({
      success: true,
      data: { data: { sessionId: 'session-123' } }
    });
    wizardApi.updateWizardSession.mockResolvedValue({
      success: true,
      data: { data: { sessionId: 'session-123' } }
    });
    wizardApi.parseOpenApi.mockResolvedValue({
      success: true,
      data: { spec: { openapi: '3.0.0' } }
    });
    wizardApi.detectType.mockResolvedValue({
      success: true,
      data: { apiType: 'rest', category: 'crm' }
    });
    wizardApi.generateConfig.mockResolvedValue({
      success: true,
      data: {
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs,
        systemKey: 'test-system'
      }
    });
    wizardApi.validateWizardConfig.mockResolvedValue({
      success: true,
      data: { valid: true, errors: [], warnings: [] }
    });
    wizardApi.testMcpConnection.mockResolvedValue({
      success: true,
      data: { connected: true }
    });
    wizardApi.credentialSelection.mockResolvedValue({
      success: true,
      data: { credentialIdOrKey: null }
    });

    // Wizard prompts mocks
    wizardPrompts.promptForAppName.mockResolvedValue('test-app');
    wizardPrompts.promptForMode.mockResolvedValue('create-system');
    wizardPrompts.promptForSystemIdOrKey.mockResolvedValue('system-123');
    wizardPrompts.promptForSourceType.mockResolvedValue('openapi-file');
    wizardPrompts.promptForOpenApiFile.mockResolvedValue('/path/to/openapi.yaml');
    wizardPrompts.promptForOpenApiUrl.mockResolvedValue('https://api.example.com/openapi.yaml');
    wizardPrompts.promptForMcpServer.mockResolvedValue({
      serverUrl: 'https://mcp.example.com',
      token: 'mcp-token'
    });
    wizardPrompts.promptForKnownPlatform.mockResolvedValue('hubspot');
    wizardPrompts.promptForUserIntent.mockResolvedValue('sales-focused');
    wizardPrompts.promptForUserPreferences.mockResolvedValue({
      mcp: true,
      abac: false,
      rbac: true
    });
    wizardPrompts.promptForConfigReview.mockResolvedValue({
      action: 'accept'
    });

    // Wizard generator mock
    wizardGenerator.generateWizardFiles.mockResolvedValue({
      appPath: '/path/to/integration/test-app',
      systemFilePath: '/path/to/integration/test-app/test-system-deploy.json',
      datasourceFilePaths: ['/path/to/integration/test-app/test-system-deploy-entity1.json'],
      variablesPath: '/path/to/integration/test-app/variables.yaml',
      envTemplatePath: '/path/to/integration/test-app/env.template',
      readmePath: '/path/to/integration/test-app/README.md',
      applicationSchemaPath: '/path/to/integration/test-app/application-schema.json'
    });
  });

  describe('handleWizard', () => {
    it('should complete wizard flow successfully with app name in options', async() => {
      await handleWizard(mockOptions);

      expect(wizardPrompts.promptForAppName).not.toHaveBeenCalled();
      expect(wizardPrompts.promptForMode).toHaveBeenCalled();
      expect(wizardApi.createWizardSession).toHaveBeenCalled();
      expect(wizardApi.generateConfig).toHaveBeenCalled();
      expect(wizardApi.validateWizardConfig).toHaveBeenCalled();
      expect(wizardGenerator.generateWizardFiles).toHaveBeenCalled();
    });

    it('should prompt for app name if not provided', async() => {
      await handleWizard({ ...mockOptions, app: undefined });

      expect(wizardPrompts.promptForAppName).toHaveBeenCalled();
    });

    it('should validate app name format', async() => {
      await expect(handleWizard({ app: 'Invalid App Name!' })).rejects.toThrow(
        'Application name must contain only lowercase letters, numbers, hyphens, and underscores'
      );
    });

    it('should handle existing directory with overwrite confirmation', async() => {
      fs.access.mockResolvedValue(undefined); // Directory exists
      inquirer.prompt.mockResolvedValue({ overwrite: true });

      await handleWizard(mockOptions);

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should cancel wizard if user declines overwrite', async() => {
      fs.access.mockResolvedValue(undefined); // Directory exists
      inquirer.prompt.mockResolvedValue({ overwrite: false });

      await handleWizard(mockOptions);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Wizard cancelled'));
      expect(wizardApi.createWizardSession).not.toHaveBeenCalled();
    });

    it('should handle openapi-file source type', async() => {
      wizardPrompts.promptForSourceType.mockResolvedValue('openapi-file');
      wizardPrompts.promptForOpenApiFile.mockResolvedValue('/path/to/file.yaml');

      await handleWizard(mockOptions);

      expect(wizardPrompts.promptForOpenApiFile).toHaveBeenCalled();
      expect(wizardApi.parseOpenApi).toHaveBeenCalled();
    });

    it('should handle openapi-url source type', async() => {
      wizardPrompts.promptForSourceType.mockResolvedValue('openapi-url');
      wizardPrompts.promptForOpenApiUrl.mockResolvedValue('https://api.example.com/openapi.yaml');

      await handleWizard(mockOptions);

      expect(wizardPrompts.promptForOpenApiUrl).toHaveBeenCalled();
      // parseOpenApi is called for URLs too (with isUrl=true)
      expect(wizardApi.parseOpenApi).toHaveBeenCalled();
    });

    it('should handle mcp-server source type', async() => {
      wizardPrompts.promptForSourceType.mockResolvedValue('mcp-server');
      wizardPrompts.promptForMcpServer.mockResolvedValue({
        serverUrl: 'https://mcp.example.com',
        token: 'token'
      });

      await handleWizard(mockOptions);

      expect(wizardPrompts.promptForMcpServer).toHaveBeenCalled();
    });

    it('should handle known-platform source type', async() => {
      wizardPrompts.promptForSourceType.mockResolvedValue('known-platform');
      wizardPrompts.promptForKnownPlatform.mockResolvedValue('hubspot');

      await handleWizard(mockOptions);

      expect(wizardPrompts.promptForKnownPlatform).toHaveBeenCalled();
    });

    it('should detect API type when OpenAPI spec is available', async() => {
      wizardPrompts.promptForSourceType.mockResolvedValue('openapi-file');
      wizardApi.parseOpenApi.mockResolvedValue({
        success: true,
        data: { spec: { openapi: '3.0.0', info: { title: 'Test API' } } }
      });

      await handleWizard(mockOptions);

      expect(wizardApi.detectType).toHaveBeenCalled();
    });

    it('should handle config review with accept action', async() => {
      wizardPrompts.promptForConfigReview.mockResolvedValue({ action: 'accept' });

      await handleWizard(mockOptions);

      expect(wizardApi.validateWizardConfig).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        mockSystemConfig,
        mockDatasourceConfigs[0]
      );
    });

    it('should prompt for systemIdOrKey in add-datasource mode', async() => {
      wizardPrompts.promptForMode.mockResolvedValue('add-datasource');
      wizardPrompts.promptForSystemIdOrKey.mockResolvedValue('system-abc');

      await handleWizard(mockOptions);

      expect(wizardPrompts.promptForSystemIdOrKey).toHaveBeenCalled();
      expect(wizardApi.createWizardSession).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'add-datasource',
        'system-abc'
      );
    });

    it('should handle config review with edit action', async() => {
      const editedSystemConfig = { ...mockSystemConfig, displayName: 'Edited Name' };
      const editedDatasourceConfigs = [...mockDatasourceConfigs];

      wizardPrompts.promptForConfigReview.mockResolvedValue({
        action: 'edit',
        systemConfig: editedSystemConfig,
        datasourceConfigs: editedDatasourceConfigs
      });

      await handleWizard(mockOptions);

      expect(wizardApi.validateWizardConfig).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        editedSystemConfig,
        editedDatasourceConfigs[0]
      );
    });

    it('should cancel wizard if user cancels config review', async() => {
      wizardPrompts.promptForConfigReview.mockResolvedValue({ action: 'cancel' });

      await handleWizard(mockOptions);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Wizard cancelled'));
      expect(wizardGenerator.generateWizardFiles).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async() => {
      wizardApi.validateWizardConfig.mockResolvedValue({
        success: true,
        data: {
          valid: false,
          errors: [{ message: 'Invalid configuration' }]
        }
      });

      await expect(handleWizard(mockOptions)).rejects.toThrow('Configuration validation failed');
    });

    it('should display validation warnings', async() => {
      wizardApi.validateWizardConfig.mockResolvedValue({
        success: true,
        data: {
          valid: true,
          errors: [],
          warnings: [{ message: 'Warning 1' }, { message: 'Warning 2' }]
        }
      });

      await handleWizard(mockOptions);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('⚠ Warnings:'));
    });
  });

  describe('error handling', () => {
    it('should handle mode selection failure', async() => {
      wizardApi.createWizardSession.mockResolvedValue({
        success: false,
        error: 'Mode selection failed'
      });

      await expect(handleWizard(mockOptions)).rejects.toThrow('Failed to create wizard session');
    });

    it('should handle source selection failure', async() => {
      wizardApi.updateWizardSession.mockResolvedValue({
        success: false,
        error: 'Source selection failed'
      });

      await expect(handleWizard(mockOptions)).rejects.toThrow('Source selection failed');
    });

    it('should handle OpenAPI parsing failure', async() => {
      wizardPrompts.promptForSourceType.mockResolvedValue('openapi-file');
      wizardApi.parseOpenApi.mockResolvedValue({
        success: false,
        error: 'Parsing failed'
      });

      await expect(handleWizard(mockOptions)).rejects.toThrow('OpenAPI parsing failed');
    });

    it('should handle config generation failure', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: false,
        error: 'Generation failed'
      });

      await expect(handleWizard(mockOptions)).rejects.toThrow('Configuration generation failed');
    });

    it('should handle missing system config in generation response', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: true,
        data: {
          datasourceConfigs: mockDatasourceConfigs
          // Missing systemConfig
        }
      });

      await expect(handleWizard(mockOptions)).rejects.toThrow('System configuration not found');
    });

    it('should handle authentication errors when auth not available', async() => {
      tokenManager.getDeviceOnlyAuth.mockRejectedValue(
        new Error('Device token authentication required. Run "aifabrix login" to authenticate.')
      );
      tokenManager.getDeploymentAuth.mockRejectedValue(
        new Error('Deployment auth also failed')
      );

      await expect(handleWizard(mockOptions)).rejects.toThrow('Authentication failed: Device token authentication required');
    });

    it('should handle dataplane URL retrieval errors', async() => {
      const dataplaneResolver = require('../../../lib/utils/dataplane-resolver');
      jest.spyOn(dataplaneResolver, 'resolveDataplaneUrl').mockRejectedValue(new Error('Dataplane URL not found'));

      await expect(handleWizard(mockOptions)).rejects.toThrow('Dataplane URL not found');
    });

    it('should handle file generation errors', async() => {
      wizardGenerator.generateWizardFiles.mockRejectedValue(new Error('File generation failed'));

      await expect(handleWizard(mockOptions)).rejects.toThrow('File generation failed');
    });
  });

  describe('setupDataplaneAndAuth', () => {

    it('should get dataplane URL from controller if not provided', async() => {
      await handleWizard(mockOptions);

      const dataplaneResolver = require('../../../lib/utils/dataplane-resolver');
      expect(dataplaneResolver.resolveDataplaneUrl).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        expect.objectContaining({ type: 'bearer', token: mockAuthConfig.token })
      );
    });

    it('should surface authentication failures from device auth', async() => {
      tokenManager.getDeviceOnlyAuth.mockRejectedValue(
        new Error('Device token authentication required. Run "aifabrix login" to authenticate.')
      );
      tokenManager.getDeploymentAuth.mockRejectedValue(
        new Error('Deployment auth also failed')
      );

      await expect(handleWizard(mockOptions)).rejects.toThrow(
        'Authentication failed: Device token authentication required. Run "aifabrix login" to authenticate.'
      );
    });
  });
});

