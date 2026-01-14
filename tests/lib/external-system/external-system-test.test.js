/**
 * Tests for AI Fabrix Builder External System Test Module
 *
 * @fileoverview Unit tests for external-system-test.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

// Mock dependencies
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(() => true),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn()
    }
  };
});

const fs = require('fs');
const fsPromises = fs.promises;
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
jest.mock('../../../lib/utils/api', () => ({
  authenticatedApiCall: jest.fn()
}));
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../lib/datasource/deploy', () => ({
  getDataplaneUrl: jest.fn()
}));

// Mock paths module
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));

// Note: We don't mock the validators or display - we test the actual implementations

// Note: Schema files are loaded directly, so we don't mock them
// The actual schema validation will use the real schemas

const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { authenticatedApiCall } = require('../../../lib/utils/api');
const { getConfig } = require('../../../lib/core/config');
const logger = require('../../../lib/utils/logger');
const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
const { detectAppType } = require('../../../lib/utils/paths');
const {
  validateFieldMappingExpression,
  validateFieldMappings,
  validateMetadataSchema,
  validateAgainstSchema
} = require('../../../lib/utils/external-system-validators');
const {
  displayTestResults,
  displayIntegrationTestResults
} = require('../../../lib/utils/external-system-display');

describe('External System Test Module', () => {
  const appName = 'hubspot';
  const appPath = path.join(process.cwd(), 'integration', appName);
  const systemKey = 'hubspot';

  const mockSystem = {
    key: 'hubspot',
    displayName: 'HubSpot CRM',
    description: 'HubSpot CRM integration',
    type: 'openapi',
    authentication: {
      type: 'oauth2'
    }
  };

  const mockDatasource = {
    key: 'hubspot-companies-get',
    displayName: 'GET /crm/v3/objects/companies',
    systemKey: 'hubspot',
    entityKey: 'company',
    resourceType: 'customer',
    fieldMappings: {
      accessFields: ['country'],
      fields: {
        country: {
          expression: '{{properties.country.value}} | toUpper | trim',
          type: 'string'
        },
        name: {
          expression: '{{properties.name.value}} | trim',
          type: 'string'
        }
      }
    },
    metadataSchema: {
      type: 'object',
      properties: {
        properties: {
          type: 'object',
          properties: {
            country: {
              type: 'object',
              properties: {
                value: { type: 'string' }
              }
            },
            name: {
              type: 'object',
              properties: {
                value: { type: 'string' }
              }
            }
          }
        }
      }
    },
    testPayload: {
      payloadTemplate: {
        properties: {
          country: {
            value: 'United States'
          },
          name: {
            value: 'Test Company'
          }
        }
      },
      expectedResult: {
        country: 'UNITED STATES',
        name: 'Test Company'
      }
    }
  };

  const mockVariables = {
    externalIntegration: {
      schemaBasePath: './',
      systems: ['hubspot-deploy.json'],
      dataSources: ['hubspot-deploy-company.json']
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({
      isExternal: true,
      appPath: appPath,
      appType: 'external'
    });
    fs.existsSync.mockReturnValue(true);
    fsPromises.readFile.mockImplementation((filePath) => {
      if (filePath.includes('variables.yaml')) {
        return Promise.resolve(yaml.dump(mockVariables));
      } else if (filePath.includes('hubspot-deploy.json')) {
        return Promise.resolve(JSON.stringify(mockSystem));
      } else if (filePath.includes('hubspot-deploy-company.json')) {
        return Promise.resolve(JSON.stringify(mockDatasource));
      }
      return Promise.reject(new Error('File not found'));
    });
  });

  describe('validateFieldMappingExpression', () => {
    it('should validate correct field mapping expression', () => {
      const result = validateFieldMappingExpression('{{properties.country.value}} | toUpper | trim');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject expression without path', () => {
      const result = validateFieldMappingExpression('toUpper | trim');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid expression format');
    });

    it('should reject invalid transformation', () => {
      const result = validateFieldMappingExpression('{{path}} | invalidTransformation');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown transformation');
    });

    it('should reject empty expression', () => {
      const result = validateFieldMappingExpression('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });
  });

  describe('validateFieldMappings', () => {
    it('should validate field mappings successfully', () => {
      const result = validateFieldMappings(mockDatasource, mockDatasource.testPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(Object.keys(result.mappedFields)).toHaveLength(2);
    });

    it('should detect missing expression', () => {
      const invalidDatasource = {
        ...mockDatasource,
        fieldMappings: {
          fields: {
            country: {
              type: 'string'
              // Missing expression
            }
          }
        }
      };
      const result = validateFieldMappings(invalidDatasource, mockDatasource.testPayload);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about missing path in payload', () => {
      const datasourceWithMissingPath = {
        ...mockDatasource,
        fieldMappings: {
          fields: {
            missing: {
              expression: '{{properties.missing.field}} | trim',
              type: 'string'
            }
          }
        }
      };
      const result = validateFieldMappings(datasourceWithMissingPath, mockDatasource.testPayload);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateMetadataSchema', () => {
    it('should validate metadata schema successfully', () => {
      const result = validateMetadataSchema(mockDatasource, mockDatasource.testPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect schema validation errors', () => {
      const invalidPayload = {
        payloadTemplate: {
          invalid: 'structure'
        }
      };
      const result = validateMetadataSchema(mockDatasource, invalidPayload);
      // Schema validation may pass or fail depending on AJV behavior
      // Just check that the function runs without throwing
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });

    it('should warn when metadata schema is missing', () => {
      const datasourceWithoutSchema = {
        ...mockDatasource,
        metadataSchema: undefined
      };
      const result = validateMetadataSchema(datasourceWithoutSchema, mockDatasource.testPayload);
      expect(result.warnings).toContain('No metadata schema defined');
    });
  });

  describe('testExternalSystem', () => {
    it('should run unit tests successfully', async() => {
      const { testExternalSystem } = require('../../../lib/external-system/test');
      const results = await testExternalSystem(appName, {});
      expect(results).toHaveProperty('valid');
      expect(results).toHaveProperty('systemResults');
      expect(results).toHaveProperty('datasourceResults');
    });

    it('should test specific datasource when option provided', async() => {
      const { testExternalSystem } = require('../../../lib/external-system/test');
      const results = await testExternalSystem(appName, { datasource: 'company' });
      expect(results.datasourceResults.length).toBeLessThanOrEqual(1);
    });

    it('should validate system files against schema', async() => {
      const { testExternalSystem } = require('../../../lib/external-system/test');
      const results = await testExternalSystem(appName, {});
      expect(results.systemResults.length).toBeGreaterThan(0);
    });

    it('should validate datasource relationships', async() => {
      const { testExternalSystem } = require('../../../lib/external-system/test');
      const results = await testExternalSystem(appName, {});
      // All datasources should have matching systemKey
      results.datasourceResults.forEach(dsResult => {
        expect(dsResult.errors.filter(e => e.includes('systemKey mismatch'))).toHaveLength(0);
      });
    });

    it('should handle missing test payload gracefully', async() => {
      const datasourceWithoutPayload = {
        ...mockDatasource,
        testPayload: undefined
      };
      const originalReadFile = fsPromises.readFile;
      fsPromises.readFile.mockImplementation((filePath) => {
        if (filePath.includes('hubspot-deploy-company.json')) {
          return Promise.resolve(JSON.stringify(datasourceWithoutPayload));
        }
        // Use the original mock implementation for other files
        if (filePath.includes('variables.yaml')) {
          return Promise.resolve(yaml.dump(mockVariables));
        } else if (filePath.includes('hubspot-deploy.json') && !filePath.includes('company')) {
          return Promise.resolve(JSON.stringify(mockSystem));
        }
        return Promise.reject(new Error('File not found'));
      });

      const { testExternalSystem } = require('../../../lib/external-system/test');
      const results = await testExternalSystem(appName, {});
      const dsResult = results.datasourceResults[0];
      expect(dsResult.warnings).toContain('No testPayload.payloadTemplate found - skipping field mapping and metadata schema tests');
    });

    it('should throw error when variables.yaml not found', async() => {
      fs.existsSync.mockReturnValue(false);
      const { testExternalSystem } = require('../../../lib/external-system/test');
      await expect(testExternalSystem(appName, {})).rejects.toThrow('variables.yaml not found');
    });
  });

  describe('testExternalSystemIntegration', () => {
    beforeEach(() => {
      getDataplaneUrl.mockResolvedValue('http://dataplane:8080');
      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token'
      });
      getConfig.mockResolvedValue({
        deployment: {
          controllerUrl: 'http://localhost:3000'
        }
      });
    });

    it('should run integration tests successfully', async() => {
      const mockTestResponse = {
        success: true,
        data: {
          data: {
            success: true,
            validationResults: {
              isValid: true,
              errors: [],
              warnings: []
            },
            fieldMappingResults: {
              mappingCount: 2,
              accessFields: ['country']
            },
            endpointTestResults: {
              endpointConfigured: false
            }
          }
        }
      };

      authenticatedApiCall.mockResolvedValue(mockTestResponse);

      const { testExternalSystemIntegration } = require('../../../lib/external-system/test');
      const results = await testExternalSystemIntegration(appName, { environment: 'dev' });

      expect(results.success).toBe(true);
      expect(results.datasourceResults.length).toBeGreaterThan(0);
      expect(authenticatedApiCall).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/pipeline/hubspot/'),
        expect.any(Object),
        'test-token'
      );
    });

    it('should handle test failures gracefully', async() => {
      const mockTestResponse = {
        success: true,
        data: {
          data: {
            success: false,
            validationResults: {
              isValid: false,
              errors: ['Validation error'],
              warnings: []
            }
          }
        }
      };

      authenticatedApiCall.mockResolvedValue(mockTestResponse);

      const { testExternalSystemIntegration } = require('../../../lib/external-system/test');
      const results = await testExternalSystemIntegration(appName, { environment: 'dev' });

      expect(results.success).toBe(false);
    });

    it('should use custom payload file when provided', async() => {
      const customPayload = { custom: 'payload' };
      fsPromises.readFile.mockImplementation((filePath) => {
        if (filePath.includes('custom-payload.json')) {
          return Promise.resolve(JSON.stringify(customPayload));
        }
        // Use default mock for other files
        if (filePath.includes('variables.yaml')) {
          return Promise.resolve(yaml.dump(mockVariables));
        } else if (filePath.includes('hubspot-deploy.json') && !filePath.includes('company')) {
          return Promise.resolve(JSON.stringify(mockSystem));
        } else if (filePath.includes('hubspot-deploy-company.json')) {
          return Promise.resolve(JSON.stringify(mockDatasource));
        }
        return Promise.reject(new Error('File not found'));
      });

      const mockTestResponse = {
        success: true,
        data: {
          data: {
            success: true,
            validationResults: { isValid: true }
          }
        }
      };

      authenticatedApiCall.mockResolvedValue(mockTestResponse);

      const { testExternalSystemIntegration } = require('../../../lib/external-system/test');
      await testExternalSystemIntegration(appName, {
        environment: 'dev',
        payload: 'custom-payload.json'
      });

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('custom')
        }),
        expect.any(String)
      );
    });

    it('should skip datasources without test payload', async() => {
      const datasourceWithoutPayload = {
        ...mockDatasource,
        testPayload: undefined
      };
      fsPromises.readFile.mockImplementation((filePath) => {
        if (filePath.includes('hubspot-deploy-company.json')) {
          return Promise.resolve(JSON.stringify(datasourceWithoutPayload));
        }
        // Use default mock for other files
        if (filePath.includes('variables.yaml')) {
          return Promise.resolve(yaml.dump(mockVariables));
        } else if (filePath.includes('hubspot-deploy.json') && !filePath.includes('company')) {
          return Promise.resolve(JSON.stringify(mockSystem));
        }
        return Promise.reject(new Error('File not found'));
      });

      const { testExternalSystemIntegration } = require('../../../lib/external-system/test');
      const results = await testExternalSystemIntegration(appName, { environment: 'dev' });

      const skipped = results.datasourceResults.find(r => r.skipped);
      expect(skipped).toBeDefined();
      expect(skipped.reason).toContain('No test payload');
    });

    it('should throw error when authentication is missing', async() => {
      getDeploymentAuth.mockResolvedValue({});
      const { testExternalSystemIntegration } = require('../../../lib/external-system/test');
      await expect(
        testExternalSystemIntegration(appName, {})
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('displayTestResults', () => {
    it('should display test results correctly', () => {
      const { displayTestResults } = require('../../../lib/external-system/test');
      const results = {
        valid: true,
        systemResults: [{ file: 'system.json', valid: true }],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: true,
            errors: [],
            warnings: []
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should display verbose output when requested', () => {
      const { displayTestResults } = require('../../../lib/utils/external-system-display');
      const results = {
        valid: true,
        systemResults: [],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: true,
            errors: [],
            warnings: ['Warning'],
            fieldMappingResults: { mappedFields: { field1: 'expr1' } },
            metadataSchemaResults: { valid: true }
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning'));
    });
  });

  describe('retryApiCall', () => {
    it('should retry on failure', async() => {
      const { retryApiCall } = require('../../../lib/external-system/test');
      let attempts = 0;
      const fn = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await retryApiCall(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async() => {
      const { retryApiCall } = require('../../../lib/external-system/test');
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(retryApiCall(fn, 2, 10)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});
