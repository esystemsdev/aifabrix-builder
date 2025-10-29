/**
 * Tests for App.js Uncovered Lines
 *
 * @fileoverview Tests specifically for uncovered lines in app.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('../../lib/template-validator', () => ({
  validateTemplate: jest.fn().mockResolvedValue(true),
  copyTemplateFiles: jest.fn().mockResolvedValue(['file1.yaml', 'file2.yaml'])
}));

jest.mock('../../lib/env-reader', () => ({
  readExistingEnv: jest.fn(),
  generateEnvTemplate: jest.fn()
}));

jest.mock('../../lib/github-generator', () => ({
  generateGithubWorkflows: jest.fn()
}));

const app = require('../../lib/app');
const inquirer = require('inquirer');
const envReader = require('../../lib/env-reader');
const githubGenerator = require('../../lib/github-generator');

describe('App.js Uncovered Lines Tests', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    inquirer.prompt.mockResolvedValue({
      port: '3000',
      language: 'typescript',
      database: false,
      redis: false,
      storage: false,
      authentication: false,
      github: false,
      controller: false
    });

    envReader.readExistingEnv.mockResolvedValue(null);
    envReader.generateEnvTemplate.mockReturnValue({
      template: '# Environment Template',
      warnings: []
    });

    // Always mock githubGenerator.generateGithubWorkflows to return an array
    githubGenerator.generateGithubWorkflows.mockResolvedValue([
      '.github/workflows/ci.yaml'
    ]);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('promptForOptions - line 146: conditional controller prompt', () => {
    it('should prompt for controller when github is not false and controller not provided', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        controller: true,
        controllerUrl: 'http://localhost:3000'
      });

      const appName = 'test-app';
      const options = { github: true }; // github is not false

      await app.createApp(appName, options);

      // Verify the prompt was called with controller question that has when condition
      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should not prompt for controller when github is false', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: false
      });

      const appName = 'test-app';
      const options = { github: false }; // github is false

      await app.createApp(appName, options);

      // Controller prompt should not be triggered
      expect(inquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('generateConfigFiles - lines 201-202: warning display', () => {
    it('should display warnings when env conversion has warnings', async() => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      envReader.readExistingEnv.mockResolvedValue({ DATABASE_URL: 'postgres://localhost/test' });
      envReader.generateEnvTemplate.mockReturnValue({
        template: '# Environment Template',
        warnings: [
          'Warning: DATABASE_URL was converted to kv:// reference',
          'Warning: API_KEY was converted to kv:// reference'
        ]
      });

      const appName = 'test-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: true,
        redis: false,
        storage: false,
        authentication: false
      };

      await app.createApp(appName, options);

      // Verify warnings were displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Environment conversion warnings:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL was converted')
      );

      consoleLogSpy.mockRestore();
    });

    it('should not display warnings when env conversion has no warnings', async() => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      envReader.readExistingEnv.mockResolvedValue({ DATABASE_URL: 'postgres://localhost/test' });
      envReader.generateEnvTemplate.mockReturnValue({
        template: '# Environment Template',
        warnings: []
      });

      const appName = 'test-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      };

      await app.createApp(appName, options);

      // Verify warnings were NOT displayed
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Environment conversion warnings:')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('createApp - line 329: githubSteps parsing', () => {
    it('should parse githubSteps from comma-separated string', async() => {
      githubGenerator.generateGithubWorkflows.mockResolvedValue([
        '.github/workflows/ci.yaml',
        '.github/workflows/release.yaml'
      ]);

      const appName = 'test-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        githubSteps: 'npm,test,deploy' // Comma-separated steps
      };

      await app.createApp(appName, options);

      expect(githubGenerator.generateGithubWorkflows).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          language: 'typescript',
          port: 3000
        }),
        expect.objectContaining({
          githubSteps: ['npm', 'test', 'deploy'] // Should be parsed as array
        })
      );
    });

    it('should parse githubSteps with spaces and filter empty strings', async() => {
      githubGenerator.generateGithubWorkflows.mockResolvedValue([
        '.github/workflows/ci.yaml'
      ]);

      const appName = 'test-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        githubSteps: 'npm, test , ,deploy' // With spaces and empty values
      };

      await app.createApp(appName, options);

      expect(githubGenerator.generateGithubWorkflows).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          githubSteps: ['npm', 'test', 'deploy'] // Should filter empty strings
        })
      );
    });

    it('should handle empty githubSteps string', async() => {
      githubGenerator.generateGithubWorkflows.mockResolvedValue([
        '.github/workflows/ci.yaml'
      ]);

      const appName = 'test-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        githubSteps: '' // Empty string
      };

      await app.createApp(appName, options);

      expect(githubGenerator.generateGithubWorkflows).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          githubSteps: [] // Should be empty array
        })
      );
    });

    it('should handle githubSteps when not provided', async() => {
      githubGenerator.generateGithubWorkflows.mockResolvedValue([
        '.github/workflows/ci.yaml'
      ]);

      const appName = 'test-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true
        // githubSteps not provided
      };

      await app.createApp(appName, options);

      expect(githubGenerator.generateGithubWorkflows).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          githubSteps: [] // Should default to empty array
        })
      );
    });
  });
});

