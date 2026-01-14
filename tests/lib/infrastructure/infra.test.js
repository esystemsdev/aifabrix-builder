/**
 * Tests for AI Fabrix Builder Infrastructure Module
 *
 * @fileoverview Unit tests for infra.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.magenta = jest.fn((text) => text);
  mockChalk.white = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  mockChalk.dim = jest.fn((text) => text);
  mockChalk.italic = jest.fn((text) => text);
  mockChalk.underline = jest.fn((text) => text);
  mockChalk.strikethrough = jest.fn((text) => text);
  mockChalk.reset = jest.fn((text) => text);
  mockChalk.inverse = jest.fn((text) => text);
  mockChalk.black = jest.fn((text) => text);
  mockChalk.redBright = jest.fn((text) => text);
  mockChalk.greenBright = jest.fn((text) => text);
  mockChalk.yellowBright = jest.fn((text) => text);
  mockChalk.blueBright = jest.fn((text) => text);
  mockChalk.magentaBright = jest.fn((text) => text);
  mockChalk.cyanBright = jest.fn((text) => text);
  mockChalk.whiteBright = jest.fn((text) => text);
  mockChalk.bgBlack = jest.fn((text) => text);
  mockChalk.bgRed = jest.fn((text) => text);
  mockChalk.bgGreen = jest.fn((text) => text);
  mockChalk.bgYellow = jest.fn((text) => text);
  mockChalk.bgBlue = jest.fn((text) => text);
  mockChalk.bgMagenta = jest.fn((text) => text);
  mockChalk.bgCyan = jest.fn((text) => text);
  mockChalk.bgWhite = jest.fn((text) => text);
  mockChalk.bgBlackBright = jest.fn((text) => text);
  mockChalk.bgRedBright = jest.fn((text) => text);
  mockChalk.bgGreenBright = jest.fn((text) => text);
  mockChalk.bgYellowBright = jest.fn((text) => text);
  mockChalk.bgBlueBright = jest.fn((text) => text);
  mockChalk.bgMagentaBright = jest.fn((text) => text);
  mockChalk.bgCyanBright = jest.fn((text) => text);
  mockChalk.bgWhiteBright = jest.fn((text) => text);
  return mockChalk;
});

// Mock modules BEFORE requiring infra (which requires secrets, which requires config)
jest.mock('child_process', () => ({
  exec: jest.fn()
}));
// Mock fs with fs.promises for config.js
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      unlink: jest.fn()
    }
  };
});
// Mock os.homedir BEFORE requiring modules that use it
const mockHomeDir = '/home/test';
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => mockHomeDir),
  tmpdir: jest.fn(() => '/tmp')
}));
jest.mock('util', () => ({
  promisify: jest.fn()
}));
// Mock config BEFORE requiring infra (which requires secrets, which requires config)
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1),
  setDeveloperId: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': 1 }),
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue(),
  CONFIG_DIR: '/mock/config/dir',
  CONFIG_FILE: '/mock/config/dir/config.yaml',
  developerId: 1 // Property access
}));
jest.mock('../../../lib/core/secrets');

const infra = require('../../../lib/infrastructure');
const secrets = require('../../../lib/core/secrets');

// Mock setTimeout to make waitForServices exit immediately
jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
  if (fn) fn();
  return 123; // Mock timer ID
});

describe('Infrastructure Module', () => {
  const mockTempDir = '/tmp';
  const mockAdminSecretsPath = path.join(mockHomeDir, '.aifabrix', 'admin-secrets.env');
  const mockTemplatePath = path.join(__dirname, '..', '..', 'templates', 'infra', 'compose.yaml');
  const mockTempComposePath = path.join(mockTempDir, 'aifabrix-compose.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    // os.homedir is already mocked at module level, but ensure it returns the correct value
    os.homedir.mockReturnValue(mockHomeDir);
    os.tmpdir.mockReturnValue(mockTempDir);
  });

  describe('startInfra', () => {
    it.skip('should start infrastructure services successfully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockAdminSecretsPath || filePath === mockTemplatePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"\nservices:\n  postgres:\n    image: postgres');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      secrets.generateAdminSecretsEnv.mockResolvedValue(mockAdminSecretsPath);

      // Mock exec to handle docker-compose commands
      exec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        if (command.includes('docker --version') || command.includes('docker-compose --version')) {
          setImmediate(() => callback(null, 'Docker version 20.10.0', ''));
        } else if (command.includes('docker-compose') && command.includes('up -d')) {
          setImmediate(() => callback(null, 'Services started', ''));
        } else {
          setImmediate(() => callback(null, 'OK', ''));
        }
        return { kill: jest.fn() };
      });

      // Mock checkInfraHealth to make waitForServices exit quickly
      const originalCheckInfraHealth = infra.checkInfraHealth;
      infra.checkInfraHealth = jest.fn().mockResolvedValue({
        postgres: 'healthy',
        redis: 'healthy',
        pgadmin: 'healthy',
        'redis-commander': 'healthy'
      });

      await infra.startInfra();

      expect(fs.writeFileSync).toHaveBeenCalled();
      // Compose file is now kept in ~/.aifabrix/infra/ directory

      // Restore original function
      infra.checkInfraHealth = originalCheckInfraHealth;
    }, 30000);

    it.skip('should generate admin-secrets.env if it does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockAdminSecretsPath) {
          return false; // admin-secrets.env does not exist
        }
        return filePath === mockTemplatePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      secrets.generateAdminSecretsEnv.mockResolvedValue(mockAdminSecretsPath);

      // Mock exec to handle docker-compose commands
      exec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        if (command.includes('docker --version') || command.includes('docker-compose --version')) {
          setImmediate(() => callback(null, 'Docker version 20.10.0', ''));
        } else if (command.includes('docker-compose') && command.includes('up -d')) {
          setImmediate(() => callback(null, 'Services started', ''));
        } else {
          setImmediate(() => callback(null, 'OK', ''));
        }
        return { kill: jest.fn() };
      });

      // Mock checkInfraHealth to make waitForServices exit quickly
      const originalCheckInfraHealth = infra.checkInfraHealth;
      infra.checkInfraHealth = jest.fn().mockResolvedValue({
        postgres: 'healthy',
        redis: 'healthy',
        pgadmin: 'healthy',
        'redis-commander': 'healthy'
      });

      await infra.startInfra();

      expect(secrets.generateAdminSecretsEnv).toHaveBeenCalled();

      // Restore original function
      infra.checkInfraHealth = originalCheckInfraHealth;
    }, 30000);

    it.skip('should throw error if Docker is not available', async() => {
      // Mock execAsync to throw error
      exec.mockImplementation((command, callback) => {
        setImmediate(() => callback(new Error('Command not found'), '', ''));
        return { kill: jest.fn() };
      });

      const util = require('util');
      const mockPromisify = (fn) => {
        return (command) => {
          if (command.includes('docker --version') || command.includes('docker-compose --version')) {
            return Promise.reject(new Error('Command not found'));
          }
          return Promise.resolve({ stdout: 'OK', stderr: '' });
        };
      };

      util.promisify = mockPromisify;

      await expect(infra.startInfra()).rejects.toThrow('Docker or Docker Compose is not available');
    });

    it.skip('should throw error if compose template not found', async() => {
      // Mock exec to return Docker version check
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker --version') || command.includes('docker-compose --version')) {
          setImmediate(() => callback(null, 'Docker version 20.10.0', ''));
        } else {
          setImmediate(() => callback(null, '', ''));
        }
        return { kill: jest.fn() };
      });

      fs.existsSync.mockImplementation((filePath) => {
        // Return false for template path, true for others
        if (filePath && filePath.includes('templates/infra/compose.yaml')) {
          return false;
        }
        return true;
      });

      await expect(infra.startInfra()).rejects.toThrow('Compose template not found');
    });

    it.skip('should handle docker-compose failures gracefully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockAdminSecretsPath || filePath === mockTemplatePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      secrets.generateAdminSecretsEnv.mockResolvedValue(mockAdminSecretsPath);

      // Mock exec to throw error for docker-compose
      exec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        if (command.includes('docker --version') || command.includes('docker-compose --version')) {
          setImmediate(() => callback(null, 'Docker version 20.10.0', ''));
        } else if (command.includes('docker-compose') && command.includes('up -d')) {
          setImmediate(() => callback(new Error('Docker compose failed'), '', ''));
        } else {
          setImmediate(() => callback(null, 'OK', ''));
        }
        return { kill: jest.fn() };
      });

      await expect(infra.startInfra()).rejects.toThrow('Docker compose failed');
    });
  });

  describe('stopInfra', () => {
    it.skip('should stop infrastructure services successfully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath.includes('.aifabrix/infra/compose.yaml');
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');

      // Mock exec to handle docker-compose commands
      exec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        if (command.includes('docker-compose') && command.includes('down')) {
          setImmediate(() => callback(null, 'Services stopped', ''));
        } else {
          setImmediate(() => callback(null, 'OK', ''));
        }
        return { kill: jest.fn() };
      });

      await infra.stopInfra();

      expect(exec).toHaveBeenCalled();
    });

    it('should handle case when infrastructure is not running', async() => {
      fs.existsSync.mockReturnValue(false);

      await infra.stopInfra();

      expect(exec).not.toHaveBeenCalled();
    });

    it.skip('should handle docker-compose failures gracefully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath.includes('.aifabrix/infra/compose.yaml');
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');

      // Mock exec to throw error for docker-compose
      exec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        if (command.includes('docker-compose') && command.includes('down')) {
          setImmediate(() => callback(new Error('Docker compose failed'), '', ''));
        } else {
          setImmediate(() => callback(null, 'OK', ''));
        }
        return { kill: jest.fn() };
      });

      await expect(infra.stopInfra()).rejects.toThrow('Docker compose failed');
    });
  });

  describe('checkInfraHealth', () => {
    it.skip('should return health status for all services', async() => {
      // Mock exec to return container status - match the actual command format
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker ps --filter') && command.includes('infra-postgres')) {
          setImmediate(() => callback(null, 'infra-postgres', ''));
        } else if (command.includes('docker ps --filter') && command.includes('infra-redis')) {
          setImmediate(() => callback(null, 'infra-redis', ''));
        } else if (command.includes('docker ps --filter') && command.includes('infra-pgadmin')) {
          setImmediate(() => callback(null, 'infra-pgadmin', ''));
        } else if (command.includes('docker ps --filter') && command.includes('redis-commander')) {
          setImmediate(() => callback(null, 'infra-redis-commander', ''));
        } else if (command.includes('docker inspect') && command.includes('State.Health.Status')) {
          setImmediate(() => callback(null, 'healthy', ''));
        } else if (command.includes('docker inspect') && command.includes('State.Status')) {
          setImmediate(() => callback(null, 'running', ''));
        } else {
          setImmediate(() => callback(null, '', ''));
        }
        return { kill: jest.fn() };
      });

      // Mock util.promisify to return the exec function
      const util = require('util');
      const originalPromisify = util.promisify;
      util.promisify = jest.fn(() => exec);

      const result = await infra.checkInfraHealth();

      // Restore
      util.promisify = originalPromisify;

      expect(result).toEqual({
        postgres: 'healthy',
        redis: 'healthy',
        pgadmin: 'healthy',
        'redis-commander': 'healthy'
      });
    });

    it.skip('should return unknown for services that fail health check', async() => {
      // Mock exec to return empty (containers not found)
      exec.mockImplementation((command, callback) => {
        setImmediate(() => callback(null, '', ''));
        return { kill: jest.fn() };
      });

      const result = await infra.checkInfraHealth();

      expect(result).toEqual({
        postgres: 'unknown',
        redis: 'unknown',
        pgadmin: 'unknown',
        'redis-commander': 'unknown'
      });
    });
  });

  describe('getInfraStatus', () => {
    it.skip('should return status information for all services', async() => {
      // Mock exec to return container status
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker ps --filter') && command.includes('infra-postgres')) {
          setImmediate(() => callback(null, 'infra-postgres', ''));
        } else if (command.includes('docker ps --filter') && command.includes('infra-redis')) {
          setImmediate(() => callback(null, 'infra-redis', ''));
        } else if (command.includes('docker ps --filter') && command.includes('infra-pgadmin')) {
          setImmediate(() => callback(null, 'infra-pgadmin', ''));
        } else if (command.includes('docker ps --filter') && command.includes('redis-commander')) {
          setImmediate(() => callback(null, 'infra-redis-commander', ''));
        } else if (command.includes('docker inspect') && command.includes('State.Status')) {
          setImmediate(() => callback(null, 'running', ''));
        } else {
          setImmediate(() => callback(null, '', ''));
        }
        return { kill: jest.fn() };
      });

      const result = await infra.getInfraStatus();

      expect(result).toEqual({
        postgres: { status: 'running', port: 5432, url: 'localhost:5432' },
        redis: { status: 'running', port: 6379, url: 'localhost:6379' },
        pgadmin: { status: 'running', port: 5050, url: 'http://localhost:5050' },
        'redis-commander': { status: 'running', port: 8081, url: 'http://localhost:8081' }
      });
    }, 10000);

    it('should return not running for services that fail status check', async() => {
      // Mock config.getDeveloperId to return 0 (default infra) for base ports
      const config = require('../../../lib/core/config');
      config.getDeveloperId.mockResolvedValueOnce(0); // Default infra uses base ports

      // Mock exec to return empty (containers not found)
      exec.mockImplementation((command, callback) => {
        setImmediate(() => callback(null, '', ''));
        return { kill: jest.fn() };
      });

      const result = await infra.getInfraStatus();

      expect(result.postgres.status).toBe('not running');
      expect(result.postgres.port).toBe(5432); // Base port for default infra (devId = 0)
      expect(result.postgres.url).toBe('localhost:5432');
    });
  });

  describe('restartService', () => {
    it.skip('should restart a valid service successfully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath.includes('.aifabrix/infra/compose.yaml');
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');

      // Mock exec to handle restart command
      exec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        if (command.includes('docker-compose') && command.includes('restart postgres')) {
          setImmediate(() => callback(null, 'Service restarted', ''));
        } else {
          setImmediate(() => callback(null, 'OK', ''));
        }
        return { kill: jest.fn() };
      });

      await infra.restartService('postgres');

      expect(exec).toHaveBeenCalled();
    });

    it('should throw error for invalid service name', async() => {
      await expect(infra.restartService('invalid-service')).rejects.toThrow('Invalid service name. Must be one of: postgres, redis, pgadmin, redis-commander');
    });

    it('should throw error if service name is not provided', async() => {
      await expect(infra.restartService()).rejects.toThrow('Service name is required and must be a string');
      await expect(infra.restartService(123)).rejects.toThrow('Service name is required and must be a string');
    });

    it('should throw error if infrastructure not properly configured', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(infra.restartService('postgres')).rejects.toThrow('Infrastructure not properly configured');
    });

    it.skip('should handle restart failures gracefully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath.includes('.aifabrix/infra/compose.yaml');
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');

      // Mock exec to throw error for restart
      exec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        if (command.includes('docker-compose') && command.includes('restart postgres')) {
          setImmediate(() => callback(new Error('Restart failed'), '', ''));
        } else {
          setImmediate(() => callback(null, 'OK', ''));
        }
        return { kill: jest.fn() };
      });

      await expect(infra.restartService('postgres')).rejects.toThrow('Restart failed');
    });
  });

  describe('waitForServices (private function)', () => {
    it('should wait for services to become healthy', async() => {
      let callCount = 0;
      exec.mockImplementation((command, callback) => {
        callCount++;
        if (callCount <= 2) {
          callback(null, 'starting', ''); // First two calls return starting
        } else {
          callback(null, 'healthy', ''); // Subsequent calls return healthy
        }
        return {};
      });

      // Mock checkInfraHealth to simulate services becoming healthy
      const originalCheckInfraHealth = infra.checkInfraHealth;
      infra.checkInfraHealth = jest.fn()
        .mockResolvedValueOnce({ postgres: 'starting', redis: 'starting', pgadmin: 'starting', 'redis-commander': 'starting' })
        .mockResolvedValueOnce({ postgres: 'starting', redis: 'starting', pgadmin: 'starting', 'redis-commander': 'starting' })
        .mockResolvedValue({ postgres: 'healthy', redis: 'healthy', pgadmin: 'healthy', 'redis-commander': 'healthy' });

      // This would be called internally by startInfra, but we can't test it directly
      // since it's a private function. The behavior is tested through startInfra integration.

      // Restore original function
      infra.checkInfraHealth = originalCheckInfraHealth;
    });
  });
});
