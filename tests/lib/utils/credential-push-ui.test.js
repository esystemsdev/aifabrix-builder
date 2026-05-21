'use strict';

jest.mock('ora', () => {
  const stop = jest.fn();
  const start = jest.fn(() => ({ stop, text: '' }));
  return jest.fn(() => ({ start, stop }));
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const ora = require('ora');
const logger = require('../../../lib/utils/logger');
const {
  shouldShowCredentialPushProgress,
  shouldUseCredentialPushSpinner,
  runWithCredentialPushSpinner
} = require('../../../lib/utils/credential-push-ui');

describe('credential-push-ui', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    jest.clearAllMocks();
  });

  it('skips progress line when json mode', async() => {
    process.stdout.isTTY = true;
    const work = jest.fn().mockResolvedValue({ pushed: 1 });
    await runWithCredentialPushSpinner(work, { systemKey: 'hubspot', json: true });
    expect(logger.log).not.toHaveBeenCalled();
    expect(ora).not.toHaveBeenCalled();
    expect(work).toHaveBeenCalled();
  });

  it('logs ⏳ progress line when not TTY', async() => {
    process.stdout.isTTY = false;
    const work = jest.fn().mockResolvedValue({ pushed: 1 });
    await runWithCredentialPushSpinner(work, { systemKey: 'hubspot' });
    expect(logger.log).toHaveBeenCalled();
    const line = String(logger.log.mock.calls[0][0]);
    expect(line).toContain('Pushing credential secrets for hubspot');
    expect(ora).not.toHaveBeenCalled();
    expect(work).toHaveBeenCalled();
  });

  it('shouldShowCredentialPushProgress respects json only', () => {
    expect(shouldShowCredentialPushProgress({ json: true })).toBe(false);
    expect(shouldShowCredentialPushProgress({ json: false })).toBe(true);
    process.stdout.isTTY = false;
    expect(shouldShowCredentialPushProgress({})).toBe(true);
  });

  it('uses ora with label on TTY without duplicate logger line', async() => {
    process.stdout.isTTY = true;
    const work = jest.fn().mockResolvedValue({ pushed: 2 });
    await runWithCredentialPushSpinner(work, { systemKey: 'hubspot' });
    expect(logger.log).not.toHaveBeenCalled();
    expect(ora).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Pushing credential secrets for hubspot')
      })
    );
    expect(work).toHaveBeenCalled();
  });

  it('shouldUseCredentialPushSpinner is false when not TTY', () => {
    process.stdout.isTTY = false;
    expect(shouldUseCredentialPushSpinner({})).toBe(false);
  });
});
