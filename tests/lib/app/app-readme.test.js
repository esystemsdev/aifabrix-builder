/**
 * Tests for AI Fabrix Builder README Generation Module
 *
 * @fileoverview Unit tests for app-readme.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const appReadme = require('../../../lib/app/readme');

describe('Application README Module', () => {
  let tempDir;
  let originalCwd;

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
      expect(result).toContain('aifabrix down test-app');
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
      const appPath = path.join(tempDir, 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const appName = 'test-app';
      const config = {
        port: 3000,
        language: 'typescript'
      };

      await appReadme.generateReadmeMdFile(appPath, appName, config);

      const readmePath = path.join(appPath, 'README.md');
      const exists = await fs.access(readmePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(readmePath, 'utf8');
      expect(content).toContain('# Test App Builder');
      expect(content).toContain('aifabrix build test-app');
    });

    it('should not overwrite existing README.md file', async() => {
      const appPath = path.join(tempDir, 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const readmePath = path.join(appPath, 'README.md');
      const existingContent = '# Custom README\n\nThis is a custom README file.';
      await fs.writeFile(readmePath, existingContent);

      const appName = 'test-app';
      const config = {
        port: 3000
      };

      await appReadme.generateReadmeMdFile(appPath, appName, config);

      const content = await fs.readFile(readmePath, 'utf8');
      expect(content).toBe(existingContent);
      expect(content).not.toContain('# Test App Builder');
    });

    it('should handle errors gracefully', async() => {
      const appPath = path.join(tempDir, 'test-app');
      // Don't create directory to trigger error

      const appName = 'test-app';
      const config = {
        port: 3000
      };

      await expect(
        appReadme.generateReadmeMdFile(appPath, appName, config)
      ).rejects.toThrow();
    });

    it('should generate README with all services enabled', async() => {
      const appPath = path.join(tempDir, 'test-app');
      await fs.mkdir(appPath, { recursive: true });

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
      const content = await fs.readFile(readmePath, 'utf8');

      expect(content).toContain('- PostgreSQL database');
      expect(content).toContain('- Redis');
      expect(content).toContain('- File storage configured');
      expect(content).toContain('- Authentication/RBAC configured');
    });

    it('should generate README with no services enabled', async() => {
      const appPath = path.join(tempDir, 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const appName = 'test-app';
      const config = {
        port: 3000
      };

      await appReadme.generateReadmeMdFile(appPath, appName, config);

      const readmePath = path.join(appPath, 'README.md');
      const content = await fs.readFile(readmePath, 'utf8');

      expect(content).toContain('- `@aifabrix/builder` installed globally');
      expect(content).toContain('- Docker Desktop running');
      expect(content).toContain('- Infrastructure running');
      expect(content).not.toContain('- PostgreSQL database');
      expect(content).not.toContain('- Redis');
    });
  });
});
