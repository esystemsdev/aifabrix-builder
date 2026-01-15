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
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('should throw error when neither v2 nor v1 is available', async() => {
      exec.mockImplementation((command, callback) => {
        callback(new Error('command not found'), null);
      });

      await expect(getComposeCommand()).rejects.toThrow(
        'Docker Compose is not available (neither "docker compose" nor "docker-compose" found)'
      );
      expect(exec).toHaveBeenCalledWith('docker compose version', expect.any(Function));
      expect(exec).toHaveBeenCalledWith('docker-compose --version', expect.any(Function));
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

