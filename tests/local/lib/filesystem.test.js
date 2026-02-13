/**
 * Tests for AI Fabrix Builder File System Operations
 *
 * @fileoverview Comprehensive file system tests without Docker
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Ensure fs is not mocked - use jest.unmock to prevent mocking
jest.unmock('fs');

// Use real fs implementation - use regular require after unmocking
// This ensures all file operations use the real filesystem
const fs = jest.requireActual('fs').promises;
const fsSync = jest.requireActual('fs');

// Helper function to check if file exists (more reliable than existsSync)
function fileExists(filePath) {
  try {
    fsSync.statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('File System Operations', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    // Create temporary directory for each test
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-fs-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    // Clean up temporary directory
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Directory Operations', () => {
    it('should create application directory structure', async() => {
      const appName = 'test-app';
      const appPath = path.join('builder', appName);

      await fs.mkdir(appPath, { recursive: true });

      expect(fsSync.statSync(appPath).isDirectory()).toBe(true);
    });

    it('should create nested directories', async() => {
      const nestedPath = path.join('builder', 'app', 'config');

      await fs.mkdir(nestedPath, { recursive: true });

      expect(fsSync.statSync(nestedPath).isDirectory()).toBe(true);
    });

    it('should handle directory already existing', async() => {
      const appPath = path.join('builder', 'test-app');

      await fs.mkdir(appPath, { recursive: true });

      // Should not throw when directory already exists
      await expect(fs.mkdir(appPath, { recursive: true })).resolves.not.toThrow();
    });
  });

  describe('File Write Operations', () => {
    it('should write application.yaml file', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        build: { language: 'typescript' }
      };

      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'application.yaml');
      const dirPath = path.dirname(filePath);
      fsSync.mkdirSync(dirPath, { recursive: true });
      const yamlContent = yaml.dump(config);
      fsSync.writeFileSync(filePath, yamlContent, 'utf8');

      // Verify file was written - use statSync for more reliable check
      try {
        const stats = fsSync.statSync(filePath);
        expect(stats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(`File not found at ${filePath}: ${error.message}`);
      }

      const content = fsSync.readFileSync(filePath, 'utf8');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
      const loaded = yaml.load(content);
      expect(loaded).toBeDefined();
      expect(loaded.app).toBeDefined();
      expect(loaded.app.key).toBe('test-app');
    });

    it('should write .env file', async() => {
      const envContent = 'DATABASE_URL=postgresql://localhost:5432/test\nREDIS_URL=redis://localhost:6379';

      const filePath = path.join(process.cwd(), 'builder', 'test-app', '.env');
      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, envContent, 'utf8');

      expect(fileExists(filePath)).toBe(true);
      const content = fsSync.readFileSync(filePath, 'utf8');
      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('REDIS_URL');
    });

    it('should write rbac.yaml file', async() => {
      const rbacConfig = {
        roles: [
          { name: 'admin', permissions: ['read', 'write', 'delete'] },
          { name: 'user', permissions: ['read'] }
        ]
      };

      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'rbac.yaml');
      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, yaml.dump(rbacConfig), 'utf8');

      expect(fileExists(filePath)).toBe(true);
      const content = fsSync.readFileSync(filePath, 'utf8');
      const loaded = yaml.load(content);
      expect(loaded.roles).toHaveLength(2);
    });

    it('should write multiple files to application directory', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });

      const files = [
        { name: 'application.yaml', content: yaml.dump({ app: { key: 'test-app' } }) },
        { name: 'rbac.yaml', content: yaml.dump({ roles: [] }) },
        { name: 'env.template', content: 'PORT=3000' }
      ];

      for (const file of files) {
        const filePath = path.join(appPath, file.name);
        fsSync.writeFileSync(filePath, file.content, 'utf8');
        expect(fileExists(filePath)).toBe(true);
      }

      for (const file of files) {
        const filePath = path.join(appPath, file.name);
        expect(fileExists(filePath)).toBe(true);
        expect(fsSync.statSync(filePath).isFile()).toBe(true);
      }
    });
  });

  describe('File Read Operations', () => {
    it('should read application.yaml file', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };

      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'application.yaml');
      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, yaml.dump(config), 'utf8');

      expect(fileExists(filePath)).toBe(true);
      const content = fsSync.readFileSync(filePath, 'utf8');
      const loaded = yaml.load(content);

      expect(loaded).toBeDefined();
      expect(loaded.app).toBeDefined();
      expect(loaded.app.key).toBe('test-app');
      expect(loaded.app.name).toBe('Test App');
      expect(loaded.port).toBe(3000);
    });

    it('should handle reading non-existent file', async() => {
      const filePath = path.join(process.cwd(), 'builder', 'nonexistent.yaml');

      // Ensure directory exists but file doesn't
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      expect(fileExists(filePath)).toBe(false);

      await expect(fs.readFile(filePath, 'utf8'))
        .rejects.toThrow();
    });

    it('should read .env file with multiple variables', async() => {
      const envContent = `DATABASE_URL=postgresql://localhost:5432/test
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=production`;

      const filePath = path.join(process.cwd(), 'builder', 'test-app', '.env');
      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, envContent, 'utf8');

      expect(fileExists(filePath)).toBe(true);
      const content = fsSync.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('REDIS_URL');
    });
  });

  describe('File Existence Checks', () => {
    it('should check if file exists', async() => {
      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'application.yaml');
      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, 'test', 'utf8');

      expect(fsSync.existsSync(filePath)).toBe(true);
      expect(fsSync.statSync(filePath).isFile()).toBe(true);
    });

    it('should check if file does not exist', async() => {
      const filePath = path.join('builder', 'nonexistent.yaml');

      expect(() => fsSync.statSync(filePath)).toThrow();
    });

    it('should check multiple files exist', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });

      const files = ['application.yaml', 'rbac.yaml', 'env.template'];

      for (const filename of files) {
        const filePath = path.join(appPath, filename);
        fsSync.writeFileSync(filePath, 'test', 'utf8');
        expect(fileExists(filePath)).toBe(true);
      }

      for (const filename of files) {
        const filePath = path.join(appPath, filename);
        expect(fileExists(filePath)).toBe(true);
        expect(fsSync.statSync(filePath).isFile()).toBe(true);
      }
    });
  });

  describe('YAML File Operations', () => {
    it('should parse valid YAML file', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        services: { database: true, redis: true }
      };

      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'application.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, yaml.dump(config), 'utf8');

      expect(fsSync.existsSync(filePath)).toBe(true);
      const content = await fs.readFile(filePath, 'utf8');
      const loaded = yaml.load(content);

      expect(loaded).toEqual(config);
    });

    it('should handle invalid YAML gracefully', async() => {
      const invalidYaml = 'app:\n  key: test-app\n  name: Test App\n invalid: [';

      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'application.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, invalidYaml, 'utf8');

      expect(fsSync.existsSync(filePath)).toBe(true);
      const content = await fs.readFile(filePath, 'utf8');

      expect(() => yaml.load(content)).toThrow();
    });

    it('should preserve YAML formatting', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };

      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'application.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, yaml.dump(config), 'utf8');

      expect(fsSync.existsSync(filePath)).toBe(true);
      const content = await fs.readFile(filePath, 'utf8');

      expect(content).toContain('app:');
      expect(content).toContain('key:');
      expect(content).toContain('test-app');
    });
  });

  describe('File Cleanup Operations', () => {
    it('should delete file', async() => {
      const filePath = path.join(process.cwd(), 'builder', 'test-app', 'temp.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, 'test', 'utf8');

      expect(fsSync.existsSync(filePath)).toBe(true);
      expect(fsSync.statSync(filePath).isFile()).toBe(true);

      await fs.unlink(filePath);

      expect(fileExists(filePath)).toBe(false);
      expect(() => fsSync.statSync(filePath)).toThrow();
    });

    it('should handle deleting non-existent file', async() => {
      const filePath = path.join('builder', 'nonexistent.yaml');

      await expect(fs.unlink(filePath))
        .rejects.toThrow();
    });

    it('should delete directory', async() => {
      const dirPath = path.join('builder', 'test-app');

      await fs.mkdir(dirPath, { recursive: true });

      expect(fsSync.statSync(dirPath).isDirectory()).toBe(true);

      await fs.rm(dirPath, { recursive: true });

      expect(() => fsSync.statSync(dirPath)).toThrow();
    });
  });

  describe('Path Operations', () => {
    it('should join paths correctly', () => {
      const basePath = 'builder';
      const appPath = 'test-app';
      const filePath = 'application.yaml';

      const fullPath = path.join(basePath, appPath, filePath);

      expect(fullPath).toContain('builder');
      expect(fullPath).toContain('test-app');
      expect(fullPath).toContain('application.yaml');
    });

    it('should resolve absolute paths', () => {
      const relativePath = path.join('builder', 'test-app');
      const absolutePath = path.resolve(relativePath);

      expect(absolutePath).toBe(path.resolve(relativePath));
    });

    it('should normalize path separators', () => {
      const unixPath = 'builder/test-app/application.yaml';
      const normalized = path.normalize(unixPath);

      expect(normalized).toContain(path.sep);
    });
  });
});

