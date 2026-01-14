/**
 * Tests for Docker Compose generation in app-run module
 * @fileoverview Tests for docker-compose.yaml generation
 */

const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('../../../lib/infrastructure');
jest.mock('../../../lib/core/secrets');
jest.mock('../../../lib/validation/validator');
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1),
  setDeveloperId: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': 1 }),
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue()
}));
jest.mock('../../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn((id) => ({
    app: 3000 + (id * 100),
    postgres: 5432 + (id * 100),
    redis: 6379 + (id * 100),
    pgadmin: 5050 + (id * 100),
    redisCommander: 8081 + (id * 100)
  }))
}));
jest.mock('../../../lib/utils/build-copy', () => {
  const os = require('os');
  const path = require('path');
  return {
    getDevDirectory: jest.fn((appName, devId) => {
      const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
      return idNum === 0
        ? path.join(os.homedir(), '.aifabrix', 'applications')
        : path.join(os.homedir(), '.aifabrix', `applications-dev-${devId}`);
    }),
    copyBuilderToDevDirectory: jest.fn().mockResolvedValue(path.join(os.homedir(), '.aifabrix', 'applications-dev-1')),
    devDirectoryExists: jest.fn().mockReturnValue(true)
  };
});

const appRun = require('../../../lib/app/run');

describe('app-run Docker Compose Generation', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-compose-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Mock os.homedir() to return temp directory
    jest.spyOn(os, 'homedir').mockReturnValue(tempDir);

    // Override getDevDirectory mock to use tempDir instead of homedir
    const buildCopy = require('../../../lib/utils/build-copy');
    buildCopy.getDevDirectory.mockImplementation((appName, devId) => {
      const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
      return idNum === 0
        ? path.join(tempDir, '.aifabrix', 'applications')
        : path.join(tempDir, '.aifabrix', `applications-dev-${devId}`);
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore os.homedir mock
    jest.restoreAllMocks();

    // Always restore cwd BEFORE cleanup to avoid uv_cwd errors
    try {
      process.chdir(originalCwd);
    } catch (error) {
      // If chdir fails, try to chdir to a safe location
      try {
        process.chdir(process.env.HOME || process.env.USERPROFILE || '/');
      } catch (e) {
        // Ignore if we can't change directory
      }
    }
    // Cleanup temp directory
    try {
      fsSync.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors (directory might already be deleted or in use)
    }
  });

  describe('generateDockerCompose', () => {
    it('should generate compose file with db-init service when requiresDatabase is true', async() => {
      const appName = 'test-app';
      // Create .env file with DB_PASSWORD in dev directory
      const buildCopy = require('../../../lib/utils/build-copy');
      const devDir = buildCopy.getDevDirectory(appName, 1);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_0_PASSWORD=secret123\n');

      // Also create builder directory for test setup
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });

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
      // Create .env file WITHOUT DB_PASSWORD (should not be required when database is false)
      const buildCopy = require('../../../lib/utils/build-copy');
      const devDir = buildCopy.getDevDirectory(appName, 1);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'PORT=3000\n');

      // Also create builder directory for test setup
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });

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
      // Create .env file with DB_PASSWORD for multiple databases in dev directory
      const buildCopy = require('../../../lib/utils/build-copy');
      const devDir = buildCopy.getDevDirectory(appName, 1);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_0_PASSWORD=pass1\nDB_1_PASSWORD=pass2\n');

      // Also create builder directory for test setup
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });

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
      const appDir = path.join(tempDir, 'builder', appName);
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

      // path.join() will normalize the path, so we need to create the file at the normalized location
      // On Linux, path.join() treats backslashes as regular characters, so we need to create
      // the file using the actual tempDir path (which path.join will resolve to)
      const normalizedPath = path.join(windowsPath, 'builder', appName);
      // Ensure the directory exists at the normalized path
      fsSync.mkdirSync(normalizedPath, { recursive: true });
      // Create .env file in dev directory
      const buildCopy = require('../../../lib/utils/build-copy');
      const devDir = buildCopy.getDevDirectory(appName, 1);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_PASSWORD=secret123\n');

      const result = await appRun.generateDockerCompose(appName, config, options);

      // Should not include Windows-style backslashes anywhere
      expect(result).not.toMatch(/\\/);
      // Should use named volume for storage (no host path bind mount)
      expect(result).toContain('aifabrix_dev1_test-app_data:/mnt/data');
      expect(result).not.toContain(windowsPath);

      process.cwd = originalCwd;
    });

    it('should generate valid YAML that can be parsed', async() => {
      const appName = 'test-app';
      // Create .env file with DB_PASSWORD in dev directory
      const buildCopy = require('../../../lib/utils/build-copy');
      const devDir = buildCopy.getDevDirectory(appName, 1);
      fsSync.mkdirSync(devDir, { recursive: true });
      fsSync.writeFileSync(path.join(devDir, '.env'), 'DB_0_PASSWORD=secret123\n');

      // Also create builder directory for test setup
      const appDir = path.join(process.cwd(), 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });

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
