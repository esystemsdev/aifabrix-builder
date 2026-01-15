/**
 * Tests for Logger Utility Module
 *
 * @fileoverview Unit tests for lib/utils/logger.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const logger = require('../../../lib/utils/logger');

describe('Logger Utility Module', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    // Save original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;

    // Create spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('log', () => {
    it('should call console.log with provided arguments', () => {
      logger.log('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('test message');
    });

    it('should handle multiple arguments', () => {
      logger.log('message', 123, { key: 'value' });
      expect(consoleLogSpy).toHaveBeenCalledWith('message', 123, { key: 'value' });
    });

    it('should handle empty arguments', () => {
      logger.log();
      expect(consoleLogSpy).toHaveBeenCalledWith();
    });

    it('should handle undefined and null', () => {
      logger.log(undefined, null);
      expect(consoleLogSpy).toHaveBeenCalledWith(undefined, null);
    });
  });

  describe('error', () => {
    it('should call console.error with provided arguments', () => {
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('error message');
    });

    it('should handle multiple arguments', () => {
      logger.error('error', 500, { code: 'ERR' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('error', 500, { code: 'ERR' });
    });

    it('should handle Error objects', () => {
      const error = new Error('test error');
      logger.error(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('warn', () => {
    it('should call console.warn with provided arguments', () => {
      logger.warn('warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message');
    });

    it('should handle multiple arguments', () => {
      logger.warn('warning', 'deprecated', { reason: 'old' });
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning', 'deprecated', { reason: 'old' });
    });
  });

  describe('info', () => {
    it('should call console.log with provided arguments', () => {
      logger.info('info message');
      expect(consoleLogSpy).toHaveBeenCalledWith('info message');
    });

    it('should handle multiple arguments', () => {
      logger.info('info', 200, { status: 'ok' });
      expect(consoleLogSpy).toHaveBeenCalledWith('info', 200, { status: 'ok' });
    });

    it('should behave the same as log', () => {
      const message = 'test';
      logger.info(message);
      logger.log(message);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, message);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, message);
    });
  });
});

