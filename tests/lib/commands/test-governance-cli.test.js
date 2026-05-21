/**
 * @fileoverview Tests for test-governance CLI
 */

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  getIntegrationPath: jest.fn()
}));
jest.mock('../../../lib/commands/test-governance-external', () => ({
  runTestGovernanceForExternalSystem: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

const { detectAppType } = require('../../../lib/utils/paths');
const { runTestGovernanceForExternalSystem } = require('../../../lib/commands/test-governance-external');
const logger = require('../../../lib/utils/logger');
const { runTestGovernanceCommandAction } = require('../../../lib/commands/test-governance-command-action');

const SAMPLE_RESULT = {
  packKey: 'test-protection-v1',
  summary: { total: 1, passed: 1, failed: 0 },
  scenarios: [
    {
      id: 's1',
      status: 'pass',
      verdict: 'PASS: ok',
      subjectUserId: 'u1',
      subjectDisplayName: 'User',
      subjectGroups: [],
      visibleKeyCount: 1,
      unexpectedVisibleKeys: [],
      missingRequiredKeys: [],
      excludedAbac: 0,
      excludedFilter: 0,
      auditRef: 'rss-1'
    }
  ]
};

describe('test-governance-cli', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({ baseDir: 'integration' });
    runTestGovernanceForExternalSystem.mockResolvedValue({
      result: SAMPLE_RESULT,
      packPath: '/tmp/pack.yaml',
      systemKey: 'test-protection'
    });
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit.mockRestore();
  });

  it('prints TTY verdict lines when verbose', async() => {
    await runTestGovernanceCommandAction('test-protection', { verbose: true });
    const output = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('PASS: ok');
    expect(output).not.toContain('metadata');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('prints redacted json with --json', async() => {
    await runTestGovernanceCommandAction('test-protection', { json: true });
    const jsonLine = logger.log.mock.calls.find(c => typeof c[0] === 'string' && c[0].startsWith('{'));
    expect(jsonLine).toBeTruthy();
    const parsed = JSON.parse(jsonLine[0]);
    expect(parsed.scenarios[0].auditRef).toBe('rss-1');
    expect(parsed.scenarios[0].metadata).toBeUndefined();
  });

  it('exits 1 when scenarios fail', async() => {
    runTestGovernanceForExternalSystem.mockResolvedValue({
      result: {
        ...SAMPLE_RESULT,
        summary: { total: 1, passed: 0, failed: 1 },
        scenarios: [{ ...SAMPLE_RESULT.scenarios[0], status: 'fail' }]
      },
      packPath: '/tmp/pack.yaml',
      systemKey: 'test-protection'
    });
    await runTestGovernanceCommandAction('test-protection', {});
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('handler exits 3 on missing pack', async() => {
    const { testGovernanceCommandHandler } = require('../../../lib/commands/test-governance-command-action');
    runTestGovernanceForExternalSystem.mockRejectedValue(new Error('No scenario pack found'));
    await testGovernanceCommandHandler('test-protection', {});
    expect(process.exit).toHaveBeenCalledWith(3);
  });
});
