/**
 * @fileoverview Tests for validation-run-post-retry.js
 */

jest.mock('../../../lib/api/validation-run.api', () => ({
  postValidationRun: jest.fn(),
  getValidationRun: jest.fn()
}));

const { postValidationRun, getValidationRun } = require('../../../lib/api/validation-run.api');
const {
  isRetryablePostFailure,
  postValidationRunWithTransportRetry,
  getValidationRunWithTransportRetry
} = require('../../../lib/utils/validation-run-post-retry');

describe('validation-run-post-retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isRetryablePostFailure', () => {
    it('returns false on success', () => {
      expect(isRetryablePostFailure({ success: true })).toBe(false);
    });

    it('returns false when not network', () => {
      expect(isRetryablePostFailure({ success: false, network: false })).toBe(false);
    });

    it('returns true for ECONNRESET', () => {
      expect(
        isRetryablePostFailure({
          success: false,
          network: true,
          originalError: { code: 'ECONNRESET' }
        })
      ).toBe(true);
    });

    it('returns true for AbortError', () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      expect(
        isRetryablePostFailure({
          success: false,
          network: true,
          originalError: e
        })
      ).toBe(true);
    });
  });

  describe('postValidationRunWithTransportRetry', () => {
    it('returns immediately on success', async() => {
      postValidationRun.mockResolvedValue({ success: true, data: {}, status: 200 });
      const res = await postValidationRunWithTransportRetry('https://dp', { token: 't' }, { runType: 'test' });
      expect(res.success).toBe(true);
      expect(postValidationRun).toHaveBeenCalledTimes(1);
    });

    it('retries once after ECONNRESET with 1s backoff then succeeds', async() => {
      postValidationRun
        .mockResolvedValueOnce({
          success: false,
          network: true,
          originalError: { code: 'ECONNRESET' }
        })
        .mockResolvedValueOnce({ success: true, data: { status: 'pass' }, status: 200 });

      const p = postValidationRunWithTransportRetry('https://dp', {}, { runType: 'test' });
      await jest.advanceTimersByTimeAsync(1000);
      const res = await p;

      expect(res.success).toBe(true);
      expect(postValidationRun).toHaveBeenCalledTimes(2);
    });

    it('uses second backoff and third attempt on two retryable failures', async() => {
      const fail = {
        success: false,
        network: true,
        originalError: { code: 'ETIMEDOUT' }
      };
      postValidationRun
        .mockResolvedValueOnce(fail)
        .mockResolvedValueOnce(fail)
        .mockResolvedValueOnce({ success: true, data: {}, status: 200 });

      const p = postValidationRunWithTransportRetry('https://dp', {}, {});
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      const res = await p;

      expect(res.success).toBe(true);
      expect(postValidationRun).toHaveBeenCalledTimes(3);
    });

    it('does not retry HTTP-style failure', async() => {
      postValidationRun.mockResolvedValue({ success: false, status: 500, network: false });
      const res = await postValidationRunWithTransportRetry('https://dp', {}, {});
      expect(res.success).toBe(false);
      expect(postValidationRun).toHaveBeenCalledTimes(1);
    });
  });

  describe('getValidationRunWithTransportRetry', () => {
    it('returns immediately on success', async() => {
      getValidationRun.mockResolvedValue({ success: true, data: { reportCompleteness: 'full' }, status: 200 });
      const res = await getValidationRunWithTransportRetry('https://dp', { token: 't' }, 'run-1');
      expect(res.success).toBe(true);
      expect(getValidationRun).toHaveBeenCalledTimes(1);
    });

    it('retries once after ECONNRESET with 1s backoff then succeeds', async() => {
      getValidationRun
        .mockResolvedValueOnce({
          success: false,
          network: true,
          originalError: { code: 'ECONNRESET' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { reportCompleteness: 'partial' },
          status: 200
        });

      const p = getValidationRunWithTransportRetry('https://dp', {}, 'id-9');
      await jest.advanceTimersByTimeAsync(1000);
      const res = await p;

      expect(res.success).toBe(true);
      expect(getValidationRun).toHaveBeenCalledTimes(2);
    });
  });
});
