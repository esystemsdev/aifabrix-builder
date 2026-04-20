/**
 * @fileoverview runSystemLevelTest — sequential fan-out and aggregate success.
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn().mockResolvedValue('/tmp/system-test-log.json')
}));

jest.mock('../../../lib/datasource/unified-validation-run', () => ({
  runUnifiedDatasourceValidation: jest.fn()
}));

const { runUnifiedDatasourceValidation } = require('../../../lib/datasource/unified-validation-run');
const { runSystemLevelTest } = require('../../../lib/external-system/test-system-level');

describe('runSystemLevelTest', () => {
  const baseParams = {
    appName: 'my-app',
    systemKey: 'my-system',
    environment: 'dev',
    runType: 'integration',
    debug: false,
    timeout: 30000
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success true when datasource list is empty', async() => {
    const r = await runSystemLevelTest({ ...baseParams, datasourceKeys: [] });
    expect(r.success).toBe(true);
    expect(r.datasourceResults).toEqual([]);
    expect(runUnifiedDatasourceValidation).not.toHaveBeenCalled();
  });

  it('returns success true when every datasource envelope is non-fail', async() => {
    runUnifiedDatasourceValidation.mockResolvedValue({
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: false,
      envelope: { status: 'ok' }
    });
    const r = await runSystemLevelTest({
      ...baseParams,
      datasourceKeys: ['ds-a', 'ds-b']
    });
    expect(r.success).toBe(true);
    expect(r.datasourceResults).toHaveLength(2);
    expect(r.datasourceResults.every(x => x.success)).toBe(true);
    expect(runUnifiedDatasourceValidation).toHaveBeenCalledTimes(2);
  });

  it('returns success false when any datasource has fail status', async() => {
    runUnifiedDatasourceValidation
      .mockResolvedValueOnce({
        apiError: null,
        pollTimedOut: false,
        incompleteNoAsync: false,
        envelope: { status: 'ok' }
      })
      .mockResolvedValueOnce({
        apiError: null,
        pollTimedOut: false,
        incompleteNoAsync: false,
        envelope: { status: 'fail' }
      });
    const r = await runSystemLevelTest({
      ...baseParams,
      datasourceKeys: ['ds-a', 'ds-b']
    });
    expect(r.success).toBe(false);
    expect(r.datasourceResults[1].success).toBe(false);
  });

  it('treats warn as aggregate success (only fail fails the rollup)', async() => {
    runUnifiedDatasourceValidation.mockResolvedValue({
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: false,
      envelope: { status: 'warn' }
    });
    const r = await runSystemLevelTest({
      ...baseParams,
      datasourceKeys: ['ds-w']
    });
    expect(r.success).toBe(true);
    expect(r.datasourceResults[0].success).toBe(true);
  });

  it('maps apiError to per-datasource failure', async() => {
    runUnifiedDatasourceValidation.mockResolvedValue({
      apiError: { formattedError: 'bad gateway', error: 'bad', status: 502 },
      pollTimedOut: false,
      incompleteNoAsync: false,
      envelope: null
    });
    const r = await runSystemLevelTest({
      ...baseParams,
      datasourceKeys: ['ds-x']
    });
    expect(r.success).toBe(false);
    expect(r.datasourceResults[0].success).toBe(false);
    expect(r.datasourceResults[0].error).toContain('bad');
  });

  it('treats skipped root status as aggregate success', async() => {
    runUnifiedDatasourceValidation.mockResolvedValue({
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: false,
      envelope: { status: 'skipped' }
    });
    const r = await runSystemLevelTest({
      ...baseParams,
      datasourceKeys: ['ds-skip']
    });
    expect(r.success).toBe(true);
    expect(r.datasourceResults[0].success).toBe(true);
  });

  it('treats poll timeout as failure even if envelope status is ok', async() => {
    runUnifiedDatasourceValidation.mockResolvedValue({
      apiError: null,
      pollTimedOut: true,
      incompleteNoAsync: false,
      envelope: { status: 'ok' }
    });
    const r = await runSystemLevelTest({
      ...baseParams,
      datasourceKeys: ['ds-to']
    });
    expect(r.success).toBe(false);
    expect(r.datasourceResults[0].success).toBe(false);
    expect(r.datasourceResults[0].error).toMatch(/timeout|incomplete/i);
  });

  it('treats incompleteNoAsync as failure', async() => {
    runUnifiedDatasourceValidation.mockResolvedValue({
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: true,
      envelope: { status: 'ok' }
    });
    const r = await runSystemLevelTest({
      ...baseParams,
      datasourceKeys: ['ds-async']
    });
    expect(r.success).toBe(false);
    expect(r.datasourceResults[0].error).toMatch(/async|incomplete/i);
  });
});
