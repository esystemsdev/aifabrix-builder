/**
 * Tests for AI Fabrix Builder File System Operations
 *
 * @fileoverview Comprehensive file system tests without Docker
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

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

      const exists = await fs.access(appPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create nested directories', async() => {
      const nestedPath = path.join('builder', 'app', 'config');

      await fs.mkdir(nestedPath, { recursive: true });

      const exists = await fs.access(nestedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle directory already existing', async() => {
      const appPath = path.join('builder', 'test-app');

      await fs.mkdir(appPath, { recursive: true });

      // Should not throw when directory already exists
      await expect(fs.mkdir(appPath, { recursive: true })).resolves.not.toThrow();
    });
  });

  describe('File Write Operations', () => {
    it('should write variables.yaml file', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000,
        build: { language: 'typescript' }
      };

      const filePath = path.join('builder', 'test-app', 'variables.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, yaml.dump(config));

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(filePath, 'utf8');
      const loaded = yaml.load(content);
      expect(loaded.app.key).toBe('test-app');
    });

    it('should write .env file', async() => {
      const envContent = 'DATABASE_URL=postgresql://localhost:5432/test\nREDIS_URL=redis://localhost:6379';

      const filePath = path.join('builder', 'test-app', '.env');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, envContent);

      const content = await fs.readFile(filePath, 'utf8');
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

      const filePath = path.join('builder', 'test-app', 'rbac.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, yaml.dump(rbacConfig));

      const content = await fs.readFile(filePath, 'utf8');
      const loaded = yaml.load(content);
      expect(loaded.roles).toHaveLength(2);
    });

    it('should write multiple files to application directory', async() => {
      const appPath = path.join('builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const files = [
        { name: 'variables.yaml', content: yaml.dump({ app: { key: 'test-app' } }) },
        { name: 'rbac.yaml', content: yaml.dump({ roles: [] }) },
        { name: 'env.template', content: 'PORT=3000' }
      ];

      for (const file of files) {
        await fs.writeFile(path.join(appPath, file.name), file.content);
      }

      for (const file of files) {
        const exists = await fs.access(path.join(appPath, file.name)).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('File Read Operations', () => {
    it('should read variables.yaml file', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };

      const filePath = path.join('builder', 'test-app', 'variables.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, yaml.dump(config));

      const content = await fs.readFile(filePath, 'utf8');
      const loaded = yaml.load(content);

      expect(loaded.app.key).toBe('test-app');
      expect(loaded.app.name).toBe('Test App');
      expect(loaded.port).toBe(3000);
    });

    it('should handle reading non-existent file', async() => {
      const filePath = path.join('builder', 'nonexistent.yaml');

      await expect(fs.readFile(filePath, 'utf8'))
        .rejects.toThrow();
    });

    it('should read .env file with multiple variables', async() => {
      const envContent = `DATABASE_URL=postgresql://localhost:5432/test
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=production`;

      const filePath = path.join('builder', 'test-app', '.env');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, envContent);

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('REDIS_URL');
    });
  });

  describe('File Existence Checks', () => {
    it('should check if file exists', async() => {
      const filePath = path.join('builder', 'test-app', 'variables.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, 'test');

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should check if file does not exist', async() => {
      const filePath = path.join('builder', 'nonexistent.yaml');

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should check multiple files exist', async() => {
      const appPath = path.join('builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const files = ['variables.yaml', 'rbac.yaml', 'env.template'];

      for (const filename of files) {
        await fs.writeFile(path.join(appPath, filename), 'test');
      }

      for (const filename of files) {
        const exists = await fs.access(path.join(appPath, filename)).then(() => true).catch(() => false);
        expect(exists).toBe(true);
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

      const filePath = path.join('builder', 'test-app', 'variables.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, yaml.dump(config));

      const content = await fs.readFile(filePath, 'utf8');
      const loaded = yaml.load(content);

      expect(loaded).toEqual(config);
    });

    it('should handle invalid YAML gracefully', async() => {
      const invalidYaml = 'app:\n  key: test-app\n  name: Test App\n invalid: [';

      const filePath = path.join('builder', 'test-app', 'variables.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, invalidYaml);

      const content = await fs.readFile(filePath, 'utf8');

      expect(() => yaml.load(content)).toThrow();
    });

    it('should preserve YAML formatting', async() => {
      const config = {
        app: { key: 'test-app', name: 'Test App' },
        port: 3000
      };

      const filePath = path.join('builder', 'test-app', 'variables.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, yaml.dump(config));

      const content = await fs.readFile(filePath, 'utf8');

      expect(content).toContain('app:');
      expect(content).toContain('key:');
      expect(content).toContain('test-app');
    });
  });

  describe('File Cleanup Operations', () => {
    it('should delete file', async() => {
      const filePath = path.join('builder', 'test-app', 'temp.yaml');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, 'test');

      let exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      await fs.unlink(filePath);

      exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should handle deleting non-existent file', async() => {
      const filePath = path.join('builder', 'nonexistent.yaml');

      await expect(fs.unlink(filePath))
        .rejects.toThrow();
    });

    it('should delete directory', async() => {
      const dirPath = path.join('builder', 'test-app');

      await fs.mkdir(dirPath, { recursive: true });

      let exists = await fs.access(dirPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      await fs.rm(dirPath, { recursive: true });

      exists = await fs.access(dirPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('Path Operations', () => {
    it('should join paths correctly', () => {
      const basePath = 'builder';
      const appPath = 'test-app';
      const filePath = 'variables.yaml';

      const fullPath = path.join(basePath, appPath, filePath);

      expect(fullPath).toContain('builder');
      expect(fullPath).toContain('test-app');
      expect(fullPath).toContain('variables.yaml');
    });

    it('should resolve absolute paths', () => {
      const relativePath = path.join('builder', 'test-app');
      const absolutePath = path.resolve(relativePath);

      expect(absolutePath).toBe(path.resolve(relativePath));
    });

    it('should normalize path separators', () => {
      const unixPath = 'builder/test-app/variables.yaml';
      const normalized = path.normalize(unixPath);

      expect(normalized).toContain(path.sep);
    });
  });
});

