/**
 * Tests for Secrets URL Module
 *
 * @fileoverview Unit tests for lib/utils/secrets-url.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock secrets-utils
jest.mock('../../../lib/utils/secrets-utils', () => ({
  buildHostnameToServiceMap: jest.fn(),
  resolveUrlPort: jest.fn()
}));

// Mock env-config-loader
jest.mock('../../../lib/utils/env-config-loader', () => ({
  loadEnvConfig: jest.fn()
}));

const { buildHostnameToServiceMap, resolveUrlPort } = require('../../../lib/utils/secrets-utils');
const { loadEnvConfig } = require('../../../lib/utils/env-config-loader');
const { resolveServicePortsInEnvContent } = require('../../../lib/utils/secrets-url');

describe('Secrets URL Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveServicePortsInEnvContent', () => {
    it('should return content unchanged for non-docker environment', async() => {
      const envContent = 'DATABASE_URL=http://postgres:5432/db';
      const environment = 'local';

      const result = await resolveServicePortsInEnvContent(envContent, environment);

      expect(result).toBe(envContent);
      expect(loadEnvConfig).not.toHaveBeenCalled();
    });

    it('should resolve service ports for docker environment', async() => {
      const envContent = 'DATABASE_URL=http://postgres:5432/db\nREDIS_URL=http://redis:6379';
      const environment = 'docker';
      const envConfig = {
        environments: {
          docker: {
            DB_HOST: 'postgres',
            REDIS_HOST: 'redis'
          }
        }
      };
      const hostnameToService = {
        postgres: 'postgres',
        redis: 'redis'
      };

      loadEnvConfig.mockResolvedValue(envConfig);
      buildHostnameToServiceMap.mockReturnValue(hostnameToService);
      resolveUrlPort
        .mockReturnValueOnce('http://postgres:5432/db')
        .mockReturnValueOnce('http://redis:6379');

      const result = await resolveServicePortsInEnvContent(envContent, environment);

      expect(loadEnvConfig).toHaveBeenCalled();
      expect(buildHostnameToServiceMap).toHaveBeenCalledWith(envConfig.environments.docker);
      expect(resolveUrlPort).toHaveBeenCalledTimes(2);
      // Function returns full env content with URLs replaced
      expect(result).toBe('DATABASE_URL=http://postgres:5432/db\nREDIS_URL=http://redis:6379');
    });

    it('should handle URLs with query strings and paths', async() => {
      const envContent = 'API_URL=https://api.example.com:8080/v1/endpoint?param=value';
      const environment = 'docker';
      const envConfig = {
        environments: {
          docker: {}
        }
      };
      const hostnameToService = {};

      loadEnvConfig.mockResolvedValue(envConfig);
      buildHostnameToServiceMap.mockReturnValue(hostnameToService);
      resolveUrlPort.mockReturnValue('https://api.example.com:8080/v1/endpoint?param=value');

      const result = await resolveServicePortsInEnvContent(envContent, environment);

      expect(resolveUrlPort).toHaveBeenCalledWith(
        'https://',
        'api.example.com',
        '8080',
        '/v1/endpoint?param=value',
        hostnameToService
      );
    });

    it('should handle URLs without paths', async() => {
      const envContent = 'SERVICE_URL=http://service:3000';
      const environment = 'docker';
      const envConfig = {
        environments: {
          docker: {
            SERVICE_HOST: 'service'
          }
        }
      };
      const hostnameToService = {
        service: 'service'
      };

      loadEnvConfig.mockResolvedValue(envConfig);
      buildHostnameToServiceMap.mockReturnValue(hostnameToService);
      resolveUrlPort.mockReturnValue('http://service:3000');

      const result = await resolveServicePortsInEnvContent(envContent, environment);

      expect(resolveUrlPort).toHaveBeenCalledWith(
        'http://',
        'service',
        '3000',
        '',
        hostnameToService
      );
    });

    it('should handle multiple URLs in same line', async() => {
      const envContent = 'URL1=http://host1:8080 URL2=https://host2:8443';
      const environment = 'docker';
      const envConfig = {
        environments: {
          docker: {}
        }
      };
      const hostnameToService = {};

      loadEnvConfig.mockResolvedValue(envConfig);
      buildHostnameToServiceMap.mockReturnValue(hostnameToService);
      resolveUrlPort
        .mockReturnValueOnce('http://host1:8080')
        .mockReturnValueOnce('https://host2:8443');

      const result = await resolveServicePortsInEnvContent(envContent, environment);

      expect(resolveUrlPort).toHaveBeenCalledTimes(2);
    });

    it('should handle empty env content', async() => {
      const envContent = '';
      const environment = 'docker';
      const envConfig = {
        environments: {
          docker: {}
        }
      };
      const hostnameToService = {};

      loadEnvConfig.mockResolvedValue(envConfig);
      buildHostnameToServiceMap.mockReturnValue(hostnameToService);

      const result = await resolveServicePortsInEnvContent(envContent, environment);

      expect(result).toBe('');
      expect(resolveUrlPort).not.toHaveBeenCalled();
    });

    it('should handle env config without docker environment', async() => {
      const envContent = 'DATABASE_URL=http://postgres:5432/db';
      const environment = 'docker';
      const envConfig = {
        environments: {}
      };
      const hostnameToService = {};

      loadEnvConfig.mockResolvedValue(envConfig);
      buildHostnameToServiceMap.mockReturnValue(hostnameToService);
      resolveUrlPort.mockReturnValue('http://postgres:5432/db');

      const result = await resolveServicePortsInEnvContent(envContent, environment);

      expect(buildHostnameToServiceMap).toHaveBeenCalledWith({});
    });
  });
});

