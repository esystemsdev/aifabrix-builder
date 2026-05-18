'use strict';

describe('deploy .protection', () => {
  let exitSpy;
  let loggerError;

  beforeEach(() => {
    loggerError = jest.fn();
    jest.resetModules();
    jest.doMock('../../../lib/utils/logger', () => ({
      log: jest.fn(),
      error: loggerError
    }));
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.dontMock('../../../lib/utils/logger');
  });

  it('exits with not-implemented message', async() => {
    const { deployApp } = require('../../../lib/app/deploy');
    await expect(deployApp('.protection', {})).rejects.toThrow('exit');
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('upload .protection')
    );
  });
});
