/**
 * Tests for Wizard Headless Mode Handler
 *
 * @fileoverview Tests for lib/commands/wizard-headless.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock all dependencies before requiring wizard-headless
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/validation/wizard-config-validator');
jest.mock('../../../lib/commands/wizard-core');
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const wizardHeadless = require('../../../lib/commands/wizard-headless');
const logger = require('../../../lib/utils/logger');
const wizardConfigValidator = require('../../../lib/validation/wizard-config-validator');
const wizardCore = require('../../../lib/commands/wizard-core');

describe('Wizard Headless Mode Handler', () => {
  const mockDataplaneUrl = 'https://dataplane.example.com';
  const mockAuthConfig = {
    type: 'bearer',
    token: 'test-token'
  };
  const mockWizardConfig = {
    appName: 'test-app',
    mode: 'create-system',
    source: {
      type: 'openapi-file',
      filePath: './openapi.yaml'
    },
    credential: {
      action: 'skip'
    },
    preferences: {
      intent: 'test integration',
      fieldOnboardingLevel: 'full'
    }
  };
  const mockSystemConfig = { key: 'test-system', displayName: 'Test System' };
  const mockDatasourceConfigs = [{ key: 'ds1', systemKey: 'test-system' }];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWizardFromConfig', () => {
    it('should execute complete wizard flow from config', async() => {
      wizardCore.handleModeSelection.mockResolvedValue({
        mode: 'create-system',
        sessionId: 'session-123'
      });
      wizardCore.handleSourceSelection.mockResolvedValue({
        sourceType: 'openapi-file',
        sourceData: './openapi.yaml'
      });
      wizardCore.handleOpenApiParsing.mockResolvedValue({
        openapi: '3.0.0',
        info: { title: 'Test API' }
      });
      wizardCore.handleCredentialSelection.mockResolvedValue(null);
      wizardCore.handleTypeDetection.mockResolvedValue({
        recommendedType: 'record-based'
      });
      wizardCore.handleConfigurationGeneration.mockResolvedValue({
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs,
        systemKey: 'test-system'
      });
      wizardCore.validateWizardConfiguration.mockResolvedValue(undefined);
      wizardCore.handleFileSaving.mockResolvedValue({
        appPath: '/workspace/integration/test-app'
      });

      await wizardHeadless.executeWizardFromConfig(
        mockWizardConfig,
        mockDataplaneUrl,
        mockAuthConfig
      );

      expect(wizardCore.handleModeSelection).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'create-system',
        undefined
      );
      expect(wizardCore.handleSourceSelection).toHaveBeenCalledWith(
        mockDataplaneUrl,
        'session-123',
        mockAuthConfig,
        mockWizardConfig.source
      );
      expect(wizardCore.handleOpenApiParsing).toHaveBeenCalled();
      expect(wizardCore.handleCredentialSelection).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        mockWizardConfig.credential,
        { allowRetry: false }
      );
      expect(wizardCore.handleTypeDetection).toHaveBeenCalled();
      expect(wizardCore.handleConfigurationGeneration).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        expect.objectContaining({
          mode: 'create-system',
          configPrefs: mockWizardConfig.preferences,
          credentialIdOrKey: null,
          systemIdOrKey: undefined
        })
      );
      expect(wizardCore.validateWizardConfiguration).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        mockSystemConfig,
        mockDatasourceConfigs
      );
      expect(wizardCore.handleFileSaving).toHaveBeenCalledWith(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-system',
        mockDataplaneUrl,
        mockAuthConfig
      );
    });

    it('should handle add-datasource mode', async() => {
      const addDatasourceConfig = {
        ...mockWizardConfig,
        mode: 'add-datasource',
        systemIdOrKey: 'existing-system'
      };
      wizardCore.handleModeSelection.mockResolvedValue({
        mode: 'add-datasource',
        sessionId: 'session-123'
      });
      wizardCore.handleSourceSelection.mockResolvedValue({
        sourceType: 'openapi-file',
        sourceData: './openapi.yaml'
      });
      wizardCore.handleOpenApiParsing.mockResolvedValue({});
      wizardCore.handleCredentialSelection.mockResolvedValue(null);
      wizardCore.handleTypeDetection.mockResolvedValue({});
      wizardCore.handleConfigurationGeneration.mockResolvedValue({
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs
      });
      wizardCore.validateWizardConfiguration.mockResolvedValue(undefined);
      wizardCore.handleFileSaving.mockResolvedValue({});

      await wizardHeadless.executeWizardFromConfig(
        addDatasourceConfig,
        mockDataplaneUrl,
        mockAuthConfig
      );

      expect(wizardCore.handleModeSelection).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        'add-datasource',
        'existing-system'
      );
      expect(wizardCore.handleConfigurationGeneration).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          mode: 'add-datasource',
          credentialIdOrKey: null,
          systemIdOrKey: 'existing-system'
        })
      );
    });

    it('should handle credential selection', async() => {
      const configWithCredential = {
        ...mockWizardConfig,
        credential: {
          action: 'select',
          credentialIdOrKey: 'my-credential'
        }
      };
      wizardCore.handleModeSelection.mockResolvedValue({
        sessionId: 'session-123'
      });
      wizardCore.handleSourceSelection.mockResolvedValue({
        sourceType: 'openapi-file',
        sourceData: './openapi.yaml'
      });
      wizardCore.handleOpenApiParsing.mockResolvedValue({});
      wizardCore.handleCredentialSelection.mockResolvedValue('my-credential');
      wizardCore.handleTypeDetection.mockResolvedValue({});
      wizardCore.handleConfigurationGeneration.mockResolvedValue({
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs
      });
      wizardCore.validateWizardConfiguration.mockResolvedValue(undefined);
      wizardCore.handleFileSaving.mockResolvedValue({});

      await wizardHeadless.executeWizardFromConfig(
        configWithCredential,
        mockDataplaneUrl,
        mockAuthConfig
      );

      expect(wizardCore.handleCredentialSelection).toHaveBeenCalledWith(
        mockDataplaneUrl,
        mockAuthConfig,
        configWithCredential.credential,
        { allowRetry: false }
      );
      expect(wizardCore.handleConfigurationGeneration).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          credentialIdOrKey: 'my-credential',
          systemIdOrKey: undefined
        })
      );
    });

    it('should use appName as systemKey when systemKey not provided', async() => {
      wizardCore.handleModeSelection.mockResolvedValue({
        sessionId: 'session-123'
      });
      wizardCore.handleSourceSelection.mockResolvedValue({
        sourceType: 'openapi-file',
        sourceData: './openapi.yaml'
      });
      wizardCore.handleOpenApiParsing.mockResolvedValue({});
      wizardCore.handleCredentialSelection.mockResolvedValue(null);
      wizardCore.handleTypeDetection.mockResolvedValue({});
      wizardCore.handleConfigurationGeneration.mockResolvedValue({
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs
        // systemKey not provided
      });
      wizardCore.validateWizardConfiguration.mockResolvedValue(undefined);
      wizardCore.handleFileSaving.mockResolvedValue({});

      await wizardHeadless.executeWizardFromConfig(
        mockWizardConfig,
        mockDataplaneUrl,
        mockAuthConfig
      );

      expect(wizardCore.handleFileSaving).toHaveBeenCalledWith(
        'test-app',
        mockSystemConfig,
        mockDatasourceConfigs,
        'test-app', // Uses appName when systemKey not provided
        mockDataplaneUrl,
        mockAuthConfig
      );
    });

    it('should throw error when mode selection fails', async() => {
      wizardCore.handleModeSelection.mockRejectedValue(new Error('Session creation failed'));
      await expect(wizardHeadless.executeWizardFromConfig(
        mockWizardConfig,
        mockDataplaneUrl,
        mockAuthConfig
      )).rejects.toThrow('Session creation failed');
    });
  });

  describe('handleWizardHeadless', () => {
    const mockOptions = {
      config: './wizard.yaml',
      controller: 'https://controller.example.com',
      environment: 'dev'
    };

    it('should execute headless wizard successfully', async() => {
      wizardConfigValidator.validateWizardConfig.mockResolvedValue({
        valid: true,
        config: mockWizardConfig
      });
      wizardCore.validateAndCheckAppDirectory.mockResolvedValue(true);
      wizardCore.setupDataplaneAndAuth.mockResolvedValue({
        dataplaneUrl: mockDataplaneUrl,
        authConfig: mockAuthConfig
      });
      wizardCore.handleModeSelection.mockResolvedValue({
        sessionId: 'session-123'
      });
      wizardCore.handleSourceSelection.mockResolvedValue({
        sourceType: 'openapi-file',
        sourceData: './openapi.yaml'
      });
      wizardCore.handleOpenApiParsing.mockResolvedValue({});
      wizardCore.handleCredentialSelection.mockResolvedValue(null);
      wizardCore.handleTypeDetection.mockResolvedValue({});
      wizardCore.handleConfigurationGeneration.mockResolvedValue({
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs
      });
      wizardCore.validateWizardConfiguration.mockResolvedValue(undefined);
      wizardCore.handleFileSaving.mockResolvedValue({});

      await wizardHeadless.handleWizardHeadless(mockOptions);

      expect(wizardConfigValidator.validateWizardConfig).toHaveBeenCalledWith('./wizard.yaml');
      expect(wizardCore.validateAndCheckAppDirectory).toHaveBeenCalledWith('test-app', false);
      expect(wizardCore.setupDataplaneAndAuth).toHaveBeenCalledWith(
        expect.objectContaining({ config: './wizard.yaml' }),
        'test-app'
      );
    });

    it('should throw error when config validation fails', async() => {
      wizardConfigValidator.validateWizardConfig.mockResolvedValue({
        valid: false,
        errors: [{ message: 'Invalid app name' }]
      });
      wizardConfigValidator.displayValidationResults.mockImplementation(() => {});

      await expect(wizardHeadless.handleWizardHeadless(mockOptions))
        .rejects.toThrow('Wizard configuration validation failed');

      expect(wizardConfigValidator.displayValidationResults).toHaveBeenCalled();
    });

    it('should pass options to setupDataplaneAndAuth', async() => {
      wizardConfigValidator.validateWizardConfig.mockResolvedValue({
        valid: true,
        config: mockWizardConfig
      });
      wizardCore.validateAndCheckAppDirectory.mockResolvedValue(true);
      wizardCore.setupDataplaneAndAuth.mockResolvedValue({
        dataplaneUrl: mockDataplaneUrl,
        authConfig: mockAuthConfig
      });
      wizardCore.handleModeSelection.mockResolvedValue({ sessionId: 'session-123' });
      wizardCore.handleSourceSelection.mockResolvedValue({
        sourceType: 'openapi-file',
        sourceData: './openapi.yaml'
      });
      wizardCore.handleOpenApiParsing.mockResolvedValue({});
      wizardCore.handleCredentialSelection.mockResolvedValue(null);
      wizardCore.handleTypeDetection.mockResolvedValue({});
      wizardCore.handleConfigurationGeneration.mockResolvedValue({
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs
      });
      wizardCore.validateWizardConfiguration.mockResolvedValue(undefined);
      wizardCore.handleFileSaving.mockResolvedValue({});

      await wizardHeadless.handleWizardHeadless({
        config: './wizard.yaml',
        environment: 'dev'
      });

      expect(wizardCore.setupDataplaneAndAuth).toHaveBeenCalledWith(
        expect.objectContaining({ config: './wizard.yaml', environment: 'dev' }),
        'test-app'
      );
    });

    it('should use default environment when not provided', async() => {
      wizardConfigValidator.validateWizardConfig.mockResolvedValue({
        valid: true,
        config: mockWizardConfig
      });
      wizardCore.validateAndCheckAppDirectory.mockResolvedValue(true);
      wizardCore.setupDataplaneAndAuth.mockResolvedValue({
        dataplaneUrl: mockDataplaneUrl,
        authConfig: mockAuthConfig
      });
      wizardCore.handleModeSelection.mockResolvedValue({ sessionId: 'session-123' });
      wizardCore.handleSourceSelection.mockResolvedValue({
        sourceType: 'openapi-file',
        sourceData: './openapi.yaml'
      });
      wizardCore.handleOpenApiParsing.mockResolvedValue({});
      wizardCore.handleCredentialSelection.mockResolvedValue(null);
      wizardCore.handleTypeDetection.mockResolvedValue({});
      wizardCore.handleConfigurationGeneration.mockResolvedValue({
        systemConfig: mockSystemConfig,
        datasourceConfigs: mockDatasourceConfigs
      });
      wizardCore.validateWizardConfiguration.mockResolvedValue(undefined);
      wizardCore.handleFileSaving.mockResolvedValue({});

      await wizardHeadless.handleWizardHeadless({
        config: './wizard.yaml'
        // No environment provided; setupDataplaneAndAuth uses resolveEnvironment() from config
      });

      expect(wizardCore.setupDataplaneAndAuth).toHaveBeenCalledWith(
        expect.objectContaining({ config: './wizard.yaml' }),
        'test-app'
      );
    });

    it('should return early when directory validation fails', async() => {
      wizardConfigValidator.validateWizardConfig.mockResolvedValue({
        valid: true,
        config: mockWizardConfig
      });
      wizardCore.validateAndCheckAppDirectory.mockResolvedValue(false);

      await wizardHeadless.handleWizardHeadless(mockOptions);

      expect(wizardCore.setupDataplaneAndAuth).not.toHaveBeenCalled();
    });

    it('should throw error when setup fails', async() => {
      wizardConfigValidator.validateWizardConfig.mockResolvedValue({
        valid: true,
        config: mockWizardConfig
      });
      wizardCore.validateAndCheckAppDirectory.mockResolvedValue(true);
      wizardCore.setupDataplaneAndAuth.mockRejectedValue(new Error('Setup failed'));

      await expect(wizardHeadless.handleWizardHeadless(mockOptions))
        .rejects.toThrow('Setup failed');
    });
  });
});
