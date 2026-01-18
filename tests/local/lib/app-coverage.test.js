/**
 * Tests for AI Fabrix Builder Application Module Coverage
 *
 * @fileoverview Additional coverage tests for app.js without Docker
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Ensure fs is not mocked - use jest.unmock to prevent mocking
jest.unmock('fs');

// Use real fs implementation - use regular require after unmocking
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const app = require('../../../lib/app');

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({
    port: '3000',
    language: 'typescript',
    database: false,
    redis: false,
    storage: false,
    authentication: false
  })
}));

// Mock templates
jest.mock('../../../lib/core/templates', () => ({
  generateVariablesYaml: jest.fn((name, config) => `app:\n  key: ${name}`),
  generateEnvTemplate: jest.fn(() => 'PORT=3000'),
  generateRbacYaml: jest.fn(() => null)
}));

// Mock env-reader
jest.mock('../../../lib/core/env-reader', () => ({
  readExistingEnv: jest.fn().mockResolvedValue(null),
  generateEnvTemplate: jest.fn()
}));

// Mock GitHub generator
jest.mock('../../../lib/generator/github', () => ({
  generateGithubWorkflows: jest.fn().mockResolvedValue([])
}));

describe('Application Module Coverage', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    // Retry cleanup on Windows (handles EBUSY errors)
    let retries = 3;
    while (retries > 0) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (error.code === 'EBUSY' && retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries--;
        } else {
          // Ignore cleanup errors in test environment
          break;
        }
      }
    }
  });

  describe('validateAppName', () => {
    it('should reject names with invalid characters', async() => {
      await expect(app.createApp('My App', {}))
        .rejects.toThrow('Application name must be 3-40 characters');
    });

    it('should reject names starting with dash', async() => {
      await expect(app.createApp('-myapp', {}))
        .rejects.toThrow('Application name cannot start or end with a dash');
    });

    it('should reject names ending with dash', async() => {
      await expect(app.createApp('myapp-', {}))
        .rejects.toThrow('Application name cannot start or end with a dash');
    });

    it('should reject names with consecutive dashes', async() => {
      await expect(app.createApp('my--app', {}))
        .rejects.toThrow('Application name cannot have consecutive dashes');
    });

    it('should reject names that are too short', async() => {
      await expect(app.createApp('ab', {}))
        .rejects.toThrow('Application name must be 3-40 characters');
    });

    it('should reject names that are too long', async() => {
      await expect(app.createApp('a'.repeat(41), {}))
        .rejects.toThrow('Application name must be 3-40 characters');
    });
  });

  describe('createApp error paths', () => {
    it('should handle existing application directory', async() => {
      // Create existing app
      const appPath = path.join('builder', 'existing-app');
      await fs.mkdir(appPath, { recursive: true });

      await expect(app.createApp('existing-app', { port: 3000, language: 'typescript' }))
        .rejects.toThrow('already exists');
    });

    it('should handle empty app name', async() => {
      await expect(app.createApp('', {}))
        .rejects.toThrow('Application name is required');
    });

    it('should handle undefined app name', async() => {
      await expect(app.createApp(undefined, {}))
        .rejects.toThrow('Application name is required');
    });
  });

  describe('pushApp error paths', () => {
    it('should handle missing registry', async() => {
      // Create required files
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      // Ensure parent directory exists
      fsSync.mkdirSync(path.dirname(appPath), { recursive: true });
      fsSync.mkdirSync(appPath, { recursive: true });
      // Ensure variables.yaml exists with proper structure
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesContent = yaml.dump({
        app: { key: 'test-app' },
        image: { name: 'test-app' }
      });
      fsSync.writeFileSync(variablesPath, variablesContent, 'utf8');

      // Verify file exists - use statSync for reliable check
      expect(() => fsSync.statSync(variablesPath).isFile()).not.toThrow();
      expect(fsSync.statSync(variablesPath).isFile()).toBe(true);

      await expect(app.pushApp('test-app', {}))
        .rejects.toThrow('Registry URL is required');
    });

    it('should handle invalid registry URL', async() => {
      // Create required files
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      // Ensure parent directory exists
      fsSync.mkdirSync(path.dirname(appPath), { recursive: true });
      fsSync.mkdirSync(appPath, { recursive: true });
      // Ensure variables.yaml exists with proper structure
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesContent = yaml.dump({
        app: { key: 'test-app' },
        image: { name: 'test-app' }
      });
      fsSync.writeFileSync(variablesPath, variablesContent, 'utf8');

      // Verify file exists - use statSync for reliable check
      expect(() => fsSync.statSync(variablesPath).isFile()).not.toThrow();
      expect(fsSync.statSync(variablesPath).isFile()).toBe(true);

      // The validation checks ACR URL format before checking the image
      await expect(app.pushApp('test-app', { registry: 'invalid.com' }))
        .rejects.toThrow('Invalid ACR URL format');
    });

    it('should handle missing local image', async() => {
      // Create required files first
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      // Ensure parent directory exists
      fsSync.mkdirSync(path.dirname(appPath), { recursive: true });
      fsSync.mkdirSync(appPath, { recursive: true });
      // Ensure variables.yaml exists with proper structure
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesContent = yaml.dump({
        app: { key: 'test-app' },
        image: { name: 'test-app', registry: 'myacr.azurecr.io' }
      });
      fsSync.writeFileSync(variablesPath, variablesContent, 'utf8');

      // Verify file exists - use statSync for reliable check
      expect(() => fsSync.statSync(variablesPath).isFile()).not.toThrow();
      expect(fsSync.statSync(variablesPath).isFile()).toBe(true);

      const pushUtils = require('../../../lib/deployment/push');
      jest.spyOn(pushUtils, 'checkLocalImageExists').mockResolvedValue(false);

      await expect(app.pushApp('test-app', { registry: 'myacr.azurecr.io' }))
        .rejects.toThrow('Docker image');
    });

    it('should handle missing Azure CLI', async() => {
      // Create required files first
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      // Ensure parent directory exists
      const builderDir = path.dirname(appPath);
      fsSync.mkdirSync(builderDir, { recursive: true });
      fsSync.mkdirSync(appPath, { recursive: true });
      // Ensure variables.yaml exists with proper structure
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesContent = yaml.dump({
        app: { key: 'test-app' },
        image: { name: 'test-app', registry: 'myacr.azurecr.io' }
      });
      fsSync.writeFileSync(variablesPath, variablesContent, 'utf8');

      // Verify file exists and was written correctly
      expect(fsSync.existsSync(variablesPath)).toBe(true);
      expect(fsSync.statSync(variablesPath).isFile()).toBe(true);
      const writtenContent = fsSync.readFileSync(variablesPath, 'utf8');
      expect(writtenContent).toBeTruthy();
      expect(writtenContent.length).toBeGreaterThan(0);

      const pushUtils = require('../../../lib/deployment/push');
      jest.spyOn(pushUtils, 'checkLocalImageExists').mockResolvedValue(true);
      jest.spyOn(pushUtils, 'checkAzureCLIInstalled').mockResolvedValue(false);

      await expect(app.pushApp('test-app', { registry: 'myacr.azurecr.io' }))
        .rejects.toThrow('Azure CLI is not installed');
    });
  });
});

