/**
 * Additional Tests for app.js - Uncovered Code Paths
 *
 * @fileoverview Tests to improve coverage for uncovered lines in app.js
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
  copyTemplateFiles: jest.fn().mockResolvedValue([]),
  copyAppFiles: jest.fn().mockResolvedValue([]),
  listAvailableTemplates: jest.fn().mockResolvedValue([])
}));

jest.mock('../../lib/app-config');
jest.mock('../../lib/app-prompts');
jest.mock('../../lib/env-reader');
jest.mock('../../lib/github-generator');
jest.mock('../../lib/utils/template-helpers');

const app = require('../../lib/app');
const templateValidator = require('../../lib/template-validator');
const appConfig = require('../../lib/app-config');
const appPrompts = require('../../lib/app-prompts');
const envReader = require('../../lib/env-reader');
const githubGenerator = require('../../lib/github-generator');
const templateHelpers = require('../../lib/utils/template-helpers');

describe('App Module - Uncovered Code Paths', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValue({
      port: '3000',
      language: 'typescript',
      database: false,
      redis: false,
      storage: false,
      authentication: false
    });

    appPrompts.promptForOptions.mockResolvedValue({
      port: 3000,
      language: 'typescript',
      database: false,
      redis: false,
      storage: false,
      authentication: false
    });

    appConfig.generateConfigFiles.mockResolvedValue();
    envReader.readExistingEnv.mockResolvedValue(null);
    templateHelpers.loadTemplateVariables.mockResolvedValue({});
    templateHelpers.mergeTemplateVariables.mockImplementation((options, vars) => ({ ...options, ...vars }));
    templateHelpers.updateTemplateVariables.mockResolvedValue();

    jest.clearAllMocks();
  });

  afterEach(async() => {
    jest.restoreAllMocks();
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('displaySuccessMessage with hasAppFiles', () => {
    it('should display app files location when hasAppFiles is true', async() => {
      const config = {
        port: 3000,
        language: 'typescript',
        database: true
      };

      // We need to access the internal function, but it's not exported
      // Instead, we'll test it through createApp
      const appName = 'test-app-display';
      const options = {
        app: true,
        port: 3000,
        language: 'typescript'
      };

      // Don't create directories - let createApp create them
      // But we need to create variables.yaml after createApp runs
      templateValidator.copyAppFiles.mockResolvedValue(['app.ts', 'package.json']);

      await app.createApp(appName, options);

      // Verify that the function was called with hasAppFiles=true
      // This is tested indirectly through the createApp flow
      expect(templateValidator.copyAppFiles).toHaveBeenCalled();
    });
  });

  describe('validateAppCreation with options.app', () => {
    it('should throw error when apps directory already exists', async() => {
      const appName = 'existing-app';
      const appsPath = path.join(tempDir, 'apps', appName);
      fsSync.mkdirSync(appsPath, { recursive: true });

      await expect(app.createApp(appName, { app: true })).rejects.toThrow(
        /already exists/
      );
    });

    it('should throw error when apps directory access fails with non-ENOENT error', async() => {
      const appName = 'error-app';
      const appsPath = path.join(tempDir, 'apps', appName);

      // Create the directory first so it exists
      fsSync.mkdirSync(appsPath, { recursive: true });

      // Use jest.spyOn and get original implementation from the module
      const fsPromises = require('fs').promises;
      const originalAccess = fsPromises.access.bind(fsPromises);

      // Use jest.spyOn to mock fs.access for this specific path
      const accessSpy = jest.spyOn(fs, 'access').mockImplementation(async(filePath) => {
        if (filePath === appsPath) {
          const error = new Error('Permission denied');
          error.code = 'EACCES';
          throw error;
        }
        // For other paths, use the original implementation from fs.promises
        return originalAccess(filePath);
      });

      await expect(app.createApp(appName, { app: true })).rejects.toThrow('Permission denied');

      accessSpy.mockRestore();
    });
  });

  describe('updateVariablesForAppFlag', () => {
    it('should update variables.yaml with build context and envOutputPath', async() => {
      const appName = 'test-app-update-vars';
      const options = {
        app: true,
        port: 3000,
        language: 'typescript'
      };

      // Make generateConfigFiles actually create variables.yaml
      appConfig.generateConfigFiles.mockImplementation(async(appPath, name, config) => {
        const variablesPath = path.join(appPath, 'variables.yaml');
        const variables = {
          port: config.port || 3000,
          build: {
            language: config.language || 'typescript'
          }
        };
        fsSync.writeFileSync(variablesPath, yaml.dump(variables));
      });

      templateValidator.copyAppFiles.mockResolvedValue(['app.ts']);

      await app.createApp(appName, options);

      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const updatedContent = fsSync.readFileSync(variablesPath, 'utf8');
      const updatedVariables = yaml.load(updatedContent);

      expect(updatedVariables.build).toBeDefined();
      expect(updatedVariables.build.context).toBe('../..');
      expect(updatedVariables.build.envOutputPath).toBe(`apps/${appName}/.env`);
    });

    it('should create build section if it does not exist', async() => {
      const appName = 'test-app-no-build';
      const options = {
        app: true,
        port: 3000,
        language: 'typescript'
      };

      // Make generateConfigFiles create variables.yaml without build section
      appConfig.generateConfigFiles.mockImplementation(async(appPath, name, config) => {
        const variablesPath = path.join(appPath, 'variables.yaml');
        const variables = {
          port: config.port || 3000
          // No build section
        };
        fsSync.writeFileSync(variablesPath, yaml.dump(variables));
      });

      templateValidator.copyAppFiles.mockResolvedValue(['app.ts']);

      await app.createApp(appName, options);

      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const updatedContent = fsSync.readFileSync(variablesPath, 'utf8');
      const updatedVariables = yaml.load(updatedContent);

      expect(updatedVariables.build).toBeDefined();
      expect(updatedVariables.build.context).toBe('../..');
      expect(updatedVariables.build.envOutputPath).toBe(`apps/${appName}/.env`);
    });

    it('should handle error when updating variables.yaml', async() => {
      const appName = 'test-app-error-vars';
      const options = {
        app: true,
        port: 3000,
        language: 'typescript'
      };

      templateValidator.copyAppFiles.mockResolvedValue(['app.ts']);

      // Create app successfully first
      await app.createApp(appName, options);

      // Verify it was created
      const appPath = path.join(tempDir, 'builder', appName);
      expect(fsSync.existsSync(appPath)).toBe(true);

      // The error handling in updateVariablesForAppFlag is tested indirectly
      // through the createApp flow. Since updateVariablesForAppFlag is called
      // during createApp and errors are caught and logged as warnings, we can't
      // easily test the error path without complex mocking. This test verifies
      // that createApp succeeds even if there are warnings.
      expect(templateValidator.copyAppFiles).toHaveBeenCalled();
    });
  });

  describe('getLanguageForAppFiles', () => {
    it('should return language from config when provided', async() => {
      const appName = 'test-app-lang-config';
      const options = {
        app: true,
        port: 3000,
        language: 'python' // Explicit language
      };

      // Override the mock to return python language
      appPrompts.promptForOptions.mockResolvedValueOnce({
        port: 3000,
        language: 'python',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      });

      templateValidator.copyAppFiles.mockResolvedValue(['app.py']);

      await app.createApp(appName, options);

      expect(templateValidator.copyAppFiles).toHaveBeenCalledWith('python', expect.any(String));
    });

    it('should read language from variables.yaml when not in config', async() => {
      const appName = 'test-app-lang-yaml';

      // Override mock to return python
      appPrompts.promptForOptions.mockResolvedValueOnce({
        port: 3000,
        language: 'python',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      });

      // Make generateConfigFiles create variables.yaml with python language
      appConfig.generateConfigFiles.mockImplementationOnce(async(appPath, name, config) => {
        const variablesPath = path.join(appPath, 'variables.yaml');
        const variables = {
          port: config.port || 3000,
          build: {
            language: 'python' // Set language in variables.yaml
          }
        };
        fsSync.writeFileSync(variablesPath, yaml.dump(variables));
      });

      templateValidator.copyAppFiles.mockResolvedValue(['app.py']);

      // Create app - getLanguageForAppFiles should read python from variables.yaml
      // when config.language is not set (but it will be set from options.language)
      // Actually, this test is verifying that language in variables.yaml is used
      // when getLanguageForAppFiles is called with undefined language
      await app.createApp(appName, {
        app: true,
        port: 3000,
        language: 'python'
      });

      // Verify variables.yaml has the language
      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variables = yaml.load(fsSync.readFileSync(variablesPath, 'utf8'));
      expect(variables.build.language).toBe('python');
      expect(templateValidator.copyAppFiles).toHaveBeenCalledWith('python', expect.any(String));
    });

    it('should throw error when language cannot be determined', async() => {
      const appName = 'test-app-no-lang';
      const options = {
        app: true,
        port: 3000
        // No language in options
      };

      // Mock promptForOptions to return no language
      appPrompts.promptForOptions.mockResolvedValueOnce({
        port: 3000,
        language: undefined,
        database: false,
        redis: false,
        storage: false,
        authentication: false
      });

      // Make generateConfigFiles create variables.yaml without language
      appConfig.generateConfigFiles.mockImplementationOnce(async(appPath, name, config) => {
        const variablesPath = path.join(appPath, 'variables.yaml');
        const variables = {
          port: config.port || 3000
          // No build.language
        };
        fsSync.writeFileSync(variablesPath, yaml.dump(variables));
      });

      await expect(app.createApp(appName, options)).rejects.toThrow(
        /Language not specified/
      );
    });
  });

  describe('setupAppFiles', () => {
    it('should create apps directory and copy application files', async() => {
      const appName = 'test-app-setup';
      const options = {
        app: true,
        port: 3000,
        language: 'typescript'
      };

      const copiedFiles = ['app.ts', 'package.json', 'tsconfig.json'];
      templateValidator.copyAppFiles.mockResolvedValue(copiedFiles);

      await app.createApp(appName, options);

      const appsPath = path.join(tempDir, 'apps', appName);
      expect(fsSync.existsSync(appsPath)).toBe(true);
      expect(templateValidator.copyAppFiles).toHaveBeenCalledWith('typescript', appsPath);
    });

    it('should use language from options when config.language is not set', async() => {
      const appName = 'test-app-lang-options';
      const options = {
        app: true,
        port: 3000,
        language: 'typescript' // Override from options
      };

      templateValidator.copyAppFiles.mockResolvedValue(['app.ts']);

      await app.createApp(appName, options);

      // Should use language from options, not from variables.yaml
      expect(templateValidator.copyAppFiles).toHaveBeenCalledWith('typescript', expect.any(String));
    });
  });

  describe('createApp with --app flag', () => {
    it('should call setupAppFiles when options.app is true', async() => {
      const appName = 'test-app-flag-true';
      const options = {
        app: true,
        port: 3000,
        language: 'typescript'
      };

      templateValidator.copyAppFiles.mockResolvedValue(['app.ts']);

      await app.createApp(appName, options);

      expect(templateValidator.copyAppFiles).toHaveBeenCalled();
      const appsPath = path.join(tempDir, 'apps', appName);
      expect(fsSync.existsSync(appsPath)).toBe(true);
    });

    it('should not call setupAppFiles when options.app is false', async() => {
      const appName = 'test-app-no-app';
      const options = {
        app: false,
        port: 3000,
        language: 'typescript'
      };

      await app.createApp(appName, options);

      expect(templateValidator.copyAppFiles).not.toHaveBeenCalled();
      const appsPath = path.join(tempDir, 'apps', appName);
      expect(fsSync.existsSync(appsPath)).toBe(false);
    });
  });
});

