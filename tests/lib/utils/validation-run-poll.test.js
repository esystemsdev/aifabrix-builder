/**
 * @fileoverview Tests for lib/utils/validation-run-poll.js
 */

const {
  nextPollDelayMs,
  isTerminalReportCompleteness,
  pollValidationRunUntilComplete
} = require('../../../lib/utils/validation-run-poll');

describe('validation-run-poll', () => {
  it('nextPollDelayMs doubles and caps at 15s', () => {
    expect(nextPollDelayMs(0)).toBe(2000);
    expect(nextPollDelayMs(1)).toBe(4000);
    expect(nextPollDelayMs(3)).toBe(15000);
    expect(nextPollDelayMs(4)).toBe(15000);
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
