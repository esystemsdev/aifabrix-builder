/**
 * @fileoverview Tests for datasource-unified-test-cli.js debug log behavior.
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/datasource/unified-validation-run', () => ({
  runUnifiedDatasourceValidation: jest.fn()
}));

jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn()
}));

jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn()
}));

jest.mock('../../../lib/commands/datasource-validation-cli', () => ({
  exitFromUnifiedValidationResult: jest.fn(),
  finalizeUnifiedValidationResult: jest.fn().mockReturnValue(0),
  unifiedCliResultFromIntegrationReturn: jest.fn(),
  exitAfterIntegrationDisplay: jest.fn(),
  finalizeAfterIntegrationDisplay: jest.fn(),
  emitCapabilityScopeDiagnostics: jest.fn()
}));

const { runUnifiedDatasourceValidation } = require('../../../lib/datasource/unified-validation-run');
const { resolveAppKeyForDatasource } = require('../../../lib/datasource/resolve-app');
const { getIntegrationPath } = require('../../../lib/utils/paths');
const { writeTestLog } = require('../../../lib/utils/test-log-writer');
const logger = require('../../../lib/utils/logger');

const { datasourceTestCommandAction } = require('../../../lib/commands/datasource-unified-test-cli');

describe('datasource-unified-test-cli (datasource test)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes debug log file when --debug is set', async() => {
    resolveAppKeyForDatasource.mockResolvedValue({ appKey: 'test-e2e-hubspot' });
    getIntegrationPath.mockReturnValue('/repo/integration/test-e2e-hubspot');
    runUnifiedDatasourceValidation.mockResolvedValue({
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: false,
      envelope: { status: 'ok', datasourceKey: 'test-e2e-hubspot-users' }
    });
    writeTestLog.mockResolvedValue('/repo/integration/test-e2e-hubspot/logs/test-2026-04-16.json');

    await datasourceTestCommandAction('test-e2e-hubspot-users', {
      app: 'test-e2e-hubspot',
      env: 'dev',
      verbose: true,
      debug: true,
      timeout: 30000,
      async: true,
      watch: false
    });

    expect(writeTestLog).toHaveBeenCalledWith(
      'test-e2e-hubspot',
      expect.objectContaining({
        request: expect.objectContaining({
          datasourceKey: 'test-e2e-hubspot-users',
          runType: 'test',
          includeDebug: true
        }),
        response: expect.any(Object)
      }),
      'test',
      '/repo/integration'
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/Debug log:/));
  });
});

/**
 * @fileoverview Tests for datasource-unified-test-cli.js (watch flags registration).
 */

const { attachDatasourceWatchOptions } = require('../../../lib/commands/datasource-unified-test-cli');

describe('datasource-unified-test-cli', () => {
  it('attachDatasourceWatchOptions registers watch-related flags', () => {
    const cmd = { option: jest.fn().mockReturnThis() };
    attachDatasourceWatchOptions(cmd);
    expect(cmd.option).toHaveBeenCalledWith('--watch', expect.any(String));
    expect(cmd.option).toHaveBeenCalledWith(
      '--watch-path <path>',
      expect.any(String),
      expect.any(Function),
      []
    );
    expect(cmd.option).toHaveBeenCalledWith('--watch-application-yaml', expect.any(String));
    expect(cmd.option).toHaveBeenCalledWith('--watch-ci', expect.any(String));
    expect(cmd.option).toHaveBeenCalledWith('--watch-full-diff', expect.any(String));
  });

  it('watch-path collector accumulates repeated flags', () => {
    const cmd = { option: jest.fn().mockReturnThis() };
    attachDatasourceWatchOptions(cmd);
    const watchPathCall = cmd.option.mock.calls.find(c => c[0] === '--watch-path <path>');
    expect(watchPathCall).toBeDefined();
    const collect = watchPathCall[2];
    expect(collect('a', [])).toEqual(['a']);
    expect(collect('b', ['a'])).toEqual(['a', 'b']);
  });
});
