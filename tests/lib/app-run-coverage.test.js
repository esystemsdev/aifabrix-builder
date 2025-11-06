/**
 * Additional Coverage Tests for Application Run Module
 *
 * @fileoverview Tests for uncovered code paths in app-run.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
// Mock child_process.exec before requiring app-run module
jest.mock('child_process', () => {
  const actualChildProcess = jest.requireActual('child_process');
  return {
    ...actualChildProcess,
    exec: jest.fn()
  };
});

const appRun = require('../../lib/app-run');

jest.mock('../../lib/validator');
jest.mock('../../lib/infra');
jest.mock('../../lib/secrets');
jest.mock('http');

const validator = require('../../lib/validator');
const infra = require('../../lib/infra');
const secrets = require('../../lib/secrets');
const http = require('http');

describe('Application Run Module - Additional Coverage', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });

    // Reset exec mock before each test
    const { exec } = require('child_process');
    exec.mockReset();
    exec.mockImplementation((command, callback) => {
      // Default: call real implementation for commands we don't explicitly mock
      const actualExec = jest.requireActual('child_process').exec;
      actualExec(command, callback);
    });

    validator.validateApplication.mockResolvedValue({
      valid: true,
      variables: { errors: [], warnings: [] },
      rbac: { errors: [], warnings: [] },
      env: { errors: [], warnings: [] }
    });

    infra.checkInfraHealth.mockResolvedValue({
      postgres: 'healthy',
      redis: 'healthy'
    });

    secrets.generateEnvFile.mockResolvedValue();
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('runApp - validation paths', () => {
    it('should validate app name is required', async() => {
      await expect(appRun.runApp('', {})).rejects.toThrow('Application name is required');
      await expect(appRun.runApp(null, {})).rejects.toThrow('Application name is required');
    });

    it('should handle missing configuration file', async() => {
      await expect(appRun.runApp('missing-app', {})).rejects.toThrow('Application configuration not found');
    });

    it('should handle validation failures', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      validator.validateApplication.mockResolvedValueOnce({
        valid: false,
        variables: {
          errors: ['Invalid port'],
          warnings: []
        }
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Configuration validation failed');
    });

    it('should handle missing Docker image', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      // Use a high port number that's unlikely to be in use (50000+)
      const testPort = 50000 + Math.floor(Math.random() * 10000);
      const variables = {
        app: { key: appName, name: 'Test App' },
        port: testPort,
        build: { localPort: testPort }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Mock validator to pass validation
      validator.validateApplication.mockResolvedValueOnce({ valid: true, variables: { errors: [] } });
      infra.checkInfraHealth.mockResolvedValueOnce({ postgres: 'healthy', redis: 'healthy' });

      // Mock child_process.exec to return empty output for docker images command
      // This simulates the image not being found
      const { exec: mockedExec } = require('child_process');
      mockedExec.mockImplementation((command, callback) => {
        if (command && command.includes('docker images') && command.includes('reference')) {
          // Empty stdout means image not found
          callback(null, { stdout: '', stderr: '' });
        } else if (command && command.includes('docker ps')) {
          // Mock docker ps for container check
          callback(null, { stdout: '', stderr: '' });
        } else {
          // For other commands, fail so test doesn't proceed further
          callback(new Error('Command not expected in this test'), null);
        }
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Docker image');

      // Clean up
      mockedExec.mockReset();
    });

    it('should handle unhealthy infrastructure services', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000, language: 'typescript' },
        database: true
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      fsSync.writeFileSync(
        path.join(appPath, 'package.json'),
        JSON.stringify({ name: appName })
      );

      infra.checkInfraHealth.mockResolvedValueOnce({
        postgres: 'unhealthy',
        redis: 'healthy'
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValueOnce(true);

      await expect(appRun.runApp(appName, {})).rejects.toThrow();

      appRun.checkImageExists.mockRestore();
    });
  });

  describe('generateDockerCompose - edge cases', () => {
    it('should generate compose with all services', async() => {
      const appName = 'test-app';
      // Create .env file with DB_PASSWORD
      fsSync.mkdirSync(path.join(tempDir, 'builder', appName), { recursive: true });
      fsSync.writeFileSync(path.join(tempDir, 'builder', appName, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        build: {
          language: 'typescript',
          port: 3000,
          localPort: 3000
        },
        port: 3000,
        services: {
          database: true,
          redis: true,
          storage: true
        },
        databases: []
      };

      const compose = await appRun.generateDockerCompose(appName, config, { port: 3000 });
      expect(compose).toContain('services:');
      expect(compose).toContain('test-app');
    });

    it('should generate compose for Python app', async() => {
      const appName = 'python-app';
      // Create .env file with DB_PASSWORD
      fsSync.mkdirSync(path.join(tempDir, 'builder', appName), { recursive: true });
      fsSync.writeFileSync(path.join(tempDir, 'builder', appName, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        build: {
          language: 'python',
          port: 8000,
          localPort: 8000
        },
        port: 8000,
        services: {
          database: false,
          redis: false
        },
        databases: []
      };

      const compose = await appRun.generateDockerCompose(appName, config, { port: 8000 });
      expect(compose).toContain('services:');
    });

    it('should throw error for unsupported language', async() => {
      const appName = 'invalid-app';
      const config = {
        build: {
          language: 'unsupported',
          port: 3000
        },
        port: 3000,
        services: {},
        databases: []
      };

      await expect(appRun.generateDockerCompose(appName, config, {})).rejects.toThrow();
    });
  });

  describe('waitForHealthCheck - timeout scenarios', () => {
    beforeEach(() => {
      jest.useFakeTimers();

      // Mock http.request to return unhealthy responses
      const mockHttpRequest = {
        on: jest.fn(),
        destroy: jest.fn(),
        end: jest.fn()
      };

      http.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 500,
          headers: {},
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(JSON.stringify({ status: 'down' })));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        if (callback) callback(mockResponse);
        return mockHttpRequest;
      });

      // Mock exec for docker commands
      const { exec } = require('child_process');
      exec.mockImplementation((command, callback) => {
        if (command && command.includes('docker ps -a')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (command && command.includes('docker inspect')) {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('should timeout when container never becomes healthy', async() => {
      const appName = 'test-app';

      const promise = appRun.waitForHealthCheck(appName, 2, 3000);

      // Fast-forward timers to exceed timeout
      jest.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Health check timeout');
    }, 10000);

    it('should handle container becoming unhealthy', async() => {
      const appName = 'test-app';

      const promise = appRun.waitForHealthCheck(appName, 2, 3000);

      // Fast-forward timers to exceed timeout
      jest.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Health check timeout');
    });
  });

  describe('port and container management', () => {
    it('should check port availability', async() => {
      const result = await appRun.checkPortAvailable(3000);
      expect(typeof result).toBe('boolean');
    });

    it('should handle port conflicts', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(false);

      await expect(appRun.runApp(appName, {})).rejects.toThrow();

      appRun.checkImageExists.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });

    it('should stop and remove existing container', async() => {
      const appName = 'existing-app';

      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(true);

      await appRun.stopAndRemoveContainer(`aifabrix-${appName}`);

      appRun.checkContainerRunning.mockRestore();
    });
  });
});

