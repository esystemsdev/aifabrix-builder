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
jest.mock('../../lib/secrets');
jest.mock('../../lib/utils/health-check');
jest.mock('../../lib/utils/compose-generator');
jest.mock('../../lib/utils/logger');

const validator = require('../../lib/validator');
const infra = require('../../lib/infra');
const secrets = require('../../lib/secrets');
const healthCheck = require('../../lib/utils/health-check');
const composeGenerator = require('../../lib/utils/compose-generator');
const logger = require('../../lib/utils/logger');

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

    validator.validateApplication.mockResolvedValue({ valid: true });
    infra.checkInfraHealth.mockResolvedValue({ postgres: 'healthy', redis: 'healthy' });
    infra.ensureAdminSecrets.mockResolvedValue('/path/to/admin-secrets.env');
    secrets.generateEnvFile.mockResolvedValue('/path/to/.env');
    healthCheck.waitForHealthCheck.mockResolvedValue();
    composeGenerator.generateDockerCompose.mockResolvedValue('version: "3"');
    composeGenerator.getImageName.mockReturnValue('aifabrix/test-app');

    // Mock fsSync.readFileSync for admin secrets
    const adminSecretsPath = path.join(tempDir, 'admin-secrets.env');
    fsSync.writeFileSync(adminSecretsPath, 'POSTGRES_PASSWORD=testpass\n');
    infra.ensureAdminSecrets.mockResolvedValue(adminSecretsPath);

    jest.clearAllMocks();
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
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

    it('should log debug messages throughout runApp when debug is enabled', async() => {
      await appRun.runApp('test-app', { debug: true });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Starting run process'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Options:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Configuration loaded'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Port selection'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Port'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Compose file generated'));
    });

    it('should log debug messages when container is already running', async() => {
      mockExecAsync.mockImplementation((cmd) => {
        if (cmd.includes('docker images')) {
          return Promise.resolve({ stdout: 'aifabrix/test-app:latest\n', stderr: '' });
        } else if (cmd.includes('docker ps') && cmd.includes('--format')) {
          return Promise.resolve({ stdout: 'aifabrix-test-app\n', stderr: '' });
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

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Error during container start'));
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
          return Promise.resolve({ stdout: 'aifabrix-test-app\n', stderr: '' });
        } else if (callCount === 2 && cmd.includes('--format "{{.Status}}"')) {
          return Promise.resolve({ stdout: 'Up 5 minutes\n', stderr: '' });
        } else if (callCount === 3 && cmd.includes('--format "{{.Ports}}"')) {
          return Promise.resolve({ stdout: '0.0.0.0:3000->3000/tcp\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });

      });

      const result = await appRun.checkContainerRunning('test-app', true);

      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Executing:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container status'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container ports'));
    });

    it('should log debug error message when container check fails', async() => {
      mockExecAsync.mockRejectedValue(new Error('Docker error'));

      const result = await appRun.checkContainerRunning('test-app', true);

      expect(result).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Container check failed'));
    });
  });

  describe('stopAndRemoveContainer with debug=true', () => {
    it('should log debug messages when stopping container', async() => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await appRun.stopAndRemoveContainer('test-app', true);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Executing:'));
    });

    it('should log debug error message when stop fails', async() => {
      mockExecAsync.mockRejectedValue(new Error('Stop failed'));

      await appRun.stopAndRemoveContainer('test-app', true);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Stop/remove container error'));
    });
  });

  describe('startContainer with debug=true (via runApp)', () => {
    it('should log debug messages when starting container through runApp', async() => {
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

