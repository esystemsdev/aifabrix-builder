/**
 * Tests for AI Fabrix Builder External System Download Module
 *
 * @fileoverview Unit tests for external-system-download.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');
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
      access: jest.fn(),
      rm: jest.fn(),
      copyFile: jest.fn()
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
jest.mock('../../../lib/api/external-systems.api', () => ({
  getExternalSystemConfig: jest.fn()
}));
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://localhost:3000')
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn().mockResolvedValue('http://dataplane:8080')
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock paths module
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  getProjectRoot: jest.fn(() => process.cwd())
}));

const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { getExternalSystemConfig } = require('../../../lib/api/external-systems.api');
const { getConfig } = require('../../../lib/core/config');
const logger = require('../../../lib/utils/logger');
const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
const { detectAppType } = require('../../../lib/utils/paths');

describe('External System Download Module', () => {
  const systemKey = 'hubspot';
  const appPath = path.join(process.cwd(), 'integration', systemKey);
  const tempDir = path.join(os.tmpdir(), `aifabrix-download-${systemKey}-123456`);

  const mockApplication = {
    key: 'hubspot',
    displayName: 'HubSpot CRM',
    description: 'HubSpot CRM integration',
    type: 'openapi',
    enabled: true,
    authentication: {
      type: 'oauth2',
      mode: 'oauth2',
      oauth2: {
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
        clientId: '{{CLIENT_ID}}',
        clientSecret: '{{CLIENT_SECRET}}',
        scopes: ['crm.objects.companies.read']
      }
    }
  };

  const mockDataSource1 = {
    key: 'hubspot-companies-get',
    displayName: 'GET /crm/v3/objects/companies',
    systemKey: 'hubspot',
    entityKey: 'company',
    resourceType: 'customer',
    fieldMappings: {
      dimensions: ['country'],
      fields: {
        country: {
          expression: '{{properties.country.value}} | toUpper | trim',
          type: 'string'
        }
      }
    }
  };

  const mockDataSource2 = {
    key: 'hubspot-contacts-get',
    displayName: 'GET /crm/v3/objects/contacts',
    systemKey: 'hubspot',
    entityKey: 'contact',
    resourceType: 'contact',
    fieldMappings: {
      dimensions: ['email'],
      fields: {
        email: {
          expression: '{{properties.email.value}} | trim',
          type: 'string'
        }
      }
    }
  };

  const mockDownloadResponse = {
    success: true,
    data: {
      data: {
        application: mockApplication,
        dataSources: [mockDataSource1, mockDataSource2]
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
    getDeploymentAuth.mockResolvedValue({
      type: 'bearer',
      token: 'test-token'
    });
    getConfig.mockResolvedValue({
      deployment: {
        controllerUrl: 'http://localhost:3000'
      }
    });
    detectAppType.mockResolvedValue({
      isExternal: true,
      appPath: appPath,
      appType: 'external'
    });
    fs.existsSync.mockImplementation((filePath) => {
      const normalizedPath = String(filePath || '').replace(/\\/g, '/');
      if (normalizedPath.includes('templates/external-system/README.md.hbs')) {
        return true;
      }
      return true; // Default to true for other files
    });
    fs.readFileSync.mockImplementation((filePath) => {
      const normalizedPath = String(filePath || '').replace(/\\/g, '/');
      if (normalizedPath.includes('templates/external-system/README.md.hbs')) {
        // Return the actual template content
        return '# {{displayName}}\n\n{{description}}\n\n## System Information\n\n- **System Key**: `{{systemKey}}`\n- **System Type**: `{{systemType}}`\n- **Datasources**: {{datasourceCount}}\n\n## Files\n\n- `variables.yaml` - Application configuration with externalIntegration block\n- `{{systemKey}}-deploy.json` - External system definition\n{{#each datasources}}\n- `{{fileName}}` - Datasource: {{displayName}}\n{{/each}}\n- `env.template` - Environment variables template\n- `application-schema.json` - Combined system + datasources for deployment\n\n## Quick Start\n\n### 1. Create External System\n\n```bash\naifabrix create {{appName}} --type external\n```\n\n### 2. Configure Authentication and Datasources\n\nEdit configuration files in `integration/{{appName}}/`:\n\n- Update authentication in `{{systemKey}}-deploy.json`\n- Configure field mappings in datasource JSON files\n\n### 3. Validate Configuration\n\n```bash\naifabrix validate {{appName}} --type external\n```\n\n### 4. Generate Deployment JSON\n\n```bash\naifabrix json {{appName}} --type external\n```\n\n### 5. Deploy to Dataplane\n\n```bash\naifabrix deploy {{appName}} --controller <url> --environment dev\n```\n\n## Testing\n\n### Unit Tests (Local Validation)\n\n```bash\naifabrix test {{appName}}\n```\n\n### Integration Tests (Via Dataplane)\n\n```bash\naifabrix test-integration {{appName}} --environment dev\n```\n\n## Deployment\n\nDeploy to dataplane via miso-controller:\n\n```bash\naifabrix deploy {{appName}} --controller <url> --environment dev\n```\n\n## Troubleshooting\n\n- **Validation errors**: Run `aifabrix validate {{appName}} --type external` to check configuration\n- **Deployment issues**: Check controller URL and authentication\n- **File not found**: Ensure you\'re in the project root directory\n';
      }
      return '';
    });
    fsPromises.mkdir.mockResolvedValue(undefined);
    fsPromises.writeFile.mockResolvedValue(undefined);
    fsPromises.copyFile.mockResolvedValue(undefined);
    fsPromises.rm.mockResolvedValue(undefined);
  });

  describe('validateSystemType', () => {
    it('should validate openapi system type', () => {
      const { validateSystemType } = require('../../../lib/external-system/download');
      const result = validateSystemType({ type: 'openapi' });
      expect(result).toBe('openapi');
    });

    it('should validate mcp system type', () => {
      const { validateSystemType } = require('../../../lib/external-system/download');
      const result = validateSystemType({ type: 'mcp' });
      expect(result).toBe('mcp');
    });

    it('should validate custom system type', () => {
      const { validateSystemType } = require('../../../lib/external-system/download');
      const result = validateSystemType({ type: 'custom' });
      expect(result).toBe('custom');
    });

    it('should throw error for invalid system type', () => {
      const { validateSystemType } = require('../../../lib/external-system/download');
      expect(() => validateSystemType({ type: 'invalid' })).toThrow('Invalid system type');
    });

    it('should throw error for missing type', () => {
      const { validateSystemType } = require('../../../lib/external-system/download');
      expect(() => validateSystemType({})).toThrow('Invalid system type');
    });
  });

  describe('validateDownloadedData', () => {
    it('should validate downloaded data successfully', () => {
      const { validateDownloadedData } = require('../../../lib/external-system/download');
      expect(() => {
        validateDownloadedData(mockApplication, [mockDataSource1, mockDataSource2]);
      }).not.toThrow();
    });

    it('should throw error for missing application', () => {
      const { validateDownloadedData } = require('../../../lib/external-system/download');
      expect(() => {
        validateDownloadedData(null, []);
      }).toThrow('Application configuration is required');
    });

    it('should throw error for missing application key', () => {
      const { validateDownloadedData } = require('../../../lib/external-system/download');
      expect(() => {
        validateDownloadedData({}, []);
      }).toThrow('Application key is required');
    });

    it('should throw error for invalid datasources array', () => {
      const { validateDownloadedData } = require('../../../lib/external-system/download');
      expect(() => {
        validateDownloadedData(mockApplication, 'not-an-array');
      }).toThrow('DataSources must be an array');
    });

    it('should throw error for datasource with mismatched systemKey', () => {
      const { validateDownloadedData } = require('../../../lib/external-system/download');
      const invalidDatasource = { ...mockDataSource1, systemKey: 'different-system' };
      expect(() => {
        validateDownloadedData(mockApplication, [invalidDatasource]);
      }).toThrow('systemKey');
    });
  });

  describe('generateEnvTemplate', () => {
    it('should generate env template for OAuth2 authentication', () => {
      const { generateEnvTemplate } = require('../../../lib/external-system/download');
      const result = generateEnvTemplate(mockApplication);
      expect(result).toContain('CLIENT_ID');
      expect(result).toContain('CLIENT_SECRET');
      expect(result).toContain('kv://secrets');
    });

    it('should generate env template for API key authentication', () => {
      const { generateEnvTemplate } = require('../../../lib/external-system/download');
      const appWithApiKey = {
        key: 'test',
        authentication: {
          type: 'apikey',
          apikey: {
            key: '{{API_KEY}}'
          }
        }
      };
      const result = generateEnvTemplate(appWithApiKey);
      expect(result).toContain('API_KEY');
      expect(result).toContain('kv://secrets');
    });

    it('should generate env template for basic auth', () => {
      const { generateEnvTemplate } = require('../../../lib/external-system/download');
      const appWithBasic = {
        key: 'test',
        authentication: {
          type: 'basic',
          basic: {
            username: '{{USERNAME}}',
            password: '{{PASSWORD}}'
          }
        }
      };
      const result = generateEnvTemplate(appWithBasic);
      expect(result).toContain('USERNAME');
      expect(result).toContain('PASSWORD');
    });

    it('should handle missing authentication', () => {
      const { generateEnvTemplate } = require('../../../lib/external-system/download');
      const appWithoutAuth = { key: 'test' };
      const result = generateEnvTemplate(appWithoutAuth);
      expect(result).toContain('# Environment variables');
    });
  });

  describe('generateVariablesYaml', () => {
    it('should generate variables.yaml structure', () => {
      const { generateVariablesYaml } = require('../../../lib/external-system/download');
      const result = generateVariablesYaml(systemKey, mockApplication, [mockDataSource1, mockDataSource2]);
      expect(result.app.key).toBe(systemKey);
      expect(result.externalIntegration).toBeDefined();
      expect(result.externalIntegration.systems).toHaveLength(1);
      expect(result.externalIntegration.dataSources).toHaveLength(2);
    });
  });

  describe('generateReadme', () => {
    it('should generate README.md content', () => {
      const { generateReadme } = require('../../../lib/external-system/download');
      const result = generateReadme(systemKey, mockApplication, [mockDataSource1, mockDataSource2]);
      expect(result).toContain('HubSpot CRM');
      expect(result).toContain(systemKey);
      expect(result).toContain('**Datasources**: 2');
      expect(result).toContain('variables.yaml');
      expect(result).toContain('aifabrix test');
      expect(result).toContain('aifabrix test-integration');
    });
  });

  describe('downloadExternalSystem', () => {
    it('should download external system successfully', async() => {
      getExternalSystemConfig.mockResolvedValue(mockDownloadResponse);
      // Mock the final path detection
      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external'
      });

      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await downloadExternalSystem(systemKey, { environment: 'dev' });

      expect(getExternalSystemConfig).toHaveBeenCalledWith(
        'http://dataplane:8080',
        systemKey,
        expect.objectContaining({ token: 'test-token' })
      );
      expect(fsPromises.mkdir).toHaveBeenCalled();
      expect(fsPromises.writeFile).toHaveBeenCalled();
      expect(fsPromises.copyFile).toHaveBeenCalled();
    });

    it('should handle dry-run mode', async() => {
      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await downloadExternalSystem(systemKey, { environment: 'dev', dryRun: true });

      expect(getExternalSystemConfig).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dry run mode'));
    });

    it('should throw error for invalid system key format', async() => {
      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await expect(
        downloadExternalSystem('Invalid System Key!', {})
      ).rejects.toThrow('System key must contain only lowercase letters');
    });

    it('should throw error when authentication is missing', async() => {
      getDeploymentAuth.mockResolvedValue({});
      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await expect(
        downloadExternalSystem(systemKey, {})
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when download fails', async() => {
      getExternalSystemConfig.mockResolvedValue({
        success: false,
        error: 'System not found'
      });
      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await expect(
        downloadExternalSystem(systemKey, {})
      ).rejects.toThrow('Failed to download system configuration');
    });

    it('should handle partial download errors', async() => {
      getExternalSystemConfig.mockResolvedValue(mockDownloadResponse);
      let writeCount = 0;
      fsPromises.writeFile.mockImplementation((filePath) => {
        writeCount++;
        // Fail on second datasource write (contact)
        if (filePath.includes('contact') || (writeCount > 3 && filePath.includes('deploy-'))) {
          throw new Error('Failed to write datasource');
        }
        return Promise.resolve();
      });

      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await expect(
        downloadExternalSystem(systemKey, {})
      ).rejects.toThrow('Partial download');
    });

    it('should clean up temporary folder on error', async() => {
      getExternalSystemConfig.mockResolvedValue(mockDownloadResponse);
      fsPromises.writeFile.mockRejectedValue(new Error('Write failed'));

      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await expect(
        downloadExternalSystem(systemKey, {})
      ).rejects.toThrow();

      expect(fsPromises.rm).toHaveBeenCalledWith(
        expect.stringContaining('aifabrix-download'),
        { recursive: true, force: true }
      );
    });

    it('should use discoverDataplaneUrl instead of getDataplaneUrl', async() => {
      getExternalSystemConfig.mockResolvedValue(mockDownloadResponse);
      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external'
      });

      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await downloadExternalSystem(systemKey, { environment: 'dev' });

      expect(resolveDataplaneUrl).toHaveBeenCalled();
      expect(getExternalSystemConfig).toHaveBeenCalled();
    });

    it('should handle inline datasources in application.configuration.dataSources', async() => {
      const inlineDatasource = {
        key: 'hubspot-deals-get',
        displayName: 'GET /crm/v3/objects/deals',
        systemKey: 'hubspot',
        entityType: 'deal',
        resourceType: 'deal'
      };
      const appWithInlineDatasources = {
        ...mockApplication,
        configuration: {
          dataSources: [inlineDatasource]
        }
      };
      const responseWithInline = {
        success: true,
        data: {
          data: {
            application: appWithInlineDatasources,
            dataSources: [mockDataSource1, mockDataSource2]
          }
        }
      };
      getExternalSystemConfig.mockResolvedValue(responseWithInline);
      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external'
      });

      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await downloadExternalSystem(systemKey, { environment: 'dev' });

      // Should extract inline datasources and merge with regular datasources
      expect(fsPromises.writeFile).toHaveBeenCalled();
      // Verify datasource files are created (should have 3: company, contact, deal)
      // New naming convention uses -datasource- instead of -deploy-
      const writeCalls = fsPromises.writeFile.mock.calls;
      const datasourceFileWrites = writeCalls.filter(call =>
        call[0].includes('datasource-') && call[0].endsWith('.json')
      );
      expect(datasourceFileWrites.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle application without separate application field', async() => {
      const responseWithoutApplicationField = {
        success: true,
        data: {
          data: {
            key: 'hubspot',
            displayName: 'HubSpot CRM',
            type: 'openapi',
            configuration: {
              dataSources: [mockDataSource1]
            }
          }
        }
      };
      getExternalSystemConfig.mockResolvedValue(responseWithoutApplicationField);
      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external'
      });

      const { downloadExternalSystem } = require('../../../lib/external-system/download');
      await downloadExternalSystem(systemKey, { environment: 'dev' });

      expect(getExternalSystemConfig).toHaveBeenCalled();
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });
  });
});
