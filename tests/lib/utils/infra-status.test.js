/**
 * Tests for Infrastructure Status Module
 *
 * @fileoverview Unit tests for lib/utils/infra-status.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const config = require('../../../lib/core/config');
const devConfig = require('../../../lib/utils/dev-config');
const containerUtils = require('../../../lib/utils/infra-containers');

// Mock dependencies
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn()
}));

jest.mock('../../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn()
}));

jest.mock('../../../lib/utils/infra-containers', () => ({
  findContainer: jest.fn()
}));

const execAsync = promisify(exec);
const {
  getInfraStatus,
  getAppStatus
} = require('../../../lib/utils/infra-status');

describe('Infrastructure Status Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInfraStatus', () => {
    it('should return status for all services when containers are running', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      devConfig.getDevPorts.mockReturnValue({
        postgres: 5432,
        redis: 6379,
        pgadmin: 5050,
        redisCommander: 8081,
        traefikHttp: 80,
        traefikHttps: 443
      });
      containerUtils.findContainer
        .mockResolvedValueOnce('aifabrix-postgres')
        .mockResolvedValueOnce('aifabrix-redis')
        .mockResolvedValueOnce('aifabrix-pgadmin')
        .mockResolvedValueOnce('aifabrix-redis-commander')
        .mockResolvedValueOnce('aifabrix-traefik');
      exec.mockImplementation((command, callback) => {
        callback(null, { stdout: 'running' });
      });

      const result = await getInfraStatus();

      expect(result).toHaveProperty('postgres');
      expect(result).toHaveProperty('redis');
      expect(result).toHaveProperty('pgadmin');
      expect(result).toHaveProperty('redis-commander');
      expect(result).toHaveProperty('traefik');
      expect(result.postgres.status).toBe('running');
      expect(result.postgres.port).toBe(5432);
      expect(result.postgres.url).toBe('localhost:5432');
      expect(containerUtils.findContainer).toHaveBeenNthCalledWith(1, 'postgres', '0', { strict: true });
    });

    it('should return not running status when container is not found', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      devConfig.getDevPorts.mockReturnValue({
        postgres: 5432,
        redis: 6379,
        pgadmin: 5050,
        redisCommander: 8081,
        traefikHttp: 80,
        traefikHttps: 443
      });
      containerUtils.findContainer.mockResolvedValue(null);

      const result = await getInfraStatus();

      expect(result.postgres.status).toBe('not running');
      expect(result.postgres.port).toBe(5432);
      expect(result.postgres.url).toBe('localhost:5432');
    });

    it('should handle docker inspect errors gracefully', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      devConfig.getDevPorts.mockReturnValue({
        postgres: 5432,
        redis: 6379,
        pgadmin: 5050,
        redisCommander: 8081,
        traefikHttp: 80,
        traefikHttps: 443
      });
      containerUtils.findContainer.mockResolvedValue('aifabrix-postgres');
      exec.mockImplementation((command, callback) => {
        callback(new Error('Docker error'), null);
      });

      const result = await getInfraStatus();

      expect(result.postgres.status).toBe('not running');
    });

    it('should normalize status value by trimming and removing quotes', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      devConfig.getDevPorts.mockReturnValue({
        postgres: 5432,
        redis: 6379,
        pgadmin: 5050,
        redisCommander: 8081,
        traefikHttp: 80,
        traefikHttps: 443
      });
      containerUtils.findContainer.mockResolvedValue('aifabrix-postgres');
      exec.mockImplementation((command, callback) => {
        callback(null, { stdout: '  "running"  ' });
      });

      const result = await getInfraStatus();

      expect(result.postgres.status).toBe('running');
    });

    it('should use developer-specific ports when developer ID is not 0', async() => {
      config.getDeveloperId.mockResolvedValue('1');
      devConfig.getDevPorts.mockReturnValue({
        postgres: 5532,
        redis: 6479,
        pgadmin: 5150,
        redisCommander: 8181,
        traefikHttp: 180,
        traefikHttps: 543
      });
      containerUtils.findContainer.mockResolvedValue(null);

      const result = await getInfraStatus();

      expect(result.postgres.port).toBe(5532);
      expect(result.redis.port).toBe(6479);
      expect(result.pgadmin.port).toBe(5150);
      expect(result['redis-commander'].port).toBe(8181);
      expect(result.traefik.port).toBe('180, 543');
    });

    it('should handle non-numeric developer ID', async() => {
      config.getDeveloperId.mockResolvedValue('invalid');
      devConfig.getDevPorts.mockReturnValue({
        postgres: 5432,
        redis: 6379,
        pgadmin: 5050,
        redisCommander: 8081,
        traefikHttp: 80,
        traefikHttps: 443
      });
      containerUtils.findContainer.mockResolvedValue(null);

      const result = await getInfraStatus();

      expect(result.postgres.port).toBe(5432);
    });
  });

  describe('getAppStatus', () => {
    it('should return app status for developer ID 0', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = 'aifabrix-myapp\t0.0.0.0:3100->3000/tcp\trunning';
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'myapp',
        container: 'aifabrix-myapp',
        port: '0.0.0.0:3100->3000/tcp',
        status: 'running',
        url: 'http://localhost:3100'
      });
    });

    it('should return app status for non-zero developer ID', async() => {
      config.getDeveloperId.mockResolvedValue('1');
      exec.mockImplementation((command, callback) => {
        const output = 'aifabrix-dev1-myapp\t0.0.0.0:3200->3000/tcp\trunning';
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'myapp',
        container: 'aifabrix-dev1-myapp',
        port: '0.0.0.0:3200->3000/tcp',
        status: 'running',
        url: 'http://localhost:3200'
      });
    });

    it('should filter out infrastructure containers', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = [
          'aifabrix-postgres\t0.0.0.0:5432->5432/tcp\trunning',
          'aifabrix-myapp\t0.0.0.0:3100->3000/tcp\trunning',
          'aifabrix-redis\t0.0.0.0:6379->6379/tcp\trunning'
        ].join('\n');
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('myapp');
      expect(result[0].container).toBe('aifabrix-myapp');
    });

    it('should handle containers without port mapping', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = 'aifabrix-myapp\t\trunning';
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toHaveLength(1);
      expect(result[0].port).toBe('');
      expect(result[0].url).toBe('unknown');
    });

    it('should handle multiple apps', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = [
          'aifabrix-app1\t0.0.0.0:3100->3000/tcp\trunning',
          'aifabrix-app2\t0.0.0.0:3101->3000/tcp\trunning'
        ].join('\n');
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('app1');
      expect(result[1].name).toBe('app2');
    });

    it('should return empty array on error', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        callback(new Error('Docker error'), null);
      });

      const result = await getAppStatus();

      expect(result).toEqual([]);
    });

    it('should handle empty output', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        callback(null, { stdout: '' });
      });

      const result = await getAppStatus();

      expect(result).toEqual([]);
    });

    it('should handle whitespace-only lines', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = 'aifabrix-myapp\t0.0.0.0:3100->3000/tcp\trunning\n   \n';
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toHaveLength(1);
    });

    it('should skip containers that do not match pattern', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = 'other-container\t0.0.0.0:3100->3000/tcp\trunning';
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toEqual([]);
    });

    it('should extract host port from port mapping', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = 'aifabrix-myapp\t0.0.0.0:8080->3000/tcp\trunning';
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result[0].url).toBe('http://localhost:8080');
    });

    it('should handle port mapping with path', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = 'aifabrix-myapp\t0.0.0.0:3100->3000/tcp, 0.0.0.0:3101->3001/tcp\trunning';
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result[0].url).toBe('http://localhost:3100');
    });

    it('should exclude init/helper containers (e.g. keycloak-db-init) from running applications', async() => {
      config.getDeveloperId.mockResolvedValue('0');
      exec.mockImplementation((command, callback) => {
        const output = [
          'aifabrix-keycloak\t0.0.0.0:8082->8080/tcp\tUp 5 minutes',
          'aifabrix-keycloak-db-init\t5432/tcp\tUp 5 minutes'
        ].join('\n');
        callback(null, { stdout: output });
      });

      const result = await getAppStatus();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('keycloak');
      expect(result.map(a => a.name)).not.toContain('keycloak-db-init');
    });
  });
});

