/**
 * Tests for Image Version Resolution Module
 *
 * @fileoverview Unit tests for image-version.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const os = require('os');
const path = require('path');

// Store for mock file content - keyed by resolved path (mock prefix allows Jest hoisting)
const mockFileStore = new Map();

function makeTempDir() {
  return path.join(os.tmpdir(), 'imgver-' + Math.random().toString(36).slice(2));
}

jest.mock('fs', () => {
  const pathMod = require('path');
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn((p) => mockFileStore.has(pathMod.resolve(p)) || actual.existsSync(p)),
    mkdtempSync: jest.fn(() => pathMod.join(require('os').tmpdir(), 'imgver-' + Math.random().toString(36).slice(2))),
    promises: {
      ...actual.promises,
      readFile: jest.fn(async(p) => {
        const norm = pathMod.resolve(p);
        if (mockFileStore.has(norm)) return mockFileStore.get(norm);
        return actual.promises.readFile(p, 'utf8');
      }),
      writeFile: jest.fn(async(p, content) => {
        mockFileStore.set(pathMod.resolve(p), typeof content === 'string' ? content : String(content));
      }),
      unlink: jest.fn(async(p) => {
        mockFileStore.delete(pathMod.resolve(p));
      }),
      rmdir: jest.fn(async() => {})
    }
  };
});
jest.mock('child_process', () => ({
  exec: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => {
  const pathMod = require('path');
  return {
    getBuilderPath: jest.fn((appName) => pathMod.join(process.cwd(), 'builder', appName))
  };
});
jest.mock('../../../lib/utils/compose-generator', () => ({
  getImageName: jest.fn((config, appName) => config?.image?.name || config?.app?.key || appName)
}));
jest.mock('../../../lib/utils/app-run-containers', () => ({
  checkImageExists: jest.fn()
}));

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const {
  getVersionFromImage,
  compareSemver,
  resolveVersionForApp,
  updateAppVersionInVariablesYaml
} = require('../../../lib/utils/image-version');
const { checkImageExists } = require('../../../lib/utils/app-run-containers');

describe('image-version', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileStore.clear();
  });

  describe('getVersionFromImage', () => {
    it('should return OCI label when present', async() => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '1.2.3', stderr: '' });
      });
      const result = await getVersionFromImage('myapp', 'latest');
      expect(result).toBe('1.2.3');
    });

    it('should return null when OCI label empty and tag not semver', async() => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '', stderr: '' });
      });
      const result = await getVersionFromImage('myapp', 'latest');
      expect(result).toBeNull();
    });

    it('should parse semver from tag when OCI label empty', async() => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '', stderr: '' });
      });
      const result = await getVersionFromImage('myapp', 'v1.0.0');
      expect(result).toBe('1.0.0');
    });

    it('should parse semver from tag without v prefix', async() => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '', stderr: '' });
      });
      const result = await getVersionFromImage('myapp', '2.3.4');
      expect(result).toBe('2.3.4');
    });

    it('should return null for invalid appName', async() => {
      const result = await getVersionFromImage('', 'latest');
      expect(result).toBeNull();
    });

    it('should return null when docker inspect fails', async() => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(new Error('docker failed'), { stdout: '', stderr: '' });
      });
      const result = await getVersionFromImage('myapp', 'latest');
      expect(result).toBeNull();
    });
  });

  describe('compareSemver', () => {
    it('should return -1 when a < b', () => {
      expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
      expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
      expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
    });

    it('should return 1 when a > b', () => {
      expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
      expect(compareSemver('1.1.0', '1.0.0')).toBe(1);
      expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
    });

    it('should return 0 when a === b', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    });

    it('should return 0 for invalid semver', () => {
      expect(compareSemver('latest', '1.0.0')).toBe(0);
      expect(compareSemver('1.0.0', '')).toBe(0);
    });
  });

  describe('resolveVersionForApp', () => {
    it('should use app.version for external app', async() => {
      const variables = {
        app: { version: '3.0.0' },
        externalIntegration: { version: '1.0.0' }
      };
      const result = await resolveVersionForApp('hubspot', variables);
      expect(result).toEqual({ version: '3.0.0', fromImage: false, updated: false });
      expect(checkImageExists).not.toHaveBeenCalled();
    });

    it('should use externalIntegration.version when app.version missing for external app', async() => {
      const variables = {
        app: {},
        externalIntegration: { version: '1.5.0' }
      };
      const result = await resolveVersionForApp('hubspot', variables);
      expect(result).toEqual({ version: '1.5.0', fromImage: false, updated: false });
    });

    it('should use 1.0.0 when image not found for regular app', async() => {
      checkImageExists.mockResolvedValue(false);
      const variables = {
        app: {},
        image: { name: 'myapp', tag: 'latest' }
      };
      const result = await resolveVersionForApp('myapp', variables);
      expect(result).toEqual({ version: '1.0.0', fromImage: false, updated: false });
    });

    it('should use template version when image not found and template has version', async() => {
      checkImageExists.mockResolvedValue(false);
      const variables = {
        app: { version: '2.0.0' },
        image: { name: 'myapp', tag: 'latest' }
      };
      const result = await resolveVersionForApp('myapp', variables);
      expect(result).toEqual({ version: '2.0.0', fromImage: false, updated: false });
    });

    it('should use image version when image exists and template empty', async() => {
      checkImageExists.mockResolvedValue(true);
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '2.1.0', stderr: '' });
      });
      const variables = {
        app: {},
        image: { name: 'myapp', tag: 'latest' }
      };
      const result = await resolveVersionForApp('myapp', variables);
      expect(result.version).toBe('2.1.0');
      expect(result.fromImage).toBe(true);
    });

    it('should use template when template version greater than image', async() => {
      checkImageExists.mockResolvedValue(true);
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '1.0.0', stderr: '' });
      });
      const variables = {
        app: { version: '2.0.0' },
        image: { name: 'myapp', tag: 'latest' }
      };
      const result = await resolveVersionForApp('myapp', variables);
      expect(result).toEqual({ version: '2.0.0', fromImage: false, updated: false });
    });

    it('should use image version when image version greater than template', async() => {
      checkImageExists.mockResolvedValue(true);
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '2.1.0', stderr: '' });
      });
      const variables = {
        app: { version: '1.0.0' },
        image: { name: 'myapp', tag: 'latest' }
      };
      const result = await resolveVersionForApp('myapp', variables);
      expect(result.version).toBe('2.1.0');
      expect(result.fromImage).toBe(true);
    });

    it('should update builder variables.yaml when fromImage and updateBuilder true', async() => {
      const tmpDir = makeTempDir();
      const yamlPath = path.join(tmpDir, 'variables.yaml');
      const yaml = require('js-yaml');
      const initial = { app: { key: 'myapp' }, port: 3000, image: { name: 'myapp', tag: 'latest' } };
      mockFileStore.set(path.resolve(yamlPath), yaml.dump(initial));

      checkImageExists.mockResolvedValue(true);
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, { stdout: '3.0.0', stderr: '' });
      });
      const variables = {
        app: { key: 'myapp' },
        image: { name: 'myapp', tag: 'latest' }
      };
      const result = await resolveVersionForApp('myapp', variables, {
        updateBuilder: true,
        builderPath: tmpDir
      });

      expect(result.version).toBe('3.0.0');
      expect(result.fromImage).toBe(true);
      expect(result.updated).toBe(true);

      const content = mockFileStore.get(path.resolve(yamlPath));
      const parsed = yaml.load(content);
      expect(parsed.app.version).toBe('3.0.0');
    });
  });

  describe('updateAppVersionInVariablesYaml', () => {
    it('should return false when builderPath missing', async() => {
      const result = await updateAppVersionInVariablesYaml('', '1.0.0');
      expect(result).toBe(false);
    });

    it('should return false when variables.yaml does not exist', async() => {
      const nonexistentDir = path.join(__dirname, '..', '..', '..', 'nonexistent-dir-xyz-123');
      const result = await updateAppVersionInVariablesYaml(nonexistentDir, '1.0.0');
      expect(result).toBe(false);
    });

    it('should update app.version when app exists', async() => {
      const tmpDir = makeTempDir();
      const yamlPath = path.join(tmpDir, 'variables.yaml');
      const yaml = require('js-yaml');
      const initial = { app: { key: 'test', version: '1.0.0' }, port: 3000 };
      mockFileStore.set(path.resolve(yamlPath), yaml.dump(initial));

      const result = await updateAppVersionInVariablesYaml(tmpDir, '2.0.0');
      expect(result).toBe(true);

      const content = mockFileStore.get(path.resolve(yamlPath));
      const parsed = yaml.load(content);
      expect(parsed.app.version).toBe('2.0.0');
    });

    it('should preserve other YAML keys when updating app.version', async() => {
      const tmpDir = makeTempDir();
      const yamlPath = path.join(tmpDir, 'variables.yaml');
      const yaml = require('js-yaml');
      const initial = {
        app: { key: 'test', displayName: 'Test', version: '1.0.0' },
        port: 3001,
        image: { name: 'myapp', tag: 'v1.0.0', registry: 'acr.azurecr.io' },
        requires: { database: true }
      };
      mockFileStore.set(path.resolve(yamlPath), yaml.dump(initial));

      const result = await updateAppVersionInVariablesYaml(tmpDir, '2.0.0');
      expect(result).toBe(true);

      const content = mockFileStore.get(path.resolve(yamlPath));
      const parsed = yaml.load(content);
      expect(parsed.app.version).toBe('2.0.0');
      expect(parsed.app.key).toBe('test');
      expect(parsed.app.displayName).toBe('Test');
      expect(parsed.port).toBe(3001);
      expect(parsed.image).toEqual({ name: 'myapp', tag: 'v1.0.0', registry: 'acr.azurecr.io' });
      expect(parsed.requires).toEqual({ database: true });
    });

    it('should create app block when missing', async() => {
      const tmpDir = makeTempDir();
      const yamlPath = path.join(tmpDir, 'variables.yaml');
      const yaml = require('js-yaml');
      const initial = { port: 3000 };
      mockFileStore.set(path.resolve(yamlPath), yaml.dump(initial));

      const result = await updateAppVersionInVariablesYaml(tmpDir, '1.0.0');
      expect(result).toBe(true);

      const content = mockFileStore.get(path.resolve(yamlPath));
      const parsed = yaml.load(content);
      expect(parsed.app).toBeDefined();
      expect(parsed.app.version).toBe('1.0.0');
    });
  });
});
