/**
 * Additional Tests for app-run.js - Debug Paths and Error Handling
 *
 * @fileoverview Tests to improve coverage for debug paths and error handling
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

jest.mock('child_process', () => {
  const actualChildProcess = jest.requireActual('child_process');
  return {
    ...actualChildProcess,
    exec: jest.fn()
  };
});

jest.mock('util', () => {
  const actualUtil = jest.requireActual('util');
  const mockExecAsync = jest.fn();
  return {
    ...actualUtil,
    promisify: jest.fn(() => mockExecAsync)
  };
});

// Mock config and devConfig BEFORE requiring app-run (which requires secrets, which requires config)
// Developer ID: 0 = default infra, > 0 = developer-specific (adds dev{id} prefix)
// Now we only call config.getDeveloperId() once at the start of runApp, then use config.developerId property
jest.mock('../../lib/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1), // Returns integer: 1 for dev-specific, 0 for default
  setDeveloperId: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': 1 }), // Config object with integer developer-id
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue(),
  CONFIG_DIR: '/mock/config/dir',
  CONFIG_FILE: '/mock/config/dir/config.yaml'
}));

jest.mock('../../lib/utils/dev-config', () => {
  const mockGetDevPorts = jest.fn((id) => ({
    app: 3000 + (id * 100),
    postgres: 5432 + (id * 100),
    redis: 6379 + (id * 100),
    pgadmin: 5050 + (id * 100),
    redisCommander: 8081 + (id * 100)
  }));

  return {
    getDevPorts: mockGetDevPorts,
    getBasePorts: jest.fn(() => ({
      app: 3000,
      postgres: 5432,
      redis: 6379,
      pgadmin: 5050,
      redisCommander: 8081
    }))
  };
});

jest.mock('net', () => {
  let portAvailable = true;
  const createMockServer = () => {
    let errorHandler = null;
    const mockServer = {
      listen: jest.fn((port, callback) => {
        if (portAvailable) {
          if (typeof callback === 'function') {
            setTimeout(() => callback(), 0);
          }
        } else {
          setTimeout(() => {
            const error = new Error('EADDRINUSE');
            error.code = 'EADDRINUSE';
            if (errorHandler) errorHandler(error);
          }, 0);
        }
      }),
      close: jest.fn((callback) => {
        if (typeof callback === 'function') callback();
      }),
      on: jest.fn((event, handler) => {
        if (event === 'error') errorHandler = handler;
      })
    };
    return mockServer;
  };
  const mockNet = {
    createServer: jest.fn(() => createMockServer()),
    __setPortAvailable: (available) => {
      portAvailable = available;
    }
  };
  return mockNet;
});

jest.mock('../../lib/validator');
jest.mock('../../lib/infra');
// Mock secrets dependencies first
jest.mock('../../lib/utils/secrets-utils');
jest.mock('../../lib/utils/secrets-path');
jest.mock('../../lib/utils/secrets-generator');
// Mock secrets - must be after config and dev-config mocks
// Using factory function to prevent loading actual secrets.js which requires config
jest.mock('../../lib/secrets', () => {
  // Don't require actual secrets.js here - it would load config
  return {
    generateEnvFile: jest.fn().mockResolvedValue('/path/to/.env'),
    loadSecrets: jest.fn().mockResolvedValue({}),
    resolveKvReferences: jest.fn().mockResolvedValue(''),
    generateAdminSecretsEnv: jest.fn().mockResolvedValue('/path/to/admin-secrets.env'),
    validateSecrets: jest.fn().mockReturnValue({ valid: true, missing: [] }),
    generateMissingSecrets: jest.fn().mockResolvedValue([]),
    createDefaultSecrets: jest.fn().mockResolvedValue()
  };
});
jest.mock('../../lib/utils/health-check');
jest.mock('../../lib/utils/compose-generator');
jest.mock('../../lib/utils/build-copy', () => {
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
jest.mock('../../lib/utils/logger');

const validator = require('../../lib/validator');
const infra = require('../../lib/infra');
const secrets = require('../../lib/secrets');
const healthCheck = require('../../lib/utils/health-check');
const composeGenerator = require('../../lib/utils/compose-generator');
const logger = require('../../lib/utils/logger');

// Require config and app-run - mocks are already set up via jest.mock()
const config = require('../../lib/config');
const appRun = require('../../lib/app-run');
const { promisify } = require('util');

// Get the mock execAsync function
const mockExecAsync = promisify();

describe('App-Run Debug Paths and Error Handling', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Setup default mocks
    fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });
    const configPath = path.join(tempDir, 'builder', 'test-app', 'variables.yaml');
    fsSync.writeFileSync(configPath, yaml.dump({
      port: 3000,
      language: 'typescript'
    }));

    // Create dev directory and .env file (where generateDockerCompose reads from)
    const devDir = path.join(os.homedir(), '.aifabrix', 'test-app-dev-1');
    fsSync.mkdirSync(devDir, { recursive: true });
    fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_PASSWORD=secret123\n');
    fsSync.writeFileSync(path.join(devDir, 'variables.yaml'), yaml.dump({
      port: 3000,
      language: 'typescript'
    }));

    // Mock fsSync.readFileSync for admin secrets
    const adminSecretsPath = path.join(tempDir, 'admin-secrets.env');
    fsSync.writeFileSync(adminSecretsPath, 'POSTGRES_PASSWORD=testpass\n');

    // Reset mocks - don't clear config mocks as they're needed by app-run.js
    validator.validateApplication.mockResolvedValue({ valid: true });
    infra.checkInfraHealth.mockResolvedValue({ postgres: 'healthy', redis: 'healthy' });
    infra.ensureAdminSecrets.mockResolvedValue(adminSecretsPath);
    secrets.generateEnvFile.mockResolvedValue('/path/to/.env');
    healthCheck.waitForHealthCheck.mockResolvedValue();
    composeGenerator.generateDockerCompose.mockResolvedValue('version: "3"');
    composeGenerator.getImageName.mockReturnValue('aifabrix/test-app');

    // Ensure config mock returns correct integer values
    // Developer ID: 0 = default infra, > 0 = developer-specific
    // Now we only call getDeveloperId() once at start of runApp, then use config.developerId property
    config.getDeveloperId.mockResolvedValue(1); // Integer, not string
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    // Clean up dev directories
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
    // Clear mocks in afterEach, but preserve config mock implementations
    // IMPORTANT: Don't clear config mocks - they're needed by app-run.js
    // Clear other mocks individually - don't use jest.clearAllMocks() as it clears config mock
    validator.validateApplication.mockClear();
    infra.checkInfraHealth.mockClear();
    infra.ensureAdminSecrets.mockClear();
    secrets.generateEnvFile.mockClear();
    healthCheck.waitForHealthCheck.mockClear();
    composeGenerator.generateDockerCompose.mockClear();
    composeGenerator.getImageName.mockClear();
    // Ensure config mock returns correct integer values after clearing
    // Developer ID: 0 = default infra, > 0 = developer-specific
    config.getDeveloperId.mockResolvedValue(1); // Integer, not string
  });

  describe('checkImageExists with debug=true', () => {
    it('should log debug messages when debug is enabled and image exists', async() => {
      mockExecAsync.mockResolvedValue({ stdout: 'aifabrix/test-app:latest\n', stderr: '' });

      const result = await appRun.checkImageExists('aifabrix/test-app', 'latest', true);

      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Executing:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Image'));
    });

    it('should log debug messages when debug is enabled and image does not exist', async() => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await appRun.checkImageExists('aifabrix/test-app', 'latest', true);

      expect(result).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Executing:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Image'));
    });

    it('should log debug error message when debug is enabled and exec fails', async() => {
      mockExecAsync.mockRejectedValue(new Error('Docker error'));

      const result = await appRun.checkImageExists('aifabrix/test-app', 'latest', true);

      expect(result).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Image check failed'));
    });
  });

  describe('runApp with debug=true', () => {
    beforeEach(() => {
      // Ensure config mock returns correct integer value
      // Developer ID: 0 = default infra, > 0 = developer-specific (creates aifabrix-dev1-app)
      // Now we only call getDeveloperId() once at start of runApp, then use config.developerId property
      config.getDeveloperId.mockResolvedValue(1); // Integer, not string

      // Mock checkPortAvailable to avoid port conflicts
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      mockExecAsync.mockImplementation((cmd) => {
        if (cmd.includes('docker images')) {
          return Promise.resolve({ stdout: 'aifabrix/test-app:latest\n', stderr: '' });
        } else if (cmd.includes('docker ps')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (cmd.includes('docker-compose')) {
          return Promise.resolve({ stdout: 'Container started', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });

      });
    });

    afterEach(() => {
      // Restore checkPortAvailable mock after each test
      if (appRun.checkPortAvailable.mockRestore) {
        appRun.checkPortAvailable.mockRestore();
      }
    });

    it('should log debug messages throughout runApp when debug is enabled', async() => {
      // Config mock is set up in beforeEach, so it should be available
      // checkPortAvailable is already mocked in beforeEach
      await appRun.runApp('test-app', { debug: true });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Starting run process'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Options:'));
    });

    it('should log debug messages when container is already running', async() => {
      // Ensure config mock returns correct integer value (1 = developer-specific)
      config.getDeveloperId.mockResolvedValue(1); // Integer, creates container name: aifabrix-dev1-test-app

      mockExecAsync.mockImplementation((cmd) => {
        if (cmd.includes('docker images')) {
          return Promise.resolve({ stdout: 'aifabrix/test-app:latest\n', stderr: '' });
        } else if (cmd.includes('docker ps') && cmd.includes('--format')) {
          return Promise.resolve({ stdout: 'aifabrix-dev1-test-app\n', stderr: '' });
        } else if (cmd.includes('docker stop')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (cmd.includes('docker rm')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (cmd.includes('docker-compose')) {
          return Promise.resolve({ stdout: 'Container started', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });

      });

      await appRun.runApp('test-app', { debug: true });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
    });

    it('should log debug error message when container start fails', async() => {
      // Ensure config mock returns correct integer value (1 = developer-specific)
      config.getDeveloperId.mockResolvedValue(1); // Integer, creates container name: aifabrix-dev1-test-app

      mockExecAsync.mockImplementation((cmd) => {
        if (cmd.includes('docker images')) {
          return Promise.resolve({ stdout: 'aifabrix/test-app:latest\n', stderr: '' });
        } else if (cmd.includes('docker ps')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (cmd.includes('docker-compose')) {
          return Promise.reject(new Error('Docker compose failed'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });

      });

      await expect(appRun.runApp('test-app', { debug: true })).rejects.toThrow();

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
    });

    it('should log debug error message when runApp fails', async() => {
      validator.validateApplication.mockRejectedValue(new Error('Validation failed'));

      await expect(appRun.runApp('test-app', { debug: true })).rejects.toThrow();

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Run failed'));
    });
  });

  describe('checkContainerRunning with debug=true', () => {
    it('should log debug messages and container details when container is running', async() => {
      let callCount = 0;
      mockExecAsync.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1 && cmd.includes('--format "{{.Names}}"')) {
          return Promise.resolve({ stdout: 'aifabrix-dev1-test-app\n', stderr: '' });
        } else if (callCount === 2 && cmd.includes('--format "{{.Status}}"')) {
          return Promise.resolve({ stdout: 'Up 5 minutes\n', stderr: '' });
        } else if (callCount === 3 && cmd.includes('--format "{{.Ports}}"')) {
          return Promise.resolve({ stdout: '0.0.0.0:3000->3000/tcp\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });

      });

      // Function signature: checkContainerRunning(appName, developerId, debug)
      const result = await appRun.checkContainerRunning('test-app', 1, true);

      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Executing:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container status'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container ports'));
    });

    it('should log debug error message when container check fails', async() => {
      mockExecAsync.mockRejectedValue(new Error('Docker error'));

      // Function signature: checkContainerRunning(appName, developerId, debug)
      const result = await appRun.checkContainerRunning('test-app', 1, true);

      expect(result).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container check failed'));
    });
  });

  describe('stopAndRemoveContainer with debug=true', () => {
    it('should log debug messages when stopping container', async() => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      // Function signature: stopAndRemoveContainer(appName, developerId, debug)
      await appRun.stopAndRemoveContainer('test-app', 1, true);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Executing:'));
    });

    it('should log debug error message when stop fails', async() => {
      mockExecAsync.mockRejectedValue(new Error('Stop failed'));

      // Function signature: stopAndRemoveContainer(appName, developerId, debug)
      await appRun.stopAndRemoveContainer('test-app', 1, true);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Stop/remove container error'));
    });
  });

  describe('startContainer with debug=true (via runApp)', () => {
    beforeEach(() => {
      // Mock checkPortAvailable to avoid port conflicts
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);
    });

    afterEach(() => {
      if (appRun.checkPortAvailable.mockRestore) {
        appRun.checkPortAvailable.mockRestore();
      }
    });

    it('should log debug messages when starting container through runApp', async() => {
      // Ensure config mock returns correct integer value (1 = developer-specific)
      config.getDeveloperId.mockResolvedValue(1); // Integer, creates container name: aifabrix-dev1-test-app

      let callCount = 0;
      mockExecAsync.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1 && cmd.includes('docker images')) {
          return Promise.resolve({ stdout: 'aifabrix/test-app:latest\n', stderr: '' });
        } else if (callCount === 2 && cmd.includes('docker ps') && cmd.includes('--format "{{.Names}}"')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (callCount === 3 && cmd.includes('docker-compose')) {
          return Promise.resolve({ stdout: 'Container started', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });

      });

      await appRun.runApp('test-app', { debug: true });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Admin secrets path'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Environment variables'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Executing:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Compose file'));
    });

    it('should log debug container status after start through runApp', async() => {
      // Ensure config mock returns correct integer value (1 = developer-specific)
      config.getDeveloperId.mockResolvedValue(1); // Integer, creates container name: aifabrix-dev1-test-app

      let callCount = 0;
      mockExecAsync.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1 && cmd.includes('docker images')) {
          return Promise.resolve({ stdout: 'aifabrix/test-app:latest\n', stderr: '' });
        } else if (callCount === 2 && cmd.includes('docker ps') && cmd.includes('--format "{{.Names}}"')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (callCount === 3 && cmd.includes('docker-compose')) {
          return Promise.resolve({ stdout: 'Container started', stderr: '' });
        } else if (callCount === 4 && cmd.includes('--format "{{.Status}}"')) {
          return Promise.resolve({ stdout: 'Up 1 second\n', stderr: '' });
        } else if (callCount === 5 && cmd.includes('--format "{{.Ports}}"')) {
          return Promise.resolve({ stdout: '0.0.0.0:3000->3000/tcp\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });

      });

      await appRun.runApp('test-app', { debug: true });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container status'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container ports'));
    });
  });
});

