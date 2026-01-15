/**
 * Tests for Templates Environment Module
 *
 * @fileoverview Unit tests for lib/core/templates-env.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  generateEnvTemplate,
  buildCoreEnv,
  buildPythonEnv,
  buildDatabaseEnv,
  buildRedisEnv,
  buildStorageEnv,
  buildAuthEnv,
  buildMonitoringEnv
} = require('../../../lib/core/templates-env');

describe('Templates Environment Module', () => {
  describe('buildCoreEnv', () => {
    it('should build core environment variables with defaults', () => {
      const config = {};
      const result = buildCoreEnv(config);

      expect(result).toEqual({
        'NODE_ENV': '${NODE_ENV}',
        'PORT': 3000,
        'APP_NAME': 'myapp',
        'LOG_LEVEL': 'info'
      });
    });

    it('should use provided port and appName', () => {
      const config = {
        port: 8080,
        appName: 'test-app'
      };
      const result = buildCoreEnv(config);

      expect(result).toEqual({
        'NODE_ENV': '${NODE_ENV}',
        'PORT': 8080,
        'APP_NAME': 'test-app',
        'LOG_LEVEL': 'info'
      });
    });
  });

  describe('buildPythonEnv', () => {
    it('should return empty object for non-Python language', () => {
      const config = { language: 'typescript' };
      const result = buildPythonEnv(config);

      expect(result).toEqual({});
    });

    it('should return empty object when language is not provided', () => {
      const config = {};
      const result = buildPythonEnv(config);

      expect(result).toEqual({});
    });

    it('should return Python environment variables for Python language', () => {
      const config = { language: 'python' };
      const result = buildPythonEnv(config);

      expect(result).toEqual({
        'PYTHONUNBUFFERED': '${PYTHONUNBUFFERED}',
        'PYTHONDONTWRITEBYTECODE': '${PYTHONDONTWRITEBYTECODE}',
        'PYTHONIOENCODING': '${PYTHONIOENCODING}'
      });
    });
  });

  describe('buildDatabaseEnv', () => {
    it('should return empty object when database is not configured', () => {
      const config = {};
      const result = buildDatabaseEnv(config);

      expect(result).toEqual({});
    });

    it('should build database environment variables', () => {
      const config = {
        database: true,
        appName: 'test-app'
      };
      const result = buildDatabaseEnv(config);

      expect(result).toHaveProperty('DATABASE_URL');
      expect(result).toHaveProperty('DB_HOST');
      expect(result).toHaveProperty('DB_PORT');
      expect(result).toHaveProperty('DB_NAME');
      expect(result).toHaveProperty('DB_USER');
      expect(result).toHaveProperty('DB_PASSWORD');
      expect(result).toHaveProperty('DB_0_PASSWORD');
      expect(result.DB_NAME).toBe('test_app'); // Hyphens replaced with underscores
      expect(result.DB_USER).toBe('test_app_user');
    });

    it('should use default appName when not provided', () => {
      const config = { database: true };
      const result = buildDatabaseEnv(config);

      expect(result.DB_NAME).toBe('myapp');
      expect(result.DB_USER).toBe('myapp_user');
    });

    it('should replace hyphens with underscores in database name', () => {
      const config = {
        database: true,
        appName: 'my-test-app'
      };
      const result = buildDatabaseEnv(config);

      expect(result.DB_NAME).toBe('my_test_app');
      expect(result.DB_USER).toBe('my_test_app_user');
    });
  });

  describe('buildRedisEnv', () => {
    it('should return empty object when redis is not configured', () => {
      const config = {};
      const result = buildRedisEnv(config);

      expect(result).toEqual({});
    });

    it('should build Redis environment variables', () => {
      const config = { redis: true };
      const result = buildRedisEnv(config);

      expect(result).toEqual({
        'REDIS_URL': 'kv://redis-url',
        'REDIS_HOST': '${REDIS_HOST}',
        'REDIS_PORT': '${REDIS_PORT}',
        'REDIS_PASSWORD': 'kv://redis-passwordKeyVault'
      });
    });
  });

  describe('buildStorageEnv', () => {
    it('should return empty object when storage is not configured', () => {
      const config = {};
      const result = buildStorageEnv(config);

      expect(result).toEqual({});
    });

    it('should build storage environment variables', () => {
      const config = { storage: true };
      const result = buildStorageEnv(config);

      expect(result).toEqual({
        'STORAGE_TYPE': 'local',
        'STORAGE_PATH': '/app/storage'
      });
    });
  });

  describe('buildAuthEnv', () => {
    it('should return empty object when authentication is not configured', () => {
      const config = {};
      const result = buildAuthEnv(config);

      expect(result).toEqual({});
    });

    it('should build authentication environment variables', () => {
      const config = { authentication: true };
      const result = buildAuthEnv(config);

      expect(result).toEqual({
        'JWT_SECRET': 'kv://miso-controller-jwt-secretKeyVault',
        'JWT_EXPIRES_IN': '24h',
        'AUTH_PROVIDER': 'local'
      });
    });
  });

  describe('buildMonitoringEnv', () => {
    it('should return empty object when controller is not configured', () => {
      const config = {};
      const result = buildMonitoringEnv(config);

      expect(result).toEqual({});
    });

    it('should build monitoring environment variables with default controller URL', () => {
      const config = { controller: true };
      const result = buildMonitoringEnv(config);

      expect(result).toEqual({
        'MISO_CONTROLLER_URL': 'https://controller.aifabrix.ai',
        'MISO_ENVIRONMENT': 'dev',
        'MISO_CLIENTID': 'kv://miso-controller-client-idKeyVault',
        'MISO_CLIENTSECRET': 'kv://miso-controller-client-secretKeyVault',
        'MISO_WEB_SERVER_URL': 'kv://miso-controller-web-server-url'
      });
    });

    it('should use provided controllerUrl', () => {
      const config = {
        controller: true,
        controllerUrl: 'https://custom-controller.example.com'
      };
      const result = buildMonitoringEnv(config);

      expect(result.MISO_CONTROLLER_URL).toBe('https://custom-controller.example.com');
    });
  });

  describe('generateEnvTemplate', () => {
    it('should generate basic env template with core variables', () => {
      const config = {
        appName: 'test-app',
        port: 3000
      };
      const result = generateEnvTemplate(config);

      expect(result).toContain('# Environment Variables Template');
      expect(result).toContain('NODE_ENV=${NODE_ENV}');
      expect(result).toContain('PORT=3000');
      expect(result).toContain('APP_NAME=test-app');
      expect(result).toContain('LOG_LEVEL=info');
      expect(result).toContain('ALLOWED_ORIGINS=http://localhost:*,');
      expect(result).toContain('WEB_SERVER_URL=http://localhost:${PORT},');
    });

    it('should include Python variables when language is python', () => {
      const config = {
        appName: 'test-app',
        language: 'python'
      };
      const result = generateEnvTemplate(config);

      expect(result).toContain('PYTHONUNBUFFERED=${PYTHONUNBUFFERED}');
      expect(result).toContain('PYTHONDONTWRITEBYTECODE=${PYTHONDONTWRITEBYTECODE}');
      expect(result).toContain('PYTHONIOENCODING=${PYTHONIOENCODING}');
    });

    it('should include database section when database is configured', () => {
      const config = {
        appName: 'test-app',
        database: true
      };
      const result = generateEnvTemplate(config);

      expect(result).toContain('# DATABASE CONFIGURATION');
      expect(result).toContain('DATABASE_URL=');
      expect(result).toContain('DB_HOST=${DB_HOST}');
      expect(result).toContain('DB_PORT=${DB_PORT}');
      expect(result).toContain('DB_NAME=test_app');
      expect(result).toContain('DB_USER=test_app_user');
      expect(result).toContain('DB_PASSWORD=');
      expect(result).toContain('DB_0_PASSWORD=');
    });

    it('should include Redis section when redis is configured', () => {
      const config = {
        appName: 'test-app',
        redis: true
      };
      const result = generateEnvTemplate(config);

      expect(result).toContain('# REDIS CONFIGURATION');
      expect(result).toContain('REDIS_URL=kv://redis-url');
      expect(result).toContain('REDIS_HOST=${REDIS_HOST}');
      expect(result).toContain('REDIS_PORT=${REDIS_PORT}');
      expect(result).toContain('REDIS_PASSWORD=kv://redis-passwordKeyVault');
    });

    it('should include storage section when storage is configured', () => {
      const config = {
        appName: 'test-app',
        storage: true
      };
      const result = generateEnvTemplate(config);

      expect(result).toContain('# STORAGE CONFIGURATION');
      expect(result).toContain('STORAGE_TYPE=local');
      expect(result).toContain('STORAGE_PATH=/app/storage');
    });

    it('should include authentication section when authentication is configured', () => {
      const config = {
        appName: 'test-app',
        authentication: true
      };
      const result = generateEnvTemplate(config);

      expect(result).toContain('# AUTHENTICATION CONFIGURATION');
      expect(result).toContain('JWT_SECRET=kv://miso-controller-jwt-secretKeyVault');
      expect(result).toContain('JWT_EXPIRES_IN=24h');
      expect(result).toContain('AUTH_PROVIDER=local');
    });

    it('should include monitoring section when controller is configured', () => {
      const config = {
        appName: 'test-app',
        controller: true
      };
      const result = generateEnvTemplate(config);

      expect(result).toContain('# MISO Controller Configuration');
      expect(result).toContain('MISO_CONTROLLER_URL=https://controller.aifabrix.ai');
      expect(result).toContain('MISO_ENVIRONMENT=dev');
      expect(result).toContain('MISO_CLIENTID=kv://miso-controller-client-idKeyVault');
      expect(result).toContain('MISO_CLIENTSECRET=kv://miso-controller-client-secretKeyVault');
      expect(result).toContain('MISO_WEB_SERVER_URL=kv://miso-controller-web-server-url');
    });

    it('should merge with existing environment variables', () => {
      const config = {
        appName: 'test-app',
        port: 3000
      };
      // Existing env vars that match core variables will override defaults
      const existingEnv = {
        'PORT': 8080,
        'LOG_LEVEL': 'debug'
      };
      const result = generateEnvTemplate(config, existingEnv);

      // Merged variables should override defaults
      expect(result).toContain('PORT=8080');
      expect(result).toContain('LOG_LEVEL=debug');
      expect(result).not.toContain('PORT=3000');
    });

    it('should generate complete template with all services', () => {
      const config = {
        appName: 'test-app',
        port: 8080,
        language: 'python',
        database: true,
        redis: true,
        storage: true,
        authentication: true,
        controller: true,
        controllerUrl: 'https://custom-controller.example.com'
      };
      const result = generateEnvTemplate(config);

      // Check all sections are present
      expect(result).toContain('# APPLICATION ENVIRONMENT');
      expect(result).toContain('# DATABASE CONFIGURATION');
      expect(result).toContain('# REDIS CONFIGURATION');
      expect(result).toContain('# STORAGE CONFIGURATION');
      expect(result).toContain('# AUTHENTICATION CONFIGURATION');
      expect(result).toContain('# MISO Controller Configuration');

      // Check Python variables
      expect(result).toContain('PYTHONUNBUFFERED');

      // Check custom controller URL
      expect(result).toContain('MISO_CONTROLLER_URL=https://custom-controller.example.com');
    });

    it('should not include service sections when services are not configured', () => {
      const config = {
        appName: 'test-app',
        port: 3000
      };
      const result = generateEnvTemplate(config);

      expect(result).not.toContain('# DATABASE CONFIGURATION');
      expect(result).not.toContain('# REDIS CONFIGURATION');
      expect(result).not.toContain('# STORAGE CONFIGURATION');
      expect(result).not.toContain('# AUTHENTICATION CONFIGURATION');
      expect(result).not.toContain('# MISO Controller Configuration');
    });

    it('should handle empty existingEnv', () => {
      const config = {
        appName: 'test-app',
        port: 3000
      };
      const result = generateEnvTemplate(config, {});

      expect(result).toContain('NODE_ENV=${NODE_ENV}');
      expect(result).toContain('PORT=3000');
    });

    it('should sort database variables correctly', () => {
      const config = {
        appName: 'test-app',
        database: true
      };
      const result = generateEnvTemplate(config);

      const dbSection = result.split('# DATABASE CONFIGURATION')[1].split('#')[0];
      const dbLines = dbSection.split('\n').filter(line => line.includes('='));

      // DB_* variables should come before DATABASE_* variables
      const dbPrefixIndex = dbLines.findIndex(line => line.startsWith('DB_'));
      const databasePrefixIndex = dbLines.findIndex(line => line.startsWith('DATABASE_'));

      if (dbPrefixIndex !== -1 && databasePrefixIndex !== -1) {
        expect(dbPrefixIndex).toBeLessThan(databasePrefixIndex);
      }
    });

    it('should sort authentication variables correctly', () => {
      const config = {
        appName: 'test-app',
        authentication: true
      };
      const result = generateEnvTemplate(config);

      const authSection = result.split('# AUTHENTICATION CONFIGURATION')[1].split('#')[0];
      const authLines = authSection.split('\n').filter(line => line.includes('='));

      // JWT_* should come before AUTH_*, which should come before SESSION_*
      const jwtIndex = authLines.findIndex(line => line.startsWith('JWT_'));
      const authIndex = authLines.findIndex(line => line.startsWith('AUTH_'));
      const sessionIndex = authLines.findIndex(line => line.startsWith('SESSION_'));

      if (jwtIndex !== -1 && authIndex !== -1) {
        expect(jwtIndex).toBeLessThan(authIndex);
      }
      if (authIndex !== -1 && sessionIndex !== -1) {
        expect(authIndex).toBeLessThan(sessionIndex);
      }
    });
  });
});

