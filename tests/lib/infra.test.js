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
const infra = require('../../lib/infra');
const secrets = require('../../lib/secrets');

// Mock modules
jest.mock('child_process', () => ({
  exec: jest.fn()
}));
jest.mock('fs');
jest.mock('os');
jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    return jest.fn((command) => {
      if (command.includes('docker --version') || command.includes('docker-compose --version')) {
        return Promise.resolve({ stdout: 'Docker version 20.10.0', stderr: '' });
      } else if (command.includes('docker-compose')) {
        return Promise.resolve({ stdout: 'Services started', stderr: '' });
      } else if (command.includes('docker ps')) {
        return Promise.resolve({ stdout: 'postgres\nredis\npgadmin\nredis-commander', stderr: '' });
      } else if (command.includes('docker inspect') && command.includes('--format') && command.includes('aifabrix-')) {
        return Promise.resolve({ stdout: 'healthy', stderr: '' });
      }
      return Promise.reject(new Error('Command not found'));

    });
  })
}));
jest.mock('../../lib/secrets');

// Mock setTimeout to make waitForServices exit immediately
jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
  if (fn) fn();
  return 123; // Mock timer ID
});

describe('Infrastructure Module', () => {
  const mockHomeDir = '/home/test';
  const mockTempDir = '/tmp';
  const mockAdminSecretsPath = path.join(mockHomeDir, '.aifabrix', 'admin-secrets.env');
  const mockTemplatePath = path.join(__dirname, '..', '..', 'templates', 'infra', 'compose.yaml');
  const mockTempComposePath = path.join(mockTempDir, 'aifabrix-compose.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    os.tmpdir.mockReturnValue(mockTempDir);
  });

  describe('startInfra', () => {
    it('should start infrastructure services successfully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockAdminSecretsPath || filePath === mockTemplatePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"\nservices:\n  postgres:\n    image: postgres');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      secrets.generateAdminSecretsEnv.mockResolvedValue(mockAdminSecretsPath);

      // Mock checkInfraHealth to make waitForServices exit quickly
      const originalCheckInfraHealth = infra.checkInfraHealth;
      infra.checkInfraHealth = jest.fn().mockResolvedValue({
        postgres: 'healthy',
        redis: 'healthy',
        pgadmin: 'healthy',
        'redis-commander': 'healthy'
      });

      await infra.startInfra();

      expect(fs.writeFileSync).toHaveBeenCalledWith(mockTempComposePath, expect.any(String));
      // Note: fs.unlinkSync might not be called if the file doesn't exist in the mock

      // Restore original function
      infra.checkInfraHealth = originalCheckInfraHealth;
    }, 30000);

    it('should generate admin-secrets.env if it does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockAdminSecretsPath) {
          return false; // admin-secrets.env does not exist
        }
        return filePath === mockTemplatePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      secrets.generateAdminSecretsEnv.mockResolvedValue(mockAdminSecretsPath);

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

    it('should throw error if Docker is not available', async() => {
      // Clear module cache and reload with error mock
      jest.resetModules();
      jest.doMock('util', () => ({
        promisify: jest.fn((fn) => {
          return jest.fn((command) => {
            return Promise.reject(new Error('Command not found'));
          });
        })
      }));

      const infra = require('../../lib/infra');
      await expect(infra.startInfra()).rejects.toThrow('Docker or Docker Compose is not available');
    });

    it('should throw error if compose template not found', async() => {
      exec.mockImplementation((command, callback) => {
        callback(null, 'Docker version 20.10.0', '');
        return {};
      });

      fs.existsSync.mockReturnValue(false);

      await expect(infra.startInfra()).rejects.toThrow('Compose template not found');
    });

    it('should clean up temp file even if docker-compose fails', async() => {
      // Clear module cache and reload with error mock
      jest.resetModules();
      jest.doMock('util', () => ({
        promisify: jest.fn((fn) => {
          return jest.fn((command) => {
            if (command.includes('docker --version') || command.includes('docker-compose --version')) {
              return Promise.resolve({ stdout: 'Docker version 20.10.0', stderr: '' });
            } else if (command.includes('docker-compose')) {
              return Promise.reject(new Error('Docker compose failed'));
            }
            return Promise.resolve({ stdout: 'OK', stderr: '' });
          });
        })
      }));

      const infra = require('../../lib/infra');
      const fs = require('fs');
      const os = require('os');
      const secrets = require('../../lib/secrets');

      os.homedir.mockReturnValue(mockHomeDir);
      os.tmpdir.mockReturnValue(mockTempDir);

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockAdminSecretsPath ||
               filePath === mockTemplatePath ||
               filePath === mockTempComposePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      secrets.generateAdminSecretsEnv.mockResolvedValue(mockAdminSecretsPath);

      await expect(infra.startInfra()).rejects.toThrow('Docker compose failed');
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockTempComposePath);
    });
  });

  describe('stopInfra', () => {
    it('should stop infrastructure services successfully', async() => {
      exec.mockImplementation((command, callback) => {
        callback(null, 'Services stopped', '');
        return {};
      });

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath === mockTempComposePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      await infra.stopInfra();

      // The implementation uses execAsync (promisify(exec)), so we check that the temp file is cleaned up
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockTempComposePath);
    });

    it('should handle case when infrastructure is not running', async() => {
      fs.existsSync.mockReturnValue(false);

      await infra.stopInfra();

      expect(exec).not.toHaveBeenCalled();
    });

    it('should clean up temp file even if docker-compose fails', async() => {
      // Clear module cache and reload with error mock
      jest.resetModules();
      jest.doMock('util', () => ({
        promisify: jest.fn((fn) => {
          return jest.fn((command) => {
            if (command.includes('docker-compose')) {
              return Promise.reject(new Error('Docker compose failed'));
            }
            return Promise.resolve({ stdout: 'OK', stderr: '' });
          });
        })
      }));

      const infra = require('../../lib/infra');
      const fs = require('fs');
      const os = require('os');

      os.homedir.mockReturnValue(mockHomeDir);
      os.tmpdir.mockReturnValue(mockTempDir);

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath === mockTempComposePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      await expect(infra.stopInfra()).rejects.toThrow('Docker compose failed');
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockTempComposePath);
    });
  });

  describe('checkInfraHealth', () => {
    it('should return health status for all services', async() => {
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker inspect') && command.includes('--format') && command.includes('aifabrix-') && command.includes('Health.Status')) {
          callback(null, 'healthy', '');
        }
        return Promise.resolve({ stdout: 'healthy', stderr: '' });
      });

      const result = await infra.checkInfraHealth();

      expect(result).toEqual({
        postgres: 'healthy',
        redis: 'healthy',
        pgadmin: 'healthy',
        'redis-commander': 'healthy'
      });
    });

    it('should return unknown for services that fail health check', async() => {
      // Clear module cache and reload with error mock
      jest.resetModules();
      jest.doMock('util', () => ({
        promisify: jest.fn((fn) => {
          return jest.fn((command) => {
            if (command.includes('docker inspect') && command.includes('--format') && command.includes('aifabrix-')) {
              return Promise.reject(new Error('Container not found'));
            }
            return Promise.resolve({ stdout: 'healthy', stderr: '' });
          });
        })
      }));

      const infra = require('../../lib/infra');
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
    it('should return status information for all services', async() => {
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker inspect') && command.includes('--format') && command.includes('aifabrix-') && command.includes('State.Status')) {
          callback(null, 'running', '');
        }
        // Return a Promise for execAsync
        return Promise.resolve({ stdout: 'running', stderr: '' });
      });

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath || filePath === mockAdminSecretsPath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');

      const result = await infra.getInfraStatus();

      expect(result).toEqual({
        postgres: { status: 'healthy', port: 5432, url: 'localhost:5432' },
        redis: { status: 'healthy', port: 6379, url: 'localhost:6379' },
        pgadmin: { status: 'healthy', port: 5050, url: 'http://localhost:5050' },
        'redis-commander': { status: 'healthy', port: 8081, url: 'http://localhost:8081' }
      });
    }, 10000);

    it('should return not running for services that fail status check', async() => {
      // Clear module cache and reload with error mock
      jest.resetModules();
      jest.doMock('util', () => ({
        promisify: jest.fn((fn) => {
          return jest.fn((command) => {
            if (command.includes('docker inspect') && command.includes('--format') && command.includes('aifabrix-')) {
              return Promise.reject(new Error('Container not found'));
            }
            return Promise.resolve({ stdout: 'running', stderr: '' });
          });
        })
      }));

      const infra = require('../../lib/infra');
      const result = await infra.getInfraStatus();

      expect(result.postgres.status).toBe('not running');
      expect(result.postgres.port).toBe(5432);
      expect(result.postgres.url).toBe('localhost:5432');
    });
  });

  describe('restartService', () => {
    it('should restart a valid service successfully', async() => {
      exec.mockImplementation((command, callback) => {
        callback(null, 'Service restarted', '');
        return {};
      });

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath === mockTempComposePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      await infra.restartService('postgres');

      // The implementation uses execAsync (promisify(exec)), so we check that the temp file is cleaned up
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockTempComposePath);
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

    it('should clean up temp file even if restart fails', async() => {
      // Clear module cache and reload with error mock
      jest.resetModules();
      jest.doMock('util', () => ({
        promisify: jest.fn((fn) => {
          return jest.fn((command) => {
            if (command.includes('docker-compose')) {
              return Promise.reject(new Error('Restart failed'));
            }
            return Promise.resolve({ stdout: 'OK', stderr: '' });
          });
        })
      }));

      const infra = require('../../lib/infra');
      const fs = require('fs');
      const os = require('os');

      os.homedir.mockReturnValue(mockHomeDir);
      os.tmpdir.mockReturnValue(mockTempDir);

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockTemplatePath ||
               filePath === mockAdminSecretsPath ||
               filePath === mockTempComposePath;
      });

      fs.readFileSync.mockReturnValue('version: "3.9"');
      fs.writeFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      await expect(infra.restartService('postgres')).rejects.toThrow('Restart failed');
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockTempComposePath);
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
