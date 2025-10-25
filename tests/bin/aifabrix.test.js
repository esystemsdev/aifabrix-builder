/**
 * Tests for bin/aifabrix.js CLI entry point
 */

// Mock the CLI module to avoid command parsing during tests
jest.mock('../../lib/cli', () => ({
  setupCommands: jest.fn()
}));

const aifabrix = require('../../bin/aifabrix');

describe('AI Fabrix CLI Entry Point', () => {
  describe('initializeCLI', () => {
    it('should be a function', () => {
      expect(typeof aifabrix.initializeCLI).toBe('function');
    });

    it('should not throw when called', () => {
      // Mock process.argv to avoid parsing Jest arguments
      const originalArgv = process.argv;
      process.argv = ['node', 'aifabrix.js'];

      // Mock Commander to avoid parsing arguments
      const originalCommand = require('commander').Command;
      const mockCommand = jest.fn().mockImplementation(() => ({
        name: jest.fn().mockReturnThis(),
        version: jest.fn().mockReturnThis(),
        description: jest.fn().mockReturnThis(),
        parse: jest.fn()
      }));
      require('commander').Command = mockCommand;

      expect(() => {
        aifabrix.initializeCLI();
      }).not.toThrow();

      // Restore original values
      process.argv = originalArgv;
      require('commander').Command = originalCommand;
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
