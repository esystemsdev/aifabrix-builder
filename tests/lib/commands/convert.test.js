/**
 * Tests for convert command (lib/commands/convert.js)
 * @fileoverview Unit tests for config format conversion (JSON/YAML)
 */

const path = require('path');
const fs = require('fs');

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn()
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));
jest.mock('../../../lib/validation/validate', () => ({
  validateAppOrFile: jest.fn(),
  displayValidationResults: jest.fn()
}));

const readline = require('readline');
jest.mock('readline', () => ({
  createInterface: jest.fn()
}));

const paths = require('../../../lib/utils/paths');
const appConfigResolver = require('../../../lib/utils/app-config-resolver');
const configFormat = require('../../../lib/utils/config-format');
const validate = require('../../../lib/validation/validate');
const convert = require('../../../lib/commands/convert');

describe('convert command', () => {
  const appPath = path.join(process.cwd(), 'integration', 'hubspot');
  const configPath = path.join(appPath, 'application.yaml');
  const schemaBasePath = appPath;

  beforeEach(() => {
    jest.clearAllMocks();
    paths.detectAppType.mockResolvedValue({ appPath, appType: 'external' });
    appConfigResolver.resolveApplicationConfigPath.mockReturnValue(configPath);
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.unlinkSync = jest.fn();
  });

  describe('runConvert', () => {
    it('throws when format is missing or invalid', async() => {
      configFormat.loadConfigFile.mockReturnValue({});
      validate.validateAppOrFile.mockResolvedValue({ valid: true });

      await expect(convert.runConvert('hubspot', {})).rejects.toThrow(
        /Option --format is required and must be 'json' or 'yaml'/
      );
      await expect(convert.runConvert('hubspot', { format: 'xml' })).rejects.toThrow(
        /Option --format is required and must be 'json' or 'yaml'/
      );
    });

    it('throws when validation fails', async() => {
      configFormat.loadConfigFile.mockReturnValue({ externalIntegration: { schemaBasePath: './', systems: [], dataSources: [] } });
      validate.validateAppOrFile.mockResolvedValue({ valid: false });
      validate.displayValidationResults.mockImplementation(() => {});

      await expect(convert.runConvert('hubspot', { format: 'yaml' })).rejects.toThrow(
        'Validation failed. Fix errors before converting.'
      );
    });

    it('uses same validation as validate command (validateAppOrFile with app name and options)', async() => {
      const variables = { externalIntegration: { schemaBasePath: './', systems: [], dataSources: [] } };
      configFormat.loadConfigFile.mockReturnValue(variables);
      validate.validateAppOrFile.mockResolvedValue({ valid: true });

      await convert.runConvert('avoma', { format: 'json', force: true });

      expect(validate.validateAppOrFile).toHaveBeenCalledWith('avoma', { format: 'json', force: true });
    });

    it('throws when user cancels prompt (no --force)', async() => {
      configFormat.loadConfigFile.mockReturnValue({
        externalIntegration: { schemaBasePath: './', systems: [], dataSources: [] }
      });
      validate.validateAppOrFile.mockResolvedValue({ valid: true });

      const rl = { question: jest.fn((msg, cb) => cb('n')), close: jest.fn() };
      readline.createInterface.mockReturnValue(rl);

      await expect(convert.runConvert('hubspot', { format: 'yaml' })).rejects.toThrow('Convert cancelled.');
      expect(rl.close).toHaveBeenCalled();
    });

    it('converts application config only when no external integration (--force)', async() => {
      const variables = { app: { key: 'hubspot' } };
      configFormat.loadConfigFile.mockImplementation((p) => {
        if (p === configPath) return variables;
        return {};
      });
      validate.validateAppOrFile.mockResolvedValue({ valid: true });

      const result = await convert.runConvert('hubspot', { format: 'json', force: true });

      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'application.json'),
        variables,
        'json'
      );
      expect(result.converted).toContain(path.join(appPath, 'application.json'));
      expect(result.deleted).toContain(configPath);
    });

    it('converts system and datasource files and updates app config links (--force)', async() => {
      const systemPath = path.join(appPath, 'hubspot-system.json');
      const dsPath = path.join(appPath, 'hubspot-datasource-company.json');
      const variables = {
        app: { key: 'hubspot' },
        externalIntegration: {
          schemaBasePath: './',
          systems: ['hubspot-system.json'],
          dataSources: ['hubspot-datasource-company.json']
        }
      };
      configFormat.loadConfigFile.mockImplementation((p) => {
        if (p === configPath) return variables;
        if (p === systemPath) return { key: 'hubspot', displayName: 'HubSpot' };
        if (p === dsPath) return { key: 'company', entityType: 'company' };
        return {};
      });
      validate.validateAppOrFile.mockResolvedValue({ valid: true });
      fs.existsSync.mockImplementation((p) => {
        return p === configPath || p === systemPath || p === dsPath;
      });

      const result = await convert.runConvert('hubspot', { format: 'yaml', force: true });

      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-system.yaml'),
        { key: 'hubspot', displayName: 'HubSpot' },
        'yaml'
      );
      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-datasource-company.yaml'),
        { key: 'company', entityType: 'company' },
        'yaml'
      );
      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'application.yaml'),
        expect.objectContaining({
          externalIntegration: expect.objectContaining({
            systems: ['hubspot-system.yaml'],
            dataSources: ['hubspot-datasource-company.yaml']
          })
        }),
        'yaml'
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(systemPath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(dsPath);
      expect(result.converted.length).toBe(3);
      expect(result.deleted.length).toBe(2);
    });

    it('skips missing system/datasource files and keeps original name in links', async() => {
      const variables = {
        app: { key: 'hubspot' },
        externalIntegration: {
          schemaBasePath: './',
          systems: ['hubspot-system.json'],
          dataSources: ['hubspot-datasource-missing.json']
        }
      };
      configFormat.loadConfigFile.mockImplementation((p) => {
        if (p === configPath) return variables;
        if (p === path.join(appPath, 'hubspot-system.json')) return { key: 'hubspot' };
        return {};
      });
      validate.validateAppOrFile.mockResolvedValue({ valid: true });
      fs.existsSync.mockImplementation((p) => {
        return p === configPath || p === path.join(appPath, 'hubspot-system.json');
      });

      const result = await convert.runConvert('hubspot', { format: 'yaml', force: true });

      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'application.yaml'),
        expect.objectContaining({
          externalIntegration: expect.objectContaining({
            systems: ['hubspot-system.yaml'],
            dataSources: ['hubspot-datasource-missing.json']
          })
        }),
        'yaml'
      );
      expect(result.converted).toHaveLength(2);
      expect(result.deleted).toHaveLength(1);
    });

    it('proceeds when user confirms with y (no --force)', async() => {
      const variables = { app: { key: 'hubspot' } };
      configFormat.loadConfigFile.mockReturnValue(variables);
      validate.validateAppOrFile.mockResolvedValue({ valid: true });
      const rl = { question: jest.fn((msg, cb) => cb('y')), close: jest.fn() };
      readline.createInterface.mockReturnValue(rl);

      const result = await convert.runConvert('hubspot', { format: 'json' });

      expect(rl.close).toHaveBeenCalled();
      expect(result.converted).toContain(path.join(appPath, 'application.json'));
      expect(result.deleted).toContain(configPath);
    });

    it('proceeds when user confirms with yes (no --force)', async() => {
      const variables = { app: { key: 'hubspot' } };
      configFormat.loadConfigFile.mockReturnValue(variables);
      validate.validateAppOrFile.mockResolvedValue({ valid: true });
      const rl = { question: jest.fn((msg, cb) => cb('  yes  ')), close: jest.fn() };
      readline.createInterface.mockReturnValue(rl);

      const result = await convert.runConvert('hubspot', { format: 'json' });

      expect(result.converted).toContain(path.join(appPath, 'application.json'));
    });

    it('does not call readline when --force', async() => {
      const variables = { app: { key: 'hubspot' } };
      configFormat.loadConfigFile.mockReturnValue(variables);
      validate.validateAppOrFile.mockResolvedValue({ valid: true });

      await convert.runConvert('hubspot', { format: 'json', force: true });

      expect(readline.createInterface).not.toHaveBeenCalled();
    });

    it('throws when app is not found (detectAppType rejects)', async() => {
      paths.detectAppType.mockRejectedValue(new Error('App \'foo\' not found'));

      await expect(convert.runConvert('foo', { format: 'yaml' })).rejects.toThrow(/not found/);
      expect(configFormat.loadConfigFile).not.toHaveBeenCalled();
    });

    it('throws when application config cannot be loaded', async() => {
      appConfigResolver.resolveApplicationConfigPath.mockReturnValue(configPath);
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('Config file not found');
      });

      await expect(convert.runConvert('hubspot', { format: 'yaml', force: true })).rejects.toThrow(
        'Config file not found'
      );
    });

    it('converts only application config when externalIntegration has empty systems and dataSources', async() => {
      const variables = {
        app: { key: 'hubspot' },
        externalIntegration: { schemaBasePath: './', systems: [], dataSources: [] }
      };
      configFormat.loadConfigFile.mockReturnValue(variables);
      validate.validateAppOrFile.mockResolvedValue({ valid: true });

      const result = await convert.runConvert('hubspot', { format: 'json', force: true });

      expect(configFormat.writeConfigFile).toHaveBeenCalledTimes(1);
      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'application.json'),
        expect.objectContaining({
          app: { key: 'hubspot' },
          externalIntegration: expect.objectContaining({ systems: [], dataSources: [] })
        }),
        'json'
      );
      expect(result.converted).toHaveLength(1);
      expect(result.deleted).toContain(configPath);
    });

    it('converts application.json to application.yaml and deletes old json config', async() => {
      const jsonConfigPath = path.join(appPath, 'application.json');
      appConfigResolver.resolveApplicationConfigPath.mockReturnValue(jsonConfigPath);
      const variables = { app: { key: 'hubspot' } };
      configFormat.loadConfigFile.mockReturnValue(variables);
      validate.validateAppOrFile.mockResolvedValue({ valid: true });
      fs.existsSync.mockReturnValue(true);

      const result = await convert.runConvert('hubspot', { format: 'yaml', force: true });

      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'application.yaml'),
        variables,
        'yaml'
      );
      expect(result.converted).toContain(path.join(appPath, 'application.yaml'));
      expect(result.deleted).toContain(jsonConfigPath);
    });
  });

  describe('targetFileName', () => {
    it('returns basename with .yaml for format yaml', () => {
      expect(convert.targetFileName('/dir/hubspot-system.json', 'yaml')).toBe('hubspot-system.yaml');
      expect(convert.targetFileName('/dir/application.yaml', 'yaml')).toBe('application.yaml');
    });

    it('returns basename with .json for format json', () => {
      expect(convert.targetFileName('/dir/hubspot-system.yaml', 'json')).toBe('hubspot-system.json');
      expect(convert.targetFileName('/dir/application.json', 'json')).toBe('application.json');
    });
  });

  describe('convertOneFile', () => {
    it('loads source and writes to target with given format', () => {
      configFormat.loadConfigFile.mockReturnValue({ key: 'test' });
      convert.convertOneFile('/a/sys.json', '/a/sys.yaml', 'yaml');
      expect(configFormat.loadConfigFile).toHaveBeenCalledWith('/a/sys.json');
      expect(configFormat.writeConfigFile).toHaveBeenCalledWith('/a/sys.yaml', { key: 'test' }, 'yaml');
    });

    it('propagates error when loadConfigFile throws', () => {
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('Invalid YAML syntax');
      });
      expect(() => convert.convertOneFile('/a/sys.json', '/a/sys.yaml', 'yaml')).toThrow('Invalid YAML syntax');
    });
  });

  describe('promptConfirm', () => {
    it('resolves true when user answers y', async() => {
      const rl = { question: jest.fn((msg, cb) => cb('y')), close: jest.fn() };
      readline.createInterface.mockReturnValue(rl);

      const result = await convert.promptConfirm('Continue? ');

      expect(result).toBe(true);
      expect(rl.close).toHaveBeenCalled();
    });

    it('resolves true when user answers yes', async() => {
      const rl = { question: jest.fn((msg, cb) => cb('yes')), close: jest.fn() };
      readline.createInterface.mockReturnValue(rl);

      const result = await convert.promptConfirm('Continue? ');

      expect(result).toBe(true);
    });

    it('resolves false when user answers n', async() => {
      const rl = { question: jest.fn((msg, cb) => cb('n')), close: jest.fn() };
      readline.createInterface.mockReturnValue(rl);

      const result = await convert.promptConfirm('Continue? ');

      expect(result).toBe(false);
    });

    it('resolves false when user input is empty or unknown', async() => {
      const rl1 = { question: jest.fn((msg, cb) => cb('')), close: jest.fn() };
      readline.createInterface.mockReturnValue(rl1);
      expect(await convert.promptConfirm('?')).toBe(false);

      readline.createInterface.mockReturnValue({ question: jest.fn((msg, cb) => cb('no')), close: jest.fn() });
      expect(await convert.promptConfirm('?')).toBe(false);
    });
  });
});
