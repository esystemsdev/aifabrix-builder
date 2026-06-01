/**
 * @fileoverview Tests for verify-step-progress
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn(),
    text: ''
  }));
});

const logger = require('../../../lib/utils/logger');
const ora = require('ora');
const {
  runWithVerifyStepProgress,
  formatVerifyStepLabel
} = require('../../../lib/lifecycle/verify-step-progress');

describe('verify-step-progress', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
    jest.clearAllMocks();
  });

  it('formatVerifyStepLabel appends ellipsis once', () => {
    expect(formatVerifyStepLabel('Running E2E tests')).toBe('Running E2E tests…');
    expect(formatVerifyStepLabel('Running E2E tests…')).toBe('Running E2E tests…');
  });

  it('skips UI when json mode is true', async() => {
    const work = jest.fn().mockResolvedValue('ok');
    const result = await runWithVerifyStepProgress('Saving', work, { json: true });
    expect(result).toBe('ok');
    expect(logger.log).not.toHaveBeenCalled();
    expect(ora).not.toHaveBeenCalled();
  });

  it('logs progress line on non-TTY', async() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const work = jest.fn().mockResolvedValue(true);
    await runWithVerifyStepProgress('Running unit tests', work, {});
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Running unit tests'));
    expect(ora).not.toHaveBeenCalled();
  });

  it('uses ora spinner on TTY and updates label when setLabel is called', async() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const stop = jest.fn();
    const spinner = { stop, text: '' };
    const start = jest.fn().mockReturnValue(spinner);
    ora.mockReturnValue({ start });

    await runWithVerifyStepProgress('Running E2E tests', async({ setLabel }) => {
      setLabel('Running E2E: ds-one (1/2)');
      return { success: true };
    }, {});

    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
    expect(spinner.text).toContain('Running E2E: ds-one (1/2)');
    expect(logger.log).not.toHaveBeenCalled();
  });
});
