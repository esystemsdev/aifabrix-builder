/**
 * Tests for Wizard API
 *
 * @fileoverview Tests for lib/api/wizard.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock ApiClient before requiring wizard.api
const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => {
  return {
    baseUrl,
    authConfig,
    get: mockClient.get,
    post: mockClient.post,
    put: mockClient.put,
    delete: mockClient.delete
  };
});

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

// Mock file upload utility
const mockUploadFile = jest.fn();
jest.mock('../../../lib/utils/file-upload', () => ({
  uploadFile: mockUploadFile
}));

const wizardApi = require('../../../lib/api/wizard.api');

describe('Wizard API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockResolvedValue({ success: true, data: {} });
    mockClient.get.mockResolvedValue({ success: true, data: {} });
    mockClient.put.mockResolvedValue({ success: true, data: {} });
    mockClient.delete.mockResolvedValue({ success: true, data: {} });
    mockUploadFile.mockResolvedValue({ success: true, data: {} });
  });

  describe('createWizardSession', () => {
    it('should create wizard session', async() => {
      const result = await wizardApi.createWizardSession(dataplaneUrl, authConfig, 'create-system');

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/sessions', {
        body: { mode: 'create-system' }
      });
      expect(result.success).toBe(true);
    });

    it('should handle add-datasource mode with systemIdOrKey', async() => {
      await wizardApi.createWizardSession(dataplaneUrl, authConfig, 'add-datasource', 'system-123');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/sessions', {
        body: { mode: 'add-datasource', systemIdOrKey: 'system-123' }
      });
    });
  });

  describe('getWizardSession', () => {
    it('should get wizard session', async() => {
      mockClient.get.mockResolvedValue({ success: true, data: { sessionId: 'session-123' } });
      const result = await wizardApi.getWizardSession(dataplaneUrl, 'session-123', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/sessions/session-123');
      expect(result.success).toBe(true);
    });
  });

  describe('updateWizardSession', () => {
    it('should update wizard session', async() => {
      mockClient.put.mockResolvedValue({ success: true, data: {} });
      const updateData = { currentStep: 1, selectedType: 'rest-api' };

      await wizardApi.updateWizardSession(dataplaneUrl, 'session-123', authConfig, updateData);

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/wizard/sessions/session-123', {
        body: updateData
      });
    });
  });

  describe('deleteWizardSession', () => {
    it('should delete wizard session', async() => {
      mockClient.delete.mockResolvedValue({ success: true });
      const result = await wizardApi.deleteWizardSession(dataplaneUrl, 'session-123', authConfig);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/wizard/sessions/session-123');
      expect(result.success).toBe(true);
    });
  });

  describe('getWizardProgress', () => {
    it('should get wizard session progress', async() => {
      const mockProgress = {
        success: true,
        data: { currentStep: 3, totalSteps: 7, canProceed: true }
      };
      mockClient.get.mockResolvedValue(mockProgress);
      const result = await wizardApi.getWizardProgress(dataplaneUrl, 'session-123', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/sessions/session-123/progress');
      expect(result.data.currentStep).toBe(3);
    });
  });

  describe('getWizardPlatforms', () => {
    it('should return platforms array when API returns platforms', async() => {
      const platforms = [{ key: 'hubspot', displayName: 'HubSpot' }, { key: 'salesforce' }];
      mockClient.get.mockResolvedValue({ data: { platforms } });
      const result = await wizardApi.getWizardPlatforms(dataplaneUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/platforms');
      expect(result).toEqual(platforms);
    });

    it('should return empty array on 404 or API error', async() => {
      mockClient.get.mockRejectedValue(new Error('Not Found'));
      const result = await wizardApi.getWizardPlatforms(dataplaneUrl, authConfig);

      expect(result).toEqual([]);
    });

    it('should return empty array when response has no platforms', async() => {
      mockClient.get.mockResolvedValue({ data: {} });
      const result = await wizardApi.getWizardPlatforms(dataplaneUrl, authConfig);

      expect(result).toEqual([]);
    });

    it('should accept response.platforms at top level', async() => {
      const platforms = [{ key: 'zendesk' }];
      mockClient.get.mockResolvedValue({ platforms });
      const result = await wizardApi.getWizardPlatforms(dataplaneUrl, authConfig);

      expect(result).toEqual(platforms);
    });
  });

  describe('parseOpenApi', () => {
    it('should parse OpenAPI file using file upload', async() => {
      const filePath = '/path/to/openapi.yaml';
      await wizardApi.parseOpenApi(dataplaneUrl, authConfig, filePath, false);

      expect(mockUploadFile).toHaveBeenCalledWith(
        'https://dataplane.example.com/api/v1/wizard/parse-openapi',
        filePath,
        'file',
        authConfig
      );
    });

    it('should parse OpenAPI from URL', async() => {
      const url = 'https://api.example.com/openapi.json';
      await wizardApi.parseOpenApi(dataplaneUrl, authConfig, url, true);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/wizard/parse-openapi?url=${encodeURIComponent(url)}`
      );
    });

    it('should handle dataplane URL with trailing slash', async() => {
      const urlWithSlash = 'https://dataplane.example.com/';
      await wizardApi.parseOpenApi(urlWithSlash, authConfig, '/path/to/file.yaml', false);

      expect(mockUploadFile).toHaveBeenCalledWith(
        'https://dataplane.example.com/api/v1/wizard/parse-openapi',
        '/path/to/file.yaml',
        'file',
        authConfig
      );
    });
  });

  describe('credentialSelection', () => {
    it('should select existing credential', async() => {
      const selectionData = {
        action: 'select',
        credentialIdOrKey: 'my-credential'
      };
      await wizardApi.credentialSelection(dataplaneUrl, authConfig, selectionData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/credential-selection', {
        body: selectionData
      });
    });

    it('should create new credential', async() => {
      const selectionData = {
        action: 'create',
        credentialConfig: {
          key: 'new-credential',
          displayName: 'New Credential',
          type: 'OAUTH2',
          config: { clientId: 'test' }
        }
      };
      await wizardApi.credentialSelection(dataplaneUrl, authConfig, selectionData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/credential-selection', {
        body: selectionData
      });
    });

    it('should skip credential selection', async() => {
      const selectionData = { action: 'skip' };
      await wizardApi.credentialSelection(dataplaneUrl, authConfig, selectionData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/credential-selection', {
        body: { action: 'skip' }
      });
    });
  });

  describe('detectType', () => {
    it('should detect API type from OpenAPI spec', async() => {
      const openapiSpec = { openapi: '3.0.0', info: { title: 'Test API' } };
      await wizardApi.detectType(dataplaneUrl, authConfig, openapiSpec);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/detect-type', {
        body: { openapiSpec }
      });
    });
  });

  describe('generateConfig', () => {
    it('should generate configuration with all options', async() => {
      const config = {
        openapiSpec: { openapi: '3.0.0' },
        detectedType: 'record-based',
        intent: 'sales-focused CRM integration',
        mode: 'create-system',
        fieldOnboardingLevel: 'full',
        enableOpenAPIGeneration: true,
        userPreferences: { enableMCP: true, enableABAC: false, enableRBAC: true }
      };

      await wizardApi.generateConfig(dataplaneUrl, authConfig, config);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/generate-config', {
        body: config
      });
    });

    it('should generate configuration for add-datasource mode', async() => {
      const config = {
        openapiSpec: { openapi: '3.0.0' },
        detectedType: 'record-based',
        intent: 'contact management',
        mode: 'add-datasource',
        systemIdOrKey: 'existing-system',
        credentialIdOrKey: 'existing-credential'
      };

      await wizardApi.generateConfig(dataplaneUrl, authConfig, config);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/generate-config', {
        body: config
      });
    });
  });

  describe('generateConfigStream', () => {
    it('should generate configuration via streaming endpoint', async() => {
      const config = {
        openapiSpec: { openapi: '3.0.0' },
        detectedType: 'record-based',
        intent: 'sales-focused CRM integration',
        mode: 'create-system'
      };

      await wizardApi.generateConfigStream(dataplaneUrl, authConfig, config);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/generate-config-stream', {
        body: config
      });
    });
  });

  describe('validateWizardConfig', () => {
    it('should validate system and datasource configs', async() => {
      const systemConfig = { key: 'test-system', displayName: 'Test System' };
      const datasourceConfig = { key: 'ds1', systemKey: 'test-system' };

      await wizardApi.validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/validate', {
        body: {
          systemConfig,
          datasourceConfig
        }
      });
    });

    it('should validate with array of datasource configs', async() => {
      const systemConfig = { key: 'test-system' };
      const datasourceConfigs = [
        { key: 'ds1', systemKey: 'test-system' },
        { key: 'ds2', systemKey: 'test-system' }
      ];

      await wizardApi.validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/validate', {
        body: {
          systemConfig,
          datasourceConfig: datasourceConfigs
        }
      });
    });
  });

  describe('validateAllSteps', () => {
    it('should validate all completed wizard steps', async() => {
      const mockValidation = {
        success: true,
        data: { isValid: true, errors: [], warnings: [] }
      };
      mockClient.get.mockResolvedValue(mockValidation);

      const result = await wizardApi.validateAllSteps(dataplaneUrl, 'session-123', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/sessions/session-123/validate');
      expect(result.data.isValid).toBe(true);
    });
  });

  describe('validateStep', () => {
    it('should validate specific wizard step', async() => {
      const mockValidation = {
        success: true,
        data: { step: 3, isValid: true, canProceed: true }
      };
      mockClient.post.mockResolvedValue(mockValidation);

      const result = await wizardApi.validateStep(dataplaneUrl, 'session-123', authConfig, 3);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/sessions/session-123/validate-step?step=3');
      expect(result.data.step).toBe(3);
    });
  });

  describe('getPreview', () => {
    it('should get configuration preview', async() => {
      const mockPreview = {
        success: true,
        data: {
          systemConfig: { key: 'test-system' },
          datasourceConfig: { key: 'test-ds' },
          systemSummary: { key: 'test-system', endpointCount: 10 }
        }
      };
      mockClient.get.mockResolvedValue(mockPreview);

      const result = await wizardApi.getPreview(dataplaneUrl, 'session-123', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/preview/session-123');
      expect(result.data.systemSummary.endpointCount).toBe(10);
    });
  });

  describe('testMcpConnection', () => {
    it('should test MCP server connection', async() => {
      const serverUrl = 'https://mcp.example.com';
      const token = 'mcp-token-123';

      await wizardApi.testMcpConnection(dataplaneUrl, authConfig, serverUrl, token);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/test-mcp-connection', {
        body: {
          serverUrl,
          token
        }
      });
    });
  });

  describe('getDeploymentDocs', () => {
    it('should get deployment documentation', async() => {
      const systemKey = 'hubspot';
      const mockResponse = {
        success: true,
        data: {
          systemKey: 'hubspot',
          content: '# HubSpot Deployment\n\nThis is the deployment documentation.',
          contentType: 'text/markdown'
        }
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = await wizardApi.getDeploymentDocs(dataplaneUrl, authConfig, systemKey);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/deployment-docs/hubspot');
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when getting deployment docs', async() => {
      const systemKey = 'hubspot';
      const errorResponse = {
        success: false,
        error: 'System not found',
        formattedError: 'System hubspot not found'
      };
      mockClient.get.mockResolvedValue(errorResponse);

      const result = await wizardApi.getDeploymentDocs(dataplaneUrl, authConfig, systemKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('System not found');
    });
  });

  describe('postDeploymentDocs', () => {
    it('should POST deployment docs with variablesYaml and deployJson for better README quality', async() => {
      const systemKey = 'hubspot';
      const body = {
        variablesYaml: 'app:\n  key: hubspot\n',
        deployJson: { key: 'hubspot', system: {}, dataSources: [] }
      };
      const mockResponse = {
        success: true,
        data: {
          systemKey: 'hubspot',
          content: '# HubSpot Deployment\n\nGenerated from variables and deploy JSON.',
          contentType: 'text/markdown'
        }
      };
      mockClient.post.mockResolvedValue(mockResponse);

      const result = await wizardApi.postDeploymentDocs(dataplaneUrl, authConfig, systemKey, body);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/wizard/deployment-docs/hubspot',
        expect.objectContaining({ body })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should accept null body (empty object sent)', async() => {
      mockClient.post.mockResolvedValue({ success: true, data: { content: '# Docs' } });
      await wizardApi.postDeploymentDocs(dataplaneUrl, authConfig, 'my-system', null);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/wizard/deployment-docs/my-system',
        expect.objectContaining({ body: {} })
      );
    });
  });

  describe('listWizardCredentials', () => {
    it('should list wizard credentials without options', async() => {
      mockClient.get.mockResolvedValue({ success: true, data: { credentials: [{ key: 'c1', displayName: 'Cred 1' }] } });

      const result = await wizardApi.listWizardCredentials(dataplaneUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/credentials', { params: {} });
      expect(result.data.credentials).toHaveLength(1);
      expect(result.data.credentials[0].key).toBe('c1');
    });

    it('should list wizard credentials with activeOnly', async() => {
      mockClient.get.mockResolvedValue({ success: true, data: { credentials: [] } });

      await wizardApi.listWizardCredentials(dataplaneUrl, authConfig, { activeOnly: true });

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/wizard/credentials', {
        params: { activeOnly: true }
      });
    });

    it('should handle listWizardCredentials errors', async() => {
      mockClient.get.mockRejectedValue(new Error('List credentials failed'));

      await expect(wizardApi.listWizardCredentials(dataplaneUrl, authConfig)).rejects.toThrow(
        'List credentials failed'
      );
    });
  });

  describe('error handling', () => {
    it('should propagate API errors', async() => {
      const errorResponse = {
        success: false,
        error: 'API error',
        formattedError: 'Formatted API error'
      };
      mockClient.post.mockResolvedValue(errorResponse);

      const result = await wizardApi.createWizardSession(dataplaneUrl, authConfig, 'create-system');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });

    it('should propagate file upload errors', async() => {
      const errorResponse = {
        success: false,
        error: 'File upload failed'
      };
      mockUploadFile.mockResolvedValue(errorResponse);

      const result = await wizardApi.parseOpenApi(dataplaneUrl, authConfig, '/path/to/file.yaml', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File upload failed');
    });
  });
});
