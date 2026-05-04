/**
 * Tests for Datasource Test E2E
 * @fileoverview Tests for lib/datasource/test-e2e.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/datasource/unified-validation-run', () => ({
  runUnifiedDatasourceValidation: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((app) => `/integration/${app}/integration.yaml`)
}));
jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn()
}));
jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn().mockResolvedValue('/path/to/log.json')
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('fs', () => ({ promises: { readFile: jest.fn() } }));

const fs = require('fs');
const { runDatasourceTestE2E } = require('../../../lib/datasource/test-e2e');
const { resolveAppKeyForDatasource } = require('../../../lib/datasource/resolve-app');
const { runUnifiedDatasourceValidation } = require('../../../lib/datasource/unified-validation-run');
const { writeTestLog } = require('../../../lib/utils/test-log-writer');

function envelopeWithSteps(stepResults) {
  return {
    status: 'pass',
    reportCompleteness: 'full',
    integration: { stepResults }
  };
}

describe('Datasource Test E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAppKeyForDatasource.mockResolvedValue({ appKey: 'myapp' });
    runUnifiedDatasourceValidation.mockResolvedValue({
      envelope: envelopeWithSteps([{ name: 'config', success: true }]),
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: false
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

    it('should pass verbose true to unified run', async() => {
      await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', verbose: true });
      expect(runUnifiedDatasourceValidation).toHaveBeenCalledWith(
        'hubspot-contacts',
        expect.objectContaining({ verbose: true, runType: 'e2e' })
      );
    });

    it('should use default async (async true, noAsync false)', async() => {
      const result = await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp' });

      expect(runUnifiedDatasourceValidation).toHaveBeenCalledWith(
        'hubspot-contacts',
        expect.objectContaining({
          async: true,
          noAsync: false,
          runType: 'e2e'
        })
      );
      expect(result.steps).toHaveLength(1);
    });

    it('should use sync mode when options.async is false', async() => {
      await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', async: false });

      expect(runUnifiedDatasourceValidation).toHaveBeenCalledWith(
        'hubspot-contacts',
        expect.objectContaining({
          async: false,
          noAsync: true
        })
      );
    });

    it('should pass e2e body options to unified run', async() => {
      await runDatasourceTestE2E('hubspot-contacts', {
        app: 'myapp',
        cleanup: false,
        runScenarios: false,
        primaryKeyValue: 'pk-val',
        capabilityKey: 'read'
      });

      expect(runUnifiedDatasourceValidation).toHaveBeenCalledWith(
        'hubspot-contacts',
        expect.objectContaining({
          cleanup: false,
          runScenarios: false,
          primaryKeyValue: 'pk-val',
          capabilityKey: 'read'
        })
      );
    });

    it('should resolve primaryKeyValue from file when value starts with @', async() => {
      fs.promises.readFile.mockResolvedValue(JSON.stringify({ id: 'external-123' }));

      await runDatasourceTestE2E('hubspot-contacts', {
        app: 'myapp',
        primaryKeyValue: '@/path/to/pk.json'
      });

      expect(runUnifiedDatasourceValidation).toHaveBeenCalledWith(
        'hubspot-contacts',
        expect.objectContaining({ primaryKeyValue: { id: 'external-123' } })
      );
    });

    it('should pass debug to unified run', async() => {
      await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', debug: true });

      expect(runUnifiedDatasourceValidation).toHaveBeenCalledWith(
        'hubspot-contacts',
        expect.objectContaining({ debug: true })
      );
    });

    it('should throw when poll times out', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        envelope: envelopeWithSteps([]),
        apiError: null,
        pollTimedOut: true,
        incompleteNoAsync: false
      });

      await expect(
        runDatasourceTestE2E('hubspot-contacts', {
          app: 'myapp',
          timeout: 50
        })
      ).rejects.toThrow(/Report incomplete: timeout/);
    });

    it('should throw when primaryKeyValue @file does not exist', async() => {
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

    it('should throw and write debug log when unified returns apiError', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        envelope: null,
        apiError: { formattedError: 'Dataplane unavailable' },
        pollTimedOut: false,
        incompleteNoAsync: false
      });

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
        '/integration/myapp'
      );
    });

    it('should throw when incomplete with --no-async', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        envelope: envelopeWithSteps([]),
        apiError: null,
        pollTimedOut: false,
        incompleteNoAsync: true
      });

      await expect(
        runDatasourceTestE2E('hubspot-contacts', { app: 'myapp', async: false })
      ).rejects.toThrow(/async polling disabled/);
    });
  });
});
