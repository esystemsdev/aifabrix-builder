/**
 * Tests for Docker Utilities Module
 *
 * @fileoverview Unit tests for lib/utils/docker.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const execAsync = promisify(exec);
const {
  checkDockerCli,
  getComposeCommand,
  ensureDockerAndCompose
} = require('../../../lib/utils/docker');

describe('Docker Utilities Module', () => {
  const originalComposeEnv = process.env.AIFABRIX_COMPOSE_CMD;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AIFABRIX_COMPOSE_CMD;
  });

  afterAll(() => {
    if (originalComposeEnv === undefined) {
      delete process.env.AIFABRIX_COMPOSE_CMD;
    } else {
      process.env.AIFABRIX_COMPOSE_CMD = originalComposeEnv;
    }
  });

  describe('checkDockerCli', () => {
    it('should resolve when docker is available', async() => {
      exec.mockImplementation((command, callback) => {
        callback(null, { stdout: 'Docker version 20.10.0', stderr: '' });
      });

      await expect(checkDockerCli()).resolves.toBeUndefined();
      expect(exec).toHaveBeenCalledWith('docker --version', expect.any(Function));
    });

    it('should throw error when docker is not available', async() => {
      exec.mockImplementation((command, callback) => {
        callback(new Error('docker: command not found'), null);
      });

      await expect(checkDockerCli()).rejects.toThrow('docker: command not found');
      expect(exec).toHaveBeenCalledWith('docker --version', expect.any(Function));
    });

    it('should throw error when docker command fails', async() => {
      exec.mockImplementation((command, callback) => {
        callback(new Error('Docker daemon not running'), null);
      });

      await expect(checkDockerCli()).rejects.toThrow('Docker daemon not running');
    });
  });

  describe('getComposeCommand', () => {
    it('should return "docker compose" when v2 is available', async() => {
      exec.mockImplementation((command, callback) => {
        if (command === 'docker compose version') {
          callback(null, { stdout: 'Docker Compose version v2.0.0', stderr: '' });
        }
      });

      const result = await getComposeCommand();

      expect(result).toBe('docker compose');
      expect(exec).toHaveBeenCalledWith('docker compose version', expect.any(Function));
    });

    it('should fallback to "docker-compose" when v2 is not available but v1 is', async() => {
      exec.mockImplementation((command, callback) => {
        if (command === 'docker compose version') {
          callback(new Error('docker compose: command not found'), null);
        } else if (command === 'docker-compose --version') {
          callback(null, { stdout: 'docker-compose version 1.29.0', stderr: '' });
        }
      });

      const result = await getComposeCommand();

      expect(result).toBe('docker-compose');
      expect(exec).toHaveBeenCalledWith('docker compose version', expect.any(Function));
      expect(exec).toHaveBeenCalledWith('docker-compose --version', expect.any(Function));
    });

    it('should throw error when neither v2 nor v1 nor podman compose is available', async() => {
      exec.mockImplementation((command, callback) => {
        callback(new Error('command not found'), null);
      });

      await expect(getComposeCommand()).rejects.toThrow(
        /Docker Compose is not available[\s\S]*docker-compose-plugin/
      );
      expect(exec).toHaveBeenCalledWith('docker compose version', expect.any(Function));
      expect(exec).toHaveBeenCalledWith('docker-compose --version', expect.any(Function));
      expect(exec).toHaveBeenCalledWith('podman compose version', expect.any(Function));
    });

    it('should return AIFABRIX_COMPOSE_CMD when set and version succeeds', async() => {
      process.env.AIFABRIX_COMPOSE_CMD = '/opt/bin/docker compose';
      exec.mockImplementation((command, callback) => {
        if (command === '/opt/bin/docker compose version') {
          callback(null, { stdout: 'Docker Compose version v2', stderr: '' });
        }
      });

      const result = await getComposeCommand();
      expect(result).toBe('/opt/bin/docker compose');
      expect(exec).toHaveBeenCalledWith('/opt/bin/docker compose version', expect.any(Function));
    });

    it('should return AIFABRIX_COMPOSE_CMD when version fails but --version works', async() => {
      process.env.AIFABRIX_COMPOSE_CMD = 'docker-compose';
      exec.mockImplementation((command, callback) => {
        if (command === 'docker-compose version') {
          callback(new Error('unknown flag'), null);
        } else if (command === 'docker-compose --version') {
          callback(null, { stdout: '1.29', stderr: '' });
        }
      });

      const result = await getComposeCommand();
      expect(result).toBe('docker-compose');
    });

    it('should return podman compose when docker compose and docker-compose fail', async() => {
      exec.mockImplementation((command, callback) => {
        if (command === 'docker compose version') {
          callback(new Error('not found'), null);
        } else if (command === 'docker-compose --version') {
          callback(new Error('not found'), null);
        } else if (command === 'podman compose version') {
          callback(null, { stdout: 'podman compose', stderr: '' });
        }
      });

      const result = await getComposeCommand();
      expect(result).toBe('podman compose');
    });

    it('should throw when AIFABRIX_COMPOSE_CMD is set but both version probes fail', async() => {
      process.env.AIFABRIX_COMPOSE_CMD = '/bad/compose';
      exec.mockImplementation((command, callback) => {
        if (command === '/bad/compose version' || command === '/bad/compose --version') {
          callback(new Error('enoent'), null);
        }
      });

      await expect(getComposeCommand()).rejects.toThrow(
        /AIFABRIX_COMPOSE_CMD[\s\S]*\/bad\/compose[\s\S]*enoent/
      );
    });

    it('should ignore whitespace-only AIFABRIX_COMPOSE_CMD and use auto-detection', async() => {
      process.env.AIFABRIX_COMPOSE_CMD = '   ';
      exec.mockImplementation((command, callback) => {
        if (command === 'docker compose version') {
          callback(null, { stdout: 'v2', stderr: '' });
        }
      });

      const result = await getComposeCommand();
      expect(result).toBe('docker compose');
    });

    it('should try v2 first before falling back to v1', async() => {
      let callCount = 0;
      exec.mockImplementation((command, callback) => {
        callCount++;
        if (command === 'docker compose version' && callCount === 1) {
          callback(new Error('docker compose: command not found'), null);
        } else if (command === 'docker-compose --version' && callCount === 2) {
          callback(null, { stdout: 'docker-compose version 1.29.0', stderr: '' });
        }
      });

      const result = await getComposeCommand();

      expect(result).toBe('docker-compose');
      // Verify v2 was tried first
      const calls = exec.mock.calls;
      expect(calls[0][0]).toBe('docker compose version');
      expect(calls[1][0]).toBe('docker-compose --version');
    });
  });

  describe('ensureDockerAndCompose', () => {
    it('should check docker and return compose command when both are available', async() => {
      exec.mockImplementation((command, callback) => {
        if (command === 'docker --version') {
          callback(null, { stdout: 'Docker version 20.10.0', stderr: '' });
        } else if (command === 'docker compose version') {
          callback(null, { stdout: 'Docker Compose version v2.0.0', stderr: '' });
        }
      });

      const result = await ensureDockerAndCompose();

      expect(result).toBe('docker compose');
      expect(exec).toHaveBeenCalledWith('docker --version', expect.any(Function));
      expect(exec).toHaveBeenCalledWith('docker compose version', expect.any(Function));
    });

    it('should throw error when docker is not available', async() => {
      exec.mockImplementation((command, callback) => {
        if (command === 'docker --version') {
          callback(new Error('docker: command not found'), null);
        }
      });

      await expect(ensureDockerAndCompose()).rejects.toThrow('docker: command not found');
      expect(exec).toHaveBeenCalledWith('docker --version', expect.any(Function));
      // Should not try to check compose if docker fails
      expect(exec).not.toHaveBeenCalledWith('docker compose version', expect.any(Function));
    });

    it('should throw error when compose is not available even if docker is', async() => {
      exec.mockImplementation((command, callback) => {
        if (command === 'docker --version') {
          callback(null, { stdout: 'Docker version 20.10.0', stderr: '' });
        } else {
          callback(new Error('command not found'), null);
        }
      });

      await expect(ensureDockerAndCompose()).rejects.toThrow(
        'Docker Compose is not available'
      );
      expect(exec).toHaveBeenCalledWith('docker --version', expect.any(Function));
    });

    it('should return docker-compose when v1 is available', async() => {
      exec.mockImplementation((command, callback) => {
        if (command === 'docker --version') {
          callback(null, { stdout: 'Docker version 20.10.0', stderr: '' });
        } else if (command === 'docker compose version') {
          callback(new Error('docker compose: command not found'), null);
        } else if (command === 'docker-compose --version') {
          callback(null, { stdout: 'docker-compose version 1.29.0', stderr: '' });
        }
      });

      const result = await ensureDockerAndCompose();

      expect(result).toBe('docker-compose');
    });
  });
});

