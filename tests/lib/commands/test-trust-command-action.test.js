/**
 * @fileoverview Tests for test-trust top-level CLI action.
 */

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));
jest.mock('../../../lib/commands/test-trust-external', () => ({
  runTestTrustForExternalSystem: jest.fn()
}));
jest.mock('../../../lib/utils/agent-trust-run-display', () => ({
  displaySystemTrustRollupTTY: jest.fn(),
  displayAgentTrustRunTTY: jest.fn()
}));
jest.mock('../../../lib/datasource/agent-trust-debug-log', () => ({
  writeTrustDebugLogAndPrint: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const { detectAppType } = require('../../../lib/utils/paths');
const { runTestTrustForExternalSystem } = require('../../../lib/commands/test-trust-external');
const { displayAgentTrustRunTTY } = require('../../../lib/utils/agent-trust-run-display');
const { writeTrustDebugLogAndPrint } = require('../../../lib/datasource/agent-trust-debug-log');
const { runTestTrustCommandAction } = require('../../../lib/commands/test-trust-command-action');

describe('test-trust-command-action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({ baseDir: 'integration' });
    runTestTrustForExternalSystem.mockResolvedValue({
      success: true,
      systemKey: 'hubspot',
      results: [
        {
          key: 'hubspot-companies',
          success: true,
          trustRun: { trustDecision: 'trusted', validationStatus: 'passed' }
        }
      ]
    });
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit.mockRestore();
  });

  it('rejects builder apps', async() => {
    detectAppType.mockResolvedValue({ baseDir: 'builder' });
    await expect(runTestTrustCommandAction('myapp', {})).rejects.toThrow(
      'external integration folders only'
    );
  });

  it('passes timeout and summary to external runner', async() => {
    await runTestTrustCommandAction('hubspot', {
      summary: true,
      timeout: '90000',
      revalidate: false
    });
    expect(runTestTrustForExternalSystem).toHaveBeenCalledWith(
      'hubspot',
      expect.objectContaining({ summary: true, timeout: '90000' })
    );
  });

  it('passes revalidate and writes debug logs when -d --revalidate', async() => {
    await runTestTrustCommandAction(
      'hubspot',
      { env: 'dev' },
      { rawArgs: ['node', 'aifabrix', 'test-trust', 'hubspot', '-d', '--revalidate', '-v'] }
    );
    expect(runTestTrustForExternalSystem).toHaveBeenCalledWith(
      'hubspot',
      expect.objectContaining({ revalidate: true, debug: true, verbose: true })
    );
    expect(writeTrustDebugLogAndPrint).toHaveBeenCalled();
    expect(displayAgentTrustRunTTY).toHaveBeenCalled();
  });
});
