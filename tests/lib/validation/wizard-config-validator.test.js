/**
 * Tests for Wizard Configuration Validator
 *
 * @fileoverview Tests for lib/validation/wizard-config-validator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const yaml = require('js-yaml');

// Mock fs
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn()
  }
}));

// Mock chalk
jest.mock('chalk', () => ({
  green: jest.fn(str => str),
  red: jest.fn(str => str),
  yellow: jest.fn(str => str),
  gray: jest.fn(str => str)
}));

const {
  loadWizardConfig,
  validateWizardConfig,
  validateWizardConfigSchema,
  resolveEnvVar,
  resolveEnvVarsInObject,
  formatValidationErrors,
  displayValidationResults
} = require('../../../lib/validation/wizard-config-validator');

describe('Wizard Config Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.TEST_TOKEN;
    delete process.env.MCP_TOKEN;
  });

  describe('resolveEnvVar', () => {
    it('should resolve environment variable', () => {
      process.env.TEST_TOKEN = 'my-secret-token';
      const result = resolveEnvVar('${TEST_TOKEN}');
      expect(result).toBe('my-secret-token');
    });

    it('should handle string without env vars', () => {
      const result = resolveEnvVar('plain-string');
      expect(result).toBe('plain-string');
    });

    it('should handle multiple env vars in one string', () => {
      process.env.HOST = 'example.com';
      process.env.PORT = '8080';
      const result = resolveEnvVar('https://${HOST}:${PORT}');
      expect(result).toBe('https://example.com:8080');
    });

    it('should throw error for undefined env var', () => {
      expect(() => resolveEnvVar('${UNDEFINED_VAR}')).toThrow('Environment variable \'UNDEFINED_VAR\' is not defined');
    });

    it('should return non-string values unchanged', () => {
      expect(resolveEnvVar(123)).toBe(123);
      expect(resolveEnvVar(true)).toBe(true);
      expect(resolveEnvVar(null)).toBe(null);
    });
  });

  describe('resolveEnvVarsInObject', () => {
    it('should resolve env vars in nested object', () => {
      process.env.MCP_TOKEN = 'secret-token';
      const obj = {
        source: {
          type: 'mcp-server',
          token: '${MCP_TOKEN}'
        },
        name: 'test'
      };
      const result = resolveEnvVarsInObject(obj);
      expect(result.source.token).toBe('secret-token');
      expect(result.name).toBe('test');
    });

    it('should resolve env vars in arrays', () => {
      process.env.ITEM1 = 'value1';
      process.env.ITEM2 = 'value2';
      const arr = ['${ITEM1}', '${ITEM2}', 'static'];
      const result = resolveEnvVarsInObject(arr);
      expect(result).toEqual(['value1', 'value2', 'static']);
    });

    it('should handle null and undefined', () => {
      expect(resolveEnvVarsInObject(null)).toBe(null);
      expect(resolveEnvVarsInObject(undefined)).toBe(undefined);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format required field errors', () => {
      const errors = [{
        keyword: 'required',
        params: { missingProperty: 'appName' }
      }];
      const result = formatValidationErrors(errors);
      expect(result[0]).toBe('Missing required field: appName');
    });

    it('should format enum errors', () => {
      const errors = [{
        keyword: 'enum',
        instancePath: '/mode',
        message: 'must be equal to one of the allowed values',
        params: { allowedValues: ['create-system', 'add-datasource'] }
      }];
      const result = formatValidationErrors(errors);
      expect(result[0]).toContain('create-system, add-datasource');
    });

    it('should format pattern errors', () => {
      const errors = [{
        keyword: 'pattern',
        instancePath: '/appName',
        message: 'must match pattern "^[a-z0-9-_]+$"'
      }];
      const result = formatValidationErrors(errors);
      expect(result[0]).toContain('/appName');
    });

    it('should handle empty errors array', () => {
      expect(formatValidationErrors([])).toEqual([]);
      expect(formatValidationErrors(null)).toEqual([]);
    });
  });

  describe('validateWizardConfigSchema', () => {
    it('should validate valid config', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject missing required fields', () => {
      const config = {
        mode: 'create-system'
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid mode', () => {
      const config = {
        appName: 'test-app',
        mode: 'invalid-mode',
        source: { type: 'openapi-file', filePath: './test.yaml' }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(false);
    });

    it('should validate openapi-file source type', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });

    it('should validate openapi-url source type', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-url',
          url: 'https://api.example.com/openapi.json'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });

    it('should validate mcp-server source type', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'mcp-server',
          serverUrl: 'https://mcp.example.com',
          token: 'test-token'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });

    it('should validate known-platform source type', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'known-platform',
          platform: 'hubspot'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid platform', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'known-platform',
          platform: 'invalid-platform'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(false);
    });

    it('should validate add-datasource mode with systemIdOrKey', () => {
      const config = {
        appName: 'test-app',
        mode: 'add-datasource',
        systemIdOrKey: 'existing-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });

    it('should validate credential configuration', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        },
        credential: {
          action: 'create',
          config: {
            key: 'my-oauth',
            displayName: 'My OAuth',
            type: 'OAUTH2'
          }
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });

    it('should validate preferences', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        },
        preferences: {
          intent: 'sales-focused CRM',
          fieldOnboardingLevel: 'full',
          enableOpenAPIGeneration: true,
          enableMCP: false,
          enableABAC: true,
          enableRBAC: false
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid fieldOnboardingLevel', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        },
        preferences: {
          fieldOnboardingLevel: 'invalid'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(false);
    });

    it('should validate deployment settings', () => {
      const config = {
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        },
        deployment: {
          controller: 'https://controller.example.com',
          environment: 'dev',
          dataplane: 'https://dataplane.example.com'
        }
      };
      const result = validateWizardConfigSchema(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('loadWizardConfig', () => {
    it('should load and parse valid YAML config', async() => {
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'create-system',
        source: { type: 'openapi-file', filePath: './test.yaml' }
      });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await loadWizardConfig('./wizard.yaml');

      expect(result.appName).toBe('test-app');
      expect(result.mode).toBe('create-system');
    });

    it('should throw error for non-existent file', async() => {
      fs.promises.access.mockRejectedValue({ code: 'ENOENT' });

      await expect(loadWizardConfig('./missing.yaml')).rejects.toThrow('Configuration file not found');
    });

    it('should throw error for invalid YAML', async() => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('invalid: yaml: content: [');

      await expect(loadWizardConfig('./invalid.yaml')).rejects.toThrow('Invalid YAML syntax');
    });

    it('should throw error for empty file', async() => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('');

      await expect(loadWizardConfig('./empty.yaml')).rejects.toThrow('Configuration file is empty or invalid');
    });
  });

  describe('validateWizardConfig', () => {
    beforeEach(() => {
      process.env.MCP_TOKEN = 'test-mcp-token';
    });

    it('should validate complete valid config', async() => {
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        }
      });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await validateWizardConfig('./wizard.yaml');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.config).toBeDefined();
    });

    it('should resolve environment variables', async() => {
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'mcp-server',
          serverUrl: 'https://mcp.example.com',
          token: '${MCP_TOKEN}'
        }
      });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await validateWizardConfig('./wizard.yaml');

      expect(result.valid).toBe(true);
      expect(result.config.source.token).toBe('test-mcp-token');
    });

    it('should fail validation for missing env var', async() => {
      delete process.env.MISSING_VAR;
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'mcp-server',
          serverUrl: 'https://mcp.example.com',
          token: '${MISSING_VAR}'
        }
      });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await validateWizardConfig('./wizard.yaml');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/MISSING_VAR/);
    });

    it('should skip env var resolution when disabled', async() => {
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'mcp-server',
          serverUrl: 'https://mcp.example.com',
          token: '${UNRESOLVED_VAR}'
        }
      });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await validateWizardConfig('./wizard.yaml', { resolveEnvVars: false });

      expect(result.valid).toBe(true);
      expect(result.config.source.token).toBe('${UNRESOLVED_VAR}');
    });

    it('should validate file path exists for openapi-file', async() => {
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './missing-openapi.yaml'
        }
      });
      fs.promises.access.mockImplementation((p) => {
        if (String(p).includes('wizard.yaml')) return Promise.resolve();
        if (String(p).includes('missing-openapi.yaml')) {
          const err = new Error('File not found');
          err.code = 'ENOENT';
          return Promise.reject(err);
        }
        const err = new Error('File not found');
        err.code = 'ENOENT';
        return Promise.reject(err);
      });
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await validateWizardConfig('./wizard.yaml');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('OpenAPI file not found');
    });

    it('should skip file path validation when disabled', async() => {
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'create-system',
        source: {
          type: 'openapi-file',
          filePath: './missing.yaml'
        }
      });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await validateWizardConfig('./wizard.yaml', { validateFilePaths: false });

      expect(result.valid).toBe(true);
    });

    it('should validate systemIdOrKey is required for add-datasource mode', async() => {
      const configContent = yaml.dump({
        appName: 'test-app',
        mode: 'add-datasource',
        source: {
          type: 'openapi-file',
          filePath: './openapi.yaml'
        }
      });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(configContent);

      const result = await validateWizardConfig('./wizard.yaml', { validateFilePaths: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('systemIdOrKey'))).toBe(true);
    });

    it('should handle file read errors', async() => {
      fs.promises.access.mockRejectedValue({ code: 'ENOENT' });

      const result = await validateWizardConfig('./nonexistent.yaml');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('displayValidationResults', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should display success message for valid config', () => {
      displayValidationResults({ valid: true, errors: [] });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should display errors for invalid config', () => {
      displayValidationResults({
        valid: false,
        errors: ['Error 1', 'Error 2']
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('failed'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error 1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error 2'));
    });
  });
});
