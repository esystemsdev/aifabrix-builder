/**
 * @fileoverview Tests for verify-trust top-level CLI action.
 */

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));
jest.mock('../../../lib/lifecycle/report-display', () => ({
  displayVerifyTrustTTY: jest.fn()
}));
jest.mock('../../../lib/commands/verify-trust-external', () => ({
  runVerifyTrustForExternalSystem: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const { detectAppType } = require('../../../lib/utils/paths');
const { runVerifyTrustForExternalSystem } = require('../../../lib/commands/verify-trust-external');
const { runVerifyTrustCommandAction } = require('../../../lib/commands/verify-trust-command-action');

describe('verify-trust-command-action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({ baseDir: 'integration' });
    runVerifyTrustForExternalSystem.mockResolvedValue({
      systemKey: 'hubspot',
      command: 'verify-trust',
      verdict: 'VERIFIED',
      businessContextConfidencePercent: 95,
      datasourceRows: []
    });
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit.mockRestore();
  });

  it('rejects builder apps', async() => {
    detectAppType.mockResolvedValue({ baseDir: 'builder' });
    await expect(runVerifyTrustCommandAction('myapp', {})).rejects.toThrow(
      'external integration folders only'
    );
  });

  it('delegates to verify-trust runner with parsed flags', async() => {
    await runVerifyTrustCommandAction(
      'hubspot',
      { revalidate: true },
      { rawArgs: ['node', 'aifabrix', 'verify-trust', 'hubspot', '-d', '--revalidate', '-v'] }
    );
    expect(runVerifyTrustForExternalSystem).toHaveBeenCalledWith(
      'hubspot',
      expect.objectContaining({ revalidate: true, debug: true, verbose: true })
    );
  });
});
