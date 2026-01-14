/**
 * Tests for Infrastructure Container Utilities
 *
 * @fileoverview Comprehensive tests for infra-containers module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock util.promisify to return a mock function we can control
const mockExecAsync = jest.fn();
jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

// Mock config module
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn()
}));

const config = require('../../../lib/core/config');
const { findContainer, checkServiceWithHealthCheck, checkServiceWithoutHealthCheck } = require('../../../lib/utils/infra-containers');

describe('Infrastructure Container Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation - returns empty stdout
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
  });

  describe('findContainer', () => {
    it('should find container with devId 0', async() => {
      // Note: devId 0 is falsy, so config.getDeveloperId() will be called
      // This is a limitation of using || operator with 0
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync.mockResolvedValue({ stdout: 'aifabrix-postgres\n', stderr: '' });

      const result = await findContainer('postgres', 0);

      expect(result).toBe('aifabrix-postgres');
      expect(mockExecAsync).toHaveBeenCalledWith('docker ps --filter "name=aifabrix-postgres" --format "{{.Names}}"');
    });

    it('should find container with devId > 0', async() => {
      mockExecAsync.mockResolvedValue({ stdout: 'aifabrix-dev5-postgres\n', stderr: '' });

      const result = await findContainer('postgres', 5);

      expect(result).toBe('aifabrix-dev5-postgres');
      expect(mockExecAsync).toHaveBeenCalledWith('docker ps --filter "name=aifabrix-dev5-postgres" --format "{{.Names}}"');
    });

    it('should load devId from config when not provided', async() => {
      config.getDeveloperId.mockResolvedValue(3);
      mockExecAsync.mockResolvedValue({ stdout: 'aifabrix-dev3-redis\n', stderr: '' });

      const result = await findContainer('redis');

      expect(result).toBe('aifabrix-dev3-redis');
      expect(config.getDeveloperId).toHaveBeenCalled();
      expect(mockExecAsync).toHaveBeenCalledWith('docker ps --filter "name=aifabrix-dev3-redis" --format "{{.Names}}"');
    });

    it('should fallback to old naming pattern when primary pattern not found', async() => {
      // Note: devId 0 is falsy, so config.getDeveloperId() will be called
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // First call returns empty
        .mockResolvedValueOnce({ stdout: 'infra-postgres\n', stderr: '' }); // Second call finds with old pattern

      const result = await findContainer('postgres', 0);

      expect(result).toBe('infra-postgres');
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
      expect(mockExecAsync).toHaveBeenNthCalledWith(1, 'docker ps --filter "name=aifabrix-postgres" --format "{{.Names}}"');
      expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'docker ps --filter "name=infra-postgres" --format "{{.Names}}"');
    });

    it('should fallback to aifabrix- pattern when both primary and old pattern not found', async() => {
      // Note: devId 0 is falsy, so config.getDeveloperId() will be called
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // First call returns empty
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // Second call returns empty
        .mockResolvedValueOnce({ stdout: 'aifabrix-postgres\n', stderr: '' }); // Third call finds with aifabrix- pattern

      const result = await findContainer('postgres', 0);

      expect(result).toBe('aifabrix-postgres');
      expect(mockExecAsync).toHaveBeenCalledTimes(3);
      expect(mockExecAsync).toHaveBeenNthCalledWith(1, 'docker ps --filter "name=aifabrix-postgres" --format "{{.Names}}"');
      expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'docker ps --filter "name=infra-postgres" --format "{{.Names}}"');
      expect(mockExecAsync).toHaveBeenNthCalledWith(3, 'docker ps --filter "name=aifabrix-postgres" --format "{{.Names}}"');
    });

    it('should return empty string when container not found with any pattern', async() => {
      // All calls return empty
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await findContainer('postgres', 0);

      expect(result).toBe('');
      expect(mockExecAsync).toHaveBeenCalledTimes(3);
    });

    it('should return null on error', async() => {
      const error = new Error('Docker command failed');
      mockExecAsync.mockRejectedValue(error);

      const result = await findContainer('postgres', 0);

      expect(result).toBeNull();
    });

    it('should handle whitespace in container name', async() => {
      mockExecAsync.mockResolvedValue({ stdout: '  aifabrix-postgres  \n', stderr: '' });

      const result = await findContainer('postgres', 0);

      expect(result).toBe('aifabrix-postgres');
    });
  });

  describe('checkServiceWithHealthCheck', () => {
    it('should return healthy status when container is healthy', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-postgres\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'healthy\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithHealthCheck('postgres', 0);

      expect(result).toBe('healthy');
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
      expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'docker inspect --format=\'{{.State.Health.Status}}\' aifabrix-postgres');
    });

    it('should return healthy status when container is starting', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-postgres\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'starting\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithHealthCheck('postgres', 0);

      expect(result).toBe('healthy');
    });

    it('should return unhealthy status when container is unhealthy', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-postgres\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'unhealthy\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithHealthCheck('postgres', 0);

      expect(result).toBe('unhealthy');
    });

    it('should return unknown when container not found', async() => {
      // Note: devId 0 is falsy, so config.getDeveloperId() will be called
      config.getDeveloperId.mockResolvedValue(0);
      // findContainer will try 3 patterns, all return empty
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await checkServiceWithHealthCheck('postgres', 0);

      expect(result).toBe('unknown');
      expect(mockExecAsync).toHaveBeenCalledTimes(3); // findContainer tries 3 patterns
    });

    it('should return unknown on error', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      const error = new Error('Docker inspect failed');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-postgres\n', stderr: '' }) // findContainer
        .mockRejectedValueOnce(error); // docker inspect fails

      const result = await checkServiceWithHealthCheck('postgres', 0);

      expect(result).toBe('unknown');
    });

    it('should load devId from config when not provided', async() => {
      config.getDeveloperId.mockResolvedValue(2);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-dev2-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'healthy\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithHealthCheck('redis');

      expect(result).toBe('healthy');
      expect(config.getDeveloperId).toHaveBeenCalled();
    });

    it('should handle quoted status values', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-postgres\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: '"healthy"\n', stderr: '' }); // docker inspect with quotes

      const result = await checkServiceWithHealthCheck('postgres', 0);

      expect(result).toBe('healthy');
    });

    it('should handle whitespace in status', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-postgres\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: '  healthy  \n', stderr: '' }); // docker inspect with whitespace

      const result = await checkServiceWithHealthCheck('postgres', 0);

      expect(result).toBe('healthy');
    });
  });

  describe('checkServiceWithoutHealthCheck', () => {
    it('should return healthy status when container is running', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'running\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('healthy');
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
      expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'docker inspect --format=\'{{.State.Status}}\' aifabrix-redis');
    });

    it('should return healthy status when container status is healthy', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'healthy\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('healthy');
    });

    it('should return unhealthy status when container is not running', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'exited\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('unhealthy');
    });

    it('should return unhealthy status when container is stopped', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'stopped\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('unhealthy');
    });

    it('should return unknown when container not found', async() => {
      // Note: devId 0 is falsy, so config.getDeveloperId() will be called
      config.getDeveloperId.mockResolvedValue(0);
      // findContainer will try 3 patterns, all return empty
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('unknown');
      expect(mockExecAsync).toHaveBeenCalledTimes(3); // findContainer tries 3 patterns
    });

    it('should return unknown on error', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      const error = new Error('Docker inspect failed');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-redis\n', stderr: '' }) // findContainer
        .mockRejectedValueOnce(error); // docker inspect fails

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('unknown');
    });

    it('should load devId from config when not provided', async() => {
      config.getDeveloperId.mockResolvedValue(4);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-dev4-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: 'running\n', stderr: '' }); // docker inspect

      const result = await checkServiceWithoutHealthCheck('redis');

      expect(result).toBe('healthy');
      expect(config.getDeveloperId).toHaveBeenCalled();
    });

    it('should handle quoted status values', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: '"running"\n', stderr: '' }); // docker inspect with quotes

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('healthy');
    });

    it('should handle whitespace in status', async() => {
      config.getDeveloperId.mockResolvedValue(0);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'aifabrix-redis\n', stderr: '' }) // findContainer
        .mockResolvedValueOnce({ stdout: '  running  \n', stderr: '' }); // docker inspect with whitespace

      const result = await checkServiceWithoutHealthCheck('redis', 0);

      expect(result).toBe('healthy');
    });
  });
});
