/**
 * @fileoverview Tests for datasource test-trust CLI finalize path.
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/datasource/agent-trust-run', () => ({
  runDatasourceAgentTrust: jest.fn()
}));
jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn().mockResolvedValue({ appKey: 'hubspot' })
}));
jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn().mockResolvedValue('/tmp/log.json')
}));

const logger = require('../../../lib/utils/logger');
const { runDatasourceAgentTrust } = require('../../../lib/datasource/agent-trust-run');
const {
  finalizeDatasourceTestTrust,
  runDatasourceTestTrustOnce
} = require('../../../lib/commands/datasource-test-trust-cli');

describe('datasource-test-trust-cli', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runDatasourceAgentTrust.mockResolvedValue({
      trustRun: {
        datasourceKey: 'hubspot-companies',
        trustDecision: 'trusted',
        validationStatus: 'passed',
        confidence: 0.9
      },
      apiError: null
    });
  });

  it('runDatasourceTestTrustOnce forwards summary and timeout', async() => {
    await runDatasourceTestTrustOnce('hubspot-companies', {
      app: 'hubspot',
      env: 'dev',
      summary: true,
      timeout: '60000'
    });
    expect(runDatasourceAgentTrust).toHaveBeenCalledWith(
      'hubspot-companies',
      expect.objectContaining({ summary: true, timeout: '60000' })
    );
  });

  it('finalizeDatasourceTestTrust prints summary line', async() => {
    const code = await finalizeDatasourceTestTrust(
      'hubspot-companies',
      { summary: true },
      {
        trustRun: {
          datasourceKey: 'hubspot-companies',
          trustDecision: 'trusted',
          validationStatus: 'passed',
          confidence: 0.9
        }
      }
    );
    expect(code).toBe(0);
    const text = logger.log.mock.calls.map(c => c[0]).join(' ');
    expect(text).toContain('hubspot-companies');
    expect(text).toContain('trusted');
  });
});
