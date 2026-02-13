/**
 * Tests for Template Helpers Module
 *
 * @fileoverview Unit tests for lib/utils/template-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((appPath) => require('path').join(appPath, 'application.yaml'))
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../../lib/utils/logger');
const configFormat = require('../../../lib/utils/config-format');
const {
  loadTemplateVariables,
  updateTemplateVariables,
  mergeTemplateVariables
} = require('../../../lib/utils/template-helpers');

describe('Template Helpers Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadTemplateVariables', () => {
    it('should return null if templateName is not provided', async() => {
      const result = await loadTemplateVariables(null);
      expect(result).toBeNull();
    });

    it('should return null if templateName is empty string', async() => {
      const result = await loadTemplateVariables('');
      expect(result).toBeNull();
    });

    it('should load template variables from application.yaml', async() => {
      const templateName = 'test-template';
      const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'applications', templateName);
      const templateVariablesPath = path.join(templatePath, 'application.yaml');
      const templateContent = 'app:\n  key: test-app\n  displayName: Test App\nport: 3000';
      const expectedVariables = yaml.load(templateContent);

      fs.readFile = jest.fn().mockResolvedValue(templateContent);

      const result = await loadTemplateVariables(templateName);

      expect(fs.readFile).toHaveBeenCalledWith(templateVariablesPath, 'utf8');
      expect(result).toEqual(expectedVariables);
    });

    it('should return null if template file does not exist', async() => {
      const templateName = 'non-existent-template';
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile = jest.fn().mockRejectedValue(error);

      const result = await loadTemplateVariables(templateName);

      expect(result).toBeNull();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn and return null if template file has invalid YAML', async() => {
      const templateName = 'invalid-template';
      const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'applications', templateName);
      const templateVariablesPath = path.join(templatePath, 'application.yaml');
      const invalidContent = 'invalid: yaml: content: [';
      const error = new Error('YAML parse error');
      error.code = 'YAML_PARSE_ERROR';
      fs.readFile = jest.fn().mockRejectedValue(error);

      const result = await loadTemplateVariables(templateName);

      expect(fs.readFile).toHaveBeenCalledWith(templateVariablesPath, 'utf8');
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not load template application.yaml'));
    });
  });

  describe('updateTemplateVariables', () => {
    const appPath = '/test/app/path';
    const appName = 'test-app';
    const configPath = path.join(appPath, 'application.yaml');

    beforeEach(() => {
      configFormat.writeConfigFile.mockClear();
      configFormat.loadConfigFile.mockReset();
    });

    it('should update app metadata in variables', async() => {
      const initialVariables = { app: { key: 'old-key', displayName: 'Old Display Name' }, port: 3000 };
      configFormat.loadConfigFile.mockReturnValue(initialVariables);

      await updateTemplateVariables(appPath, appName, {}, {});

      expect(configFormat.writeConfigFile).toHaveBeenCalled();
      const [, writtenVariables] = configFormat.writeConfigFile.mock.calls[0];
      expect(writtenVariables.app.key).toBe(appName);
    });

    it('should update displayName if it contains "miso"', async() => {
      const initialVariables = { app: { key: 'old-key', displayName: 'MISO Application' }, port: 3000 };
      configFormat.loadConfigFile.mockReturnValue(initialVariables);

      await updateTemplateVariables(appPath, appName, {}, {});

      const [, writtenVariables] = configFormat.writeConfigFile.mock.calls[0];
      expect(writtenVariables.app.displayName).toBe('Test App');
    });

    it('should update port if provided in options and config', async() => {
      configFormat.loadConfigFile.mockReturnValue({ port: 3000 });
      const options = { port: 8080 };
      const config = { port: 8080 };

      await updateTemplateVariables(appPath, appName, options, config);

      const [, writtenVariables] = configFormat.writeConfigFile.mock.calls[0];
      expect(writtenVariables.port).toBe(8080);
    });

    it('should not update port if not provided in options', async() => {
      configFormat.loadConfigFile.mockReturnValue({ port: 3000 });

      await updateTemplateVariables(appPath, appName, {}, {});

      const [, writtenVariables] = configFormat.writeConfigFile.mock.calls[0];
      expect(writtenVariables.port).toBe(3000);
    });

    it('should nullify build.envOutputPath', async() => {
      configFormat.loadConfigFile.mockReturnValue({ build: { envOutputPath: './env' }, port: 3000 });

      await updateTemplateVariables(appPath, appName, {}, {});

      const [, writtenVariables] = configFormat.writeConfigFile.mock.calls[0];
      expect(writtenVariables.build.envOutputPath).toBeNull();
    });

    it('should update database config when --app flag is set', async() => {
      configFormat.loadConfigFile.mockReturnValue({ requires: { database: true }, port: 3000 });
      const options = { app: true };

      await updateTemplateVariables(appPath, appName, options, {});

      const [, writtenVariables] = configFormat.writeConfigFile.mock.calls[0];
      expect(writtenVariables.requires.databases).toEqual([{ name: appName }]);
    });

    it('should not update database config when --app flag is not set', async() => {
      configFormat.loadConfigFile.mockReturnValue({ requires: { database: true }, port: 3000 });

      await updateTemplateVariables(appPath, appName, {}, {});

      const [, writtenVariables] = configFormat.writeConfigFile.mock.calls[0];
      expect(writtenVariables.requires.databases).toBeUndefined();
    });

    it('should handle missing application config gracefully', async() => {
      const appConfigResolver = require('../../../lib/utils/app-config-resolver');
      appConfigResolver.resolveApplicationConfigPath.mockImplementationOnce(() => {
        throw new Error('Application config not found');
      });

      await updateTemplateVariables(appPath, appName, {}, {});

      expect(logger.warn).not.toHaveBeenCalled();
      expect(configFormat.writeConfigFile).not.toHaveBeenCalled();
    });

    it('should warn on other errors when updating variables', async() => {
      configFormat.loadConfigFile.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      await updateTemplateVariables(appPath, appName, {}, {});

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not update application config'));
    });
  });

  describe('mergeTemplateVariables', () => {
    it('should return options unchanged if templateVariables is null', () => {
      const options = { port: 3000, language: 'typescript' };
      const result = mergeTemplateVariables(options, null);
      expect(result).toEqual(options);
    });

    it('should return options unchanged if templateVariables is undefined', () => {
      const options = { port: 3000, language: 'typescript' };
      const result = mergeTemplateVariables(options, undefined);
      expect(result).toEqual(options);
    });

    it('should merge port from template if not in options', () => {
      const options = { language: 'typescript' };
      const templateVariables = { port: 8080 };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.port).toBe(8080);
    });

    it('should not override port if already in options', () => {
      const options = { port: 3000 };
      const templateVariables = { port: 8080 };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.port).toBe(3000);
    });

    it('should merge language from template build config if not in options', () => {
      const options = { port: 3000 };
      const templateVariables = { build: { language: 'python' } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.language).toBe('python');
    });

    it('should not override language if already in options', () => {
      const options = { language: 'typescript' };
      const templateVariables = { build: { language: 'python' } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.language).toBe('typescript');
    });

    it('should merge database requirement from template if not in options', () => {
      const options = { port: 3000 };
      const templateVariables = { requires: { database: true } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.database).toBe(true);
    });

    it('should merge redis requirement from template if not in options', () => {
      const options = { port: 3000 };
      const templateVariables = { requires: { redis: true } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.redis).toBe(true);
    });

    it('should merge storage requirement from template if not in options', () => {
      const options = { port: 3000 };
      const templateVariables = { requires: { storage: true } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.storage).toBe(true);
    });

    it('should not override database if already in options', () => {
      const options = { database: false };
      const templateVariables = { requires: { database: true } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.database).toBe(false);
    });

    it('should merge authentication from template if not in options', () => {
      const options = { port: 3000 };
      const templateVariables = { authentication: { type: 'azure' } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.authentication).toBe(true);
    });

    it('should convert authentication object to boolean', () => {
      const options = { port: 3000 };
      const templateVariables = { authentication: false };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.authentication).toBe(false);
    });

    it('should not override authentication if already in options', () => {
      const options = { authentication: false };
      const templateVariables = { authentication: { type: 'azure' } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.authentication).toBe(false);
    });

    it('should merge all template variables correctly', () => {
      const options = {};
      const templateVariables = {
        port: 8080,
        build: { language: 'python' },
        requires: {
          database: true,
          redis: false,
          storage: true
        },
        authentication: { type: 'azure' }
      };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.port).toBe(8080);
      expect(result.language).toBe('python');
      expect(result.database).toBe(true);
      expect(result.redis).toBe(false);
      expect(result.storage).toBe(true);
      expect(result.authentication).toBe(true);
    });

    it('should preserve existing options when merging', () => {
      const options = { port: 3000, customOption: 'value' };
      const templateVariables = { build: { language: 'python' } };
      const result = mergeTemplateVariables(options, templateVariables);
      expect(result.port).toBe(3000);
      expect(result.customOption).toBe('value');
      expect(result.language).toBe('python');
    });
  });
});

