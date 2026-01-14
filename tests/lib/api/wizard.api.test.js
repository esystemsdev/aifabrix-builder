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
  post: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => {
  return {
    baseUrl,
    authConfig,
    get: mockClient.get,
    post: mockClient.post
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
    mockUploadFile.mockResolvedValue({ success: true, data: {} });
  });

  describe('selectMode', () => {
    it('should select wizard mode', async() => {
      const result = await wizardApi.selectMode(dataplaneUrl, authConfig, 'create-system');

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/mode-selection', {
        body: { mode: 'create-system' }
      });
      expect(result.success).toBe(true);
    });

    it('should handle add-datasource mode', async() => {
      await wizardApi.selectMode(dataplaneUrl, authConfig, 'add-datasource');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/mode-selection', {
        body: { mode: 'add-datasource' }
      });
    });
  });

  describe('selectSource', () => {
    it('should select source type with source data', async() => {
      await wizardApi.selectSource(dataplaneUrl, authConfig, 'openapi-file', '/path/to/file.yaml');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/source-selection', {
        body: {
          sourceType: 'openapi-file',
          sourceData: '/path/to/file.yaml'
        }
      });
    });

    it('should select source type without source data', async() => {
      await wizardApi.selectSource(dataplaneUrl, authConfig, 'known-platform');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/source-selection', {
        body: {
          sourceType: 'known-platform',
          sourceData: undefined
        }
      });
    });
  });

  describe('parseOpenApi', () => {
    it('should parse OpenAPI file using file upload', async() => {
      const filePath = '/path/to/openapi.yaml';
      await wizardApi.parseOpenApi(dataplaneUrl, authConfig, filePath);

      expect(mockUploadFile).toHaveBeenCalledWith(
        'https://dataplane.example.com/api/v1/wizard/parse-openapi',
        filePath,
        'file',
        authConfig
      );
    });

    it('should handle dataplane URL with trailing slash', async() => {
      const urlWithSlash = 'https://dataplane.example.com/';
      await wizardApi.parseOpenApi(urlWithSlash, authConfig, '/path/to/file.yaml');

      expect(mockUploadFile).toHaveBeenCalledWith(
        'https://dataplane.example.com/api/v1/wizard/parse-openapi',
        '/path/to/file.yaml',
        'file',
        authConfig
      );
    });
  });

  describe('detectType', () => {
    it('should detect API type from OpenAPI spec', async() => {
      const openApiSpec = { openapi: '3.0.0', info: { title: 'Test API' } };
      await wizardApi.detectType(dataplaneUrl, authConfig, openApiSpec);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/detect-type', {
        body: { openApiSpec }
      });
    });
  });

  describe('generateConfig', () => {
    it('should generate configuration with all options', async() => {
      const config = {
        mode: 'create-system',
        sourceType: 'openapi-file',
        openApiSpec: { openapi: '3.0.0' },
        userIntent: 'sales-focused',
        preferences: { mcp: true, abac: false, rbac: true }
      };

      await wizardApi.generateConfig(dataplaneUrl, authConfig, config);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/generate-config', {
        body: config
      });
    });

    it('should generate configuration with minimal options', async() => {
      const config = {
        mode: 'create-system',
        sourceType: 'known-platform'
      };

      await wizardApi.generateConfig(dataplaneUrl, authConfig, config);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/generate-config', {
        body: config
      });
    });
  });

  describe('validateWizardConfig', () => {
    it('should validate system and datasource configs', async() => {
      const systemConfig = { key: 'test-system', displayName: 'Test System' };
      const datasourceConfigs = [
        { key: 'ds1', systemKey: 'test-system' },
        { key: 'ds2', systemKey: 'test-system' }
      ];

      await wizardApi.validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/validate', {
        body: {
          systemConfig,
          datasourceConfigs
        }
      });
    });

    it('should validate with empty datasource configs', async() => {
      const systemConfig = { key: 'test-system' };
      const datasourceConfigs = [];

      await wizardApi.validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/wizard/validate', {
        body: {
          systemConfig,
          datasourceConfigs: []
        }
      });
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

  describe('error handling', () => {
    it('should propagate API errors', async() => {
      const errorResponse = {
        success: false,
        error: 'API error',
        formattedError: 'Formatted API error'
      };
      mockClient.post.mockResolvedValue(errorResponse);

      const result = await wizardApi.selectMode(dataplaneUrl, authConfig, 'create-system');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });

    it('should propagate file upload errors', async() => {
      const errorResponse = {
        success: false,
        error: 'File upload failed'
      };
      mockUploadFile.mockResolvedValue(errorResponse);

      const result = await wizardApi.parseOpenApi(dataplaneUrl, authConfig, '/path/to/file.yaml');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File upload failed');
    });
  });
});

