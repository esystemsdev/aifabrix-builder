/**
 * Tests for test-e2e external system command
 * @fileoverview Tests for lib/commands/test-e2e-external.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');

jest.mock('../../../lib/utils/paths', () => {
  const pathMod = require('path');
  return {
    getIntegrationPath: jest.fn((app) => pathMod.join(process.cwd(), 'integration', app))
  };
});
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn()
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/commands/upload', () => ({
  uploadExternalSystem: jest.fn().mockResolvedValue(undefined)
}));

const fs = require('fs');
const { getIntegrationPath } = require('../../../lib/utils/paths');
const { resolveApplicationConfigPath } = require('../../../lib/utils/app-config-resolver');
const { loadConfigFile } = require('../../../lib/utils/config-format');
const { runTestE2EForExternalSystem, getDatasourceKeys } = require('../../../lib/commands/test-e2e-external');

jest.mock('../../../lib/commands/repair-internal', () => ({
  discoverIntegrationFiles: jest.fn(),
  buildEffectiveDatasourceFiles: jest.fn()
}));
jest.mock('../../../lib/datasource/test-e2e', () => ({
  runDatasourceTestE2E: jest.fn()
}));

const { discoverIntegrationFiles, buildEffectiveDatasourceFiles } = require('../../../lib/commands/repair-internal');
const { runDatasourceTestE2E } = require('../../../lib/datasource/test-e2e');
const upload = require('../../../lib/commands/upload');

describe('test-e2e-external', () => {
  const appPath = path.join(process.cwd(), 'integration', 'hubspot-demo');
  const configPath = path.join(appPath, 'application.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    getIntegrationPath.mockReturnValue(appPath);
    resolveApplicationConfigPath.mockReturnValue(configPath);
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      const s = String(p);
      return s === appPath || s === configPath || s.endsWith('-system.json') || s.endsWith('-system.yaml') || s.endsWith('-datasource-companies.json');
    });
    discoverIntegrationFiles.mockReturnValue({
      systemFiles: ['hubspot-demo-system.json'],
      datasourceFiles: ['hubspot-demo-datasource-companies.json']
    });
    buildEffectiveDatasourceFiles.mockReturnValue(['hubspot-demo-datasource-companies.json']);
    loadConfigFile.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
        return { externalIntegration: { dataSources: ['hubspot-demo-datasource-companies.json'] } };
      }
      if (s.endsWith('hubspot-demo-system.json')) {
        return { key: 'hubspot-demo', dataSources: ['hubspot-demo-companies'] };
      }
      if (s.endsWith('hubspot-demo-datasource-companies.json')) {
        return { key: 'hubspot-demo-companies', systemKey: 'hubspot-demo' };
      }
      return {};
    });
    runDatasourceTestE2E.mockResolvedValue({ success: true, steps: [{ success: true }] });
  });

  afterEach(() => {
    fs.existsSync.mockRestore?.();
  });

  describe('runTestE2EForExternalSystem', () => {
    it('throws when external system name is missing', async() => {
      await expect(runTestE2EForExternalSystem('')).rejects.toThrow('External system name is required');
      await expect(runTestE2EForExternalSystem(null)).rejects.toThrow('External system name is required');
    });

    it('throws when integration path does not exist', async() => {
      fs.existsSync.mockImplementation((p) => p !== appPath);
      await expect(runTestE2EForExternalSystem('hubspot-demo')).rejects.toThrow('Integration path not found');
    });

    it('throws when no system file found', async() => {
      discoverIntegrationFiles.mockReturnValue({ systemFiles: [], datasourceFiles: [] });
      await expect(runTestE2EForExternalSystem('hubspot-demo')).rejects.toThrow('No system file found');
    });

    it('resolves datasource keys and calls runDatasourceTestE2E per key', async() => {
      const result = await runTestE2EForExternalSystem('hubspot-demo', { env: 'tst', verbose: true });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({ key: 'hubspot-demo-companies', success: true });
      expect(runDatasourceTestE2E).toHaveBeenCalledTimes(1);
      expect(runDatasourceTestE2E).toHaveBeenCalledWith(
        'hubspot-demo-companies',
        expect.objectContaining({
          app: 'hubspot-demo',
          environment: 'tst',
          verbose: true,
          async: true
        })
      );
    });

    it('calls uploadExternalSystem once before E2E when sync is true', async() => {
      await runTestE2EForExternalSystem('hubspot-demo', { sync: true, verbose: true });

      expect(upload.uploadExternalSystem).toHaveBeenCalledTimes(1);
      expect(upload.uploadExternalSystem).toHaveBeenCalledWith(
        'hubspot-demo',
        expect.objectContaining({ minimal: true, verbose: true })
      );
      expect(runDatasourceTestE2E).toHaveBeenCalled();
    });

    it('does not call upload when sync is false', async() => {
      await runTestE2EForExternalSystem('hubspot-demo');

      expect(upload.uploadExternalSystem).not.toHaveBeenCalled();
    });

    it('returns success true and empty results when no datasources', async() => {
      buildEffectiveDatasourceFiles.mockReturnValue([]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('hubspot-demo-system.json')) {
          return { key: 'hubspot-demo', dataSources: [] };
        }
        return s.endsWith('application.yaml') ? {} : {};
      });

      const result = await runTestE2EForExternalSystem('hubspot-demo');

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(runDatasourceTestE2E).not.toHaveBeenCalled();
    });

    it('aggregates failures and returns success false', async() => {
      runDatasourceTestE2E
        .mockResolvedValueOnce({ success: true, steps: [] })
        .mockRejectedValueOnce(new Error('E2E failed'));

      discoverIntegrationFiles.mockReturnValue({
        systemFiles: ['hubspot-demo-system.json'],
        datasourceFiles: ['hubspot-demo-datasource-companies.json', 'hubspot-demo-datasource-contacts.json']
      });
      buildEffectiveDatasourceFiles.mockReturnValue(['hubspot-demo-datasource-companies.json', 'hubspot-demo-datasource-contacts.json']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('hubspot-demo-system.json')) {
          return { key: 'hubspot-demo', dataSources: ['hubspot-demo-companies', 'hubspot-demo-contacts'] };
        }
        if (s.endsWith('companies.json')) {
          return { key: 'hubspot-demo-companies', systemKey: 'hubspot-demo' };
        }
        if (s.endsWith('contacts.json')) {
          return { key: 'hubspot-demo-contacts', systemKey: 'hubspot-demo' };
        }
        return s.endsWith('application.yaml') ? { externalIntegration: { dataSources: [] } } : {};
      });

      const result = await runTestE2EForExternalSystem('hubspot-demo');

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('E2E failed');
    });
  });

  describe('getDatasourceKeys', () => {
    it('returns keys from system file dataSources when present', () => {
      const variables = { externalIntegration: { dataSources: ['hubspot-demo-datasource-companies.json'] } };
      const systemParsed = { key: 'hubspot-demo', dataSources: ['hubspot-demo-companies'] };
      const datasourceFiles = ['hubspot-demo-datasource-companies.json'];

      const keys = getDatasourceKeys(appPath, configPath, variables, 'hubspot-demo', systemParsed, datasourceFiles);

      expect(keys).toEqual(['hubspot-demo-companies']);
    });
  });
});
