/**
 * Tests for bin/aifabrix.js CLI entry point
 */

// Mock commander before anything else
const mockParse = jest.fn();
jest.mock('commander', () => {
  const mockCommand = jest.fn().mockImplementation(() => ({
    name: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    parse: mockParse
  }));
  return {
    Command: mockCommand
  };
});

// Mock the CLI module to avoid command parsing during tests
jest.mock('../../lib/cli', () => ({
  setupCommands: jest.fn()
}));

jest.mock('../../lib/commands/app', () => ({
  setupAppCommands: jest.fn()
}));

const aifabrix = require('../../bin/aifabrix');

describe('AI Fabrix CLI Entry Point', () => {
  describe('initializeCLI', () => {
    it('should be a function', () => {
      expect(typeof aifabrix.initializeCLI).toBe('function');
    });

    it('should not throw when called', () => {
      // Reset the parse mock
      mockParse.mockClear();

      expect(() => {
        aifabrix.initializeCLI();
      }).not.toThrow();

      // Verify parse was called
      expect(mockParse).toHaveBeenCalled();
    });

    it('should be exported as module', () => {
      expect(aifabrix).toHaveProperty('initializeCLI');
    });
  });

  describe('module structure', () => {
    it('should export initializeCLI function', () => {
      expect(aifabrix).toEqual({
        initializeCLI: expect.any(Function)
      });
    });
  });
});
