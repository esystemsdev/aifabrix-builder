/**
 * Additional Coverage Tests for Application Run Module
 *
 * @fileoverview Tests for uncovered code paths in app-run.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock fs to use real implementation to override any other mocks
jest.mock('fs', () => {
  return jest.requireActual('fs');
});

const fs = require('fs').promises;
const fsSync = require('fs');

// Mock config and dev-config BEFORE requiring app-run (which requires secrets, which requires config)
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1),
  setDeveloperId: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': 1 }),
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue(),
  CONFIG_DIR: '/mock/config/dir',
  CONFIG_FILE: '/mock/config/dir/config.yaml'
}));

jest.mock('../../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn((id) => ({
    app: 3000 + (id * 100),
    postgres: 5432 + (id * 100),
    redis: 6379 + (id * 100),
    pgadmin: 5050 + (id * 100),
    redisCommander: 8081 + (id * 100)
  })),
  getBasePorts: jest.fn(() => ({
    app: 3000,
    postgres: 5432,
    redis: 6379,
    pgadmin: 5050,
    redisCommander: 8081
  }))
}));

// Mock secrets dependencies
jest.mock('../../../lib/utils/secrets-utils');
jest.mock('../../../lib/utils/secrets-path');
jest.mock('../../../lib/utils/secrets-generator');

// Mock child_process.exec
jest.mock('child_process', () => {
  const actualChildProcess = jest.requireActual('child_process');
  return {
    ...actualChildProcess,
    exec: jest.fn()
  };
});

jest.mock('../../../lib/validation/validator');
jest.mock('../../../lib/infrastructure');
jest.mock('../../../lib/utils/health-check', () => ({
  waitForHealthCheck: jest.fn().mockResolvedValue(true),
  checkHealthEndpoint: jest.fn().mockResolvedValue(true),
  checkPortAvailable: jest.fn().mockResolvedValue(true),
  waitForDbInit: jest.fn().mockResolvedValue()
}));
jest.mock('../../../lib/utils/compose-generator', () => ({
  generateDockerCompose: jest.fn().mockResolvedValue('version: "3"\nservices:\n  test-app:\n    image: test-app'),
  getImageName: jest.fn().mockReturnValue('test-app')
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));
jest.mock('net', () => {
  const actualNet = jest.requireActual('net');
  return {
    ...actualNet,
    createServer: jest.fn(() => {
      const mockServer = {
        listen: jest.fn((port, callback) => {
          if (typeof callback === 'function') {
            setImmediate(callback);
          }
          return mockServer;
        }),
        close: jest.fn((callback) => {
          if (typeof callback === 'function') {
            setImmediate(callback);
          }
          return mockServer;
        }),
        on: jest.fn()
      };
      return mockServer;
    })
  };
});
jest.mock('../../../lib/core/secrets', () => ({
  generateEnvFile: jest.fn().mockResolvedValue('/path/to/.env'),
  loadSecrets: jest.fn().mockResolvedValue({}),
  resolveKvReferences: jest.fn().mockResolvedValue(''),
  generateAdminSecretsEnv: jest.fn().mockResolvedValue('/path/to/admin-secrets.env'),
  validateSecrets: jest.fn().mockReturnValue({ valid: true, missing: [] }),
  generateMissingSecrets: jest.fn().mockResolvedValue([]),
  createDefaultSecrets: jest.fn().mockResolvedValue()
}));
jest.mock('http', () => ({
  request: jest.fn((options, callback) => {
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
    return {
      on: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn()
    };
  })
}));

const appRun = require('../../../lib/app/run');
const validator = require('../../../lib/validation/validator');
const infra = require('../../../lib/infrastructure');
const secrets = require('../../../lib/core/secrets');
const healthCheck = require('../../../lib/utils/health-check');
const composeGenerator = require('../../../lib/utils/compose-generator');

describe('Application Run Module - Additional Coverage', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });

    // Reset exec mock - default to empty success
    const { exec } = require('child_process');
    exec.mockReset();
    exec.mockImplementation((command, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (typeof cb === 'function') {
        cb(null, '', '');
      }
    });

    // Reset all mocks
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

    secrets.generateEnvFile.mockResolvedValue('/path/to/.env');
    healthCheck.waitForHealthCheck.mockResolvedValue(true);
    composeGenerator.generateDockerCompose.mockResolvedValue('version: "3"\nservices:\n  test-app:\n    image: test-app');
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

      const configPath = path.join(appPath, 'variables.yaml');
      const configContent = yaml.dump({ app: { key: appName, name: 'Test App' }, build: { port: 3000 } });
      fsSync.writeFileSync(configPath, configContent, 'utf8');

      // Verify file exists and was written correctly - use statSync for reliable check
      expect(fsSync.statSync(configPath).isFile()).toBe(true);
      const writtenContent = fsSync.readFileSync(configPath, 'utf8');
      expect(writtenContent).toBeTruthy();
      expect(writtenContent).toContain('test-app');

      validator.validateApplication.mockResolvedValueOnce({
        valid: false,
        variables: { errors: ['Invalid port'], warnings: [] },
        rbac: { errors: [], warnings: [] },
        env: { errors: [], warnings: [] }
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Configuration validation failed');
    });

    it('should handle missing Docker image', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const testPort = 50000 + Math.floor(Math.random() * 10000);
      const configPath = path.join(appPath, 'variables.yaml');
      const configContent = yaml.dump({
        app: { key: appName, name: 'Test App' },
        port: testPort,
        build: { localPort: testPort }
      });
      fsSync.writeFileSync(configPath, configContent, 'utf8');

      // Verify file exists and was written correctly - use statSync for reliable check
      expect(fsSync.statSync(configPath).isFile()).toBe(true);
      const writtenContent = fsSync.readFileSync(configPath, 'utf8');
      expect(writtenContent).toBeTruthy();
      expect(writtenContent).toContain('test-app');

      validator.validateApplication.mockResolvedValueOnce({
        valid: true,
        variables: { errors: [], warnings: [] },
        rbac: { errors: [], warnings: [] },
        env: { errors: [], warnings: [] }
      });
      infra.checkInfraHealth.mockResolvedValueOnce({ postgres: 'healthy', redis: 'healthy' });

      const { exec } = require('child_process');
      exec.mockImplementation((command, options, callback) => {
        const cb = typeof options === 'function' ? options : callback;
        if (command && command.includes('docker images') && command.includes('reference')) {
          if (typeof cb === 'function') {
            cb(null, '', '');
          }
        } else if (typeof cb === 'function') {
          cb(null, '', '');
        }
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Docker image');
    });

    it('should handle unhealthy infrastructure services', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({
          app: { key: appName, name: 'Test App' },
          build: { port: 3000, language: 'typescript' },
          database: true
        })
      );
      fsSync.writeFileSync(
        path.join(appPath, 'package.json'),
        JSON.stringify({ name: appName })
      );

      const { exec } = require('child_process');
      exec.mockImplementation((command, options, callback) => {
        const cb = typeof options === 'function' ? options : callback;
        if (command && command.includes('docker images')) {
          if (typeof cb === 'function') {
            cb(null, `${appName}:latest\n`, '');
          }
        } else if (typeof cb === 'function') {
          cb(null, '', '');
        }
      });

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
      fsSync.mkdirSync(path.join(tempDir, 'builder', appName), { recursive: true });
      fsSync.writeFileSync(path.join(tempDir, 'builder', appName, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        build: { language: 'typescript', port: 3000, localPort: 3000 },
        port: 3000,
        services: { database: true, redis: true, storage: true },
        databases: []
      };

      composeGenerator.generateDockerCompose.mockResolvedValueOnce('version: "3"\nservices:\n  test-app:\n    image: test-app');
      const compose = await appRun.generateDockerCompose(appName, config, { port: 3000 });
      expect(compose).toContain('services:');
      expect(compose).toContain('test-app');
    });

    it('should generate compose for Python app', async() => {
      const appName = 'python-app';
      fsSync.mkdirSync(path.join(tempDir, 'builder', appName), { recursive: true });
      fsSync.writeFileSync(path.join(tempDir, 'builder', appName, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        build: { language: 'python', port: 8000, localPort: 8000 },
        port: 8000,
        services: { database: false, redis: false },
        databases: []
      };

      composeGenerator.generateDockerCompose.mockResolvedValueOnce('version: "3"\nservices:\n  python-app:\n    image: python-app');
      const compose = await appRun.generateDockerCompose(appName, config, { port: 8000 });
      expect(compose).toContain('services:');
    });

    it('should throw error for unsupported language', async() => {
      const config = {
        build: { language: 'unsupported', port: 3000 },
        port: 3000,
        services: {},
        databases: []
      };

      composeGenerator.generateDockerCompose.mockRejectedValueOnce(new Error('Unsupported language'));
      await expect(appRun.generateDockerCompose('invalid-app', config, {})).rejects.toThrow();
    });
  });

  describe('waitForHealthCheck - timeout scenarios', () => {
    it('should timeout when container never becomes healthy', async() => {
      healthCheck.waitForHealthCheck.mockRejectedValueOnce(new Error('Health check timeout'));
      await expect(appRun.waitForHealthCheck('test-app', 2, 3000)).rejects.toThrow('Health check timeout');
    });

    it('should handle container becoming unhealthy', async() => {
      healthCheck.waitForHealthCheck.mockRejectedValueOnce(new Error('Health check timeout'));
      await expect(appRun.waitForHealthCheck('test-app', 2, 3000)).rejects.toThrow('Health check timeout');
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

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump({ app: { key: appName, name: 'Test App' }, build: { port: 3000 } })
      );

      const { exec } = require('child_process');
      exec.mockImplementation((command, options, callback) => {
        const cb = typeof options === 'function' ? options : callback;
        if (command && command.includes('docker images')) {
          if (typeof cb === 'function') {
            cb(null, `${appName}:latest\n`, '');
          }
        } else if (typeof cb === 'function') {
          cb(null, '', '');
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(false);

      await expect(appRun.runApp(appName, {})).rejects.toThrow();

      appRun.checkImageExists.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });

    it('should stop and remove existing container', async() => {
      const { exec } = require('child_process');
      exec.mockImplementation((command, options, callback) => {
        const cb = typeof options === 'function' ? options : callback;
        if (typeof cb === 'function') {
          cb(null, '', '');
        }
      });

      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(true);
      await appRun.stopAndRemoveContainer('existing-app');
      appRun.checkContainerRunning.mockRestore();
    });
  });
});
