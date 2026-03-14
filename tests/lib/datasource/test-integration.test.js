/**
 * Tests for Datasource Test Integration
 * @fileoverview Tests for lib/datasource/test-integration.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/api/pipeline.api');
jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((app) => `/integration/${app}`),
  resolveIntegrationAppKeyFromCwd: jest.fn()
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((p) => `${p}/application.yaml`)
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn()
}));
jest.mock('../../../lib/external-system/test-auth', () => ({
  setupIntegrationTestAuth: jest.fn()
}));
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn().mockResolvedValue({})
}));
jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn().mockResolvedValue('/path/to/log.json')
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}));

const { runDatasourceTestIntegration, resolveSystemKey } = require('../../../lib/datasource/test-integration');
const pipelineApi = require('../../../lib/api/pipeline.api');
const paths = require('../../../lib/utils/paths');
const configFormat = require('../../../lib/utils/config-format');
const testAuth = require('../../../lib/external-system/test-auth');
const fs = require('fs').promises;

describe('Datasource Test Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paths.resolveIntegrationAppKeyFromCwd.mockReturnValue(null);
    configFormat.loadConfigFile.mockReturnValue({
      externalIntegration: {
        systems: ['test-system.yaml'],
        dataSources: ['ds1-datasource.json'],
        schemaBasePath: './'
      }
    });
    fs.readFile.mockResolvedValue(JSON.stringify({ key: 'my-ds', testPayload: { payloadTemplate: {} } }));
    testAuth.setupIntegrationTestAuth.mockResolvedValue({
      authConfig: { token: 't' },
      dataplaneUrl: 'https://dp.example.com'
    });
    pipelineApi.testDatasourceViaPipeline.mockResolvedValue({
      success: true,
      data: { success: true }
    });
  });

  describe('resolveSystemKey', () => {
    it('should throw when no app context', async() => {
      paths.resolveIntegrationAppKeyFromCwd.mockReturnValue(null);
      await expect(resolveSystemKey()).rejects.toThrow('Could not determine app context');
    });
  });

  describe('runDatasourceTestIntegration', () => {
    it('should throw when datasourceKey is missing', async() => {
      await expect(runDatasourceTestIntegration('', { app: 'myapp' })).rejects.toThrow('Datasource key is required');
    });

    it('should call pipeline test when datasource found', async() => {
      const appConfig = {
        externalIntegration: {
          systems: ['sys.yaml'],
          dataSources: ['my-ds-datasource.json'],
          schemaBasePath: './'
        }
      };
      const datasourceConfig = { key: 'my-ds', testPayload: { payloadTemplate: { x: 1 } } };
      configFormat.loadConfigFile.mockImplementation((filePath) => {
        if (filePath && filePath.endsWith('application.yaml')) return appConfig;
        if (filePath && filePath.includes('my-ds-datasource')) return datasourceConfig;
        return appConfig;
      });
      const yaml = require('js-yaml');
      fs.readFile.mockResolvedValueOnce(yaml.dump({ key: 'mysys' }));

      const result = await runDatasourceTestIntegration('my-ds', { app: 'myapp' });

      expect(pipelineApi.testDatasourceViaPipeline).toHaveBeenCalled();
      expect(result.key).toBe('my-ds');
      expect(result.success).toBe(true);
    });

    it('should find datasource by key inside file when filename base does not match', async() => {
      const fsSync = require('fs');
      fsSync.existsSync.mockReturnValue(true);
      const appConfig = {
        externalIntegration: {
          systems: ['hubspot-system.yaml'],
          dataSources: ['hubspot-companies-datasource.json'],
          schemaBasePath: './'
        }
      };
      const datasourceConfig = { key: 'test-e2e-hubspot-companies', testPayload: { payloadTemplate: { x: 1 } } };
      configFormat.loadConfigFile.mockImplementation((filePath) => {
        if (filePath && filePath.endsWith('application.yaml')) return appConfig;
        if (filePath && filePath.includes('hubspot-companies-datasource')) return datasourceConfig;
        return appConfig;
      });
      const yaml = require('js-yaml');
      fs.readFile.mockResolvedValue(yaml.dump({ key: 'hubspot' }));

      const result = await runDatasourceTestIntegration('test-e2e-hubspot-companies', { app: 'test-e2e-hubspot' });

      expect(pipelineApi.testDatasourceViaPipeline).toHaveBeenCalledWith(
        expect.objectContaining({ datasourceKey: 'test-e2e-hubspot-companies' })
      );
      expect(result.key).toBe('test-e2e-hubspot-companies');
      expect(result.success).toBe(true);
    });
  });
});
