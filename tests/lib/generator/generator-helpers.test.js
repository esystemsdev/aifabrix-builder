/**
 * Tests for Generator Helpers Module
 *
 * @fileoverview Unit tests for lib/generator/helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

const {
  loadVariables,
  loadEnvTemplate,
  loadRbac,
  validatePortalInput,
  parseEnvironmentVariables
} = require('../../../lib/generator/helpers');

describe('Generator Helpers Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadVariables', () => {
    it('should load and parse application config (yaml) successfully', () => {
      const configPath = '/path/to/application.yaml';
      const mockVariables = {
        name: 'test-app',
        image: { name: 'test-image' }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockVariables));

      const result = loadVariables(configPath);

      expect(fs.existsSync).toHaveBeenCalledWith(configPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(configPath, 'utf8');
      expect(result).toEqual({ parsed: mockVariables });
    });

    it('should throw error when config file does not exist', () => {
      const configPath = '/path/to/application.yaml';

      fs.existsSync.mockReturnValue(false);

      expect(() => loadVariables(configPath)).toThrow(/Config file not found/);
    });

    it('should throw error when YAML is invalid', () => {
      const configPath = '/path/to/application.yaml';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

      expect(() => loadVariables(configPath)).toThrow(/Invalid YAML syntax/);
    });
  });

  describe('loadEnvTemplate', () => {
    it('should load env.template successfully', () => {
      const templatePath = '/path/to/env.template';
      const mockContent = 'DATABASE_URL=postgres://localhost/test\nAPI_KEY=test-key';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockContent);

      const result = loadEnvTemplate(templatePath);

      expect(fs.existsSync).toHaveBeenCalledWith(templatePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(templatePath, 'utf8');
      expect(result).toBe(mockContent);
    });

    it('should throw error when file does not exist', () => {
      const templatePath = '/path/to/env.template';

      fs.existsSync.mockReturnValue(false);

      expect(() => loadEnvTemplate(templatePath)).toThrow(`env.template not found: ${templatePath}`);
    });
  });

  describe('loadRbac', () => {
    it('should load and parse rbac.yaml successfully', () => {
      const rbacPath = '/path/to/rbac.yaml';
      const mockRbac = {
        roles: [
          { name: 'admin', permissions: ['read', 'write'] }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockRbac));

      const result = loadRbac(rbacPath);

      expect(fs.existsSync).toHaveBeenCalledWith(rbacPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(rbacPath, 'utf8');
      expect(result).toEqual(mockRbac);
    });

    it('should return null when file does not exist', () => {
      const rbacPath = '/path/to/rbac.yaml';

      fs.existsSync.mockReturnValue(false);

      const result = loadRbac(rbacPath);

      expect(result).toBeNull();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should throw error when YAML is invalid', () => {
      const rbacPath = '/path/to/rbac.yaml';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

      expect(() => loadRbac(rbacPath)).toThrow('Invalid YAML syntax in rbac.yaml:');
    });
  });

  describe('validatePortalInput', () => {
    it('should validate valid portalInput', () => {
      const portalInput = {
        field: 'text',
        label: 'Database URL'
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).not.toThrow();
    });

    it('should throw error when portalInput is not an object', () => {
      expect(() => validatePortalInput(null, 'VAR')).toThrow('Invalid portalInput for variable \'VAR\': must be an object');
      expect(() => validatePortalInput('string', 'VAR')).toThrow('Invalid portalInput for variable \'VAR\': must be an object');
      expect(() => validatePortalInput(123, 'VAR')).toThrow('Invalid portalInput for variable \'VAR\': must be an object');
    });

    it('should throw error when field is missing', () => {
      const portalInput = {
        label: 'Database URL'
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': field is required and must be a string'
      );
    });

    it('should throw error when field is not a string', () => {
      const portalInput = {
        field: 123,
        label: 'Database URL'
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': field is required and must be a string'
      );
    });

    it('should throw error when label is missing', () => {
      const portalInput = {
        field: 'text'
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': label is required and must be a string'
      );
    });

    it('should throw error when field type is invalid', () => {
      const portalInput = {
        field: 'invalid',
        label: 'Database URL'
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': field must be one of: password, text, textarea, select'
      );
    });

    it('should validate select field with options', () => {
      const portalInput = {
        field: 'select',
        label: 'Environment',
        options: ['dev', 'tst', 'pro']
      };

      expect(() => validatePortalInput(portalInput, 'ENV')).not.toThrow();
    });

    it('should throw error when select field has no options', () => {
      const portalInput = {
        field: 'select',
        label: 'Environment'
      };

      expect(() => validatePortalInput(portalInput, 'ENV')).toThrow(
        'Invalid portalInput for variable \'ENV\': select field requires a non-empty options array'
      );
    });

    it('should throw error when select field has empty options array', () => {
      const portalInput = {
        field: 'select',
        label: 'Environment',
        options: []
      };

      expect(() => validatePortalInput(portalInput, 'ENV')).toThrow(
        'Invalid portalInput for variable \'ENV\': select field requires a non-empty options array'
      );
    });

    it('should throw error when options used with non-select field', () => {
      const portalInput = {
        field: 'text',
        label: 'Database URL',
        options: ['option1', 'option2']
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': options can only be used with select field type'
      );
    });

    it('should validate placeholder', () => {
      const portalInput = {
        field: 'text',
        label: 'Database URL',
        placeholder: 'postgres://localhost/db'
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).not.toThrow();
    });

    it('should throw error when placeholder is not a string', () => {
      const portalInput = {
        field: 'text',
        label: 'Database URL',
        placeholder: 123
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': placeholder must be a string'
      );
    });

    it('should validate masked field', () => {
      const portalInput = {
        field: 'password',
        label: 'API Key',
        masked: true
      };

      expect(() => validatePortalInput(portalInput, 'API_KEY')).not.toThrow();
    });

    it('should throw error when masked is not a boolean', () => {
      const portalInput = {
        field: 'password',
        label: 'API Key',
        masked: 'true'
      };

      expect(() => validatePortalInput(portalInput, 'API_KEY')).toThrow(
        'Invalid portalInput for variable \'API_KEY\': masked must be a boolean'
      );
    });

    it('should validate validation object', () => {
      const portalInput = {
        field: 'text',
        label: 'Database URL',
        validation: {
          min: 1,
          max: 100
        }
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).not.toThrow();
    });

    it('should throw error when validation is not an object', () => {
      const portalInput = {
        field: 'text',
        label: 'Database URL',
        validation: 'invalid'
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': validation must be an object'
      );
    });

    it('should throw error when validation is an array', () => {
      const portalInput = {
        field: 'text',
        label: 'Database URL',
        validation: []
      };

      expect(() => validatePortalInput(portalInput, 'DATABASE_URL')).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': validation must be an object'
      );
    });
  });

  describe('parseEnvironmentVariables', () => {
    it('should parse environment variables successfully', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test\nAPI_KEY=test-key';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'DATABASE_URL',
        value: 'postgres://localhost/test',
        location: 'variable',
        required: false
      });
      expect(result[1]).toEqual({
        name: 'API_KEY',
        value: 'test-key',
        location: 'variable',
        required: true // Contains 'key' in name
      });
    });

    it('should skip empty lines', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test\n\nAPI_KEY=test-key';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(2);
    });

    it('should skip comment lines', () => {
      const envTemplate = '# Database configuration\nDATABASE_URL=postgres://localhost/test\n# API configuration\nAPI_KEY=test-key';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(2);
    });

    it('should skip lines without equals sign', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test\nINVALID_LINE\nAPI_KEY=test-key';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(2);
    });

    it('should skip lines with empty key or value', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test\n=empty-key\nEMPTY_VALUE=\nAPI_KEY=test-key';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(2);
    });

    it('should handle kv:// prefix for KeyVault variables', () => {
      const envTemplate = 'DATABASE_PASSWORD=kv://secrets/database/password';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'DATABASE_PASSWORD',
        value: 'secrets/database/password', // kv:// prefix removed
        location: 'keyvault',
        required: true
      });
    });

    it('should mark sensitive variables as required', () => {
      const envTemplate = 'DATABASE_PASSWORD=secret123\nAPI_SECRET=secret456\nAUTH_TOKEN=token123';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(3);
      expect(result[0].required).toBe(true); // Contains 'password'
      expect(result[1].required).toBe(true); // Contains 'secret'
      expect(result[2].required).toBe(true); // Contains 'token'
    });

    it('should merge portalInput from variablesConfig', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test';
      const variablesConfig = {
        configuration: [
          {
            name: 'DATABASE_URL',
            portalInput: {
              field: 'text',
              label: 'Database URL',
              placeholder: 'postgres://localhost/db'
            }
          }
        ]
      };

      const result = parseEnvironmentVariables(envTemplate, variablesConfig);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toEqual({
        field: 'text',
        label: 'Database URL',
        placeholder: 'postgres://localhost/db'
      });
    });

    it('should validate portalInput when merging from variablesConfig', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test';
      const variablesConfig = {
        configuration: [
          {
            name: 'DATABASE_URL',
            portalInput: {
              field: 'invalid', // Invalid field type
              label: 'Database URL'
            }
          }
        ]
      };

      expect(() => parseEnvironmentVariables(envTemplate, variablesConfig)).toThrow(
        'Invalid portalInput for variable \'DATABASE_URL\': field must be one of: password, text, textarea, select'
      );
    });

    it('should handle variablesConfig with no configuration array', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test';
      const variablesConfig = {};

      const result = parseEnvironmentVariables(envTemplate, variablesConfig);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toBeUndefined();
    });

    it('should handle null variablesConfig', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost/test';

      const result = parseEnvironmentVariables(envTemplate, null);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toBeUndefined();
    });

    it('should handle variables with spaces around equals sign', () => {
      const envTemplate = 'DATABASE_URL = postgres://localhost/test\nAPI_KEY= test-key';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('DATABASE_URL');
      expect(result[0].value).toBe('postgres://localhost/test');
      expect(result[1].name).toBe('API_KEY');
      expect(result[1].value).toBe('test-key');
    });

    it('should handle multiple kv:// variables', () => {
      const envTemplate = 'DATABASE_PASSWORD=kv://secrets/db/password\nAPI_SECRET=kv://secrets/api/secret';
      const result = parseEnvironmentVariables(envTemplate);

      expect(result).toHaveLength(2);
      expect(result[0].location).toBe('keyvault');
      expect(result[0].value).toBe('secrets/db/password');
      expect(result[1].location).toBe('keyvault');
      expect(result[1].value).toBe('secrets/api/secret');
    });
  });
});

