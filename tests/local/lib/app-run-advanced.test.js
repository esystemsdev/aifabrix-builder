/**
 * Advanced Tests for AI Fabrix Builder Application Run Module
 *
 * @fileoverview Additional tests for app-run.js to improve coverage
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// CRITICAL: Mock http FIRST before any modules that might use it
jest.mock('http', () => {
  const mockHttpRequest = {
    on: jest.fn(),
    destroy: jest.fn(),
    end: jest.fn()
  };

  return {
    request: jest.fn((options, callback) => {
      // Default: return healthy response immediately
      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            setImmediate(() => handler(Buffer.from(JSON.stringify({ status: 'ok' }))));
          }
          if (event === 'end') {
            setImmediate(() => handler());
          }
        })
      };
      if (callback) {
        setImmediate(() => callback(mockResponse));
      }
      return mockHttpRequest;
    })
  };
});

// CRITICAL: Ensure fetch is mocked before any modules load
if (!global.fetch || typeof global.fetch.mockResolvedValue !== 'function') {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: jest.fn().mockReturnValue('application/json')
    },
    json: jest.fn().mockResolvedValue({ success: true }),
    text: jest.fn().mockResolvedValue('OK')
  });
}

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('../../../lib/push', () => ({
  checkLocalImageExists: jest.fn()
}));

// Mock health-check module to prevent real HTTP calls
jest.mock('../../../lib/utils/health-check', () => ({
  waitForHealthCheck: jest.fn().mockResolvedValue(true),
  checkHealthEndpoint: jest.fn().mockResolvedValue(true)
}));

// Mock config module to return developer ID 1
jest.mock('../../../lib/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1),
  setDeveloperId: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': 1 }),
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue()
}));

// Mock build-copy module
jest.mock('../../../lib/utils/build-copy', () => {
  const os = require('os');
  const path = require('path');
  return {
    getDevDirectory: jest.fn((appName, devId) => {
      return path.join(os.homedir(), '.aifabrix', `${appName}-dev-${devId}`);
    }),
    copyBuilderToDevDirectory: jest.fn().mockResolvedValue(path.join(os.homedir(), '.aifabrix', 'test-app-dev-1')),
    devDirectoryExists: jest.fn().mockReturnValue(true)
  };
});

const appRun = require('../../../lib/app-run');
const { exec } = require('child_process');
const { promisify } = require('util');
const net = require('net');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const healthCheck = require('../../../lib/utils/health-check');
const config = require('../../../lib/config');

describe('Application Run Advanced Tests', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    jest.clearAllMocks();
    jest.setTimeout(1000); // Set 1 second timeout for all tests in this suite

    // Reset health check mock
    healthCheck.waitForHealthCheck.mockResolvedValue(true);
    healthCheck.checkHealthEndpoint.mockResolvedValue(true);

    // Reset config mock to return developer ID 1
    config.getDeveloperId.mockResolvedValue(1);
    config.getConfig.mockResolvedValue({ 'developer-id': 1 });

    // Reset http.request mock to default implementation
    http.request.mockClear();
    const mockHttpRequest = {
      on: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn()
    };

    http.request.mockImplementation((options, callback) => {
      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            setImmediate(() => handler(Buffer.from(JSON.stringify({ status: 'ok' }))));
          }
          if (event === 'end') {
            setImmediate(() => handler());
          }
        })
      };
      if (callback) {
        setImmediate(() => callback(mockResponse));
      }
      return mockHttpRequest;
    });

    // Reset fetch mock to default implementation
    if (global.fetch && typeof global.fetch.mockResolvedValue === 'function') {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({ success: true }),
        text: jest.fn().mockResolvedValue('OK')
      });
    }
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    // Clean up dev directories
    const fs = require('fs').promises;
    const aifabrixDir = path.join(os.homedir(), '.aifabrix');
    if (fsSync.existsSync(aifabrixDir)) {
      const entries = await fs.readdir(aifabrixDir).catch(() => []);
      for (const entry of entries) {
        if (entry.startsWith('test-app-dev-')) {
          const entryPath = path.join(aifabrixDir, entry);
          await fs.rm(entryPath, { recursive: true, force: true }).catch(() => {});
        }
      }
    }
    jest.restoreAllMocks();
  });

  describe('generateDockerCompose additional paths', () => {
    it('should generate compose for Python app', async() => {
      const appName = 'test-app';
      const appDir = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      // Create .env file in dev directory (where generateDockerCompose reads from)
      const devDir = path.join(os.homedir(), '.aifabrix', `${appName}-dev-1`);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        language: 'python',
        port: 3000
      };

      const composePath = await appRun.generateDockerCompose('test-app', config, {});

      expect(composePath).toBeDefined();
    });

    it('should generate compose with database', async() => {
      const appName = 'test-app';
      const appDir = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      // Create .env file in dev directory (where generateDockerCompose reads from)
      const devDir = path.join(os.homedir(), '.aifabrix', `${appName}-dev-1`);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        language: 'typescript',
        port: 3000
      };
      const services = { database: true };

      const composePath = await appRun.generateDockerCompose('test-app', config, services);

      expect(composePath).toBeDefined();
    });

    it('should generate compose with redis', async() => {
      const appName = 'test-app';
      const appDir = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      // Create .env file in dev directory (where generateDockerCompose reads from)
      const devDir = path.join(os.homedir(), '.aifabrix', `${appName}-dev-1`);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        language: 'typescript',
        port: 3000
      };
      const services = { redis: true };

      const composePath = await appRun.generateDockerCompose('test-app', config, services);

      expect(composePath).toBeDefined();
    });

    it('should generate compose with storage', async() => {
      const appName = 'test-app';
      const appDir = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      // Create .env file in dev directory (where generateDockerCompose reads from)
      const devDir = path.join(os.homedir(), '.aifabrix', `${appName}-dev-1`);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        language: 'typescript',
        port: 3000
      };
      const services = { storage: true };

      const composePath = await appRun.generateDockerCompose('test-app', config, services);

      expect(composePath).toBeDefined();
    });

    it('should generate compose with authentication', async() => {
      const appName = 'test-app';
      const appDir = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      // Create .env file in dev directory (where generateDockerCompose reads from)
      const devDir = path.join(os.homedir(), '.aifabrix', `${appName}-dev-1`);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_PASSWORD=secret123\n');

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

