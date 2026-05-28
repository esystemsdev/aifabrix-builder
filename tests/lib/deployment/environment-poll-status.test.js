/**
 * @fileoverview Unit tests for environment deployment poll status helpers
 */

const {
  extractDeploymentRecord,
  isTerminalPollApiResponse,
  buildPollStatusError,
  fetchDeploymentStatusById
} = require('../../../lib/deployment/environment-poll-status');

describe('environment-poll-status', () => {
  describe('extractDeploymentRecord', () => {
    it('returns nested data.data deployment', () => {
      const record = { status: 'pending', progress: 0 };
      expect(extractDeploymentRecord({ success: true, data: { data: record } })).toEqual(record);
    });

    it('returns null for API error response', () => {
      expect(extractDeploymentRecord({ success: false, status: 404 })).toBeNull();
    });
  });

  describe('isTerminalPollApiResponse', () => {
    it('treats 404 as terminal', () => {
      expect(isTerminalPollApiResponse({ success: false, status: 404 })).toBe(true);
    });

    it('does not treat 503 as terminal', () => {
      expect(isTerminalPollApiResponse({ success: false, status: 503 })).toBe(false);
    });
  });

  describe('fetchDeploymentStatusById', () => {
    it('returns deployment from pipeline endpoint', async() => {
      const deployment = { status: 'pending', progress: 10 };
      const getPipelineDeployment = jest.fn().mockResolvedValue({ success: true, data: { data: deployment } });
      const getDeployment = jest.fn();

      const result = await fetchDeploymentStatusById(
        getPipelineDeployment,
        getDeployment,
        'http://localhost:3610',
        'tst',
        'dep-1',
        { type: 'bearer', token: 't' }
      );

      expect(result).toEqual(deployment);
      expect(getDeployment).not.toHaveBeenCalled();
    });

    it('throws when both endpoints return terminal 404', async() => {
      const notFound = {
        success: false,
        status: 404,
        error: 'Environment with key \'tst\' not found',
        formattedError: 'Environment with key \'tst\' not found'
      };
      const getPipelineDeployment = jest.fn().mockResolvedValue(notFound);
      const getDeployment = jest.fn().mockResolvedValue(notFound);

      await expect(
        fetchDeploymentStatusById(
          getPipelineDeployment,
          getDeployment,
          'http://localhost:3610',
          'tst',
          'dep-1',
          { type: 'bearer', token: 't' }
        )
      ).rejects.toMatchObject({
        message: 'Environment with key \'tst\' not found',
        pollTerminal: true
      });
    });

    it('returns null when responses are retryable', async() => {
      const getPipelineDeployment = jest.fn().mockResolvedValue({ success: false, status: 503 });
      const getDeployment = jest.fn().mockResolvedValue({ success: false, status: 502 });

      const result = await fetchDeploymentStatusById(
        getPipelineDeployment,
        getDeployment,
        'http://localhost:3610',
        'tst',
        'dep-1',
        { type: 'bearer', token: 't' }
      );

      expect(result).toBeNull();
    });
  });

  describe('buildPollStatusError', () => {
    it('sets pollTerminal on error', () => {
      const err = buildPollStatusError(
        { success: false, status: 404, formattedError: 'not found' },
        null
      );
      expect(err.pollTerminal).toBe(true);
      expect(err.message).toBe('not found');
    });
  });
});
