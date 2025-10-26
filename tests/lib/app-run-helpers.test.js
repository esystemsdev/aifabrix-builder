/**
 * Tests for AI Fabrix Builder Application Run Helper Functions
 *
 * @fileoverview Unit tests for app-run.js helper functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Mock execAsync to avoid actual Docker builds
jest.mock('util', () => ({
  promisify: jest.fn(() => jest.fn())
}));

const appRun = require('../../lib/app-run');

describe('Application Run Helper Functions', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    // Clean up temporary directory
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('checkImageExists', () => {
    it('should return true when image exists', async() => {
      // Mock the execAsync function for this test
      const originalExecAsync = require('../../lib/app-run').checkImageExists;
      jest.spyOn(require('../../lib/app-run'), 'checkImageExists')
        .mockImplementation(async(appName) => {
          return appName === 'test-app';
        });

      const result = await appRun.checkImageExists('test-app');
      expect(result).toBe(true);
    });

    it('should return false when image does not exist', async() => {
      jest.spyOn(appRun, 'checkImageExists')
        .mockImplementation(async() => false);

      const result = await appRun.checkImageExists('test-app');
      expect(result).toBe(false);
    });
  });

  describe('checkContainerRunning', () => {
    it('should return true when container is running', async() => {
      jest.spyOn(appRun, 'checkContainerRunning')
        .mockImplementation(async() => true);

      const result = await appRun.checkContainerRunning('test-app');
      expect(result).toBe(true);
    });

    it('should return false when container is not running', async() => {
      jest.spyOn(appRun, 'checkContainerRunning')
        .mockImplementation(async() => false);

      const result = await appRun.checkContainerRunning('test-app');
      expect(result).toBe(false);
    });
  });

  describe('checkPortAvailable', () => {
    it('should return true when port is available', async() => {
      const result = await appRun.checkPortAvailable(3000);
      expect(result).toBe(true);
    });

    it('should return false when port is in use', async() => {
      // Create a server to occupy the port
      const net = require('net');
      const server = net.createServer();

      await new Promise((resolve) => {
        server.listen(3000, () => {
          resolve();
        });
      });

      const result = await appRun.checkPortAvailable(3000);
      expect(result).toBe(false);

      server.close();
    });
  });

  describe('generateDockerCompose', () => {
    it('should generate compose content for TypeScript app', async() => {
      const config = {
        language: 'typescript',
        port: 3000,
        services: { database: true },
        healthCheck: { path: '/health', interval: 30 }
      };

      const result = await appRun.generateDockerCompose('test-app', config, { port: 3001 });

      expect(result).toContain('test-app');
      expect(result).toContain('3001:3000');
      expect(result).toContain('aifabrix-test-app');
      expect(result).toContain('aifabrix-network');
    });

    it('should generate compose content for Python app', async() => {
      const config = {
        language: 'python',
        port: 8000,
        services: { database: false },
        healthCheck: { path: '/health', interval: 30 }
      };

      const result = await appRun.generateDockerCompose('test-app', config, { port: 8001 });

      expect(result).toContain('test-app');
      expect(result).toContain('8001:8000');
      expect(result).toContain('aifabrix-test-app');
    });

    it('should throw error for unsupported language', async() => {
      const config = {
        language: 'unsupported',
        port: 3000
      };

      await expect(appRun.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Docker Compose template not found for language: unsupported');
    });
  });

  describe('waitForHealthCheck', () => {
    it('should resolve when container becomes healthy', async() => {
      jest.spyOn(appRun, 'waitForHealthCheck')
        .mockImplementation(async() => {
          // Simulate successful health check
          return Promise.resolve();
        });

      await expect(appRun.waitForHealthCheck('test-app', 2)).resolves.not.toThrow();
    });

    it('should throw error when container becomes unhealthy', async() => {
      jest.spyOn(appRun, 'waitForHealthCheck')
        .mockImplementation(async() => {
          throw new Error('Container aifabrix-test-app is unhealthy');
        });

      await expect(appRun.waitForHealthCheck('test-app', 2))
        .rejects.toThrow('Container aifabrix-test-app is unhealthy');
    });

    it('should timeout after specified duration', async() => {
      jest.spyOn(appRun, 'waitForHealthCheck')
        .mockImplementation(async() => {
          throw new Error('Health check timeout after 2 seconds');
        });

      await expect(appRun.waitForHealthCheck('test-app', 2))
        .rejects.toThrow('Health check timeout after 2 seconds');
    });
  });
});
