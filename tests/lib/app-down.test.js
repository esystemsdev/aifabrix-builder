/**
 * Tests for AI Fabrix Builder App Down Module
 *
 * @fileoverview Unit tests for app-down.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.white = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('../../lib/app-run-helpers', () => ({
  stopAndRemoveContainer: jest.fn()
}));

jest.mock('../../lib/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1)
}));

jest.mock('../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { exec } = require('child_process');
const config = require('../../lib/config');
const helpers = require('../../lib/app-run-helpers');
const appDown = require('../../lib/app-down');
const logger = require('../../lib/utils/logger');

describe('App Down Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should stop and remove container without volumes', async() => {
    helpers.stopAndRemoveContainer.mockResolvedValue();

    await appDown.downApp('myapp', { volumes: false });

    expect(config.getDeveloperId).toHaveBeenCalled();
    expect(helpers.stopAndRemoveContainer).toHaveBeenCalledWith('myapp', 1, false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('should stop container and remove volume when --volumes is set', async() => {
    helpers.stopAndRemoveContainer.mockResolvedValue();
    // Mock exec to simulate successful volume remove
    exec.mockImplementation((command, optionsOrCb, cbMaybe) => {
      const cb = typeof optionsOrCb === 'function' ? optionsOrCb : cbMaybe;
      setImmediate(() => cb(null, 'removed', ''));
      return { kill: jest.fn() };
    });

    await appDown.downApp('myapp', { volumes: true });

    expect(helpers.stopAndRemoveContainer).toHaveBeenCalledWith('myapp', 1, false);
    expect(exec).toHaveBeenCalled();
    // Ensure a gray info is logged if needed and success message printed
    expect(logger.log).toHaveBeenCalled();
  });

  it('should ignore missing volume errors gracefully', async() => {
    helpers.stopAndRemoveContainer.mockResolvedValue();
    // Mock exec to simulate error (e.g., no such volume)
    exec.mockImplementation((command, optionsOrCb, cbMaybe) => {
      const cb = typeof optionsOrCb === 'function' ? optionsOrCb : cbMaybe;
      setImmediate(() => cb(new Error('No such volume'), '', ''));
      return { kill: jest.fn() };
    });

    await appDown.downApp('myapp', { volumes: true });

    expect(helpers.stopAndRemoveContainer).toHaveBeenCalled();
    // Error swallowed and gray log printed
    expect(logger.log).toHaveBeenCalled();
  });

  it('should remove legacy dev0 volume name when developerId is 0', async() => {
    const configModule = require('../../lib/config');
    configModule.getDeveloperId.mockResolvedValueOnce(0);
    helpers.stopAndRemoveContainer.mockResolvedValue();

    // First attempt (primaryName) fails, second attempt (legacy dev0) succeeds
    let callCount = 0;
    exec.mockImplementation((command, optionsOrCb, cbMaybe) => {
      const cb = typeof optionsOrCb === 'function' ? optionsOrCb : cbMaybe;
      callCount += 1;
      if (callCount === 1) {
        setImmediate(() => cb(new Error('No such volume'), '', ''));
      } else {
        setImmediate(() => cb(null, 'removed', ''));
      }
      return { kill: jest.fn() };
    });

    await appDown.downApp('myapp', { volumes: true });

    // Two attempts: primary (aifabrix_myapp_data) and legacy (aifabrix_dev0_myapp_data)
    expect(exec).toHaveBeenCalledTimes(2);
    expect(helpers.stopAndRemoveContainer).toHaveBeenCalledWith('myapp', 0, false);
  });

  it('should validate app name and throw on invalid', async() => {
    await expect(appDown.downApp('', {})).rejects.toThrow('Failed to stop application');
    await expect(appDown.downApp(null, {})).rejects.toThrow('Failed to stop application');
  });
});

