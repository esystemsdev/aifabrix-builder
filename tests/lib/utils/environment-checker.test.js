/**
 * Tests for Environment Checker Module
 *
 * @fileoverview Unit tests for lib/utils/environment-checker.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock docker utils
jest.mock('../../../lib/utils/docker', () => ({
  checkDockerCli: jest.fn(),
  getComposeCommand: jest.fn()
}));

// Mock secrets-path
jest.mock('../../../lib/utils/secrets-path', () => ({
  getActualSecretsPath: jest.fn()
}));

// Mock paths
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/home/user/.aifabrix')
}));

// Mock config and dev-config (for developer-aware port checks)
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue('0')
}));
jest.mock('../../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn((id) => ({
    postgres: 5432 + (id || 0) * 100,
    redis: 6379 + (id || 0) * 100,
    pgadmin: 5050 + (id || 0) * 100,
    redisCommander: 8081 + (id || 0) * 100
  }))
}));

const fs = require('fs');
const dockerUtils = require('../../../lib/utils/docker');
const { getActualSecretsPath } = require('../../../lib/utils/secrets-path');
const pathsUtil = require('../../../lib/utils/paths');
const config = require('../../../lib/core/config');
const devConfig = require('../../../lib/utils/dev-config');
const {
  checkDocker,
  checkPorts,
  checkSecrets,
  checkEnvironment
} = require('../../../lib/utils/environment-checker');

describe('Environment Checker Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDocker', () => {
    it('should return ok when Docker is available', async() => {
      dockerUtils.checkDockerCli.mockResolvedValue();
      dockerUtils.getComposeCommand.mockResolvedValue('docker compose');

      const result = await checkDocker();

      expect(result).toBe('ok');
      expect(dockerUtils.checkDockerCli).toHaveBeenCalled();
      expect(dockerUtils.getComposeCommand).toHaveBeenCalled();
    });

    it('should return error when Docker CLI check fails', async() => {
      dockerUtils.checkDockerCli.mockRejectedValue(new Error('Docker not found'));

      const result = await checkDocker();

      expect(result).toBe('error');
    });

    it('should return error when compose command check fails', async() => {
      dockerUtils.checkDockerCli.mockResolvedValue();
      dockerUtils.getComposeCommand.mockRejectedValue(new Error('Compose not found'));

      const result = await checkDocker();

      expect(result).toBe('error');
    });
  });

  describe('checkPorts', () => {
    let mockServer;
    let originalCreateServer;

    beforeEach(() => {
      // Mock net.createServer
      mockServer = {
        listen: jest.fn((port, callback) => {
          if (callback) callback();
          return mockServer;
        }),
        close: jest.fn((callback) => {
          if (callback) callback();
        }),
        on: jest.fn()
      };

      const net = require('net');
      originalCreateServer = net.createServer;
      net.createServer = jest.fn(() => mockServer);
    });

    afterEach(() => {
      const net = require('net');
      net.createServer = originalCreateServer;
    });

    it('should return ok when all ports are available', async() => {
      const result = await checkPorts();

      expect(result).toBe('ok');
      expect(mockServer.listen).toHaveBeenCalledTimes(4); // 4 required ports
    });

    it('should return warning when some ports are in use', async() => {
      mockServer.listen = jest.fn((port, callback) => {
        if (port === 5432) {
          // Simulate port in use
          mockServer.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Port in use')), 0);
            }
          });
        } else if (callback) {
          callback();
        }
        return mockServer;
      });

      const result = await checkPorts();

      expect(result).toBe('warning');
    });

    it('should return warning when all ports are in use', async() => {
      mockServer.listen = jest.fn(() => {
        mockServer.on.mockImplementation((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Port in use')), 0);
          }
        });
        return mockServer;
      });

      const result = await checkPorts();

      expect(result).toBe('warning');
    });

    it('should use developer-specific ports when developer-id is 6', async() => {
      config.getDeveloperId.mockResolvedValue('6');
      devConfig.getDevPorts.mockImplementation((id) => ({
        postgres: 5432 + id * 100,
        redis: 6379 + id * 100,
        pgadmin: 5050 + id * 100,
        redisCommander: 8081 + id * 100
      }));

      const result = await checkPorts();

      expect(result).toBe('ok');
      // Developer 6: 5432+600=6032, 6379+600=6979, 5050+600=5650, 8081+600=8681
      expect(mockServer.listen).toHaveBeenCalledWith(6032, expect.any(Function));
      expect(mockServer.listen).toHaveBeenCalledWith(6979, expect.any(Function));
      expect(mockServer.listen).toHaveBeenCalledWith(5650, expect.any(Function));
      expect(mockServer.listen).toHaveBeenCalledWith(8681, expect.any(Function));
    });

    it('should use explicit ports when passed to checkPorts', async() => {
      const result = await checkPorts([1111, 2222]);

      expect(result).toBe('ok');
      expect(mockServer.listen).toHaveBeenCalledWith(1111, expect.any(Function));
      expect(mockServer.listen).toHaveBeenCalledWith(2222, expect.any(Function));
    });
  });

  describe('checkSecrets', () => {
    beforeEach(() => {
      fs.existsSync = jest.fn();
    });

    it('should return ok when user path exists', async() => {
      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(true);

      const result = await checkSecrets();

      expect(result).toEqual({ status: 'ok', paths: [userPath] });
      expect(fs.existsSync).toHaveBeenCalledWith(userPath);
    });

    it('should return ok when build path exists', async() => {
      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      const buildPath = '/custom/secrets.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath });
      fs.existsSync
        .mockReturnValueOnce(false) // user path doesn't exist
        .mockReturnValueOnce(true); // build path exists

      const result = await checkSecrets();

      expect(result).toEqual({ status: 'ok', paths: [buildPath] });
    });

    it('should return missing when neither path exists', async() => {
      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      const buildPath = '/custom/secrets.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath });
      fs.existsSync.mockReturnValue(false);

      const result = await checkSecrets();

      expect(result).toEqual({ status: 'missing', paths: [userPath, buildPath] });
    });

    it('should return missing when only user path checked and not found', async() => {
      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(false);

      const result = await checkSecrets();

      expect(result).toEqual({ status: 'missing', paths: [userPath] });
    });

    it('should fallback to default path on error', async() => {
      const defaultPath = '/home/user/.aifabrix/secrets.yaml';
      getActualSecretsPath.mockRejectedValue(new Error('Config error'));
      pathsUtil.getAifabrixHome.mockReturnValue('/home/user/.aifabrix');
      fs.existsSync.mockReturnValue(true);

      const result = await checkSecrets();

      expect(result).toEqual({ status: 'ok', paths: [defaultPath] });
    });

    it('should return missing when fallback path also not found', async() => {
      const defaultPath = '/home/user/.aifabrix/secrets.yaml';
      getActualSecretsPath.mockRejectedValue(new Error('Config error'));
      pathsUtil.getAifabrixHome.mockReturnValue('/home/user/.aifabrix');
      fs.existsSync.mockReturnValue(false);

      const result = await checkSecrets();

      expect(result).toEqual({ status: 'missing', paths: [defaultPath] });
    });
  });

  describe('checkEnvironment', () => {
    beforeEach(() => {
      fs.existsSync = jest.fn();
    });

    it('should return all ok when everything is available', async() => {
      dockerUtils.checkDockerCli.mockResolvedValue();
      dockerUtils.getComposeCommand.mockResolvedValue('docker compose');

      const net = require('net');
      const mockServer = {
        listen: jest.fn((port, callback) => {
          if (callback) callback();
          return mockServer;
        }),
        close: jest.fn((callback) => {
          if (callback) callback();
        }),
        on: jest.fn()
      };
      net.createServer = jest.fn(() => mockServer);

      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(true);

      const result = await checkEnvironment();

      expect(result).toEqual({
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });
    });

    it('should include recommendations when Docker is missing', async() => {
      dockerUtils.checkDockerCli.mockRejectedValue(new Error('Docker not found'));

      const net = require('net');
      const mockServer = {
        listen: jest.fn((port, callback) => {
          if (callback) callback();
          return mockServer;
        }),
        close: jest.fn((callback) => {
          if (callback) callback();
        }),
        on: jest.fn()
      };
      net.createServer = jest.fn(() => mockServer);

      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(true);

      const result = await checkEnvironment();

      expect(result.docker).toBe('error');
      expect(result.recommendations).toContain('Install Docker and Docker Compose');
    });

    it('should include recommendations when ports are in use', async() => {
      dockerUtils.checkDockerCli.mockResolvedValue();
      dockerUtils.getComposeCommand.mockResolvedValue('docker compose');
      config.getDeveloperId.mockResolvedValue('0');
      devConfig.getDevPorts.mockImplementation((id) => ({
        postgres: 5432 + (id || 0) * 100,
        redis: 6379 + (id || 0) * 100,
        pgadmin: 5050 + (id || 0) * 100,
        redisCommander: 8081 + (id || 0) * 100
      }));

      const net = require('net');
      const mockServer = {
        listen: jest.fn(() => {
          mockServer.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Port in use')), 0);
            }
          });
          return mockServer;
        }),
        close: jest.fn(),
        on: jest.fn()
      };
      net.createServer = jest.fn(() => mockServer);

      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(true);

      const result = await checkEnvironment();

      expect(result.ports).toBe('warning');
      expect(result.recommendations).toContain('Some required ports (5432, 6379, 5050, 8081) are in use');
    });

    it('should show developer-specific ports in recommendation when developer-id is 6', async() => {
      dockerUtils.checkDockerCli.mockResolvedValue();
      dockerUtils.getComposeCommand.mockResolvedValue('docker compose');
      config.getDeveloperId.mockResolvedValue('6');
      devConfig.getDevPorts.mockImplementation((id) => ({
        postgres: 5432 + id * 100,
        redis: 6379 + id * 100,
        pgadmin: 5050 + id * 100,
        redisCommander: 8081 + id * 100
      }));

      const net = require('net');
      const mockServer = {
        listen: jest.fn(() => {
          mockServer.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Port in use')), 0);
            }
          });
          return mockServer;
        }),
        close: jest.fn(),
        on: jest.fn()
      };
      net.createServer = jest.fn(() => mockServer);

      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(true);

      const result = await checkEnvironment();

      expect(result.ports).toBe('warning');
      expect(result.recommendations).toContain('Some required ports (6032, 6979, 5650, 8681) are in use');
    });

    it('should include recommendations when secrets are missing', async() => {
      dockerUtils.checkDockerCli.mockResolvedValue();
      dockerUtils.getComposeCommand.mockResolvedValue('docker compose');

      const net = require('net');
      const mockServer = {
        listen: jest.fn((port, callback) => {
          if (callback) callback();
          return mockServer;
        }),
        close: jest.fn((callback) => {
          if (callback) callback();
        }),
        on: jest.fn()
      };
      net.createServer = jest.fn(() => mockServer);

      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(false);

      const result = await checkEnvironment();

      expect(result.secrets).toBe('missing');
      expect(result.recommendations).toContain(`Create secrets file: ${userPath}`);
    });

    it('should include multiple recommendations when multiple issues found', async() => {
      dockerUtils.checkDockerCli.mockRejectedValue(new Error('Docker not found'));
      config.getDeveloperId.mockResolvedValue('0');
      devConfig.getDevPorts.mockImplementation((id) => ({
        postgres: 5432 + (id || 0) * 100,
        redis: 6379 + (id || 0) * 100,
        pgadmin: 5050 + (id || 0) * 100,
        redisCommander: 8081 + (id || 0) * 100
      }));

      const net = require('net');
      const mockServer = {
        listen: jest.fn(() => {
          mockServer.on.mockImplementation((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Port in use')), 0);
            }
          });
          return mockServer;
        }),
        close: jest.fn(),
        on: jest.fn()
      };
      net.createServer = jest.fn(() => mockServer);

      const userPath = '/home/user/.aifabrix/secrets.local.yaml';
      getActualSecretsPath.mockResolvedValue({ userPath, buildPath: null });
      fs.existsSync.mockReturnValue(false);

      const result = await checkEnvironment();

      expect(result.recommendations.length).toBeGreaterThan(1);
      expect(result.recommendations).toContain('Install Docker and Docker Compose');
      expect(result.recommendations).toContain('Some required ports (5432, 6379, 5050, 8081) are in use');
      expect(result.recommendations).toContain(`Create secrets file: ${userPath}`);
    });
  });
});

