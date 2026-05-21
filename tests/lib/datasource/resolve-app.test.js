/**
 * Tests for resolve-app.js (resolveAppKeyForDatasource)
 * @fileoverview Unit tests for lib/datasource/resolve-app.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((app) => `/integration/${app}`),
  listIntegrationAppNames: jest.fn(),
  resolveIntegrationAppKeyFromCwd: jest.fn()
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((p) => `${p}/application.yaml`)
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn()
}));

const fs = require('fs');
const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

const { resolveAppKeyForDatasource, appHasDatasourceKey } = require('../../../lib/datasource/resolve-app');
const paths = require('../../../lib/utils/paths');
const configFormat = require('../../../lib/utils/config-format');

describe('resolve-app', () => {
  afterAll(() => {
    existsSyncSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    paths.resolveIntegrationAppKeyFromCwd.mockReturnValue(null);
    paths.listIntegrationAppNames.mockReturnValue(['app-a', 'app-b']);
    configFormat.loadConfigFile.mockImplementation((filePath) => {
      if (filePath && filePath.includes('app-a') && filePath.includes('application')) {
        return { externalIntegration: { dataSources: ['ds1.json'], schemaBasePath: './' } };
      }
      if (filePath && filePath.includes('app-a') && filePath.includes('ds1')) {
        return { key: 'my-datasource' };
      }
      if (filePath && filePath.includes('app-b') && filePath.includes('application')) {
        return { externalIntegration: { dataSources: ['other.json'], schemaBasePath: './' } };
      }
      if (filePath && filePath.includes('app-b') && filePath.includes('other')) {
        return { key: 'other-ds' };
      }
      return { externalIntegration: { dataSources: [], schemaBasePath: './' } };
    });
  });

  describe('resolveAppKeyForDatasource', () => {
    it('should return explicit app when --app provided and path exists', async() => {
      const result = await resolveAppKeyForDatasource('any-key', 'myapp');
      expect(result).toEqual({ appKey: 'myapp' });
      expect(paths.listIntegrationAppNames).not.toHaveBeenCalled();
    });

    it('should fall through when explicit app path does not exist', async() => {
      fs.existsSync.mockImplementation((p) => !String(p).includes('nonexistent-app'));
      configFormat.loadConfigFile.mockImplementation((filePath) => {
        if (filePath && filePath.includes('app-a') && filePath.includes('application')) {
          return { externalIntegration: { dataSources: ['ds1.json'], schemaBasePath: './' } };
        }
        if (filePath && filePath.includes('app-a')) {
          return { key: 'target-key' };
        }
        return { externalIntegration: { dataSources: [], schemaBasePath: './' } };
      });
      paths.listIntegrationAppNames.mockReturnValue(['app-a']);
      const result = await resolveAppKeyForDatasource('target-key', 'nonexistent-app');
      expect(result).toEqual({ appKey: 'app-a' });
    });

    it('should throw when datasource key is empty', async() => {
      await expect(resolveAppKeyForDatasource('', 'myapp')).rejects.toThrow('Datasource key is required');
      await expect(resolveAppKeyForDatasource('  ', null)).rejects.toThrow('cannot be empty');
    });

    it('should resolve from cwd when cwd is under integration and app has datasource', async() => {
      paths.resolveIntegrationAppKeyFromCwd.mockReturnValue('app-a');
      const result = await resolveAppKeyForDatasource('my-datasource', null);
      expect(result).toEqual({ appKey: 'app-a' });
    });

    it('should resolve from scan when exactly one app has the datasource key', async() => {
      configFormat.loadConfigFile.mockImplementation((filePath) => {
        if (filePath && filePath.includes('app-a')) {
          if (filePath.includes('application')) {
            return { externalIntegration: { dataSources: ['ds1.json'], schemaBasePath: './' } };
          }
          return { key: 'target-key' };
        }
        if (filePath && filePath.includes('app-b')) {
          return { externalIntegration: { dataSources: ['x.json'], schemaBasePath: './' } };
        }
        return {};
      });
      const result = await resolveAppKeyForDatasource('target-key', null);
      expect(result).toEqual({ appKey: 'app-a' });
    });

    it('should throw when more than one app has the datasource key', async() => {
      configFormat.loadConfigFile.mockImplementation((filePath) => {
        if (filePath && (filePath.includes('app-a') || filePath.includes('app-b'))) {
          if (filePath.includes('application')) {
            return { externalIntegration: { dataSources: ['ds.json'], schemaBasePath: './' } };
          }
          return { key: 'same-key' };
        }
        return {};
      });
      await expect(resolveAppKeyForDatasource('same-key', null)).rejects.toThrow(
        'More than one app has this datasource'
      );
    });

    it('should throw when no app found and parse fallback fails', async() => {
      configFormat.loadConfigFile.mockImplementation(() => ({ externalIntegration: { dataSources: [] } }));
      paths.listIntegrationAppNames.mockReturnValue(['other-app']);
      fs.existsSync.mockImplementation((p) => !p.includes('unknown-key'));
      await expect(resolveAppKeyForDatasource('unknown-key', null)).rejects.toThrow(
        'Could not determine app context'
      );
    });

    it('should resolve app from datasource JSON filename stem', async() => {
      configFormat.loadConfigFile.mockImplementation(filePath => {
        if (filePath.includes('test-e2e-hubspot') && filePath.includes('application')) {
          return {
            externalIntegration: {
              dataSources: ['test-e2e-hubspot-datasource-companies.json'],
              schemaBasePath: './'
            }
          };
        }
        if (filePath.includes('datasource-companies')) {
          return { key: 'test-e2e-hubspot-companies' };
        }
        return { externalIntegration: { dataSources: [], schemaBasePath: './' } };
      });
      paths.listIntegrationAppNames.mockReturnValue(['test-e2e-hubspot']);
      const result = await resolveAppKeyForDatasource('test-e2e-hubspot-datasource-companies', null);
      expect(result).toEqual({ appKey: 'test-e2e-hubspot' });
    });
  });

  describe('appHasDatasourceKey', () => {
    it('should return true when app has datasource file with matching key', () => {
      const pathsMod = require('../../../lib/utils/paths');
      pathsMod.getIntegrationPath.mockReturnValue('/integration/app-a');
      configFormat.loadConfigFile.mockImplementation((filePath) => {
        if (filePath.includes('application')) return { externalIntegration: { dataSources: ['ds1.json'], schemaBasePath: './' } };
        return { key: 'my-datasource' };
      });
      const result = appHasDatasourceKey('app-a', 'my-datasource');
      expect(result).toBe(true);
    });

    it('should return false when no datasource matches', () => {
      configFormat.loadConfigFile.mockImplementation((filePath) => {
        if (filePath.includes('application')) return { externalIntegration: { dataSources: ['ds1.json'], schemaBasePath: './' } };
        return { key: 'other-key' };
      });
      const result = appHasDatasourceKey('app-a', 'my-datasource');
      expect(result).toBe(false);
    });
  });
});
