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

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../../lib/utils/logger');
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

    it('should load template variables from variables.yaml', async() => {
      const templateName = 'test-template';
      const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'applications', templateName);
      const templateVariablesPath = path.join(templatePath, 'variables.yaml');
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
      const templateVariablesPath = path.join(templatePath, 'variables.yaml');
      const invalidContent = 'invalid: yaml: content: [';
      const error = new Error('YAML parse error');
      error.code = 'YAML_PARSE_ERROR';
      fs.readFile = jest.fn().mockRejectedValue(error);

      const result = await loadTemplateVariables(templateName);

      expect(fs.readFile).toHaveBeenCalledWith(templateVariablesPath, 'utf8');
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not load template variables.yaml'));
    });
  });

  describe('updateTemplateVariables', () => {
    const appPath = '/test/app/path';
    const appName = 'test-app';
    const variablesPath = path.join(appPath, 'variables.yaml');

    it('should update app metadata in variables', async() => {
      const initialContent = 'app:\n  key: old-key\n  displayName: Old Display Name\nport: 3000';
      const variables = yaml.load(initialContent);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateTemplateVariables(appPath, appName, {}, {});

      expect(fs.readFile).toHaveBeenCalledWith(variablesPath, 'utf8');
      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][0];
      expect(writtenContent).toBe(variablesPath);
      const writtenYaml = fs.writeFile.mock.calls[0][1];
      const writtenVariables = yaml.load(writtenYaml);
      expect(writtenVariables.app.key).toBe(appName);
    });

    it('should update displayName if it contains "miso"', async() => {
      const initialContent = 'app:\n  key: old-key\n  displayName: MISO Application\nport: 3000';
      const variables = yaml.load(initialContent);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateTemplateVariables(appPath, appName, {}, {});

      const writtenYaml = fs.writeFile.mock.calls[0][1];
      const writtenVariables = yaml.load(writtenYaml);
      expect(writtenVariables.app.displayName).toBe('Test App');
    });

    it('should update port if provided in options and config', async() => {
      const initialContent = 'port: 3000';
      const options = { port: 8080 };
      const config = { port: 8080 };
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateTemplateVariables(appPath, appName, options, config);

      const writtenYaml = fs.writeFile.mock.calls[0][1];
      const writtenVariables = yaml.load(writtenYaml);
      expect(writtenVariables.port).toBe(8080);
    });

    it('should not update port if not provided in options', async() => {
      const initialContent = 'port: 3000';
      const options = {};
      const config = {};
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateTemplateVariables(appPath, appName, options, config);

      const writtenYaml = fs.writeFile.mock.calls[0][1];
      const writtenVariables = yaml.load(writtenYaml);
      expect(writtenVariables.port).toBe(3000);
    });

    it('should nullify build.envOutputPath', async() => {
      const initialContent = 'build:\n  envOutputPath: ./env\nport: 3000';
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateTemplateVariables(appPath, appName, {}, {});

      const writtenYaml = fs.writeFile.mock.calls[0][1];
      const writtenVariables = yaml.load(writtenYaml);
      expect(writtenVariables.build.envOutputPath).toBeNull();
    });

    it('should update database config when --app flag is set', async() => {
      const initialContent = 'requires:\n  database: true\nport: 3000';
      const options = { app: true };
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateTemplateVariables(appPath, appName, options, {});

      const writtenYaml = fs.writeFile.mock.calls[0][1];
      const writtenVariables = yaml.load(writtenYaml);
      expect(writtenVariables.requires.databases).toEqual([{ name: appName }]);
    });

    it('should not update database config when --app flag is not set', async() => {
      const initialContent = 'requires:\n  database: true\nport: 3000';
      const options = {};
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateTemplateVariables(appPath, appName, options, {});

      const writtenYaml = fs.writeFile.mock.calls[0][1];
      const writtenVariables = yaml.load(writtenYaml);
      expect(writtenVariables.requires.databases).toBeUndefined();
    });

    it('should handle missing variables.yaml gracefully', async() => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile = jest.fn().mockRejectedValue(error);

      await updateTemplateVariables(appPath, appName, {}, {});

      expect(logger.warn).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should warn on other errors when updating variables', async() => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.readFile = jest.fn().mockRejectedValue(error);

      await updateTemplateVariables(appPath, appName, {}, {});

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not update variables.yaml'));
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

