/**
 * Tests for Wizard Core Functions
 *
 * @fileoverview Tests for lib/commands/wizard-core.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock all dependencies before requiring wizard-core
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/datasource/deploy');
jest.mock('../../../lib/commands/wizard-dataplane');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/api/wizard.api');
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

const wizardCore = require('../../../lib/commands/wizard-core');
const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const tokenManager = require('../../../lib/utils/token-manager');
const datasourceDeploy = require('../../../lib/datasource/deploy');
const wizardDataplane = require('../../../lib/commands/wizard-dataplane');
const controllerUrl = require('../../../lib/utils/controller-url');
const wizardApi = require('../../../lib/api/wizard.api');
const wizardGenerator = require('../../../lib/generator/wizard');
const inquirer = require('inquirer');

describe('Wizard Core Functions', () => {
  const mockDataplaneUrl = 'https://dataplane.example.com';
  const mockAuthConfig = {
    type: 'bearer',
    token: 'test-token',
    controller: 'https://controller.example.com'
  };
  const mockSessionId = 'session-123';
  const mockOpenApiSpec = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.cwd = jest.fn(() => '/workspace');
  });

  describe('validateAndCheckAppDirectory', () => {
    it('should validate app name format', async() => {
      await expect(wizardCore.validateAndCheckAppDirectory('Invalid App Name!'))
        .rejects.toThrow('Application name must contain only lowercase letters, numbers, hyphens, and underscores');
    });

    it('should return true for valid app name when directory does not exist', async() => {
      fs.access.mockRejectedValue({ code: 'ENOENT' });
      const result = await wizardCore.validateAndCheckAppDirectory('test-app');
      expect(result).toBe(true);
    });

    it('should prompt for overwrite in interactive mode when directory exists', async() => {
      fs.access.mockResolvedValue(undefined);
      inquirer.prompt.mockResolvedValue({ overwrite: true });
      const result = await wizardCore.validateAndCheckAppDirectory('test-app', true);
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when user declines overwrite', async() => {
      fs.access.mockResolvedValue(undefined);
      inquirer.prompt.mockResolvedValue({ overwrite: false });
      const result = await wizardCore.validateAndCheckAppDirectory('test-app', true);
      expect(result).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Wizard cancelled'));
    });

    it('should log warning in non-interactive mode when directory exists', async() => {
      fs.access.mockResolvedValue(undefined);
      const result = await wizardCore.validateAndCheckAppDirectory('test-app', false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning'));
      expect(result).toBe(true);
    });

    it('should throw error for non-ENOENT errors', async() => {
      fs.access.mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });
      await expect(wizardCore.validateAndCheckAppDirectory('test-app'))
        .rejects.toMatchObject({ code: 'EACCES' });
    });
  });

  describe('extractSessionId', () => {
    it('should extract session ID from data.sessionId', () => {
      const response = { data: { sessionId: 'session-123' } };
      expect(wizardCore.extractSessionId(response)).toBe('session-123');
    });

    it('should extract session ID from sessionId', () => {
      const response = { sessionId: 'session-123' };
      expect(wizardCore.extractSessionId(response)).toBe('session-123');
    });

    it('should extract session ID from nested object', () => {
      const response = { data: { sessionId: { id: 'session-123' } } };
      expect(wizardCore.extractSessionId(response)).toBe('session-123');
    });

    it('should throw error when session ID not found', () => {
      const response = { data: {} };
      expect(() => wizardCore.extractSessionId(response)).toThrow('Session ID not found');
    });
  });

  describe('handleModeSelection', () => {
    it('should create wizard session with default mode', async() => {
      wizardApi.createWizardSession.mockResolvedValue({
        success: true,
        data: { sessionId: mockSessionId }
      });
      const result = await wizardCore.handleModeSelection(mockDataplaneUrl, mockAuthConfig);
      expect(wizardApi.createWizardSession).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'create-system',
        null
      );
      expect(result.mode).toBe('create-system');
      expect(result.sessionId).toBe(mockSessionId);
    });

    it('should create wizard session with provided mode and systemIdOrKey', async() => {
      wizardApi.createWizardSession.mockResolvedValue({
        success: true,
        data: { sessionId: mockSessionId }
      });
      const result = await wizardCore.handleModeSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        'add-datasource',
        'system-123'
      );
      expect(wizardApi.createWizardSession).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'add-datasource',
        'system-123'
      );
      expect(result.mode).toBe('add-datasource');
    });

    it('should throw error when session creation fails', async() => {
      wizardApi.createWizardSession.mockResolvedValue({
        success: false,
        error: 'Session creation failed',
        formattedError: 'Formatted error'
      });
      await expect(wizardCore.handleModeSelection(mockDataplaneUrl, mockAuthConfig))
        .rejects.toThrow('Failed to create wizard session');
    });

    it('should show clear message when dataplane returns 401 (token valid for controller)', async() => {
      wizardApi.createWizardSession.mockResolvedValue({
        success: false,
        status: 401,
        error: 'Invalid token or insufficient permissions',
        errorData: { message: 'Invalid token or insufficient permissions' }
      });
      const err = await wizardCore.handleModeSelection(mockDataplaneUrl, mockAuthConfig).catch(e => e);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Your token is valid for the controller');
      expect(err.message).toContain('rejected the request');
    });
  });

  describe('handleSourceSelection', () => {
    it('should handle openapi-file source type', async() => {
      wizardApi.updateWizardSession.mockResolvedValue({ success: true });
      const configSource = { type: 'openapi-file', filePath: './openapi.yaml' };
      const result = await wizardCore.handleSourceSelection(
        mockDataplaneUrl,
        mockSessionId,
        mockAuthConfig,
        configSource
      );
      expect(result.sourceType).toBe('openapi-file');
      expect(result.sourceData).toBe('./openapi.yaml');
    });

    it('should handle openapi-url source type', async() => {
      wizardApi.updateWizardSession.mockResolvedValue({ success: true });
      const configSource = { type: 'openapi-url', url: 'https://api.example.com/openapi.json' };
      const result = await wizardCore.handleSourceSelection(
        mockDataplaneUrl,
        mockSessionId,
        mockAuthConfig,
        configSource
      );
      expect(result.sourceType).toBe('openapi-url');
      expect(result.sourceData).toBe('https://api.example.com/openapi.json');
    });

    it('should handle mcp-server source type', async() => {
      wizardApi.updateWizardSession.mockResolvedValue({ success: true });
      const configSource = {
        type: 'mcp-server',
        serverUrl: 'https://mcp.example.com',
        token: 'token-123'
      };
      const result = await wizardCore.handleSourceSelection(
        mockDataplaneUrl,
        mockSessionId,
        mockAuthConfig,
        configSource
      );
      expect(result.sourceType).toBe('mcp-server');
      expect(JSON.parse(result.sourceData)).toEqual({
        serverUrl: 'https://mcp.example.com',
        token: 'token-123'
      });
    });

    it('should handle known-platform source type', async() => {
      wizardApi.updateWizardSession.mockResolvedValue({ success: true });
      const configSource = { type: 'known-platform', platform: 'hubspot' };
      const result = await wizardCore.handleSourceSelection(
        mockDataplaneUrl,
        mockSessionId,
        mockAuthConfig,
        configSource
      );
      expect(result.sourceType).toBe('known-platform');
      expect(result.sourceData).toBe('hubspot');
    });

    it('should throw error when update session fails', async() => {
      wizardApi.updateWizardSession.mockResolvedValue({
        success: false,
        error: 'Update failed'
      });
      await expect(wizardCore.handleSourceSelection(
        mockDataplaneUrl,
        mockSessionId,
        mockAuthConfig,
        { type: 'openapi-file', filePath: './test.yaml' }
      )).rejects.toThrow('Source selection failed');
    });
  });

  describe('handleOpenApiParsing', () => {
    it('should parse OpenAPI file successfully', async() => {
      wizardApi.parseOpenApi.mockResolvedValue({
        success: true,
        data: { spec: mockOpenApiSpec }
      });
      const result = await wizardCore.handleOpenApiParsing(
        mockDataplaneUrl,
        mockAuthConfig,
        'openapi-file',
        './openapi.yaml'
      );
      expect(wizardApi.parseOpenApi).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        './openapi.yaml',
        false
      );
      expect(result).toEqual(mockOpenApiSpec);
    });

    it('should parse OpenAPI URL successfully', async() => {
      wizardApi.parseOpenApi.mockResolvedValue({
        success: true,
        data: { spec: mockOpenApiSpec }
      });
      const result = await wizardCore.handleOpenApiParsing(
        mockDataplaneUrl,
        mockAuthConfig,
        'openapi-url',
        'https://api.example.com/openapi.json'
      );
      expect(wizardApi.parseOpenApi).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'https://api.example.com/openapi.json',
        true
      );
      expect(result).toEqual(mockOpenApiSpec);
    });

    it('should throw error when parsing fails', async() => {
      wizardApi.parseOpenApi.mockResolvedValue({
        success: false,
        error: 'Parsing failed'
      });
      await expect(wizardCore.handleOpenApiParsing(
        mockDataplaneUrl,
        mockAuthConfig,
        'openapi-file',
        './invalid.yaml'
      )).rejects.toThrow('OpenAPI parsing failed');
    });

    it('should test MCP server connection successfully', async() => {
      wizardApi.testMcpConnection.mockResolvedValue({
        success: true,
        data: { connected: true }
      });
      const mcpData = JSON.stringify({
        serverUrl: 'https://mcp.example.com',
        token: 'token-123'
      });
      const result = await wizardCore.handleOpenApiParsing(
        mockDataplaneUrl,
        mockAuthConfig,
        'mcp-server',
        mcpData
      );
      expect(wizardApi.testMcpConnection).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'https://mcp.example.com',
        'token-123'
      );
      expect(result).toBeNull();
    });

    it('should throw error when MCP connection fails', async() => {
      wizardApi.testMcpConnection.mockResolvedValue({
        success: false,
        data: { connected: false, error: 'Connection failed' }
      });
      const mcpData = JSON.stringify({
        serverUrl: 'https://mcp.example.com',
        token: 'token-123'
      });
      await expect(wizardCore.handleOpenApiParsing(
        mockDataplaneUrl,
        mockAuthConfig,
        'mcp-server',
        mcpData
      )).rejects.toThrow('MCP connection failed');
    });

    it('should return null for known-platform source type', async() => {
      const result = await wizardCore.handleOpenApiParsing(
        mockDataplaneUrl,
        mockAuthConfig,
        'known-platform',
        'hubspot'
      );
      expect(result).toBeNull();
    });
  });

  describe('handleCredentialSelection', () => {
    it('should skip credential selection when no config provided', async() => {
      const result = await wizardCore.handleCredentialSelection(mockDataplaneUrl, mockAuthConfig);
      expect(wizardApi.credentialSelection).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should skip credential selection when action is skip', async() => {
      const configCredential = { action: 'skip' };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential
      );
      expect(wizardApi.credentialSelection).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should create credential successfully', async() => {
      wizardApi.credentialSelection.mockResolvedValue({
        success: true,
        data: { credentialIdOrKey: 'new-credential' }
      });
      const configCredential = {
        action: 'create',
        config: { key: 'new-credential', type: 'OAUTH2' }
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential
      );
      expect(result).toBe('new-credential');
    });

    it('should select credential successfully', async() => {
      wizardApi.credentialSelection.mockResolvedValue({
        success: true,
        data: { credentialIdOrKey: 'existing-credential' }
      });
      const configCredential = {
        action: 'select',
        credentialIdOrKey: 'existing-credential'
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential
      );
      expect(result).toBe('existing-credential');
    });

    it('should return null when credential selection fails', async() => {
      wizardApi.credentialSelection.mockResolvedValue({
        success: false,
        error: 'Selection failed'
      });
      const configCredential = {
        action: 'create',
        config: { key: 'new-credential' }
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential
      );
      expect(result).toBeNull();
    });
  });

  describe('handleTypeDetection', () => {
    it('should detect API type successfully', async() => {
      wizardApi.detectType.mockResolvedValue({
        success: true,
        data: { recommendedType: 'record-based', confidence: 0.9 }
      });
      const result = await wizardCore.handleTypeDetection(
        mockDataplaneUrl,
        mockAuthConfig,
        mockOpenApiSpec
      );
      expect(wizardApi.detectType).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        mockOpenApiSpec
      );
      expect(result.recommendedType).toBe('record-based');
    });

    it('should return null when openapiSpec is null', async() => {
      const result = await wizardCore.handleTypeDetection(
        mockDataplaneUrl,
        mockAuthConfig,
        null
      );
      expect(wizardApi.detectType).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when detection fails', async() => {
      wizardApi.detectType.mockResolvedValue({ success: false });
      const result = await wizardCore.handleTypeDetection(
        mockDataplaneUrl,
        mockAuthConfig,
        mockOpenApiSpec
      );
      expect(result).toBeNull();
    });
  });

  describe('handleConfigurationGeneration', () => {
    const mockSystemConfig = { key: 'test-system', displayName: 'Test System' };
    const mockDatasourceConfigs = [{ key: 'ds1', systemKey: 'test-system' }];

    it('should generate configuration with default preferences', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: true,
        data: {
          systemConfig: mockSystemConfig,
          datasourceConfigs: mockDatasourceConfigs,
          systemKey: 'test-system'
        }
      });
      const result = await wizardCore.handleConfigurationGeneration(
        mockDataplaneUrl,
        mockAuthConfig,
        {
          mode: 'create-system',
          openapiSpec: mockOpenApiSpec,
          detectedType: { recommendedType: 'record-based' }
        }
      );
      expect(wizardApi.generateConfig).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        expect.objectContaining({
          openapiSpec: mockOpenApiSpec,
          detectedType: 'record-based',
          intent: 'general integration',
          mode: 'create-system',
          fieldOnboardingLevel: 'full',
          enableOpenAPIGeneration: true,
          userPreferences: {
            enableMCP: false,
            enableABAC: false,
            enableRBAC: false
          }
        })
      );
      expect(result.systemConfig).toEqual(mockSystemConfig);
      expect(result.datasourceConfigs).toEqual(mockDatasourceConfigs);
    });

    it('should generate configuration with custom preferences', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: true,
        data: {
          systemConfig: mockSystemConfig,
          datasourceConfigs: mockDatasourceConfigs
        }
      });
      const preferences = {
        intent: 'sales-focused CRM',
        fieldOnboardingLevel: 'standard',
        enableOpenAPIGeneration: false,
        enableMCP: true,
        enableABAC: true,
        enableRBAC: false
      };
      await wizardCore.handleConfigurationGeneration(
        mockDataplaneUrl,
        mockAuthConfig,
        {
          mode: 'create-system',
          openapiSpec: mockOpenApiSpec,
          detectedType: { recommendedType: 'record-based' },
          configPrefs: preferences,
          credentialIdOrKey: 'credential-123'
        }
      );
      expect(wizardApi.generateConfig).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        expect.objectContaining({
          intent: 'sales-focused CRM',
          fieldOnboardingLevel: 'standard',
          enableOpenAPIGeneration: false,
          credentialIdOrKey: 'credential-123',
          userPreferences: {
            enableMCP: true,
            enableABAC: true,
            enableRBAC: false
          }
        })
      );
    });

    it('should throw error when generation fails', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: false,
        error: 'Generation failed'
      });
      await expect(wizardCore.handleConfigurationGeneration(
        mockDataplaneUrl,
        mockAuthConfig,
        {
          mode: 'create-system',
          openapiSpec: mockOpenApiSpec,
          detectedType: { recommendedType: 'record-based' }
        }
      )).rejects.toThrow('Configuration generation failed');
    });

    it('should handle single datasourceConfig response', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: true,
        data: {
          systemConfig: mockSystemConfig,
          datasourceConfig: mockDatasourceConfigs[0]
        }
      });
      const result = await wizardCore.handleConfigurationGeneration(
        mockDataplaneUrl,
        mockAuthConfig,
        {
          mode: 'create-system',
          openapiSpec: mockOpenApiSpec,
          detectedType: { recommendedType: 'record-based' }
        }
      );
      expect(result.datasourceConfigs).toEqual([mockDatasourceConfigs[0]]);
    });
  });

  describe('validateWizardConfiguration', () => {
    const mockSystemConfig = { key: 'test-system' };
    const mockDatasourceConfigs = [{ key: 'ds1' }];

    it('should validate configuration successfully', async() => {
      wizardApi.validateWizardConfig.mockResolvedValue({
        success: true,
        data: { isValid: true, warnings: [] }
      });
      await wizardCore.validateWizardConfiguration(
        mockDataplaneUrl,
        mockAuthConfig,
        mockSystemConfig,
        mockDatasourceConfigs
      );
      expect(wizardApi.validateWizardConfig).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        mockSystemConfig,
        mockDatasourceConfigs[0]
      );
    });

    it('should display warnings when present', async() => {
      wizardApi.validateWizardConfig.mockResolvedValue({
        success: true,
        data: {
          isValid: true,
          warnings: [
            { message: 'Warning 1' },
            { message: 'Warning 2' }
          ]
        }
      });
      await wizardCore.validateWizardConfiguration(
        mockDataplaneUrl,
        mockAuthConfig,
        mockSystemConfig,
        mockDatasourceConfigs
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warnings'));
    });

    it('should throw error when validation fails', async() => {
      wizardApi.validateWizardConfig.mockResolvedValue({
        success: false,
        data: {
          isValid: false,
          errors: [{ message: 'Error 1' }, { message: 'Error 2' }]
        }
      });
      await expect(wizardCore.validateWizardConfiguration(
        mockDataplaneUrl,
        mockAuthConfig,
        mockSystemConfig,
        mockDatasourceConfigs
      )).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('handleFileSaving', () => {
    const mockSystemConfig = { key: 'test-system' };
    const mockDatasourceConfigs = [{ key: 'ds1' }];
    const mockGeneratedFiles = {
      appPath: '/workspace/integration/test-app',
      systemFilePath: '/workspace/integration/test-app/test-system-deploy.json'
    };

    it('should save files successfully', async() => {
      wizardApi.getDeploymentDocs.mockResolvedValue({
        success: true,
        data: { content: '# Test README' }
      });
      wizardGenerator.generateWizardFiles.mockResolvedValue(mockGeneratedFiles);
      const result = await wizardCore.handleFileSaving(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        mockDataplaneUrl,
        mockAuthConfig
      );
      expect(wizardGenerator.generateWizardFiles).toHaveBeenCalledWith(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        { aiGeneratedReadme: '# Test README' }
      );
      expect(result).toEqual(mockGeneratedFiles);
    });

    it('should handle missing deployment docs gracefully', async() => {
      wizardApi.getDeploymentDocs.mockResolvedValue({
        success: false
      });
      wizardGenerator.generateWizardFiles.mockResolvedValue(mockGeneratedFiles);
      await wizardCore.handleFileSaving(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        mockDataplaneUrl,
        mockAuthConfig
      );
      expect(wizardGenerator.generateWizardFiles).toHaveBeenCalledWith(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        { aiGeneratedReadme: null }
      );
    });

    it('should throw error when file generation fails', async() => {
      wizardGenerator.generateWizardFiles.mockRejectedValue(new Error('File generation failed'));
      await expect(wizardCore.handleFileSaving(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        mockDataplaneUrl,
        mockAuthConfig
      )).rejects.toThrow('File generation failed');
    });
  });

  describe('setupDataplaneAndAuth', () => {
    const mockOptions = {};

    beforeEach(() => {
      config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
      controllerUrl.resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    });

    it('should setup dataplane and auth successfully', async() => {
      tokenManager.getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      const dataplaneResolver = require('../../../lib/utils/dataplane-resolver');
      jest.spyOn(dataplaneResolver, 'resolveDataplaneUrl').mockResolvedValue(mockDataplaneUrl);

      const result = await wizardCore.setupDataplaneAndAuth(mockOptions, 'test-app');

      expect(result.dataplaneUrl).toBe(mockDataplaneUrl);
      expect(result.authConfig).toEqual(mockAuthConfig);
      expect(config.resolveEnvironment).toHaveBeenCalled();
      expect(controllerUrl.resolveControllerUrl).toHaveBeenCalledWith();
      expect(tokenManager.getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'test-app'
      );
      expect(dataplaneResolver.resolveDataplaneUrl).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        mockAuthConfig
      );
    });

    it('should throw error when authentication fails', async() => {
      tokenManager.getDeploymentAuth.mockRejectedValue(new Error('Deployment auth failed'));
      await expect(wizardCore.setupDataplaneAndAuth(mockOptions, 'test-app'))
        .rejects.toThrow('Authentication failed');
      expect(tokenManager.getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'test-app'
      );
    });

    it('should throw error when dataplane URL lookup fails', async() => {
      tokenManager.getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      const dataplaneResolver = require('../../../lib/utils/dataplane-resolver');
      jest.spyOn(dataplaneResolver, 'resolveDataplaneUrl').mockRejectedValue(new Error('Dataplane not found'));
      await expect(wizardCore.setupDataplaneAndAuth(mockOptions, 'test-app'))
        .rejects.toThrow('Dataplane not found');
      expect(tokenManager.getDeploymentAuth).toHaveBeenCalled();
      expect(dataplaneResolver.resolveDataplaneUrl).toHaveBeenCalled();
    });
  });
});
