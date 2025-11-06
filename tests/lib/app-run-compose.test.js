/**
 * Tests for Docker Compose generation in app-run module
 * @fileoverview Tests for docker-compose.yaml generation
 */

const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('../../lib/infra');
jest.mock('../../lib/secrets');
jest.mock('../../lib/validator');

const appRun = require('../../lib/app-run');

describe('app-run Docker Compose Generation', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-compose-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Cleanup temp directory
    try {
      fsSync.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateDockerCompose', () => {
    it('should generate compose file with db-init service when requiresDatabase is true', async() => {
      const appName = 'test-app';
      // Create .env file with DB_PASSWORD
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      fsSync.writeFileSync(path.join(appDir, '.env'), 'DB_0_PASSWORD=secret123\n');

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
      // Create .env file with DB_PASSWORD
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      fsSync.writeFileSync(path.join(appDir, '.env'), 'DB_PASSWORD=secret123\n');

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
      // Create .env file with DB_PASSWORD for multiple databases
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      fsSync.writeFileSync(path.join(appDir, '.env'), 'DB_0_PASSWORD=pass1\nDB_1_PASSWORD=pass2\n');

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
      // Create .env file with DB_PASSWORD
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      fsSync.writeFileSync(path.join(appDir, '.env'), 'DB_PASSWORD=secret123\n');

      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: {
          storage: true
        }
      };
      const options = { port: 3090 };

      // Mock process.cwd() to return a Windows-style path (using tempDir with backslashes)
      // This simulates Windows path behavior without hardcoding a specific path
      const originalCwd = process.cwd;
      const windowsPath = tempDir.replace(/\//g, '\\'); // Convert forward slashes to backslashes
      process.cwd = jest.fn(() => windowsPath);

      const result = await appRun.generateDockerCompose(appName, config, options);

      // Should use forward slashes, not backslashes (even if cwd returns backslashes)
      // The result should contain the path with forward slashes
      const forwardSlashPath = tempDir.replace(/\\/g, '/');
      expect(result).toContain(forwardSlashPath);
      expect(result).not.toContain(windowsPath);

      process.cwd = originalCwd;
    });

    it('should generate valid YAML that can be parsed', async() => {
      const appName = 'test-app';
      // Create .env file with DB_PASSWORD
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });
      fsSync.writeFileSync(path.join(appDir, '.env'), 'DB_0_PASSWORD=secret123\n');

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
