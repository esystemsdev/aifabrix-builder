'use strict';

jest.mock('ora', () => {
  const stop = jest.fn();
  const start = jest.fn(() => ({ stop, text: '' }));
  return jest.fn(() => ({ start, stop }));
});

const ora = require('ora');
const {
  shouldUseCredentialPushSpinner,
  runWithCredentialPushSpinner
} = require('../../../lib/utils/credential-push-ui');

describe('credential-push-ui', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    jest.clearAllMocks();
  });

  it('skips spinner when not TTY', async() => {
    process.stdout.isTTY = false;
    const work = jest.fn().mockResolvedValue({ pushed: 1 });
    const result = await runWithCredentialPushSpinner(work, { systemKey: 'hubspot' });
    expect(result).toEqual({ pushed: 1 });
    expect(ora).not.toHaveBeenCalled();
    expect(work).toHaveBeenCalled();
  });

  it('skips spinner when json mode', () => {
    process.stdout.isTTY = true;
    expect(shouldUseCredentialPushSpinner({ json: true })).toBe(false);
  });

  it('uses ora when TTY', async() => {
    process.stdout.isTTY = true;
    const work = jest.fn().mockResolvedValue({ pushed: 2 });
    await runWithCredentialPushSpinner(work, { systemKey: 'hubspot' });
    expect(ora).toHaveBeenCalled();
    expect(work).toHaveBeenCalled();
  });
});
