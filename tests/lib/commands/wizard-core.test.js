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
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((appPath) => require('path').join(appPath, 'application.yaml'))
}));
const mockPromptForCredentialIdOrKeyRetry = jest.fn();
jest.mock('../../../lib/generator/wizard-prompts', () => ({
  promptForCredentialIdOrKeyRetry: (...args) => mockPromptForCredentialIdOrKeyRetry(...args)
}));
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
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
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

    it('should skip credential when select fails and user chooses skip on retry', async() => {
      wizardApi.credentialSelection.mockResolvedValue({
        success: false,
        error: 'Credential not found'
      });
      mockPromptForCredentialIdOrKeyRetry.mockResolvedValue({ skip: true });
      const configCredential = {
        action: 'select',
        credentialIdOrKey: 'missing-cred'
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential,
        { allowRetry: true }
      );
      expect(result).toBeNull();
      expect(mockPromptForCredentialIdOrKeyRetry).toHaveBeenCalledWith('Credential not found');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Skipping credential selection'));
    });

    it('should retry with new credential when select fails and user enters new id on retry', async() => {
      wizardApi.credentialSelection
        .mockResolvedValueOnce({ success: false, error: 'Credential not found' })
        .mockResolvedValueOnce({ success: true, data: { credentialIdOrKey: 'retry-cred' } });
      mockPromptForCredentialIdOrKeyRetry.mockResolvedValue({ skip: false, credentialIdOrKey: 'retry-cred' });
      const configCredential = {
        action: 'select',
        credentialIdOrKey: 'missing-cred'
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential,
        { allowRetry: true }
      );
      expect(result).toBe('retry-cred');
      expect(wizardApi.credentialSelection).toHaveBeenCalledTimes(2);
    });

    it('should skip when credentialSelection throws and user chooses skip on retry', async() => {
      wizardApi.credentialSelection.mockRejectedValue(new Error('Network error'));
      mockPromptForCredentialIdOrKeyRetry.mockResolvedValue({ skip: true });
      const configCredential = {
        action: 'select',
        credentialIdOrKey: 'some-cred'
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential,
        { allowRetry: true }
      );
      expect(result).toBeNull();
      expect(mockPromptForCredentialIdOrKeyRetry).toHaveBeenCalledWith('Network error');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Skipping credential selection'));
    });

    it('should retry with new credential when credentialSelection throws and user enters new id on retry', async() => {
      wizardApi.credentialSelection
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, data: { credentialIdOrKey: 'retry-cred' } });
      mockPromptForCredentialIdOrKeyRetry.mockResolvedValue({ skip: false, credentialIdOrKey: 'retry-cred' });
      const configCredential = {
        action: 'select',
        credentialIdOrKey: 'some-cred'
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential,
        { allowRetry: true }
      );
      expect(result).toBe('retry-cred');
      expect(wizardApi.credentialSelection).toHaveBeenCalledTimes(2);
    });

    it('should return null when credentialSelection throws and action is create (no retry)', async() => {
      wizardApi.credentialSelection.mockRejectedValue(new Error('Network error'));
      const configCredential = {
        action: 'create',
        config: { key: 'new-cred', type: 'OAUTH2' }
      };
      const result = await wizardCore.handleCredentialSelection(
        mockDataplaneUrl,
        mockAuthConfig,
        configCredential
      );
      expect(result).toBeNull();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Credential selection failed'));
      expect(mockPromptForCredentialIdOrKeyRetry).not.toHaveBeenCalled();
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

    it('should return null when detectType throws', async() => {
      wizardApi.detectType.mockRejectedValue(new Error('Network error'));
      const result = await wizardCore.handleTypeDetection(
        mockDataplaneUrl,
        mockAuthConfig,
        mockOpenApiSpec
      );
      expect(result).toBeNull();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Type detection failed'));
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

    it('should throw with validation details and formatted when generation fails with errorData', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: false,
        error: 'Request validation failed',
        errorData: {
          detail: 'Request validation failed',
          errors: [
            { field: 'body.openapiSpec', message: 'Required' },
            { path: 'intent', msg: 'Invalid value' }
          ]
        },
        formattedError: '\x1b[31mValidation Error\x1b[0m\nRequest validation failed'
      });
      let thrown;
      try {
        await wizardCore.handleConfigurationGeneration(
          mockDataplaneUrl,
          mockAuthConfig,
          {
            mode: 'create-system',
            openapiSpec: mockOpenApiSpec,
            detectedType: { recommendedType: 'record-based' }
          }
        );
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toContain('Configuration generation failed');
      expect(thrown.message).toContain('Validation errors:');
      expect(thrown.message).toContain('body.openapiSpec: Required');
      expect(thrown.message).toContain('intent: Invalid value');
      expect(thrown.formatted).toBe('\x1b[31mValidation Error\x1b[0m\nRequest validation failed');
    });

    it('should throw with configuration.errors in message when generation fails with errorData.configuration.errors (array)', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        errorData: {
          detail: 'Invalid config',
          configuration: {
            errors: [
              { field: 'systemKey', message: 'Must be alphanumeric' }
            ]
          }
        }
      });
      let thrown;
      try {
        await wizardCore.handleConfigurationGeneration(
          mockDataplaneUrl,
          mockAuthConfig,
          {
            mode: 'create-system',
            openapiSpec: mockOpenApiSpec,
            detectedType: { recommendedType: 'record-based' }
          }
        );
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toContain('Configuration errors:');
      expect(thrown.message).toContain('systemKey: Must be alphanumeric');
    });

    it('should throw with configuration.errors in message when generation fails with errorData.configuration.errors (object)', async() => {
      wizardApi.generateConfig.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        errorData: {
          configuration: {
            errors: { systemKey: 'Invalid', name: 'Required' }
          }
        }
      });
      let thrown;
      try {
        await wizardCore.handleConfigurationGeneration(
          mockDataplaneUrl,
          mockAuthConfig,
          {
            mode: 'create-system',
            openapiSpec: mockOpenApiSpec,
            detectedType: { recommendedType: 'record-based' }
          }
        );
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toContain('configuration.systemKey: Invalid');
      expect(thrown.message).toContain('configuration.name: Required');
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

    it('should save files successfully and update README via POST deployment-docs with application.yaml and deploy JSON', async() => {
      wizardGenerator.generateWizardFiles.mockResolvedValue(mockGeneratedFiles);
      fs.readFile.mockImplementation((p) => {
        if (String(p).endsWith('application.yaml')) return Promise.resolve('app:\n  key: test-app\n');
        if (String(p).endsWith('test-app-deploy.json')) return Promise.resolve('{}');
        return Promise.reject(new Error('ENOENT'));
      });
      fs.writeFile.mockResolvedValue(undefined);
      wizardApi.postDeploymentDocs.mockResolvedValue({
        success: true,
        data: { content: '# Test README' }
      });
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
        { aiGeneratedReadme: null }
      );
      expect(wizardApi.postDeploymentDocs).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'test-system',
        expect.objectContaining({ variablesYaml: expect.any(String), deployJson: expect.anything() })
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        '# Test README',
        'utf8'
      );
      expect(result).toEqual(mockGeneratedFiles);
    });

    it('should handle missing deployment docs gracefully', async() => {
      wizardGenerator.generateWizardFiles.mockResolvedValue(mockGeneratedFiles);
      fs.readFile.mockImplementation((p) => {
        if (String(p).endsWith('application.yaml')) return Promise.resolve('app:\n  key: test-app\n');
        if (String(p).endsWith('test-app-deploy.json')) return Promise.resolve('{}');
        return Promise.reject(new Error('ENOENT'));
      });
      wizardApi.postDeploymentDocs.mockResolvedValue({ success: false });
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
      expect(fs.writeFile).not.toHaveBeenCalledWith(expect.stringContaining('README.md'), expect.any(String), 'utf8');
    });

    it('should continue when postDeploymentDocs throws', async() => {
      wizardGenerator.generateWizardFiles.mockResolvedValue(mockGeneratedFiles);
      fs.readFile.mockImplementation((p) => {
        if (String(p).endsWith('application.yaml')) return Promise.resolve('app:\n  key: test-app\n');
        if (String(p).endsWith('test-app-deploy.json')) return Promise.resolve('{}');
        return Promise.reject(new Error('ENOENT'));
      });
      wizardApi.postDeploymentDocs.mockRejectedValue(new Error('Network error'));
      const result = await wizardCore.handleFileSaving(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        mockDataplaneUrl,
        mockAuthConfig
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Could not fetch AI-generated README'));
      expect(wizardGenerator.generateWizardFiles).toHaveBeenCalledWith(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        { aiGeneratedReadme: null }
      );
      expect(result).toEqual(mockGeneratedFiles);
    });

    it('should fall back to GET deployment-docs when application.yaml and deploy.json are unreadable', async() => {
      wizardGenerator.generateWizardFiles.mockResolvedValue(mockGeneratedFiles);
      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      wizardApi.getDeploymentDocs.mockResolvedValue({
        success: true,
        data: { content: '# Fallback README' }
      });
      const result = await wizardCore.handleFileSaving(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        mockDataplaneUrl,
        mockAuthConfig
      );
      expect(wizardApi.getDeploymentDocs).toHaveBeenCalledWith(mockDataplaneUrl, mockAuthConfig, 'test-system');
      expect(wizardApi.postDeploymentDocs).not.toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        '# Fallback README',
        'utf8'
      );
      expect(result).toEqual(mockGeneratedFiles);
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
