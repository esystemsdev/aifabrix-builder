/**
 * @fileoverview Tests for lib/utils/validation-run-poll.js
 */

const {
  nextPollDelayMs,
  isTerminalReportCompleteness,
  pollValidationRunUntilComplete
} = require('../../../lib/utils/validation-run-poll');

describe('validation-run-poll', () => {
  it('nextPollDelayMs uses fast phase then doubles and caps at 15s', () => {
    expect(nextPollDelayMs(0)).toBe(400);
    expect(nextPollDelayMs(23)).toBe(400);
    expect(nextPollDelayMs(24)).toBe(2000);
    expect(nextPollDelayMs(25)).toBe(4000);
    expect(nextPollDelayMs(27)).toBe(15000);
    expect(nextPollDelayMs(28)).toBe(15000);
  });

  it('isTerminalReportCompleteness is true only for full', () => {
    expect(isTerminalReportCompleteness({ reportCompleteness: 'full' })).toBe(true);
    expect(isTerminalReportCompleteness({ reportCompleteness: 'minimal' })).toBe(false);
  });

  it('pollValidationRunUntilComplete stops on full (first response)', async() => {
    const fetchRun = jest.fn().mockResolvedValue({
      success: true,
      data: { reportCompleteness: 'full', status: 'ok' }
    });
    const r = await pollValidationRunUntilComplete({
      dataplaneUrl: 'https://x',
      authConfig: {},
      testRunId: 't1',
      budgetMs: 60000,
      fetchRun
    });
    expect(r.envelope.reportCompleteness).toBe('full');
    expect(r.timedOut).toBe(false);
    expect(fetchRun).toHaveBeenCalledTimes(1);
    expect(fetchRun).toHaveBeenCalledWith('https://x', {}, 't1', {});
  });

  it('pollValidationRunUntilComplete passes pollRequestTimeoutMs as fourth arg to fetchRun', async() => {
    const fetchRun = jest.fn().mockResolvedValue({
      success: true,
      data: { reportCompleteness: 'full', status: 'ok' }
    });
    await pollValidationRunUntilComplete({
      dataplaneUrl: 'https://x',
      authConfig: {},
      testRunId: 't1',
      budgetMs: 60000,
      fetchRun,
      pollRequestTimeoutMs: 120000
    });
    expect(fetchRun).toHaveBeenCalledWith('https://x', {}, 't1', { timeoutMs: 120000 });
  });

  it('pollValidationRunUntilComplete returns api error from fetchRun', async() => {
    const fetchRun = jest.fn().mockResolvedValue({ success: false, status: 500 });
    const r = await pollValidationRunUntilComplete({
      dataplaneUrl: 'https://x',
      authConfig: {},
      testRunId: 't1',
      budgetMs: 60000,
      fetchRun
    });
    expect(r.envelope).toBeNull();
    expect(r.lastApiResult.success).toBe(false);
  });
});
