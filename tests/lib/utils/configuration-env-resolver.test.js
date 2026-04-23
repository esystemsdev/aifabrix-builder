/**
 * Tests for configuration-env-resolver (upload resolution and download re-templating).
 *
 * @fileoverview Tests for lib/utils/configuration-env-resolver.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((key) => `/integration/${key}`)
}));
jest.mock('../../../lib/utils/credential-secrets-env', () => ({
  parseEnvToMap: jest.requireActual('../../../lib/utils/credential-secrets-env').parseEnvToMap,
  resolveKvValue: jest.requireActual('../../../lib/utils/credential-secrets-env').resolveKvValue
}));
jest.mock('../../../lib/core/secrets', () => ({
  loadSecrets: jest.fn().mockResolvedValue({}),
  resolveKvReferences: jest.fn().mockResolvedValue('RESOLVED=value\n')
}));
jest.mock('../../../lib/utils/secrets-helpers', () => ({
  loadEnvTemplate: jest.fn().mockReturnValue('KEY=value\n')
}));
jest.mock('../../../lib/utils/secrets-path', () => ({
  getActualSecretsPath: jest.fn().mockResolvedValue({ userPath: '/secrets', buildPath: null })
}));

const {
  buildResolvedEnvMapForIntegration,
  resolveConfigurationValues,
  getEnvTemplateVariableNames,
  retemplateConfigurationFromEnvTemplate,
  retemplateConfigurationForDownload,
  substituteVarPlaceholders
} = require('../../../lib/utils/configuration-env-resolver');
const { getIntegrationPath } = require('../../../lib/utils/paths');
const { loadSecrets, resolveKvReferences } = require('../../../lib/core/secrets');
const { loadEnvTemplate } = require('../../../lib/utils/secrets-helpers');

describe('configuration-env-resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIntegrationPath.mockImplementation((key) => path.join('/integration', key));
    loadSecrets.mockResolvedValue({});
    resolveKvReferences.mockResolvedValue('A=1\nB=2\n');
    loadEnvTemplate.mockReturnValue('A=1\nB=2\n');
  });

  describe('substituteVarPlaceholders', () => {
    it('should replace {{VAR}} with envMap value', () => {
      expect(substituteVarPlaceholders('id={{SITE_ID}}', { SITE_ID: '123' })).toBe('id=123');
    });
    it('should replace multiple placeholders', () => {
      expect(substituteVarPlaceholders('{{A}}-{{B}}', { A: 'x', B: 'y' })).toBe('x-y');
    });
    it('should throw when variable is missing', () => {
      expect(() => substituteVarPlaceholders('{{MISSING}}', {})).toThrow('Missing configuration env var: MISSING');
    });
    it('should include systemKey hint in error when provided', () => {
      expect(() => substituteVarPlaceholders('{{X}}', {}, 'my-app')).toThrow('Run \'aifabrix resolve my-app\'');
    });
    it('should throw when placeholder contains only whitespace (missing from envMap)', () => {
      expect(() => substituteVarPlaceholders('{{  }}', {})).toThrow('Missing configuration env var');
    });
  });

  describe('resolveConfigurationValues', () => {
    it('should resolve variable location from envMap', () => {
      const config = [{ name: 'SITE_ID', value: '{{SITE_ID}}', location: 'variable' }];
      resolveConfigurationValues(config, { SITE_ID: '123' }, {}, 'my-app');
      expect(config[0].value).toBe('123');
    });
    it('should leave keyvault kv:// reference unchanged (secret pushed separately)', () => {
      const config = [{ name: 'SECRET', value: 'kv://secrets/foo', location: 'keyvault' }];
      resolveConfigurationValues(config, {}, { 'secrets/foo': 'secret-val' }, 'my-app');
      expect(config[0].value).toBe('kv://secrets/foo');
    });
    it('should throw for variable location when env var missing', () => {
      const config = [{ name: 'X', value: '{{X}}', location: 'variable' }];
      expect(() => resolveConfigurationValues(config, {}, {}, 'my-app')).toThrow('Missing configuration env var: X');
    });
    it('should throw for keyvault when value is not kv://', () => {
      const config = [{ name: 'S', value: '{{S}}', location: 'keyvault' }];
      expect(() => resolveConfigurationValues(config, { S: 'x' }, {}, 'my-app')).toThrow(
        /location 'keyvault' but value is not kv:\/\//i
      );
    });
    it('should throw when variable location has kv:// value', () => {
      const config = [{ name: 'S', value: 'kv://secrets/x', location: 'variable' }];
      expect(() => resolveConfigurationValues(config, {}, {})).toThrow('Use location \'keyvault\' for secrets');
    });
    it('should skip non-string or missing value', () => {
      const config = [{ name: 'A' }, { name: 'B', value: 42 }];
      resolveConfigurationValues(config, {}, {});
      expect(config[0].value).toBeUndefined();
      expect(config[1].value).toBe(42);
    });
    it('should do nothing for empty array', () => {
      resolveConfigurationValues([], {}, {});
    });
    it('should do nothing for null or non-array configArray', () => {
      resolveConfigurationValues(null, {}, {});
      resolveConfigurationValues(undefined, {}, {});
    });
    it('should skip items with location neither variable nor keyvault', () => {
      const config = [{ name: 'X', value: 'plain', location: 'other' }];
      resolveConfigurationValues(config, {}, {});
      expect(config[0].value).toBe('plain');
    });
  });

  describe('resolveConfigurationValues (auth-section / keyvault)', () => {
    it('keeps auth-style keyvault entry unchanged (kv:// stays in config; secret pushed separately)', () => {
      const config = [{ name: 'KV_MYAPP_CLIENTSECRET', value: 'kv://myapp/clientsecret', location: 'keyvault' }];
      expect(() => resolveConfigurationValues(config, {}, {}, 'myapp')).not.toThrow();
      expect(config[0].value).toBe('kv://myapp/clientsecret');
    });
    it('should throw for auth-style variable entry when env var missing and message suggests resolve', () => {
      const config = [{ name: 'API_BASE_URL', value: '{{API_BASE_URL}}', location: 'variable' }];
      expect(() => resolveConfigurationValues(config, {}, {}, 'my-app')).toThrow('Missing configuration env var: API_BASE_URL');
      expect(() => resolveConfigurationValues(config, {}, {}, 'my-app')).toThrow('aifabrix resolve my-app');
    });
    it('should throw when auth-style entry has location variable but value is kv:// (misconfiguration)', () => {
      const config = [{ name: 'KV_MYAPP_CLIENTID', value: 'kv://myapp/clientid', location: 'variable' }];
      expect(() => resolveConfigurationValues(config, {}, { 'myapp/clientid': 'x' }, 'myapp')).toThrow(
        'location \'variable\' but value is kv://'
      );
      expect(() => resolveConfigurationValues(config, {}, { 'myapp/clientid': 'x' }, 'myapp')).toThrow('Use location \'keyvault\'');
    });
  });

  describe('getEnvTemplateVariableNames', () => {
    it('should return set of keys from env.template content', () => {
      const content = 'SITE_ID=123\n# comment\nAPI_KEY=kv://x\n';
      const names = getEnvTemplateVariableNames(content);
      expect(names.has('SITE_ID')).toBe(true);
      expect(names.has('API_KEY')).toBe(true);
      expect(names.size).toBe(2);
    });
    it('should ignore comments and blank lines', () => {
      const names = getEnvTemplateVariableNames('# only comment\n\n');
      expect(names.size).toBe(0);
    });
    it('should return empty set for empty or invalid input', () => {
      expect(getEnvTemplateVariableNames('').size).toBe(0);
      expect(getEnvTemplateVariableNames(null).size).toBe(0);
      expect(getEnvTemplateVariableNames(undefined).size).toBe(0);
    });
    it('should return empty set for non-string input', () => {
      expect(getEnvTemplateVariableNames(123).size).toBe(0);
    });
  });

  describe('retemplateConfigurationFromEnvTemplate', () => {
    it('should set value to {{name}} for variable location when name in set', () => {
      const config = [
        { name: 'SITE_ID', value: '123', location: 'variable' },
        { name: 'OTHER', value: 'x', location: 'variable' }
      ];
      const names = new Set(['SITE_ID']);
      retemplateConfigurationFromEnvTemplate(config, names);
      expect(config[0].value).toBe('{{SITE_ID}}');
      expect(config[1].value).toBe('x');
    });
    it('should skip keyvault and non-variable', () => {
      const config = [{ name: 'S', value: 'secret', location: 'keyvault' }];
      retemplateConfigurationFromEnvTemplate(config, new Set(['S']));
      expect(config[0].value).toBe('secret');
    });
    it('should do nothing for empty set or empty array', () => {
      const config = [{ name: 'A', value: '1', location: 'variable' }];
      retemplateConfigurationFromEnvTemplate(config, new Set());
      expect(config[0].value).toBe('1');
      retemplateConfigurationFromEnvTemplate([], new Set(['A']));
    });
    it('should not throw for null or undefined configArray', () => {
      expect(() => retemplateConfigurationFromEnvTemplate(null, new Set(['A']))).not.toThrow();
      expect(() => retemplateConfigurationFromEnvTemplate(undefined, new Set(['A']))).not.toThrow();
    });
  });

  describe('buildResolvedEnvMapForIntegration', () => {
    it('should return envMap from .env when file exists', async() => {
      const integrationPath = '/integration/my-app';
      const envPath = path.join(integrationPath, '.env');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === envPath || p === integrationPath);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('SITE_ID=123\nAPI_KEY=abc\n');
      getIntegrationPath.mockReturnValue(integrationPath);

      const result = await buildResolvedEnvMapForIntegration('my-app');
      expect(result.envMap).toEqual({ SITE_ID: '123', API_KEY: 'abc' });
      expect(result.secrets).toEqual({});
      expect(loadEnvTemplate).not.toHaveBeenCalled();
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });
    it('should use env.template and resolveKvReferences when .env missing', async() => {
      const integrationPath = '/integration/my-app';
      const envPath = path.join(integrationPath, '.env');
      const envTemplatePath = path.join(integrationPath, 'env.template');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === envTemplatePath);
      getIntegrationPath.mockReturnValue(integrationPath);
      resolveKvReferences.mockResolvedValue('SITE_ID=456\n');

      const result = await buildResolvedEnvMapForIntegration('my-app');
      expect(loadEnvTemplate).toHaveBeenCalledWith(envTemplatePath);
      expect(resolveKvReferences).toHaveBeenCalled();
      expect(result.envMap).toEqual({ SITE_ID: '456' });
      fs.existsSync.mockRestore();
    });
    it('should return empty envMap when neither .env nor env.template exist', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const result = await buildResolvedEnvMapForIntegration('my-app');
      expect(result.envMap).toEqual({});
      expect(loadSecrets).toHaveBeenCalled();
      fs.existsSync.mockRestore();
    });
    it('should throw when systemKey is missing', async() => {
      await expect(buildResolvedEnvMapForIntegration('')).rejects.toThrow('systemKey is required');
      await expect(buildResolvedEnvMapForIntegration(null)).rejects.toThrow('systemKey is required');
    });
    it('should throw when systemKey is not a string', async() => {
      await expect(buildResolvedEnvMapForIntegration(123)).rejects.toThrow('systemKey is required');
    });
    it('should use empty secrets when loadSecrets throws', async() => {
      loadSecrets.mockRejectedValueOnce(new Error('Secrets file not found'));
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const result = await buildResolvedEnvMapForIntegration('my-app');
      expect(result.secrets).toEqual({});
      expect(result.envMap).toEqual({});
      fs.existsSync.mockRestore();
    });
    it('should throw when env.template exists but loadEnvTemplate throws', async() => {
      const envTemplatePath = path.join('/integration/my-app', 'env.template');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === envTemplatePath);
      loadEnvTemplate.mockImplementation(() => {
        throw new Error('env.template not found: /bad/path');
      });
      await expect(buildResolvedEnvMapForIntegration('my-app')).rejects.toThrow('env.template not found');
      fs.existsSync.mockRestore();
    });
  });

  describe('retemplateConfigurationForDownload', () => {
    it('should return false when env.template does not exist', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const config = [{ name: 'A', value: '1', location: 'variable' }];
      const applied = await retemplateConfigurationForDownload('my-app', config);
      expect(applied).toBe(false);
      expect(config[0].value).toBe('1');
      fs.existsSync.mockRestore();
    });
    it('should mutate config and return true when env.template exists', async() => {
      const integrationPath = '/integration/my-app';
      const envTemplatePath = path.join(integrationPath, 'env.template');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === envTemplatePath);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('SITE_ID=1\n');
      getIntegrationPath.mockReturnValue(integrationPath);

      const config = [{ name: 'SITE_ID', value: '123', location: 'variable' }];
      const applied = await retemplateConfigurationForDownload('my-app', config);
      expect(applied).toBe(true);
      expect(config[0].value).toBe('{{SITE_ID}}');
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });
    it('should return false for invalid systemKey or non-array config', async() => {
      expect(await retemplateConfigurationForDownload('', [])).toBe(false);
      expect(await retemplateConfigurationForDownload('x', null)).toBe(false);
    });
    it('should return false when systemKey is not a string', async() => {
      expect(await retemplateConfigurationForDownload(123, [])).toBe(false);
    });
    it('should not mutate config when env.template has no matching keys', async() => {
      const integrationPath = '/integration/my-app';
      const envTemplatePath = path.join(integrationPath, 'env.template');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === envTemplatePath);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('OTHER_VAR=1\n');
      getIntegrationPath.mockReturnValue(integrationPath);
      const config = [{ name: 'SITE_ID', value: '123', location: 'variable' }];
      const applied = await retemplateConfigurationForDownload('my-app', config);
      expect(applied).toBe(true);
      expect(config[0].value).toBe('123');
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });
  });
});
