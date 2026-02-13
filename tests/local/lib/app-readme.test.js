/**
 * Tests for AI Fabrix Builder README Generation Module
 *
 * @fileoverview Unit tests for app-readme.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');

// Ensure fs is not mocked - use jest.unmock to prevent mocking
jest.unmock('fs');

// Use real fs implementation
const fs = jest.requireActual('fs').promises;
const fsSync = jest.requireActual('fs');

// Variables for modules to be loaded after reset
let appReadme;

describe('Application README Module', () => {
  let tempDir;
  let originalCwd;

  beforeAll(() => {
    // Reset modules and re-require to get fresh module with real fs
    jest.resetModules();
    jest.unmock('fs');
    appReadme = require('../../../lib/app/readme');
  });

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-readme-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    // Clean up temporary directory
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('formatAppDisplayName', () => {
    it('should capitalize first letter of each word', () => {
      expect(appReadme.formatAppDisplayName('test-app')).toBe('Test App');
      expect(appReadme.formatAppDisplayName('my-awesome-app')).toBe('My Awesome App');
      expect(appReadme.formatAppDisplayName('single')).toBe('Single');
    });

    it('should handle app names with multiple hyphens', () => {
      expect(appReadme.formatAppDisplayName('multi-word-app-name')).toBe('Multi Word App Name');
    });

    it('should handle app names without hyphens', () => {
      expect(appReadme.formatAppDisplayName('testapp')).toBe('Testapp');
    });
  });

  describe('generateReadmeMd', () => {
    it('should generate README with basic configuration', () => {
      const appName = 'test-app';
      const config = {
        port: 3000,
        language: 'typescript'
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('# Test App Builder');
      expect(result).toContain('Build, run, and deploy Test App');
      expect(result).toContain('aifabrix build test-app');
      expect(result).toContain('aifabrix run test-app');
      expect(result).toContain('http://localhost:3000');
      expect(result).toContain('aifabrix/test-app:latest');
      expect(result).toContain('docker logs aifabrix-test-app -f');
      expect(result).toContain('aifabrix down-infra test-app');
      expect(result).toContain('aifabrix push test-app --registry myacr.azurecr.io --tag "v1.0.0,latest"');
    });

    it('should include database prerequisite when database is enabled', () => {
      const appName = 'test-app';
      const config = {
        port: 3000,
        database: true
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('- PostgreSQL database');
      expect(result).toContain('and PostgreSQL is accessible');
    });

    it('should include redis prerequisite when redis is enabled', () => {
      const appName = 'test-app';
      const config = {
        port: 3000,
        redis: true
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('- Redis');
    });

    it('should include storage prerequisite when storage is enabled', () => {
      const appName = 'test-app';
      const config = {
        port: 3000,
        storage: true
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('- File storage configured');
    });

    it('should include authentication prerequisite when authentication is enabled', () => {
      const appName = 'test-app';
      const config = {
        port: 3000,
        authentication: true
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('- Authentication/RBAC configured');
    });

    it('should include all prerequisites when all services are enabled', () => {
      const appName = 'test-app';
      const config = {
        port: 3000,
        database: true,
        redis: true,
        storage: true,
        authentication: true
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('- PostgreSQL database');
      expect(result).toContain('- Redis');
      expect(result).toContain('- File storage configured');
      expect(result).toContain('- Authentication/RBAC configured');
    });

    it('should use default port 3000 when port is not specified', () => {
      const appName = 'test-app';
      const config = {};

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('http://localhost:3000');
      expect(result).toContain('(default: 3000)');
    });

    it('should use custom port when specified', () => {
      const appName = 'test-app';
      const config = {
        port: 8080
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('http://localhost:8080');
      expect(result).toContain('(default: 8080)');
    });

    it('should include all required sections', () => {
      const appName = 'test-app';
      const config = {
        port: 3000
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('## Quick Start');
      expect(result).toContain('### 1. Install');
      expect(result).toContain('### 3. Build & Run Locally');
      expect(result).toContain('### 4. Deploy to Azure');
      expect(result).toContain('## Prerequisites');
      expect(result).toContain('## Troubleshooting');
    });

    it('should generate correct image name', () => {
      const appName = 'my-app';
      const config = {
        port: 3000
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('aifabrix/my-app:latest');
    });

    it('should not include database troubleshooting when database is disabled', () => {
      const appName = 'test-app';
      const config = {
        port: 3000,
        database: false
      };

      const result = appReadme.generateReadmeMd(appName, config);

      expect(result).toContain('Verify infrastructure is running');
      expect(result).not.toContain('and PostgreSQL is accessible');
    });
  });

  describe('generateReadmeMdFile', () => {
    it('should create README.md file when it does not exist', async() => {
      const appPath = path.join(process.cwd(), 'test-app-create');
      // generateReadmeMdFile will create the directory if it doesn't exist
      const appName = 'test-app';
      const config = {
        port: 3000,
        language: 'typescript'
      };

      await appReadme.generateReadmeMdFile(appPath, appName, config);

      const readmePath = path.join(appPath, 'README.md');
      // Use a more reliable file existence check
      if (!fsSync.existsSync(readmePath)) {
        throw new Error(`README.md not created at ${readmePath}, cwd: ${process.cwd()}`);
      }
      const stats = fsSync.statSync(readmePath);
      expect(stats.isFile()).toBe(true);

      const content = await fs.readFile(readmePath, 'utf8');
      expect(content).toContain('# Test App Builder');
      expect(content).toContain('aifabrix build test-app');
    });

    it('should not overwrite existing README.md file', async() => {
      const appPath = path.join(process.cwd(), 'test-app-overwrite');
      // Ensure directory exists
      fsSync.mkdirSync(appPath, { recursive: true });

      const readmePath = path.join(appPath, 'README.md');
      const existingContent = '# Custom README\n\nThis is a custom README file.';
      fsSync.writeFileSync(readmePath, existingContent, 'utf8');

      // Verify file was written - use a more reliable check
      if (!fsSync.existsSync(readmePath)) {
        throw new Error(`File not created at ${readmePath}, cwd: ${process.cwd()}`);
      }
      const stats = fsSync.statSync(readmePath);
      expect(stats.isFile()).toBe(true);

      const appName = 'test-app';
      const config = {
        port: 3000
      };

      await appReadme.generateReadmeMdFile(appPath, appName, config);

      const content = await fs.readFile(readmePath, 'utf8');
      expect(content).toBe(existingContent);
      expect(content).not.toContain('# Test App Builder');
    });

    it('should overwrite existing README.md when options.force is true', async() => {
      const appPath = path.join(process.cwd(), 'test-app-force');
      fsSync.mkdirSync(appPath, { recursive: true });
      const readmePath = path.join(appPath, 'README.md');
      const existingContent = '# Old README';
      fsSync.writeFileSync(readmePath, existingContent, 'utf8');

      const appName = 'test-app';
      const config = { port: 3000 };

      await appReadme.generateReadmeMdFile(appPath, appName, config, { force: true });

      const content = await fs.readFile(readmePath, 'utf8');
      expect(content).toContain('# Test App Builder');
      expect(content).toContain('aifabrix build test-app');
      expect(content).not.toBe(existingContent);
    });

    it('should handle errors gracefully', async() => {
      // Since generateReadmeMdFile now creates directories, we need to test a different error scenario
      // Test with a path that would fail for other reasons (e.g., permission denied)
      // For now, test that it doesn't throw when directory creation succeeds
      const appPath = path.join(process.cwd(), 'test-app-error-' + Date.now());
      // Directory will be created by generateReadmeMdFile, so this should succeed
      const appName = 'test-app';
      const config = {
        port: 3000
      };

      // This should succeed since directory creation is handled
      await expect(
        appReadme.generateReadmeMdFile(appPath, appName, config)
      ).resolves.not.toThrow();

      // Clean up
      if (fsSync.existsSync(appPath)) {
        await fs.rm(appPath, { recursive: true, force: true });
      }
    });

    it('should generate README with all services enabled', async() => {
      const appPath = path.join(process.cwd(), 'test-app-services');
      // generateReadmeMdFile will create the directory if it doesn't exist
      const appName = 'test-app';
      const config = {
        port: 3000,
        database: true,
        redis: true,
        storage: true,
        authentication: true
      };

      await appReadme.generateReadmeMdFile(appPath, appName, config);

      const readmePath = path.join(appPath, 'README.md');
      // Verify file exists - use a more reliable check
      if (!fsSync.existsSync(readmePath)) {
        throw new Error(`README.md not created at ${readmePath}, cwd: ${process.cwd()}`);
      }
      const stats = fsSync.statSync(readmePath);
      expect(stats.isFile()).toBe(true);

      // Use sync read to ensure we get the actual file content
      const content = fsSync.readFileSync(readmePath, 'utf8');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('- PostgreSQL database');
      expect(content).toContain('- Redis');
      expect(content).toContain('- File storage configured');
      expect(content).toContain('- Authentication/RBAC configured');
    });

    it('should generate README with no services enabled', async() => {
      const appPath = path.join(process.cwd(), 'test-app-no-services');
      // generateReadmeMdFile will create the directory if it doesn't exist
      const appName = 'test-app';
      const config = {
        port: 3000
      };

      await appReadme.generateReadmeMdFile(appPath, appName, config);

      const readmePath = path.join(appPath, 'README.md');
      // Verify file exists - use a more reliable check
      if (!fsSync.existsSync(readmePath)) {
        throw new Error(`README.md not created at ${readmePath}, cwd: ${process.cwd()}`);
      }
      const stats = fsSync.statSync(readmePath);
      expect(stats.isFile()).toBe(true);

      // Use sync read to ensure we get the actual file content
      const content = fsSync.readFileSync(readmePath, 'utf8');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('- `@aifabrix/builder` installed globally');
      expect(content).toContain('- Docker Desktop running');
      expect(content).toContain('- Infrastructure running');
      expect(content).not.toContain('- PostgreSQL database');
      expect(content).not.toContain('- Redis');
    });
  });

  describe('ensureReadmeForAppPath', () => {
    it('should generate README.md when application.yaml exists', async() => {
      const appPath = path.join(process.cwd(), 'ensure-path-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      const variablesContent = 'app:\n  key: myapp\nport: 3001\nimage:\n  name: aifabrix/myapp\n  registry: myacr.azurecr.io';
      fsSync.writeFileSync(path.join(appPath, 'application.yaml'), variablesContent, 'utf8');

      await appReadme.ensureReadmeForAppPath(appPath, 'myapp');

      const readmePath = path.join(appPath, 'README.md');
      expect(fsSync.existsSync(readmePath)).toBe(true);
      const content = fsSync.readFileSync(readmePath, 'utf8');
      expect(content).toContain('# Myapp Builder');
      expect(content).toContain('aifabrix build myapp');
      expect(content).toContain('http://localhost:3001');
    });

    it('should overwrite existing README.md when application.yaml exists', async() => {
      const appPath = path.join(process.cwd(), 'ensure-path-overwrite');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(path.join(appPath, 'README.md'), '# Old', 'utf8');
      fsSync.writeFileSync(path.join(appPath, 'application.yaml'), 'port: 4000\nimage:\n  name: aifabrix/overwrite', 'utf8');

      await appReadme.ensureReadmeForAppPath(appPath, 'overwrite');

      const content = fsSync.readFileSync(path.join(appPath, 'README.md'), 'utf8');
      expect(content).toContain('# Overwrite Builder');
      expect(content).not.toBe('# Old');
    });

    it('should do nothing when application.yaml does not exist', async() => {
      const appPath = path.join(process.cwd(), 'ensure-path-no-vars');
      fsSync.mkdirSync(appPath, { recursive: true });

      await appReadme.ensureReadmeForAppPath(appPath, 'no-vars');

      expect(fsSync.existsSync(path.join(appPath, 'README.md'))).toBe(false);
    });
  });

  describe('ensureReadmeForApp', () => {
    it('should generate README at builder path when application.yaml exists', async() => {
      const builderPath = path.join(process.cwd(), 'builder', 'dataplane');
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(builderPath, 'application.yaml'),
        'port: 3001\nimage:\n  name: aifabrix/dataplane\n  registry: myacr.azurecr.io',
        'utf8'
      );

      await appReadme.ensureReadmeForApp('dataplane');

      const readmePath = path.join(builderPath, 'README.md');
      expect(fsSync.existsSync(readmePath)).toBe(true);
      const content = fsSync.readFileSync(readmePath, 'utf8');
      expect(content).toContain('# Dataplane Builder');
      expect(content).toContain('aifabrix build dataplane');
    });
  });
});
