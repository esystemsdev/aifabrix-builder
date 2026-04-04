/**
 * Tests for Datasource Test Integration
 * @fileoverview Tests for lib/datasource/test-integration.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/datasource/unified-validation-run', () => ({
  runUnifiedDatasourceValidation: jest.fn()
}));
jest.mock('../../../lib/datasource/integration-context', () => ({
  getSystemKeyFromAppKey: jest.fn(),
  findDatasourceFileByKey: jest.fn()
}));
jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn()
}));
jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn().mockResolvedValue('/path/to/log.json')
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { runDatasourceTestIntegration } = require('../../../lib/datasource/test-integration');
const { resolveAppKeyForDatasource } = require('../../../lib/datasource/resolve-app');
const { runUnifiedDatasourceValidation } = require('../../../lib/datasource/unified-validation-run');
const { getSystemKeyFromAppKey } = require('../../../lib/datasource/integration-context');
const { writeTestLog } = require('../../../lib/utils/test-log-writer');

function passEnvelope(overrides = {}) {
  return {
    status: 'pass',
    systemKey: 'mysys',
    reportCompleteness: 'full',
    ...overrides
  };
}

describe('Datasource Test Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAppKeyForDatasource.mockResolvedValue({ appKey: 'myapp' });
    getSystemKeyFromAppKey.mockResolvedValue('mysys');
    runUnifiedDatasourceValidation.mockResolvedValue({
      envelope: passEnvelope(),
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: false
    });
  });

  describe('runDatasourceTestIntegration', () => {
    it('should throw when datasourceKey is missing', async() => {
      await expect(runDatasourceTestIntegration('', { app: 'myapp' })).rejects.toThrow('Datasource key is required');
    });

    it('should call unified validation with runType integration', async() => {
      const result = await runDatasourceTestIntegration('my-ds', { app: 'myapp' });

      expect(runUnifiedDatasourceValidation).toHaveBeenCalledWith(
        'my-ds',
        expect.objectContaining({
          app: 'myapp',
          runType: 'integration',
          async: true,
          noAsync: false
        })
      );
      expect(result.key).toBe('my-ds');
      expect(result.systemKey).toBe('mysys');
      expect(result.success).toBe(true);
      expect(result.datasourceTestRun).toEqual(passEnvelope());
    });

    it('should return failure object when POST fails (apiError)', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        envelope: null,
        apiError: { formattedError: 'Unauthorized', success: false },
        pollTimedOut: false,
        incompleteNoAsync: false
      });

      const result = await runDatasourceTestIntegration('my-ds', { app: 'myapp' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(result.datasourceTestRun).toBeNull();
      expect(result.runMeta.apiError).toEqual({ formattedError: 'Unauthorized', success: false });
    });

    it('should write debug log on apiError when debug is true', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        envelope: null,
        apiError: { error: 'boom' },
        pollTimedOut: false,
        incompleteNoAsync: false
      });

      await runDatasourceTestIntegration('my-ds', { app: 'myapp', debug: true });

      expect(writeTestLog).toHaveBeenCalledWith(
        'myapp',
        expect.objectContaining({
          request: expect.objectContaining({ systemKey: 'mysys', datasourceKey: 'my-ds' }),
          error: 'boom'
        }),
        'test-integration'
      );
    });

    it('should surface poll timeout as failure with partial envelope', async() => {
      const partial = passEnvelope({ reportCompleteness: 'partial' });
      runUnifiedDatasourceValidation.mockResolvedValue({
        envelope: partial,
        apiError: null,
        pollTimedOut: true,
        incompleteNoAsync: false
      });

      const result = await runDatasourceTestIntegration('my-ds', { app: 'myapp' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout/i);
      expect(result.datasourceTestRun).toEqual(partial);
    });
  });
});
