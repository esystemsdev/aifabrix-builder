/**
 * Advanced Tests for AI Fabrix Builder Application Run Module
 *
 * @fileoverview Additional tests for app-run.js to improve coverage
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const appRun = require('../../lib/app-run');
const { exec } = require('child_process');
const { promisify } = require('util');
const net = require('net');

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('../../lib/push', () => ({
  checkLocalImageExists: jest.fn()
}));

describe('Application Run Advanced Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(1000); // Set 1 second timeout for all tests in this suite
  });

  describe('generateDockerCompose additional paths', () => {
    it('should generate compose for Python app', async() => {
      const config = {
        language: 'python',
        port: 3000
      };

      const composePath = await appRun.generateDockerCompose('test-app', config, {});
      
      expect(composePath).toBeDefined();
    });

    it('should generate compose with database', async() => {
      const config = {
        language: 'typescript',
        port: 3000
      };
      const services = { database: true };

      const composePath = await appRun.generateDockerCompose('test-app', config, services);
      
      expect(composePath).toBeDefined();
    });

    it('should generate compose with redis', async() => {
      const config = {
        language: 'typescript',
        port: 3000
      };
      const services = { redis: true };

      const composePath = await appRun.generateDockerCompose('test-app', config, services);
      
      expect(composePath).toBeDefined();
    });

    it('should generate compose with storage', async() => {
      const config = {
        language: 'typescript',
        port: 3000
      };
      const services = { storage: true };

      const composePath = await appRun.generateDockerCompose('test-app', config, services);
      
      expect(composePath).toBeDefined();
    });

    it('should generate compose with authentication', async() => {
      const config = {
        language: 'typescript',
        port: 3000
      };
      const services = { authentication: true };

      const composePath = await appRun.generateDockerCompose('test-app', config, services);
      
      expect(composePath).toBeDefined();
    });
  });

  describe('stopAndRemoveContainer error paths', () => {
    it('should handle exec errors gracefully', async() => {
      const execAsync = promisify(require('child_process').exec);
      jest.spyOn(require('child_process'), 'exec').mockImplementation((cmd, callback) => {
        callback(new Error('Container not found'), '', '');
      });

      await expect(appRun.stopAndRemoveContainer('test-app'))
        .resolves.not.toThrow();
    });
  });

  describe('checkContainerRunning error paths', () => {
    it('should handle exec errors gracefully', async() => {
      const execAsync = promisify(require('child_process').exec);
      jest.spyOn(require('child_process'), 'exec').mockImplementation((cmd, callback) => {
        callback(new Error('Container check failed'), '', '');
      });

      const result = await appRun.checkContainerRunning('test-app');
      expect(result).toBe(false);
    });
  });

  describe('checkImageExists error paths', () => {
    it('should handle docker exec errors', async() => {
      const execAsync = promisify(require('child_process').exec);
      jest.spyOn(require('child_process'), 'exec').mockImplementation((cmd, callback) => {
        callback(new Error('Docker error'), '', '');
      });

      const result = await appRun.checkImageExists('nonexistent:latest');
      expect(result).toBe(false);
    });
  });

  // Note: waitForHealthCheck and checkPortAvailable tests removed because they
  // involve real network timeouts that slow down test suite significantly.
  // These functions are covered through integration tests.
});

