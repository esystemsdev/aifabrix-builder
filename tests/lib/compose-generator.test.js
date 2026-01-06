/**
 * Tests for Docker Compose Generator Module
 *
 * @fileoverview Unit tests for compose-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Mock config and devConfig
jest.mock('../../lib/config', () => {
  const mockGetDeveloperId = jest.fn().mockResolvedValue(1);
  const mockSetDeveloperId = jest.fn().mockResolvedValue();
  const mockGetConfig = jest.fn().mockResolvedValue({ 'developer-id': 1 });
  const mockSaveConfig = jest.fn().mockResolvedValue();
  const mockClearConfig = jest.fn().mockResolvedValue();

  return {
    getDeveloperId: mockGetDeveloperId,
    setDeveloperId: mockSetDeveloperId,
    getConfig: mockGetConfig,
    saveConfig: mockSaveConfig,
    clearConfig: mockClearConfig
  };
});

// Mock build-copy module
jest.mock('../../lib/utils/build-copy', () => {
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

jest.mock('../../lib/utils/dev-config', () => {
  const mockGetDevPorts = jest.fn((id) => ({
    app: 3000 + (id * 100),
    postgres: 5432 + (id * 100),
    redis: 6379 + (id * 100),
    pgadmin: 5050 + (id * 100),
    redisCommander: 8081 + (id * 100)
  }));

  return {
    getDevPorts: mockGetDevPorts
  };
});

const composeGenerator = require('../../lib/utils/compose-generator');
const buildCopy = require('../../lib/utils/build-copy');

describe('Compose Generator Module', () => {
  let tempDir;
  let originalCwd;
  let devDir;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-compose-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Ensure global.PROJECT_ROOT is set (should be set by tests/setup.js)
    // Use absolute path resolution to ensure it works in CI
    // Don't try to create templates - use the real ones from the repository
    const projectRoot = global.PROJECT_ROOT || path.resolve(__dirname, '..', '..');
    global.PROJECT_ROOT = projectRoot;

    // Verify templates exist (they should be in the repository)
    // If they don't exist, the test will fail with a clear error message
    const typescriptTemplatePath = path.resolve(projectRoot, 'templates', 'typescript', 'docker-compose.hbs');
    const pythonTemplatePath = path.resolve(projectRoot, 'templates', 'python', 'docker-compose.hbs');

    if (!fsSync.existsSync(typescriptTemplatePath)) {
      throw new Error(`TypeScript Docker Compose template not found at ${typescriptTemplatePath}. ` +
        `Project root: ${projectRoot}. Templates should exist in the repository.`);
    }

    if (!fsSync.existsSync(pythonTemplatePath)) {
      throw new Error(`Python Docker Compose template not found at ${pythonTemplatePath}. ` +
        `Project root: ${projectRoot}. Templates should exist in the repository.`);
    }

    // Create builder directory structure
    fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

    // Override getDevDirectory mock to use tempDir instead of homedir
    buildCopy.getDevDirectory.mockImplementation((appName, devId) => {
      const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
      return idNum === 0
        ? path.join(tempDir, '.aifabrix', 'applications')
        : path.join(tempDir, '.aifabrix', `applications-dev-${devId}`);
    });

    // Create dev directory structure (where .env files are now expected)
    devDir = buildCopy.getDevDirectory('test-app', 1);
    fsSync.mkdirSync(devDir, { recursive: true });

    jest.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    jest.restoreAllMocks();
  });

  describe('loadDockerComposeTemplate error handling', () => {
    it('should throw error when template not found', async() => {
      const config = {
        language: 'nonexistent',
        port: 3000
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Docker Compose template not found');
    });
  });

  describe('Handlebars helpers', () => {
    it('should return empty string for pgQuote with null identifier', () => {
      const handlebars = require('handlebars');
      const result = handlebars.helpers.pgQuote(null);
      expect(result).toBe('');
    });

    it('should return empty string for pgUser with null dbName', () => {
      const handlebars = require('handlebars');
      const result = handlebars.helpers.pgUser(null);
      expect(result).toBe('');
    });

    it('should return empty string for pgUser with undefined dbName', () => {
      const handlebars = require('handlebars');
      const result = handlebars.helpers.pgUser(undefined);
      expect(result).toBe('');
    });

    it('should quote identifiers with hyphens', () => {
      const handlebars = require('handlebars');
      const result = handlebars.helpers.pgQuote('miso-logs');
      // SafeString objects have a .string property
      const value = result && typeof result === 'object' && result.string ? result.string : result;
      expect(value).toBe('"miso-logs"');
    });

    it('should escape quotes in identifiers', () => {
      const handlebars = require('handlebars');
      const result = handlebars.helpers.pgQuote('test"db');
      // SafeString objects have a .string property
      const value = result && typeof result === 'object' && result.string ? result.string : result;
      expect(value).toBe('"test""db"');
    });

    it('should generate user name with _user suffix and convert hyphens to underscores', () => {
      const handlebars = require('handlebars');
      const result = handlebars.helpers.pgUser('miso-logs');
      // SafeString objects have a .string property
      const value = result && typeof result === 'object' && result.string ? result.string : result;
      expect(value).toBe('"miso_logs_user"');
    });

    it('should generate old user name format for migration (preserving hyphens)', () => {
      const handlebars = require('handlebars');
      const result = handlebars.helpers.pgUserOld('miso-logs');
      // SafeString objects have a .string property
      const value = result && typeof result === 'object' && result.string ? result.string : result;
      // pgUserOld returns unquoted name - template will add quotes where needed
      expect(value).toBe('miso-logs_user');
    });
  });

  describe('getImageName', () => {
    it('should extract image name from string config.image', () => {
      const config = { image: 'myapp:v1.0.0' };
      const result = composeGenerator.getImageName(config, 'fallback');
      expect(result).toBe('myapp');
    });

    it('should use config.image.name when image is object', () => {
      const config = { image: { name: 'myapp', tag: 'latest' } };
      const result = composeGenerator.getImageName(config, 'fallback');
      expect(result).toBe('myapp');
    });

    it('should use config.app.key when image.name not available', () => {
      const config = { app: { key: 'myapp' } };
      const result = composeGenerator.getImageName(config, 'fallback');
      expect(result).toBe('myapp');
    });

    it('should use appName fallback when no image config', () => {
      const config = {};
      const result = composeGenerator.getImageName(config, 'fallback-app');
      expect(result).toBe('fallback-app');
    });
  });

  describe('readDatabasePasswords error handling', () => {
    it('should throw error when .env file does not exist', async() => {
      // Remove dev directory to simulate missing .env file
      if (fsSync.existsSync(devDir)) {
        fsSync.rmSync(devDir, { recursive: true, force: true });
      }

      const config = {
        port: 3000,
        requires: { database: true }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('.env file not found');
    });

    it('should throw error when DB_PASSWORD is missing', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'OTHER_VAR=value\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Missing required password variable');
    });

    it('should throw error when DB_PASSWORD is empty', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Password variable DB_PASSWORD is empty');
    });

    it('should throw error when DB_0_PASSWORD is missing for multiple databases', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_1_PASSWORD=pass2\n');

      const config = {
        port: 3000,
        requires: {
          databases: [
            { name: 'db1' },
            { name: 'db2' }
          ]
        }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Missing required password variable DB_0_PASSWORD');
    });

    it('should throw error when DB_1_PASSWORD is missing for multiple databases', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=pass1\n');

      const config = {
        port: 3000,
        requires: {
          databases: [
            { name: 'db1' },
            { name: 'db2' }
          ]
        }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Missing required password variable DB_1_PASSWORD');
    });
  });

  describe('readDatabasePasswords (via generateDockerCompose)', () => {
    it('should read DB_PASSWORD from .env file', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('DB_PASSWORD');
      expect(result).toBeDefined();
    });

    it('should read DB_0_PASSWORD from .env file', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('DB_PASSWORD');
      expect(result).toBeDefined();
    });

    it('should handle file read errors', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      // Mock fs.promises.readFile to throw error
      const fsPromises = require('fs').promises;
      const readFileSpy = jest.spyOn(fsPromises, 'readFile').mockRejectedValue(new Error('Read error'));

      const config = {
        port: 3000,
        requires: { database: true }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Failed to read .env file');

      // Restore original
      readFileSpy.mockRestore();
    });

    it('should parse .env file with comments and empty lines', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, '# Comment\n\nDB_PASSWORD=secret123\n\n# Another comment\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should handle .env file with invalid format (no equals sign)', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'INVALID_LINE_WITHOUT_EQUALS\nDB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should handle .env file with equals at start', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, '=value\nDB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should read passwords for multiple databases', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=pass1\nDB_1_PASSWORD=pass2\n');

      const config = {
        port: 3000,
        requires: {
          databases: [
            { name: 'miso-controller' },
            { name: 'miso-logs' }
          ]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('DB_0_PASSWORD');
      expect(result).toContain('DB_1_PASSWORD');
      // Verify user names use underscores (not hyphens) in CREATE USER and GRANT commands
      // Note: DROP USER commands will contain old user names with hyphens (for migration)
      expect(result).toContain('miso_controller_user');
      expect(result).toContain('miso_logs_user');
      // Verify CREATE USER commands use underscores (SafeString prevents HTML escaping, so quotes are correct)
      expect(result).toContain('CREATE USER "miso_controller_user"');
      expect(result).toContain('CREATE USER "miso_logs_user"');
      // Verify old user names are only in DROP USER commands (for migration)
      // Note: Quotes are escaped in YAML output, so check for the pattern without quotes
      expect(result).toContain('DROP USER IF EXISTS');
      expect(result).toContain('miso-controller_user');
      expect(result).toContain('miso-logs_user');
      expect(result).toBeDefined();
    });

    it('should handle multiple databases with all passwords', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=pass1\nDB_1_PASSWORD=pass2\nDB_2_PASSWORD=pass3\n');

      const config = {
        port: 3000,
        requires: {
          databases: [
            { name: 'db1' },
            { name: 'db2' },
            { name: 'db3' }
          ]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('DB_0_PASSWORD');
      expect(result).toContain('DB_1_PASSWORD');
      expect(result).toContain('DB_2_PASSWORD');
      expect(result).toBeDefined();
    });

    it('should use database name from config when provided', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: {
          databases: [{ name: 'mydb' }]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should use appKey fallback when database name not provided', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: {
          databases: [{}]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });
  });

  describe('generateDockerCompose', () => {
    it('should generate compose file with database passwords', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('test-app');
      expect(result).toContain('DB_PASSWORD');
      expect(result).toBeDefined();
    });

    it('should throw error when .env file is missing', async() => {
      // Remove dev directory to simulate missing .env file
      if (fsSync.existsSync(devDir)) {
        fsSync.rmSync(devDir, { recursive: true, force: true });
      }

      const config = {
        port: 3000,
        requires: { database: true }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('.env file not found');
    });

    it('should use options.port when provided', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, { port: 8080 });
      expect(result).toContain('8080');
    });

    it('should use config.port when options.port not provided', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('3000');
    });

    it('should default to port 3000 when no port specified', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('3000');
    });

    it('should use containerPort from build.containerPort and calculate host port with developer offset', async() => {
      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      // Mock developer ID 1
      const configModule = require('../../lib/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      // Config similar to Keycloak: port 8082, containerPort 8080
      const config = {
        port: 8082,
        build: {
          containerPort: 8080,
          language: 'typescript'
        },
        requires: { database: true }
      };

      // For developer ID 1, host port should be 8082 + (1 * 100) = 8182
      // Container port should remain 8080 (unchanged)
      // Pass the developer-specific host port in options
      const result = await composeGenerator.generateDockerCompose('test-app', config, { port: 8182 });

      // Verify host port is 8182 (base port 8082 + developer offset 100)
      expect(result).toContain('8182:8080');
      // Verify container port is 8080 (unchanged)
      expect(result).toContain(':8080');
      // Verify health check uses container port 8080
      expect(result).toContain('http://localhost:8080');
    });

    it('should use containerPort from build.containerPort for developer ID 0 (no offset)', async() => {
      // Create dev directory for dev ID 0
      const devDir0 = buildCopy.getDevDirectory('test-app', 0);
      fsSync.mkdirSync(devDir0, { recursive: true });
      const envPath = path.join(devDir0, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      // Mock developer ID 0
      const configModule = require('../../lib/config');
      configModule.getDeveloperId.mockResolvedValue(0);

      // Config similar to Keycloak: port 8082, containerPort 8080
      const config = {
        port: 8082,
        build: {
          containerPort: 8080,
          language: 'typescript'
        },
        requires: { database: true }
      };

      // For developer ID 0, host port should be 8082 (no offset)
      // Container port should remain 8080 (unchanged)
      // Pass the base host port in options (no offset for dev ID 0)
      const result = await composeGenerator.generateDockerCompose('test-app', config, { port: 8082 });

      // Verify host port is 8082 (no offset for dev ID 0)
      expect(result).toContain('8082:8080');
      // Verify container port is 8080 (unchanged)
      expect(result).toContain(':8080');
      // Verify health check uses container port 8080
      expect(result).toContain('http://localhost:8080');
    });

    it('should handle Python language', async() => {
      // Ensure config.getDeveloperId returns 1 (matching devDir setup)
      const configModule = require('../../lib/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        language: 'python',
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should handle config.build.language', async() => {
      // Ensure config.getDeveloperId returns 1 (matching devDir setup)
      const configModule = require('../../lib/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const envPath = path.join(devDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });
  });
});

