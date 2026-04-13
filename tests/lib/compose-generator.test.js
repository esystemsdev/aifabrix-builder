/**
 * Tests for Docker Compose Generator Module
 *
 * @fileoverview Unit tests for compose-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Use real fs so .env files created in tests are visible to compose-generator when run in full suite
jest.mock('fs', () => jest.requireActual('fs'));

const { execSync } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

function createDirReal(dir) {
  const script = 'require(\'fs\').mkdirSync(process.argv[1], { recursive: true })';
  const nodeExe = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
  const cmd = `${nodeExe} -e ${JSON.stringify(script)} ${JSON.stringify(dir)}`;
  execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
}
function writeFileReal(filePath, content) {
  const nodeExe = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const script = 'const fs=require(\'fs\'); const b=Buffer.from(process.argv[2],\'base64\'); fs.writeFileSync(process.argv[1], b.toString(\'utf8\'));';
  execSync(nodeExe + ' -e ' + JSON.stringify(script) + ' ' + JSON.stringify(filePath) + ' ' + JSON.stringify(b64), {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
}

// Mock config and devConfig
jest.mock('../../lib/core/config', () => {
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
// Note: The mock implementation will be overridden in beforeEach to use tempDir
jest.mock('../../lib/utils/build-copy', () => {
  const os = require('os');
  const path = require('path');

  const mockGetDevDirectory = jest.fn((appName, devId) => {
    const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
    return idNum === 0
      ? path.join(os.homedir(), '.aifabrix', 'applications')
      : path.join(os.homedir(), '.aifabrix', `applications-dev-${devId}`);
  });

  return {
    getDevDirectory: mockGetDevDirectory,
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

// Reload compose-generator so it picks up real fs (when run after tests that mock fs)
delete require.cache[require.resolve('../../lib/utils/compose-generator')];
const composeGenerator = require('../../lib/utils/compose-generator');
const buildCopy = require('../../lib/utils/build-copy');

describe('Compose Generator Module', () => {
  let tempDir;
  let originalCwd;
  let devDir;
  let originalExistsSync;
  let originalReadFileSync;

  describe('isVectorDatabaseName', () => {
    const { isVectorDatabaseName } = composeGenerator;
    it('returns true when name ends with vector', () => {
      expect(isVectorDatabaseName('dataplane-vector')).toBe(true);
      expect(isVectorDatabaseName('myVector')).toBe(true);
      expect(isVectorDatabaseName('VECTOR')).toBe(true);
    });
    it('returns false when name does not end with vector', () => {
      expect(isVectorDatabaseName('mydb')).toBe(false);
      expect(isVectorDatabaseName('vector-store')).toBe(false);
      expect(isVectorDatabaseName('main')).toBe(false);
    });
    it('returns false for null or undefined', () => {
      expect(isVectorDatabaseName(null)).toBe(false);
      expect(isVectorDatabaseName(undefined)).toBe(false);
    });
  });

  describe('expandFrontDoorHostPlaceholders', () => {
    const { expandFrontDoorHostPlaceholders, buildTraefikConfig } = composeGenerator;

    it('inserts dot between adjacent DEV_USERNAME and REMOTE_HOST tokens', () => {
      expect(
        expandFrontDoorHostPlaceholders('${DEV_USERNAME}${REMOTE_HOST}', 1, 'https://builder02.local/path')
      ).toBe('dev01.builder02.local');
    });

    it('expands explicit dotted template from remote-server URL', () => {
      expect(
        expandFrontDoorHostPlaceholders('${DEV_USERNAME}.${REMOTE_HOST}', 2, 'https://x.example.com:8443')
      ).toBe('dev02.x.example.com');
    });

    it('trims trailing dots when remote-server is missing or empty', () => {
      expect(expandFrontDoorHostPlaceholders('${DEV_USERNAME}.${REMOTE_HOST}', 1, null)).toBe('dev01');
      expect(expandFrontDoorHostPlaceholders('${DEV_USERNAME}${REMOTE_HOST}', 1, '')).toBe('dev01');
    });

    it('omits dev label for developer-id 0 or empty so host is bare REMOTE_HOST (no leading dot)', () => {
      expect(
        expandFrontDoorHostPlaceholders('${DEV_USERNAME}.${REMOTE_HOST}', 0, 'https://builder02.local')
      ).toBe('builder02.local');
      expect(
        expandFrontDoorHostPlaceholders('${DEV_USERNAME}.${REMOTE_HOST}', '0', 'https://builder02.local')
      ).toBe('builder02.local');
      expect(
        expandFrontDoorHostPlaceholders('${DEV_USERNAME}${REMOTE_HOST}', 0, 'https://x.example.com')
      ).toBe('x.example.com');
      expect(expandFrontDoorHostPlaceholders('${DEV_USERNAME}.${REMOTE_HOST}', '', null)).toBe('');
    });

    it('uses expanded host in buildTraefikConfig when frontDoor enabled', () => {
      const cfg = {
        frontDoorRouting: {
          enabled: true,
          pattern: '/data/*',
          host: '${DEV_USERNAME}.${REMOTE_HOST}',
          tls: false
        }
      };
      const t = buildTraefikConfig(cfg, 1, null, 'https://builder02.local');
      expect(t.enabled).toBe(true);
      expect(t.host).toBe('dev01.builder02.local');
      expect(t.path).toBe('/data');
    });

    it('buildTraefikConfig uses bare remote hostname when developer-id is 0', () => {
      const cfg = {
        frontDoorRouting: {
          enabled: true,
          pattern: '/data/*',
          host: '${DEV_USERNAME}.${REMOTE_HOST}',
          tls: false
        }
      };
      const t = buildTraefikConfig(cfg, 0, null, 'https://builder02.local');
      expect(t.host).toBe('builder02.local');
    });

    it('buildTraefikConfig treats tls string "false" like boolean false', () => {
      const cfg = {
        frontDoorRouting: {
          enabled: true,
          pattern: '/data/*',
          host: 'dev01.builder02.local',
          tls: 'false'
        }
      };
      const t = buildTraefikConfig(cfg, 1, null, 'https://builder02.local');
      expect(t.tls).toBe(false);
    });

    it('buildTraefikConfig prefixes Traefik path with /dev when env-scoped resources apply (dataplane-style)', () => {
      const cfg = {
        frontDoorRouting: {
          enabled: true,
          pattern: '/data/*',
          host: '${DEV_USERNAME}.${REMOTE_HOST}',
          tls: false
        }
      };
      const scope = {
        effectiveEnvironmentScopedResources: true,
        runEnvKey: 'dev'
      };
      const t = buildTraefikConfig(cfg, 1, scope, 'https://builder02.local');
      expect(t.path).toBe('/dev/data');
    });

    it('buildTraefikConfig uses /tst/data when run env is tst', () => {
      const cfg = {
        frontDoorRouting: {
          enabled: true,
          pattern: '/data/*',
          host: '${DEV_USERNAME}.${REMOTE_HOST}',
          tls: false
        }
      };
      const scope = {
        effectiveEnvironmentScopedResources: true,
        runEnvKey: 'tst'
      };
      const t = buildTraefikConfig(cfg, 2, scope, 'https://builder02.local');
      expect(t.path).toBe('/tst/data');
    });

    it('buildTraefikConfig leaves /miso base path when env-scoped (same generator; miso template omits app flag)', () => {
      const cfg = {
        frontDoorRouting: {
          enabled: true,
          pattern: '/miso/*',
          host: '${DEV_USERNAME}.${REMOTE_HOST}',
          tls: false
        }
      };
      const scope = {
        effectiveEnvironmentScopedResources: true,
        runEnvKey: 'dev'
      };
      const t = buildTraefikConfig(cfg, 1, scope, 'https://builder02.local');
      expect(t.path).toBe('/dev/miso');
    });
  });

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-compose-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Ensure global.PROJECT_ROOT is set (should be set by tests/setup.js)
    // Use absolute path resolution to ensure it works in CI
    const projectRoot = global.PROJECT_ROOT || path.resolve(__dirname, '..', '..');
    global.PROJECT_ROOT = projectRoot;

    // Mock file system to make template loading succeed without actual template files
    // This allows tests to run in CI where templates might not be immediately available
    const typescriptTemplatePath = path.resolve(projectRoot, 'templates', 'typescript', 'docker-compose.hbs');
    const pythonTemplatePath = path.resolve(projectRoot, 'templates', 'python', 'docker-compose.hbs');

    // Save original functions
    originalExistsSync = fsSync.existsSync;
    originalReadFileSync = fsSync.readFileSync;

    // Ensure fs.promises.readFile uses real implementation for .env files
    // This is needed because compose-generator uses fs.promises.readFile
    // We need to ensure the fs module that compose-generator uses has the real promises
    const realFsPromises = jest.requireActual('fs').promises;
    const fsModule = require('fs');
    if (!fsModule.promises) {
      fsModule.promises = realFsPromises;
    } else {
      // Ensure readFile uses real implementation
      fsModule.promises.readFile = realFsPromises.readFile;
    }

    // Mock existsSync to return true for template paths
    fsSync.existsSync = jest.fn((filePath) => {
      if (filePath === typescriptTemplatePath || filePath === pythonTemplatePath) {
        return true;
      }
      return originalExistsSync.call(fsSync, filePath);
    });

    // Mock readFileSync to return a template that matches the actual structure
    // Use the actual template if it exists, otherwise use a mock that matches the structure
    fsSync.readFileSync = jest.fn((filePath, encoding) => {
      if (filePath === typescriptTemplatePath || filePath === pythonTemplatePath) {
        // Try to use the actual template if it exists
        try {
          return originalReadFileSync.call(fsSync, filePath, encoding);
        } catch (error) {
          // If actual template doesn't exist, use a mock that matches the structure
          return 'services:\n  {{app.key}}:\n    image: {{image.name}}:{{image.tag}}\n    ports:\n      - "{{hostPort}}:{{containerPort}}"';
        }
      }
      return originalReadFileSync.call(fsSync, filePath, encoding);
    });

    // Create builder directory structure
    fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

    // Override getDevDirectory mock to use tempDir instead of homedir
    // IMPORTANT: Always set this in beforeEach to ensure it uses the current tempDir
    // Don't use mockReset() or clearAllMocks() as they can interfere with the implementation
    buildCopy.getDevDirectory.mockImplementation((appName, devId) => {
      const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
      const result = idNum === 0
        ? path.join(tempDir, '.aifabrix', 'applications')
        : path.join(tempDir, '.aifabrix', `applications-dev-${devId}`);
      return result;
    });

    // Create dev directory structure (where .env files are now expected)
    // This ensures the directory exists for all tests
    devDir = buildCopy.getDevDirectory('test-app', 1);
    // Use realFs to ensure directory is actually created (bypasses any mocks)
    const realFs = jest.requireActual('fs');
    try {
      realFs.mkdirSync(devDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw new Error(`Failed to create dev directory in beforeEach: ${devDir} - ${error.message}`);
      }
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);
    jest.restoreAllMocks();

    // Restore original file system functions
    if (originalExistsSync) {
      fsSync.existsSync = originalExistsSync;
    }
    if (originalReadFileSync) {
      fsSync.readFileSync = originalReadFileSync;
    }
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

  describe('Traefik configuration helpers', () => {
    it('buildDevUsernameForFrontDoorHost is empty for id 0 and non-zero padded otherwise', () => {
      expect(composeGenerator.buildDevUsernameForFrontDoorHost(0)).toBe('');
      expect(composeGenerator.buildDevUsernameForFrontDoorHost('0')).toBe('');
      expect(composeGenerator.buildDevUsernameForFrontDoorHost(null)).toBe('');
      expect(composeGenerator.buildDevUsernameForFrontDoorHost('')).toBe('');
      expect(composeGenerator.buildDevUsernameForFrontDoorHost(1)).toBe('dev01');
      expect(composeGenerator.buildDevUsernameForFrontDoorHost(12)).toBe('dev12');
    });

    it('should derive base path from pattern', () => {
      expect(composeGenerator.derivePathFromPattern('/api/*')).toBe('/api');
      expect(composeGenerator.derivePathFromPattern('/api/v1/*')).toBe('/api/v1');
      expect(composeGenerator.derivePathFromPattern('/api')).toBe('/api');
      expect(composeGenerator.derivePathFromPattern('/')).toBe('/');
      expect(composeGenerator.derivePathFromPattern(null)).toBe('/');
    });

    it('should build developer username with padding', () => {
      expect(composeGenerator.buildDevUsername(0)).toBe('dev');
      expect(composeGenerator.buildDevUsername(1)).toBe('dev01');
      expect(composeGenerator.buildDevUsername('2')).toBe('dev02');
      expect(composeGenerator.buildDevUsername('12')).toBe('dev12');
    });

    it('should build Traefik config with host interpolation', () => {
      const config = {
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/api/*',
          tls: false
        }
      };

      const result = composeGenerator.buildTraefikConfig(config, '1');
      expect(result).toEqual({
        enabled: true,
        host: 'dev01.aifabrix.dev',
        path: '/api',
        tls: false,
        certStore: null,
        stripPathPrefix: true
      });
    });

    it('should build Traefik config with certStore for wildcard certificates', () => {
      const config = {
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/api/*',
          tls: true,
          certStore: 'wildcard'
        }
      };

      const result = composeGenerator.buildTraefikConfig(config, '1');
      expect(result).toEqual({
        enabled: true,
        host: 'dev01.aifabrix.dev',
        path: '/api',
        tls: true,
        certStore: 'wildcard',
        stripPathPrefix: true
      });
    });

    it('should build Traefik config without certStore when not provided', () => {
      const config = {
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/api/*',
          tls: true
        }
      };

      const result = composeGenerator.buildTraefikConfig(config, '1');
      expect(result).toEqual({
        enabled: true,
        host: 'dev01.aifabrix.dev',
        path: '/api',
        tls: true,
        certStore: null,
        stripPathPrefix: true
      });
    });

    it('should return disabled Traefik config when not enabled', () => {
      const result = composeGenerator.buildTraefikConfig({}, '1');
      expect(result).toEqual({ enabled: false });
    });

    it('should throw when enabled without host', () => {
      const config = {
        frontDoorRouting: {
          enabled: true,
          pattern: '/api/*'
        }
      };

      expect(() => composeGenerator.buildTraefikConfig(config, '1'))
        .toThrow('frontDoorRouting.host is required when frontDoorRouting.enabled is true');
    });

    it('computeAlignedHealthCheckPath uses Traefik path + explicit suffix', () => {
      const config = {
        healthCheck: { interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/auth/*'
        }
      };
      expect(composeGenerator.computeAlignedHealthCheckPath(config, 1, null, null, '/health/ready')).toBe(
        '/auth/health/ready'
      );
    });

    it('computeAlignedHealthCheckPath prefixes /dev when env-scoped opts apply', () => {
      const config = {
        healthCheck: { interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/auth/*'
        }
      };
      const scopeOpts = { effectiveEnvironmentScopedResources: true, runEnvKey: 'dev' };
      expect(
        composeGenerator.computeAlignedHealthCheckPath(config, 1, scopeOpts, null, '/health/ready')
      ).toBe('/dev/auth/health/ready');
    });

    it('computeAlignedHealthCheckPath returns suffix only when front door inactive', () => {
      const config = {
        healthCheck: { interval: 30 }
      };
      expect(composeGenerator.computeAlignedHealthCheckPath(config, 1, null, null)).toBe('/health/ready');
    });

    it('resolveHealthCheckPathWithFrontDoorVdir prepends vdir to healthCheck.path', () => {
      const config = {
        healthCheck: { path: '/health/ready', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/auth/*'
        }
      };
      expect(composeGenerator.resolveHealthCheckPathWithFrontDoorVdir(config, 1, null, null)).toBe(
        '/auth/health/ready'
      );
    });

    it('resolveHealthCheckPathWithFrontDoorVdir leaves path unchanged when it already starts with vdir', () => {
      const config = {
        healthCheck: { path: '/auth/health/ready', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/auth/*'
        }
      };
      expect(composeGenerator.resolveHealthCheckPathWithFrontDoorVdir(config, 1, null, null)).toBe(
        '/auth/health/ready'
      );
    });

    it('resolveHealthCheckPathWithFrontDoorVdir leaves bare /health when skipVdirMergeWhenPathIsBareHealth (compose)', () => {
      const config = {
        healthCheck: { path: '/health', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/miso/*'
        }
      };
      expect(
        composeGenerator.resolveHealthCheckPathWithFrontDoorVdir(config, 1, null, null, {
          skipVdirMergeWhenPathIsBareHealth: true
        })
      ).toBe('/health');
    });

    it('resolveHealthCheckPathWithFrontDoorVdir prepends vdir to bare /health when caller omits skip (legacy / explicit public path)', () => {
      const config = {
        healthCheck: { path: '/health', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/miso/*'
        }
      };
      expect(composeGenerator.resolveHealthCheckPathWithFrontDoorVdir(config, 0, null, null)).toBe('/miso/health');
    });

    it('buildTraefikConfig sets stripPathPrefix false when compose health is under /auth (no frontDoor.stripPathPrefix)', () => {
      const config = {
        healthCheck: { path: '/health/ready', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'dev01.aifabrix.dev',
          pattern: '/auth/*',
          tls: false
        }
      };
      const t = composeGenerator.buildTraefikConfig(config, '1');
      expect(t.stripPathPrefix).toBe(false);
    });

    it('buildTraefikConfig sets stripPathPrefix true for miso-style bare /health', () => {
      const config = {
        healthCheck: { path: '/health', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/miso/*',
          tls: false
        }
      };
      const t = composeGenerator.buildTraefikConfig(config, '1');
      expect(t.stripPathPrefix).toBe(true);
    });

    it('buildTraefikConfig sets stripPathPrefix false for scoped /dev/auth and /health/ready', () => {
      const config = {
        healthCheck: { path: '/health/ready', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: 'h.test',
          pattern: '/auth/*',
          tls: false
        }
      };
      const scope = { effectiveEnvironmentScopedResources: true, runEnvKey: 'dev' };
      const t = composeGenerator.buildTraefikConfig(config, '1', scope, null);
      expect(t.path).toBe('/dev/auth');
      expect(t.stripPathPrefix).toBe(false);
    });
  });

  describe('readDatabasePasswords error handling', () => {
    // Helper to ensure .env file is created correctly
    // Uses realFs (via jest.requireActual) to bypass any mocks
    const ensureEnvFile = async(appName, content) => {
      const configModule = require('../../lib/core/config');
      const devId = await configModule.getDeveloperId();
      const actualDevDir = buildCopy.getDevDirectory(appName, devId);

      // The path from getDevDirectory should already be absolute (uses tempDir from beforeEach)
      const absoluteDir = actualDevDir;

      // Create directory and file on real filesystem (subprocess) so they exist when fs is mocked
      createDirReal(absoluteDir);
      const envPath = path.join(absoluteDir, '.env');
      writeFileReal(envPath, content);
      return envPath;
    };

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
      // Ensure .env file exists with content that doesn't have DB_PASSWORD
      await ensureEnvFile('test-app', 'OTHER_VAR=value\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Missing required password variable');
    });

    it('should throw error when DB_PASSWORD is empty', async() => {
      // Ensure .env file exists with empty DB_PASSWORD
      await ensureEnvFile('test-app', 'DB_PASSWORD=\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      await expect(composeGenerator.generateDockerCompose('test-app', config, {}))
        .rejects.toThrow('Password variable DB_PASSWORD is empty');
    });

    it('should throw error when DB_0_PASSWORD is missing for multiple databases', async() => {
      // Ensure .env file exists with only DB_1_PASSWORD
      await ensureEnvFile('test-app', 'DB_1_PASSWORD=pass2\n');

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
      // Ensure .env file exists with only DB_0_PASSWORD
      await ensureEnvFile('test-app', 'DB_0_PASSWORD=pass1\n');

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
    // Helper to get and ensure dev directory exists using the same devId as generateDockerCompose
    const getAndEnsureDevDir = async(appName = 'test-app') => {
      const configModule = require('../../lib/core/config');
      const devId = await configModule.getDeveloperId();
      const dir = buildCopy.getDevDirectory(appName, devId);
      fsSync.mkdirSync(dir, { recursive: true });
      return dir;
    };

    it('should read DB_PASSWORD from .env file', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, '# Comment\n\nDB_PASSWORD=secret123\n\n# Another comment\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should handle .env file with invalid format (no equals sign)', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'INVALID_LINE_WITHOUT_EQUALS\nDB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should handle .env file with equals at start', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, '=value\nDB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should read passwords for multiple databases', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      // Verify CREATE USER commands use underscores; template emits \" for shell escaping in -c
      expect(result).toContain('CREATE USER \\"miso_controller_user\\"');
      expect(result).toContain('CREATE USER \\"miso_logs_user\\"');
      // Verify old user names are only in DROP USER commands (for migration)
      // Note: Quotes are escaped in YAML output, so check for the pattern without quotes
      expect(result).toContain('DROP USER IF EXISTS');
      expect(result).toContain('miso-controller_user');
      expect(result).toContain('miso-logs_user');
      expect(result).toBeDefined();
    });

    it('should handle multiple databases with all passwords', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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

    it('should include CREATE EXTENSION vector for databases whose name ends with vector', async() => {
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=pass1\nDB_1_PASSWORD=pass2\n');

      const config = {
        port: 3000,
        requires: {
          database: true,
          databases: [
            { name: 'main' },
            { name: 'dataplane-vector' }
          ]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('CREATE EXTENSION IF NOT EXISTS "vector";');
      expect(result).toContain('dataplane-vector');
      expect(result).toContain('Extension "vector" enabled on "dataplane-vector"');
    });

    it('should not include CREATE EXTENSION when no database name ends with vector and no extensions', async() => {
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=pass1\nDB_1_PASSWORD=pass2\n');

      const config = {
        port: 3000,
        requires: {
          database: true,
          databases: [
            { name: 'db1' },
            { name: 'db2' }
          ]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).not.toContain('CREATE EXTENSION');
    });

    it('should include CREATE EXTENSION for each database extension (e.g. Flowise)', async() => {
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=pass0\n');

      const config = {
        port: 3000,
        requires: {
          database: true,
          databases: [
            {
              name: 'flowise',
              extensions: ['pgcrypto', 'uuid-ossp', 'vector', 'btree_gin', 'btree_gist']
            }
          ]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('flowise');
      expect(result).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
      expect(result).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      expect(result).toContain('CREATE EXTENSION IF NOT EXISTS "vector";');
      expect(result).toContain('CREATE EXTENSION IF NOT EXISTS "btree_gin";');
      expect(result).toContain('CREATE EXTENSION IF NOT EXISTS "btree_gist";');
    });

    it('should add vector extension when database name ends with vector and extensions not listed', async() => {
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_0_PASSWORD=pass0\n');

      const config = {
        port: 3000,
        requires: {
          database: true,
          databases: [{ name: 'dataplane-vector' }]
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('CREATE EXTENSION IF NOT EXISTS "vector";');
      expect(result).toContain('dataplane-vector');
    });

  });

  describe('generateDockerCompose', () => {
    // Helper to get and ensure dev directory exists using the same devId as generateDockerCompose
    const getAndEnsureDevDir = async(appName = 'test-app') => {
      const configModule = require('../../lib/core/config');
      const devId = await configModule.getDeveloperId();
      const dir = buildCopy.getDevDirectory(appName, devId);
      fsSync.mkdirSync(dir, { recursive: true });
      return dir;
    };

    it('should generate compose file with database passwords', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, { port: 8080 });
      expect(result).toContain('8080');
    });

    it('should use config.port when options.port not provided', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('3000');
    });

    it('should default to port 3000 when no port specified', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('3000');
    });

    it('should use containerPort from build.containerPort and calculate host port with developer offset', async() => {
      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      // Mock developer ID 1
      const configModule = require('../../lib/core/config');
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
      const configModule = require('../../lib/core/config');
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
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
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
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      // Get the actual dev directory path that generateDockerCompose will use
      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        build: { language: 'python' },
        port: 3000,
        requires: { database: true }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toBeDefined();
    });

    it('should include Traefik labels when frontDoorRouting enabled', async() => {
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true },
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/api/*',
          tls: true
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('traefik.enable=true');
      expect(result).toContain('Host(`dev01.aifabrix.dev`)');
      expect(result).toContain('PathPrefix(`/api`)');
      expect(result).toContain('traefik.http.routers.test-app.entrypoints=websecure');
      expect(result).toContain('traefik.http.routers.test-app-http.entrypoints=web');
      expect(result).toContain('traefik.http.routers.test-app-http.service=test-app');
      expect(result).toContain('BASE_PATH=/api');
      expect(result).toContain('X_FORWARDED_PREFIX=/api');
      expect(result).toContain('stripprefix');
    });

    it('should omit Traefik StripPrefix for /auth when healthCheck.path is under vdir (derived, no YAML flag)', async() => {
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const actualDevDir = await getAndEnsureDevDir('test-app-strip');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true },
        healthCheck: { path: '/health/ready', interval: 30 },
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/auth/*',
          tls: true
        }
      };

      const result = await composeGenerator.generateDockerCompose('kc-style', config, {});
      expect(result).toContain('PathPrefix(`/auth`)');
      expect(result).not.toContain('stripprefix');
    });

    it('should healthcheck use vdir + healthCheck.path when frontDoorRouting.enabled', async() => {
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const actualDevDir = await getAndEnsureDevDir('vdir-compose-health');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 8082,
        build: { language: 'typescript', containerPort: 8080 },
        requires: { database: true },
        healthCheck: {
          path: '/health/ready',
          bashProbe: true,
          interval: 30
        },
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/auth/*',
          tls: false
        }
      };

      const result = await composeGenerator.generateDockerCompose('idp-svc', config, {});
      expect(result).toContain('GET /auth/health/ready');
      expect(result).toContain('CMD-SHELL');
      expect(result).not.toContain('stripprefix');
    });

    it('should healthcheck keep bare /health for compose when frontDoorRouting.enabled (internal listener)', async() => {
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const actualDevDir = await getAndEnsureDevDir('vdir-compose-bare-health');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        build: { language: 'typescript', containerPort: 3000 },
        requires: { database: true },
        healthCheck: {
          path: '/health',
          bashProbe: true,
          interval: 30
        },
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/miso/*',
          tls: false
        }
      };

      const result = await composeGenerator.generateDockerCompose('miso-style-app', config, {});
      expect(result).toContain('GET /health');
      expect(result).not.toContain('GET /miso/health');
      expect(result).toContain('stripprefix');
    });

    it('should include certStore label when certStore is provided', async() => {
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true },
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/api/*',
          tls: true,
          certStore: 'wildcard'
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('traefik.enable=true');
      expect(result).toContain('traefik.http.routers.test-app.entrypoints=websecure');
      expect(result).toContain('traefik.http.routers.test-app-http.entrypoints=web');
      expect(result).toContain('traefik.http.routers.test-app.tls.certstore=wildcard');
      expect(result).not.toContain('traefik.http.routers.test-app.tls.certstore=null');
    });

    it('should not include certStore label when certStore is not provided', async() => {
      const configModule = require('../../lib/core/config');
      configModule.getDeveloperId.mockResolvedValue(1);

      const actualDevDir = await getAndEnsureDevDir('test-app');
      const envPath = path.join(actualDevDir, '.env');
      fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

      const config = {
        port: 3000,
        requires: { database: true },
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.aifabrix.dev',
          pattern: '/api/*',
          tls: true
        }
      };

      const result = await composeGenerator.generateDockerCompose('test-app', config, {});
      expect(result).toContain('traefik.http.routers.test-app.entrypoints=websecure');
      expect(result).toContain('traefik.http.routers.test-app-http.entrypoints=web');
      expect(result).not.toContain('traefik.http.routers.test-app.tls.certstore');
    });

    describe('reloadStart (run --reload command override)', () => {
      it('should add command override when devMountPath and build.reloadStart are set', async() => {
        const actualDevDir = await getAndEnsureDevDir('test-app');
        const envPath = path.join(actualDevDir, '.env');
        fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

        const config = {
          port: 3000,
          requires: { database: true },
          build: { language: 'typescript', reloadStart: 'pnpm run reloadStart' }
        };
        const options = { devMountPath: '/workspace/myapp' };

        const result = await composeGenerator.generateDockerCompose('test-app', config, options);
        expect(result).toContain('cd /app && pnpm run reloadStart');
        expect(result).toContain('command:');
        expect(result).toContain('user: "${AIFABRIX_UID:-1000}:${AIFABRIX_GID:-1000}"');
      });

      it('should not add command override when devMountPath is set but build.reloadStart is not', async() => {
        const actualDevDir = await getAndEnsureDevDir('test-app');
        const envPath = path.join(actualDevDir, '.env');
        fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

        const config = {
          port: 3000,
          requires: { database: true },
          build: { language: 'typescript' }
        };
        const options = { devMountPath: '/workspace/myapp' };

        const result = await composeGenerator.generateDockerCompose('test-app', config, options);
        expect(result).not.toContain('cd /app && pnpm run reloadStart');
      });

      it('should not add command override when build.reloadStart is set but devMountPath is not', async() => {
        const actualDevDir = await getAndEnsureDevDir('test-app');
        const envPath = path.join(actualDevDir, '.env');
        fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

        const config = {
          port: 3000,
          requires: { database: true },
          build: { language: 'typescript', reloadStart: 'pnpm run reloadStart' }
        };
        const options = {};

        const result = await composeGenerator.generateDockerCompose('test-app', config, options);
        expect(result).not.toContain('cd /app && pnpm run reloadStart');
      });

      it('should set PORT to containerPort in environment when reloadStart is set so reload command uses container port', async() => {
        const actualDevDir = await getAndEnsureDevDir('dataplane');
        const envPath = path.join(actualDevDir, '.env');
        fsSync.writeFileSync(envPath, 'DB_PASSWORD=secret123\n');

        const config = {
          app: { key: 'dataplane' },
          port: 3001,
          requires: { database: true },
          build: { language: 'python', reloadStart: 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload' }
        };
        const options = { devMountPath: '/workspace/dataplane' };

        const result = await composeGenerator.generateDockerCompose('dataplane', config, options);
        expect(result).toContain('cd /app && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload');
        expect(result).toMatch(/PORT=3001/);
      });
    });
  });

  describe('resolveMisoEnvironment', () => {
    const { resolveMisoEnvironment } = composeGenerator;

    it('defaults to dev', () => {
      expect(resolveMisoEnvironment({})).toBe('dev');
    });

    it('returns tst or pro when env matches (case-insensitive)', () => {
      expect(resolveMisoEnvironment({ env: 'TST' })).toBe('tst');
      expect(resolveMisoEnvironment({ env: 'pro' })).toBe('pro');
    });

    it('maps unknown env to dev', () => {
      expect(resolveMisoEnvironment({ env: 'staging' })).toBe('dev');
    });
  });
});
