/**
 * @fileoverview Tests for verify-governance CLI action.
 */

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  getIntegrationPath: jest.fn()
}));
jest.mock('../../../lib/lifecycle/report-display', () => ({
  displayVerifyGovernanceTTY: jest.fn()
}));
jest.mock('../../../lib/commands/verify-governance-external', () => ({
  runVerifyGovernanceForExternalSystem: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

const { runVerifyGovernanceForExternalSystem } = require('../../../lib/commands/verify-governance-external');
const { runVerifyGovernanceCommandAction } = require('../../../lib/commands/verify-governance-command-action');

describe('verify-governance-command-action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runVerifyGovernanceForExternalSystem.mockResolvedValue({
      systemKey: 'test-protection',
      command: 'verify-governance',
      verdict: 'VERIFIED',
      policyCoveragePercent: 100,
      dimensionCoveragePercent: 100,
      enforcementScenarios: { passed: 1, total: 1 },
      datasourceRows: []
    });
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit.mockRestore();
  });

  it('delegates to verify-governance external runner', async() => {
    await runVerifyGovernanceCommandAction('test-protection', { verbose: true });
    expect(runVerifyGovernanceForExternalSystem).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits 1 when governance verify fails', async() => {
    runVerifyGovernanceForExternalSystem.mockResolvedValue({
      systemKey: 'test-protection',
      verdict: 'FAILED',
      policyCoveragePercent: 0,
      dimensionCoveragePercent: 0,
      enforcementScenarios: { passed: 0, total: 1 },
      datasourceRows: []
    });
    await runVerifyGovernanceCommandAction('test-protection', {});
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
