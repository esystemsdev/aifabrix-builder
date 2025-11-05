/**
 * Tests for Docker Compose generation in app-run module
 * @fileoverview Tests for docker-compose.yaml generation
 */

const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('../../lib/infra');
jest.mock('../../lib/secrets');
jest.mock('../../lib/validator');

const appRun = require('../../lib/app-run');

describe('app-run Docker Compose Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDockerCompose', () => {
    it('should generate compose file with db-init service when requiresDatabase is true', async() => {
      const appName = 'test-app';
      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: {
          database: true,
          databases: [{ name: 'test_app' }]
        }
      };
      const options = { port: 3090 };

      const result = await appRun.generateDockerCompose(appName, config, options);

      expect(result).toContain('test-app:');
      expect(result).toContain('db-init:');
      expect(result).toContain('depends_on:');
      expect(result).toContain('test_app');
      expect(result).toContain('pgvector/pgvector:pg15');
    });

    it('should not include db-init service when requiresDatabase is false', async() => {
      const appName = 'test-app';
      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: {
          database: false
        }
      };
      const options = { port: 3090 };

      const result = await appRun.generateDockerCompose(appName, config, options);

      expect(result).toContain('test-app:');
      expect(result).not.toContain('db-init:');
      expect(result).not.toContain('depends_on:');
    });

    it('should use databases from config.requires.databases', async() => {
      const appName = 'test-app';
      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: {
          database: true,
          databases: [
            { name: 'test_db1' },
            { name: 'test_db2' }
          ]
        }
      };
      const options = { port: 3090 };

      const result = await appRun.generateDockerCompose(appName, config, options);

      expect(result).toContain('test_db1');
      expect(result).toContain('test_db2');
    });

    it('should convert Windows paths to forward slashes for volumes', async() => {
      const appName = 'test-app';
      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: {
          storage: true
        }
      };
      const options = { port: 3090 };

      // Mock process.cwd() to return Windows path
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => 'C:\\git\\test-project');

      const result = await appRun.generateDockerCompose(appName, config, options);

      // Should use forward slashes, not backslashes
      expect(result).toContain('C:/git/test-project');
      expect(result).not.toContain('C:\\git\\test-project');

      process.cwd = originalCwd;
    });

    it('should generate valid YAML that can be parsed', async() => {
      const appName = 'test-app';
      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: {
          database: true,
          databases: [{ name: 'test_app' }]
        }
      };
      const options = { port: 3090 };

      const result = await appRun.generateDockerCompose(appName, config, options);

      // Should be valid YAML
      expect(() => yaml.load(result)).not.toThrow();

      const parsed = yaml.load(result);
      expect(parsed).toHaveProperty('services');
      expect(parsed.services).toHaveProperty('test-app');
      expect(parsed.services).toHaveProperty('db-init');
      expect(parsed.services['test-app'].depends_on).toHaveProperty('db-init');
    });
  });
});
