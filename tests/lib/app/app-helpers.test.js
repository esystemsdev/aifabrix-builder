/**
 * Tests for Application Helpers Module
 *
 * @fileoverview Unit tests for lib/app/helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    promises: {
      access: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn()
    }
  };
});

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock validation/template
jest.mock('../../../lib/validation/template', () => ({
  validateTemplate: jest.fn(),
  copyTemplateFiles: jest.fn(),
  copyAppFiles: jest.fn()
}));

// Mock generator/github
jest.mock('../../../lib/generator/github', () => ({
  generateGithubWorkflows: jest.fn()
}));

// Mock utils/template-helpers
jest.mock('../../../lib/utils/template-helpers', () => ({
  updateTemplateVariables: jest.fn()
}));

// Mock app/push
jest.mock('../../../lib/app/push', () => ({
  validateAppName: jest.fn()
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((appPath) => require('path').join(appPath, 'application.yaml'))
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const configFormat = require('../../../lib/utils/config-format');
const { validateTemplate, copyTemplateFiles, copyAppFiles } = require('../../../lib/validation/template');
const { generateGithubWorkflows } = require('../../../lib/generator/github');
const { updateTemplateVariables } = require('../../../lib/utils/template-helpers');
const { validateAppName } = require('../../../lib/app/push');
const {
  validateAppDirectoryNotExists,
  getBaseDirForAppType,
  handleGitHubWorkflows,
  validateAppCreation,
  processTemplateFiles,
  updateVariablesForAppFlag,
  getLanguageForAppFiles,
  setupAppFiles
} = require('../../../lib/app/helpers');

describe('Application Helpers Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAppDirectoryNotExists', () => {
    it('should throw error if directory exists', async() => {
      const appPath = '/path/to/builder/test-app';
      fs.access.mockResolvedValue();

      await expect(validateAppDirectoryNotExists(appPath, 'test-app', 'builder')).rejects.toThrow(
        'Application \'test-app\' already exists in builder/test-app/'
      );
    });

    it('should not throw error if directory does not exist', async() => {
      const appPath = '/path/to/builder/test-app';
      fs.access.mockRejectedValue({ code: 'ENOENT' });

      await expect(validateAppDirectoryNotExists(appPath, 'test-app', 'builder')).resolves.not.toThrow();
    });

    it('should throw other errors', async() => {
      const appPath = '/path/to/builder/test-app';
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.access.mockRejectedValue(error);

      await expect(validateAppDirectoryNotExists(appPath, 'test-app', 'builder')).rejects.toThrow('Permission denied');
    });

    it('should use custom baseDir in error message', async() => {
      const appPath = '/path/to/integration/test-app';
      fs.access.mockResolvedValue();

      await expect(validateAppDirectoryNotExists(appPath, 'test-app', 'integration')).rejects.toThrow(
        'Application \'test-app\' already exists in integration/test-app/'
      );
    });
  });

  describe('getBaseDirForAppType', () => {
    it('should return integration for external type', () => {
      expect(getBaseDirForAppType('external')).toBe('integration');
    });

    it('should return builder for non-external types', () => {
      expect(getBaseDirForAppType('webapp')).toBe('builder');
      expect(getBaseDirForAppType('api')).toBe('builder');
      expect(getBaseDirForAppType('')).toBe('builder');
    });
  });

  describe('handleGitHubWorkflows', () => {
    it('should not generate workflows if github option is not set', async() => {
      const options = {};
      const config = {};

      await handleGitHubWorkflows(options, config);

      expect(generateGithubWorkflows).not.toHaveBeenCalled();
    });

    it('should generate workflows when github option is set', async() => {
      const options = { github: true, mainBranch: 'main' };
      const config = { key: 'test-app' };
      generateGithubWorkflows.mockResolvedValue(['.github/workflows/ci.yml']);

      await handleGitHubWorkflows(options, config);

      expect(generateGithubWorkflows).toHaveBeenCalledWith(
        process.cwd(),
        config,
        {
          mainBranch: 'main',
          uploadCoverage: true,
          githubSteps: []
        }
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Generated GitHub Actions workflows'));
    });

    it('should parse github-steps option', async() => {
      const options = {
        github: true,
        githubSteps: 'build, test, deploy'
      };
      const config = { key: 'test-app' };
      generateGithubWorkflows.mockResolvedValue(['.github/workflows/ci.yml']);

      await handleGitHubWorkflows(options, config);

      expect(generateGithubWorkflows).toHaveBeenCalledWith(
        process.cwd(),
        config,
        expect.objectContaining({
          githubSteps: ['build', 'test', 'deploy']
        })
      );
    });

    it('should filter empty github-steps', async() => {
      const options = {
        github: true,
        githubSteps: 'build, , test,  , deploy'
      };
      const config = { key: 'test-app' };
      generateGithubWorkflows.mockResolvedValue(['.github/workflows/ci.yml']);

      await handleGitHubWorkflows(options, config);

      expect(generateGithubWorkflows).toHaveBeenCalledWith(
        process.cwd(),
        config,
        expect.objectContaining({
          githubSteps: ['build', 'test', 'deploy']
        })
      );
    });

    it('should use default mainBranch when not provided', async() => {
      const options = { github: true };
      const config = { key: 'test-app' };
      generateGithubWorkflows.mockResolvedValue(['.github/workflows/ci.yml']);

      await handleGitHubWorkflows(options, config);

      expect(generateGithubWorkflows).toHaveBeenCalledWith(
        process.cwd(),
        config,
        expect.objectContaining({
          mainBranch: 'main'
        })
      );
    });
  });

  describe('validateAppCreation', () => {
    it('should validate app name and directory', async() => {
      const appName = 'test-app';
      const options = {};
      const appPath = '/path/to/builder/test-app';
      validateAppName.mockReturnValue();
      fs.access.mockRejectedValue({ code: 'ENOENT' });

      await validateAppCreation(appName, options, appPath, 'builder');

      expect(validateAppName).toHaveBeenCalledWith(appName);
    });

    it('should validate apps directory when app option is set', async() => {
      const appName = 'test-app';
      const options = { app: true };
      const appPath = '/path/to/builder/test-app';
      const appsPath = path.join(process.cwd(), 'apps', appName);
      validateAppName.mockReturnValue();
      fs.access.mockRejectedValue({ code: 'ENOENT' });

      await validateAppCreation(appName, options, appPath, 'builder');

      expect(fs.access).toHaveBeenCalledWith(appsPath);
    });

    it('should throw error if apps directory exists', async() => {
      const appName = 'test-app';
      const options = { app: true };
      const appPath = '/path/to/builder/test-app';
      validateAppName.mockReturnValue();
      fs.access
        .mockRejectedValueOnce({ code: 'ENOENT' })
        .mockRejectedValueOnce({ code: 'ENOENT' })
        .mockRejectedValueOnce({ code: 'ENOENT' })
        .mockResolvedValueOnce();

      await expect(validateAppCreation(appName, options, appPath, 'builder')).rejects.toThrow(
        'Application \'test-app\' already exists in apps/test-app/'
      );
    });

    it('should not validate apps directory when app option is not set', async() => {
      const appName = 'test-app';
      const options = {};
      const appPath = '/path/to/builder/test-app';
      validateAppName.mockReturnValue();
      fs.access.mockRejectedValue({ code: 'ENOENT' });

      await validateAppCreation(appName, options, appPath, 'builder');

      expect(fs.access).toHaveBeenCalledTimes(3);
    });
  });

  describe('processTemplateFiles', () => {
    it('should not process if template is not provided', async() => {
      await processTemplateFiles(null, '/path/to/app', 'test-app', {}, {});

      expect(validateTemplate).not.toHaveBeenCalled();
      expect(copyTemplateFiles).not.toHaveBeenCalled();
    });

    it('should process template files', async() => {
      const template = 'test-template';
      const appPath = '/path/to/app';
      const appName = 'test-app';
      const options = {};
      const config = { key: 'test-app' };
      copyTemplateFiles.mockResolvedValue(['file1.yaml', 'file2.yaml']);
      updateTemplateVariables.mockResolvedValue();

      await processTemplateFiles(template, appPath, appName, options, config);

      expect(validateTemplate).toHaveBeenCalledWith(template);
      expect(copyTemplateFiles).toHaveBeenCalledWith(template, appPath);
      expect(updateTemplateVariables).toHaveBeenCalledWith(appPath, appName, options, config);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Copied 2 file(s) from template \'test-template\''));
    });
  });

  describe('updateVariablesForAppFlag', () => {
    it('should update application.yaml with build context and envOutputPath', async() => {
      const appPath = '/path/to/app';
      const appName = 'test-app';
      const variablesPath = path.join(appPath, 'application.yaml');
      const existingVariables = {
        app: { key: 'test-app' },
        build: { language: 'typescript' }
      };
      configFormat.loadConfigFile.mockReturnValue(existingVariables);
      configFormat.writeConfigFile.mockImplementation(() => {});

      await updateVariablesForAppFlag(appPath, appName);

      expect(configFormat.loadConfigFile).toHaveBeenCalledWith(variablesPath);
      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(variablesPath, expect.objectContaining({
        build: expect.objectContaining({
          context: '../..',
          envOutputPath: '../../apps/test-app/.env',
          language: 'typescript'
        })
      }));
    });

    it('should create build object if it does not exist', async() => {
      const appPath = '/path/to/app';
      const appName = 'test-app';
      const variablesPath = path.join(appPath, 'application.yaml');
      configFormat.loadConfigFile.mockReturnValue({ app: { key: 'test-app' } });
      configFormat.writeConfigFile.mockImplementation(() => {});

      await updateVariablesForAppFlag(appPath, appName);

      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(variablesPath, expect.objectContaining({
        build: { context: '../..', envOutputPath: '../../apps/test-app/.env' }
      }));
    });

    it('should handle errors gracefully', async() => {
      const appPath = '/path/to/app';
      const appName = 'test-app';
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await updateVariablesForAppFlag(appPath, appName);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not update application config'));
    });
  });

  describe('getLanguageForAppFiles', () => {
    it('should return language from parameter if provided', async() => {
      const language = 'typescript';
      const appPath = '/path/to/app';

      const result = await getLanguageForAppFiles(language, appPath);

      expect(result).toBe('typescript');
      expect(configFormat.loadConfigFile).not.toHaveBeenCalled();
    });

    it('should read language from application.yaml if not provided', async() => {
      const language = null;
      const appPath = '/path/to/app';
      const variablesPath = path.join(appPath, 'application.yaml');
      configFormat.loadConfigFile.mockReturnValue({ build: { language: 'python' } });

      const result = await getLanguageForAppFiles(language, appPath);

      expect(result).toBe('python');
      expect(configFormat.loadConfigFile).toHaveBeenCalledWith(variablesPath);
    });

    it('should throw error if language cannot be determined', async() => {
      const language = null;
      const appPath = '/path/to/app';
      const variablesPath = path.join(appPath, 'application.yaml');
      configFormat.loadConfigFile.mockReturnValue({ app: { key: 'test-app' } });

      await expect(getLanguageForAppFiles(language, appPath)).rejects.toThrow(
        'Language not specified and could not be determined from application.yaml'
      );
    });
  });

  describe('setupAppFiles', () => {
    it('should setup apps directory and copy files', async() => {
      const appName = 'test-app';
      const appPath = '/path/to/builder/test-app';
      const config = { language: 'typescript' };
      const options = {};
      const appsPath = path.join(process.cwd(), 'apps', appName);

      configFormat.loadConfigFile.mockReturnValue({ build: { language: 'typescript' } });
      configFormat.writeConfigFile.mockImplementation(() => {});
      fs.mkdir.mockResolvedValue();
      copyAppFiles.mockResolvedValue(['app.ts', 'package.json']);

      await setupAppFiles(appName, appPath, config, options);

      expect(fs.mkdir).toHaveBeenCalledWith(appsPath, { recursive: true });
      expect(copyAppFiles).toHaveBeenCalledWith('typescript', appsPath);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Copied 2 application file(s) to apps/test-app/'));
    });

    it('should use language from options if not in config', async() => {
      const appName = 'test-app';
      const appPath = '/path/to/builder/test-app';
      const config = {};
      const options = { language: 'python' };
      const appsPath = path.join(process.cwd(), 'apps', appName);

      configFormat.loadConfigFile.mockReturnValue({ build: { language: 'python' } });
      configFormat.writeConfigFile.mockImplementation(() => {});
      fs.mkdir.mockResolvedValue();
      copyAppFiles.mockResolvedValue(['app.py', 'requirements.txt']);

      await setupAppFiles(appName, appPath, config, options);

      expect(copyAppFiles).toHaveBeenCalledWith('python', appsPath);
    });
  });
});

