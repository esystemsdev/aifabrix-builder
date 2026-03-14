/**
 * Tests for Datasource Test E2E
 * @fileoverview Tests for lib/datasource/test-e2e.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/api/external-test.api');
jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((app) => `/integration/${app}`)
}));
jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn()
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('https://controller.example.com')
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeviceOnlyAuth: jest.fn()
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn().mockResolvedValue('https://dataplane.example.com')
}));
jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn().mockResolvedValue('/path/to/log.json')
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('fs', () => ({ promises: { readFile: jest.fn() } }));

const fs = require('fs');
const { runDatasourceTestE2E } = require('../../../lib/datasource/test-e2e');
const { resolveAppKeyForDatasource } = require('../../../lib/datasource/resolve-app');
const externalTestApi = require('../../../lib/api/external-test.api');
const tokenManager = require('../../../lib/utils/token-manager');

describe('Datasource Test E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAppKeyForDatasource.mockResolvedValue({ appKey: 'myapp' });
    tokenManager.getDeviceOnlyAuth.mockResolvedValue({ type: 'bearer', token: 'test-token' });
    externalTestApi.testDatasourceE2E.mockResolvedValue({
      success: true,
      data: { steps: [{ name: 'config', success: true }] }
    });
    externalTestApi.getE2ETestRun.mockResolvedValue({
      status: 'completed',
      steps: [{ name: 'config', success: true }],
      success: true
    });
  });

  describe('runDatasourceTestE2E', () => {
    it('should throw when datasourceKey is missing', async() => {
      await expect(runDatasourceTestE2E('', { app: 'myapp' })).rejects.toThrow('Datasource key is required');
    });

    it('should call resolveAppKeyForDatasource with datasourceKey and options.app', async() => {
      await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp' });
      expect(resolveAppKeyForDatasource).toHaveBeenCalledWith('hubspot-contacts', 'myapp');
    });

    it('should include audit true in body when verbose is true', async() => {
      await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', verbose: true });
      expect(externalTestApi.testDatasourceE2E).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        expect.any(Object),
        expect.objectContaining({ audit: true }),
        { asyncRun: true }
      );
    });

    it('should call external E2E API with datasource key (default async)', async() => {
      const result = await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp' });

      expect(externalTestApi.testDatasourceE2E).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        expect.objectContaining({ token: 'test-token' }),
        expect.any(Object),
        { asyncRun: true }
      );
      expect(result.steps).toHaveLength(1);
    });

    it('should use sync mode when options.async is false (no polling)', async() => {
      externalTestApi.testDatasourceE2E.mockResolvedValue({
        success: true,
        data: { steps: [{ name: 'config', success: true }], success: true }
      });

      const result = await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', async: false });

      expect(externalTestApi.testDatasourceE2E).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        expect.any(Object),
        {},
        { asyncRun: false }
      );
      expect(externalTestApi.getE2ETestRun).not.toHaveBeenCalled();
      expect(result.steps).toHaveLength(1);
    });

    it('should poll getE2ETestRun when response has testRunId (async flow)', async() => {
      externalTestApi.testDatasourceE2E.mockResolvedValue({
        success: true,
        data: { testRunId: 'run-123', status: 'running', startedAt: '2026-01-01T00:00:00Z' }
      });
      externalTestApi.getE2ETestRun.mockResolvedValue({
        status: 'completed',
        steps: [{ name: 'config', success: true }, { name: 'credential', success: true }],
        success: true
      });

      const result = await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp' });

      expect(externalTestApi.getE2ETestRun).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        'run-123',
        expect.objectContaining({ token: 'test-token' })
      );
      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(2);
    });

    it('should pass body options (testCrud, recordId, cleanup, primaryKeyValue)', async() => {
      await runDatasourceTestE2E('hubspot-contacts', {
        app: 'myapp',
        testCrud: true,
        recordId: 'rec-1',
        cleanup: false,
        primaryKeyValue: 'pk-val'
      });

      expect(externalTestApi.testDatasourceE2E).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        expect.any(Object),
        expect.objectContaining({
          testCrud: true,
          recordId: 'rec-1',
          cleanup: false,
          primaryKeyValue: 'pk-val'
        }),
        { asyncRun: true }
      );
    });

    it('should resolve primaryKeyValue from file when value starts with @', async() => {
      fs.promises.readFile.mockResolvedValue(JSON.stringify({ id: 'external-123' }));

      await runDatasourceTestE2E('hubspot-contacts', {
        app: 'myapp',
        primaryKeyValue: '@/path/to/pk.json'
      });

      expect(externalTestApi.testDatasourceE2E).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        expect.any(Object),
        expect.objectContaining({ primaryKeyValue: { id: 'external-123' } }),
        { asyncRun: true }
      );
    });

    it('should include includeDebug in body when debug is true', async() => {
      await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', debug: true });

      expect(externalTestApi.testDatasourceE2E).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        expect.any(Object),
        { includeDebug: true },
        { asyncRun: true }
      );
    });

    it('should throw when poll times out (negative)', async() => {
      externalTestApi.testDatasourceE2E.mockResolvedValue({
        success: true,
        data: { testRunId: 'run-timeout', status: 'running', startedAt: '2026-01-01T00:00:00Z' }
      });
      externalTestApi.getE2ETestRun.mockResolvedValue({ status: 'running', completedActions: [] });

      await expect(
        runDatasourceTestE2E('hubspot-contacts', {
          app: 'myapp',
          pollTimeoutMs: 50,
          pollIntervalMs: 20
        })
      ).rejects.toThrow(/did not complete within/);
      expect(externalTestApi.getE2ETestRun).toHaveBeenCalled();
    });

    it('should throw when primaryKeyValue @file does not exist (negative)', async() => {
      const err = new Error('ENOENT: no such file or directory');
      err.code = 'ENOENT';
      fs.promises.readFile.mockRejectedValue(err);

      await expect(
        runDatasourceTestE2E('hubspot-contacts', {
          app: 'myapp',
          primaryKeyValue: '@/nonexistent/pk.json'
        })
      ).rejects.toThrow(/ENOENT|no such file/);
    });

    it('should throw and write debug log when API errors on POST (negative)', async() => {
      externalTestApi.testDatasourceE2E.mockRejectedValue(new Error('Dataplane unavailable'));

      const writeTestLog = require('../../../lib/utils/test-log-writer').writeTestLog;

      await expect(
        runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', debug: true })
      ).rejects.toThrow('Dataplane unavailable');

      expect(writeTestLog).toHaveBeenCalledWith(
        'myapp',
        expect.objectContaining({
          request: expect.any(Object),
          error: 'Dataplane unavailable'
        }),
        'test-e2e',
        expect.any(String)
      );
    });
  });
});
