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
  displaySystemTrustRollupTTY: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const { detectAppType } = require('../../../lib/utils/paths');
const { runTestTrustForExternalSystem } = require('../../../lib/commands/test-trust-external');
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
});
