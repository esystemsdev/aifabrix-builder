/**
 * @fileoverview Tests for datasource-unified-test-cli action handlers (success / error / integration / E2E).
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../lib/datasource/unified-validation-run', () => ({
  runUnifiedDatasourceValidation: jest.fn()
}));

jest.mock('../../../lib/datasource/test-integration', () => ({
  runDatasourceTestIntegration: jest.fn()
}));

jest.mock('../../../lib/datasource/test-e2e', () => ({
  runDatasourceTestE2E: jest.fn()
}));

jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn().mockResolvedValue({ appKey: 'myapp' })
}));

jest.mock('../../../lib/utils/datasource-validation-watch', () => ({
  runDatasourceValidationWatchLoop: jest.fn()
}));

jest.mock('../../../lib/utils/external-system-display', () => ({
  displayIntegrationTestResults: jest.fn(),
  displayE2EResults: jest.fn()
}));

jest.mock('../../../lib/certification/post-unified-cert-sync', () => ({
  afterUnifiedValidationCertSync: jest.fn().mockResolvedValue(undefined)
}));

const logger = require('../../../lib/utils/logger');
const { runUnifiedDatasourceValidation } = require('../../../lib/datasource/unified-validation-run');
const { runDatasourceTestIntegration } = require('../../../lib/datasource/test-integration');
const { runDatasourceTestE2E } = require('../../../lib/datasource/test-e2e');
const { displayIntegrationTestResults } = require('../../../lib/utils/external-system-display');

const {
  runDatasourceUnifiedTestOnceForWatch,
  datasourceTestCommandAction,
  runIntegrationOnceForWatch,
  integrationTestCommandAction,
  runDatasourceTestE2ECliOnce
} = require('../../../lib/commands/datasource-unified-test-cli');

function stripAnsi(s) {
  const ESC = String.fromCharCode(27);
  const re = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
  return String(s).replace(re, '');
}

function okTestEnvelope() {
  return {
    status: 'ok',
    datasourceKey: 'd',
    systemKey: 's',
    runType: 'test',
    developer: { executiveSummary: '✔ ok' }
  };
}

describe('datasource-unified-test-cli actions', () => {
  let exitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('runDatasourceUnifiedTestOnceForWatch', () => {
    it('returns exit 0 for ok envelope', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        apiError: null,
        pollTimedOut: false,
        incompleteNoAsync: false,
        envelope: okTestEnvelope()
      });
      const r = await runDatasourceUnifiedTestOnceForWatch('d', {}, {});
      expect(r.exitCode).toBe(0);
    });

    it('returns exit 3 on apiError (json mode)', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        apiError: { formattedError: 'unauthorized', status: 401 },
        pollTimedOut: false,
        incompleteNoAsync: false,
        envelope: null
      });
      const r = await runDatasourceUnifiedTestOnceForWatch('d', {}, { json: true });
      expect(r.exitCode).toBe(3);
    });

    it('logs ✖ and returns exit 4 when run throws', async() => {
      runUnifiedDatasourceValidation.mockRejectedValue(new Error('network down'));
      const r = await runDatasourceUnifiedTestOnceForWatch('d', {}, {});
      expect(r.exitCode).toBe(4);
      expect(stripAnsi(String(logger.error.mock.calls[0][0]))).toContain('✖ Datasource test failed:');
      expect(String(logger.error.mock.calls[0][1])).toBe('network down');
    });
  });

  describe('datasourceTestCommandAction', () => {
    it('exits 0 on ok envelope', async() => {
      runUnifiedDatasourceValidation.mockResolvedValue({
        apiError: null,
        pollTimedOut: false,
        incompleteNoAsync: false,
        envelope: okTestEnvelope()
      });
      await datasourceTestCommandAction('d', { watch: false, async: true });
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('exits 4 on thrown error', async() => {
      runUnifiedDatasourceValidation.mockRejectedValue(new Error('boom'));
      await datasourceTestCommandAction('d', { watch: false });
      expect(exitSpy).toHaveBeenCalledWith(4);
      expect(stripAnsi(String(logger.error.mock.calls[0][0]))).toContain('✖ Datasource test failed:');
    });
  });

  describe('runIntegrationOnceForWatch', () => {
    const cliOpts = {
      json: false,
      summary: false,
      warningsAsErrors: false,
      requireCert: false,
      verbose: false,
      debug: false
    };
    const unifiedDisplayOpts = {
      json: false,
      summary: false,
      warningsAsErrors: false,
      requireCert: false,
      debug: false
    };

    it('calls displayIntegrationTestResults when not unifiedModes', async() => {
      runDatasourceTestIntegration.mockResolvedValue({
        key: 'd',
        success: true,
        systemKey: 'sys',
        datasourceTestRun: {
          status: 'warn',
          datasourceKey: 'd',
          systemKey: 'sys',
          runType: 'integration',
          developer: { executiveSummary: '⚠ warn' }
        }
      });
      const r = await runIntegrationOnceForWatch('d', {}, cliOpts, unifiedDisplayOpts);
      expect(displayIntegrationTestResults).toHaveBeenCalled();
      expect(r.exitCode).toBe(0);
    });

    it('skips display when unifiedModes (json)', async() => {
      runDatasourceTestIntegration.mockResolvedValue({
        key: 'd',
        success: true,
        systemKey: 'sys',
        datasourceTestRun: okTestEnvelope()
      });
      const r = await runIntegrationOnceForWatch(
        'd',
        {},
        { ...cliOpts, json: true },
        { ...unifiedDisplayOpts, json: true }
      );
      expect(displayIntegrationTestResults).not.toHaveBeenCalled();
      expect(r.exitCode).toBe(0);
    });
  });

  describe('integrationTestCommandAction', () => {
    it('displays results and exits 0 on success', async() => {
      runDatasourceTestIntegration.mockResolvedValue({
        key: 'd',
        success: true,
        systemKey: 'sys',
        datasourceTestRun: {
          status: 'ok',
          datasourceKey: 'd',
          systemKey: 'sys',
          runType: 'integration',
          developer: { executiveSummary: 'ok' }
        }
      });
      await integrationTestCommandAction('d', { watch: false, env: 'dev' });
      expect(displayIntegrationTestResults).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('runDatasourceTestE2ECliOnce', () => {
    it('displays envelope via displayIntegrationTestResults when envelope present', async() => {
      runDatasourceTestE2E.mockResolvedValue({
        steps: [],
        success: true,
        datasourceTestRun: {
          status: 'ok',
          datasourceKey: 'd',
          systemKey: 'sys',
          runType: 'e2e',
          developer: { executiveSummary: 'done' }
        }
      });
      const r = await runDatasourceTestE2ECliOnce('d', { verbose: false, debug: false });
      expect(r.exitCode).toBe(0);
      expect(displayIntegrationTestResults).toHaveBeenCalled();
    });
  });
});
