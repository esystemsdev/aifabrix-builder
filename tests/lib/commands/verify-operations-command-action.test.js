/**
 * @fileoverview Tests for verify-operations CLI action (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/commands/verify-operations-external', () => ({
  runVerifyOperationsForExternalSystem: jest.fn()
}));
jest.mock('../../../lib/lifecycle/report-display', () => ({
  displayVerifyOperationsTTY: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { runVerifyOperationsForExternalSystem } = require('../../../lib/commands/verify-operations-external');
const { displayVerifyOperationsTTY } = require('../../../lib/lifecycle/report-display');
const { runVerifyOperationsCommandAction } = require('../../../lib/commands/verify-operations-command-action');

describe('verify-operations-command-action', () => {
  const verifiedResult = {
    systemKey: 'acme-crm',
    command: 'verify-operations',
    verdict: 'VERIFIED',
    operationalReadinessPercent: 100,
    warnings: [],
    details: { reliability: { validation: true } }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    runVerifyOperationsForExternalSystem.mockResolvedValue(verifiedResult);
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit.mockRestore();
  });

  it('--json includes hero metric and omits details without flag', async() => {
    await runVerifyOperationsCommandAction('acme-crm', { json: true }, { rawArgs: [] });
    const jsonLine = logger.log.mock.calls.find(c => typeof c[0] === 'string' && c[0].startsWith('{'));
    expect(jsonLine).toBeTruthy();
    const parsed = JSON.parse(jsonLine[0]);
    expect(parsed.operationalReadinessPercent).toBe(100);
    expect(parsed.details).toBeUndefined();
    expect(displayVerifyOperationsTTY).not.toHaveBeenCalled();
  });

  it('--json with -v includes details block', async() => {
    await runVerifyOperationsCommandAction(
      'acme-crm',
      { json: true, verbose: true },
      { rawArgs: ['--json', '-v'] }
    );
    const parsed = JSON.parse(logger.log.mock.calls[0][0]);
    expect(parsed.details).toBeDefined();
  });

  it('exits 1 when verdict is FAILED', async() => {
    runVerifyOperationsForExternalSystem.mockResolvedValue({
      ...verifiedResult,
      verdict: 'FAILED',
      operationalReadinessPercent: 40
    });
    await runVerifyOperationsCommandAction('acme-crm', {}, { rawArgs: [] });
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits 0 when verdict is VERIFIED', async() => {
    await runVerifyOperationsCommandAction('acme-crm', {}, { rawArgs: [] });
    expect(process.exit).not.toHaveBeenCalled();
  });
});
