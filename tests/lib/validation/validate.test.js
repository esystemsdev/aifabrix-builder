/**
 * Tests for AI Fabrix Builder Validation Module
 *
 * @fileoverview Unit tests for validate.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Mock modules
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    statSync: jest.fn()
  };
});
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../lib/validation/validator', () => ({
  validateApplication: jest.fn()
}));
jest.mock('../../../lib/utils/schema-resolver', () => ({
  resolveExternalFiles: jest.fn()
}));
jest.mock('../../../lib/utils/schema-loader', () => ({
  loadExternalSystemSchema: jest.fn(),
  loadExternalDataSourceSchema: jest.fn(),
  detectSchemaType: jest.fn()
}));
jest.mock('../../../lib/utils/error-formatter', () => ({
  formatValidationErrors: jest.fn((errors) => errors.map(e => e.message || JSON.stringify(e)))
}));
jest.mock('../../../lib/generator/external-controller-manifest', () => ({
  generateControllerManifest: jest.fn()
}));
jest.mock('../../../lib/validation/external-manifest-validator', () => ({
  validateControllerManifest: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  getProjectRoot: jest.fn(() => process.cwd())
}));

const fsSync = require('fs');
const logger = require('../../../lib/utils/logger');
const validator = require('../../../lib/validation/validator');
const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
const { loadExternalSystemSchema, loadExternalDataSourceSchema, detectSchemaType } = require('../../../lib/utils/schema-loader');
const { formatValidationErrors } = require('../../../lib/utils/error-formatter');
const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
const { validateControllerManifest } = require('../../../lib/validation/external-manifest-validator');
const { detectAppType } = require('../../../lib/utils/paths');

describe('Validation Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateExternalFile', () => {
    it('should validate external system file successfully', async() => {
      const mockFilePath = '/path/to/system.json';
      const mockContent = JSON.stringify({ key: 'test', displayName: 'Test' });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'system');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(mockValidate).toHaveBeenCalledWith(JSON.parse(mockContent));
    });

    it('should validate external datasource file successfully', async() => {
      const mockFilePath = '/path/to/datasource.json';
      const mockContent = JSON.stringify({ key: 'test', systemKey: 'hubspot' });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalDataSourceSchema.mockReturnValue(mockValidate);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'datasource');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid file', async() => {
      const mockFilePath = '/path/to/invalid.json';
      const mockContent = JSON.stringify({ key: 'test' });
      const mockValidate = jest.fn().mockReturnValue(false);
      const mockErrors = [{ message: 'Missing required field' }];

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalSystemSchema.mockReturnValue(mockValidate);
      mockValidate.errors = mockErrors;
      formatValidationErrors.mockReturnValue(['Missing required field']);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'system');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle file not found', async() => {
      fsSync.existsSync.mockReturnValue(false);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      await expect(validateExternalFile('/nonexistent.json', 'system')).rejects.toThrow('File not found');
    });

    it('should handle invalid JSON', async() => {
      const mockFilePath = '/path/to/invalid.json';
      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue('invalid json {');

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'system');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON syntax');
    });

    it('should throw error for unknown file type', async() => {
      const mockFilePath = '/path/to/file.json';
      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue('{}');

      const { validateExternalFile } = require('../../../lib/validation/validate');
      await expect(validateExternalFile(mockFilePath, 'unknown')).rejects.toThrow('Unknown file type');
    });
  });

  describe('validateAppOrFile', () => {
    it('should validate file path as external-system', async() => {
      const mockFilePath = '/path/to/system.json';
      const mockContent = JSON.stringify({ key: 'test', displayName: 'Test', type: 'openapi', authentication: {} });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.statSync.mockReturnValue({ isFile: () => true });
      fsSync.readFileSync.mockReturnValue(mockContent);
      detectSchemaType.mockReturnValue('external-system');
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateAppOrFile } = require('../../../lib/validation/validate');
      const result = await validateAppOrFile(mockFilePath);

      expect(result.valid).toBe(true);
      expect(result.file).toBe(mockFilePath);
      expect(result.type).toBe('external-system');
    });

    it('should validate file path as external-datasource', async() => {
      const mockFilePath = '/path/to/datasource.json';
      const mockContent = JSON.stringify({ key: 'test', systemKey: 'hubspot', entityKey: 'deal', fieldMappings: {} });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.statSync.mockReturnValue({ isFile: () => true });
      fsSync.readFileSync.mockReturnValue(mockContent);
      detectSchemaType.mockReturnValue('external-datasource');
      loadExternalDataSourceSchema.mockReturnValue(mockValidate);

      const { validateAppOrFile } = require('../../../lib/validation/validate');
      const result = await validateAppOrFile(mockFilePath);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('external-datasource');
    });

    it('should validate file path as application', async() => {
      const mockFilePath = '/path/to/application.json';
      const mockContent = JSON.stringify({ application: { key: 'test' } });

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.statSync.mockReturnValue({ isFile: () => true });
      fsSync.readFileSync.mockReturnValue(mockContent);
      detectSchemaType.mockReturnValue('system');

      const { validateAppOrFile } = require('../../../lib/validation/validate');
      const result = await validateAppOrFile(mockFilePath);

      expect(result.valid).toBe(true);
    });

    it('should validate app name without externalIntegration', async() => {
      const appName = 'myapp';
      const appPath = path.join(process.cwd(), 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const yaml = require('js-yaml');
      const { detectAppType } = require('../../../lib/utils/paths');

      detectAppType.mockResolvedValue({
        isExternal: false,
        appPath: appPath,
        appType: 'regular',
        baseDir: 'builder'
      });

      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        // For file path check (isFilePath), return false
        return false;
      });
      fsSync.statSync.mockReturnValue({ isFile: () => false });
      fsSync.readFileSync.mockReturnValue(yaml.dump({}));

      const { validateAppOrFile } = require('../../../lib/validation/validate');
      const result = await validateAppOrFile(appName);

      expect(result.valid).toBe(true);
      expect(result.application).toBeDefined();
      expect(result.externalFiles).toEqual([]);
    });

    it('should validate app name with externalIntegration', async() => {
      const appName = 'myapp';
      const appPath = path.join(process.cwd(), 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const yaml = require('js-yaml');
      const { detectAppType } = require('../../../lib/utils/paths');

      detectAppType.mockResolvedValue({
        isExternal: false,
        appPath: appPath,
        appType: 'regular',
        baseDir: 'builder'
      });

      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const mockExternalFiles = [
        { path: '/path/to/system.json', type: 'system', fileName: 'system.json' },
        { path: '/path/to/datasource.json', type: 'datasource', fileName: 'datasource.json' }
      ];

      resolveExternalFiles.mockResolvedValue(mockExternalFiles);

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === mockExternalFiles[0].path) return true;
        if (filePath === mockExternalFiles[1].path) return true;
        // For file path check (isFilePath), return false
        return false;
      });
      fsSync.statSync.mockReturnValue({ isFile: () => false });
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({
            externalIntegration: {
              schemaBasePath: './schemas'
            }
          });
        }
        if (filePath === mockExternalFiles[0].path) {
          return JSON.stringify({ key: 'test', displayName: 'Test', type: 'openapi', authentication: {} });
        }
        if (filePath === mockExternalFiles[1].path) {
          return JSON.stringify({ key: 'test', systemKey: 'hubspot', entityKey: 'deal', fieldMappings: {} });
        }
        return '';
      });

      const mockSystemValidate = jest.fn().mockReturnValue(true);
      const mockDatasourceValidate = jest.fn().mockReturnValue(true);
      loadExternalSystemSchema.mockReturnValue(mockSystemValidate);
      loadExternalDataSourceSchema.mockReturnValue(mockDatasourceValidate);

      const { validateAppOrFile } = require('../../../lib/validation/validate');
      const result = await validateAppOrFile(appName);

      expect(result.valid).toBe(true);
      expect(result.externalFiles).toHaveLength(2);
      expect(result.externalFiles[0].valid).toBe(true);
      expect(result.externalFiles[1].valid).toBe(true);
    });

    it('should aggregate errors from app and external files', async() => {
      const appName = 'myapp';
      const appPath = path.join(process.cwd(), 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const yaml = require('js-yaml');
      const { detectAppType } = require('../../../lib/utils/paths');

      detectAppType.mockResolvedValue({
        isExternal: false,
        appPath: appPath,
        appType: 'regular',
        baseDir: 'builder'
      });

      validator.validateApplication.mockResolvedValue({
        valid: false,
        errors: ['App error'],
        warnings: []
      });

      const mockExternalFiles = [
        { path: '/path/to/invalid.json', type: 'system', fileName: 'invalid.json' }
      ];

      resolveExternalFiles.mockResolvedValue(mockExternalFiles);

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === mockExternalFiles[0].path) return true;
        // For file path check (isFilePath), return false
        return false;
      });
      fsSync.statSync.mockReturnValue({ isFile: () => false });
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({
            externalIntegration: {
              schemaBasePath: './schemas'
            }
          });
        }
        return JSON.stringify({ key: 'test' });
      });

      const mockValidate = jest.fn().mockReturnValue(false);
      mockValidate.errors = [{ message: 'External error' }];
      loadExternalSystemSchema.mockReturnValue(mockValidate);
      formatValidationErrors.mockReturnValue(['External error']);

      const { validateAppOrFile } = require('../../../lib/validation/validate');
      const result = await validateAppOrFile(appName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('App error');
      expect(result.errors.some(e => e.includes('invalid.json'))).toBe(true);
    });

    it('should throw error if appOrFile is missing', async() => {
      const { validateAppOrFile } = require('../../../lib/validation/validate');
      await expect(validateAppOrFile(null)).rejects.toThrow('App name or file path is required');
      await expect(validateAppOrFile('')).rejects.toThrow('App name or file path is required');
    });

    it('should handle invalid YAML in variables.yaml', async() => {
      const appName = 'myapp';
      const appPath = path.join(process.cwd(), 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const { detectAppType } = require('../../../lib/utils/paths');

      detectAppType.mockResolvedValue({
        isExternal: false,
        appPath: appPath,
        appType: 'regular',
        baseDir: 'builder'
      });

      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        // For file path check (isFilePath), return false
        return false;
      });
      fsSync.statSync.mockReturnValue({ isFile: () => false });
      fsSync.readFileSync.mockReturnValue('invalid: yaml: [unclosed');

      const { validateAppOrFile } = require('../../../lib/validation/validate');
      const result = await validateAppOrFile(appName);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });

  describe('displayValidationResults', () => {
    it('should display success message for valid result', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = { valid: true };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation passed'));
    });

    it('should display error message for invalid result', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = { valid: false };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
    });

    it('should display application validation results', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        }
      };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application'));
    });

    it('should handle application results without errors array', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = {
        valid: false,
        application: {
          valid: false
        }
      };

      expect(() => displayValidationResults(result)).not.toThrow();
    });

    it('should display external files validation results', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = {
        valid: true,
        externalFiles: [
          {
            file: 'system.json',
            type: 'system',
            valid: true,
            errors: [],
            warnings: []
          }
        ]
      };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('External Integration Files'));
    });

    it('should display file validation results', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = {
        valid: true,
        file: '/path/to/file.json',
        type: 'external-system',
        errors: [],
        warnings: []
      };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('/path/to/file.json'));
    });

    it('should display warnings in validation results', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = {
        valid: true,
        warnings: ['Warning 1', 'Warning 2']
      };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warnings'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning 1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning 2'));
    });

    it('should display RBAC validation results', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = {
        valid: true,
        rbac: {
          valid: true,
          errors: [],
          warnings: []
        }
      };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('RBAC Configuration'));
    });

    it('should display RBAC errors when invalid', () => {
      const { displayValidationResults } = require('../../../lib/validation/validate');
      const result = {
        valid: false,
        rbac: {
          valid: false,
          errors: ['RBAC error 1', 'RBAC error 2'],
          warnings: []
        }
      };

      displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('RBAC error 1'));
    });
  });

  describe('validateExternalFile edge cases', () => {
    it('should validate role references in system files', async() => {
      const mockFilePath = '/path/to/system.json';
      const mockContent = JSON.stringify({
        key: 'test',
        displayName: 'Test',
        roles: [
          { value: 'role1', name: 'Role 1' },
          { value: 'role2', name: 'Role 2' }
        ],
        permissions: [
          { name: 'perm1', roles: ['role1'] },
          { name: 'perm2', roles: ['role2', 'role3'] } // role3 doesn't exist
        ]
      });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'system');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('role3'))).toBe(true);
    });

    it('should handle permissions without roles array', async() => {
      const mockFilePath = '/path/to/system.json';
      const mockContent = JSON.stringify({
        key: 'test',
        displayName: 'Test',
        roles: [{ value: 'role1', name: 'Role 1' }],
        permissions: [
          { name: 'perm1' } // No roles property
        ]
      });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'system');

      expect(result.valid).toBe(true);
    });

    it('should handle system files without permissions', async() => {
      const mockFilePath = '/path/to/system.json';
      const mockContent = JSON.stringify({
        key: 'test',
        displayName: 'Test'
        // No permissions
      });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'system');

      expect(result.valid).toBe(true);
    });

    it('should normalize external-system type to system', async() => {
      const mockFilePath = '/path/to/system.json';
      const mockContent = JSON.stringify({ key: 'test', displayName: 'Test' });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'external-system');

      expect(result.type).toBe('external-system');
      expect(mockValidate).toHaveBeenCalled();
    });

    it('should normalize external-datasource type to datasource', async() => {
      const mockFilePath = '/path/to/datasource.json';
      const mockContent = JSON.stringify({ key: 'test', systemKey: 'hubspot' });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalDataSourceSchema.mockReturnValue(mockValidate);

      const { validateExternalFile } = require('../../../lib/validation/validate');
      const result = await validateExternalFile(mockFilePath, 'external-datasource');

      expect(result.type).toBe('external-datasource');
      expect(mockValidate).toHaveBeenCalled();
    });
  });

  describe('validateExternalFilesForApp', () => {
    it('should validate multiple external files', async() => {
      const appName = 'myapp';
      const mockFiles = [
        { path: '/path/to/system1.json', type: 'system', fileName: 'system1.json' },
        { path: '/path/to/system2.json', type: 'system', fileName: 'system2.json' }
      ];

      resolveExternalFiles.mockResolvedValue(mockFiles);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue(JSON.stringify({ key: 'test', displayName: 'Test' }));

      const mockValidate = jest.fn().mockReturnValue(true);
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateExternalFilesForApp } = require('../../../lib/validation/validate');
      const result = await validateExternalFilesForApp(appName);

      expect(result).toHaveLength(2);
      expect(result[0].file).toBe('system1.json');
      expect(result[1].file).toBe('system2.json');
    });

    it('should handle empty external files array', async() => {
      const appName = 'myapp';
      resolveExternalFiles.mockResolvedValue([]);

      const { validateExternalFilesForApp } = require('../../../lib/validation/validate');
      const result = await validateExternalFilesForApp(appName);

      expect(result).toEqual([]);
    });
  });

  describe('validateFilePath', () => {
    it('should validate file path and detect type', async() => {
      const mockFilePath = '/path/to/system.json';
      const mockContent = JSON.stringify({ key: 'test', displayName: 'Test' });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue(mockContent);
      detectSchemaType.mockReturnValue('system');
      loadExternalSystemSchema.mockReturnValue(mockValidate);

      const { validateFilePath } = require('../../../lib/validation/validate');
      const result = await validateFilePath(mockFilePath);

      expect(result.valid).toBe(true);
      expect(detectSchemaType).toHaveBeenCalledWith(mockFilePath, mockContent);
    });

    it('should throw error if file path does not exist', async() => {
      fsSync.existsSync.mockReturnValue(false);

      const { validateFilePath } = require('../../../lib/validation/validate');
      await expect(validateFilePath('/nonexistent.json')).rejects.toThrow('File not found');
    });
  });

  describe('validateExternalSystemComplete', () => {
    const appName = 'test-external-app';
    const appPath = path.join(process.cwd(), 'integration', appName);

    beforeEach(() => {
      jest.clearAllMocks();
      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });
      // Mock fs.existsSync for file existence checks
      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath.includes('test-external-app') || filePath.includes('variables.yaml');
      });
    });

    it('should validate valid external system completely (all steps pass)', async() => {
      // Step 1: Application config valid
      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Step 2: Components valid - need to mock validateExternalFilesForApp properly
      const systemFilePath = path.join(appPath, 'test-system.json');
      const datasourceFilePath = path.join(appPath, 'test-datasource.json');

      resolveExternalFiles.mockResolvedValue([
        {
          path: systemFilePath,
          fileName: 'test-system.json',
          type: 'external-system'
        },
        {
          path: datasourceFilePath,
          fileName: 'test-datasource.json',
          type: 'external-datasource'
        }
      ]);

      // Mock file existence and reads for validation
      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath === systemFilePath ||
               filePath === datasourceFilePath ||
               filePath.includes('variables.yaml') ||
               filePath.includes('test-external-app');
      });

      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          return JSON.stringify({ key: 'test-system', displayName: 'Test System', type: 'openapi' });
        }
        if (filePath === datasourceFilePath) {
          return JSON.stringify({ key: 'test-datasource', systemKey: 'test-system', entityKey: 'entity1' });
        }
        return '';
      });

      const mockSystemValidate = jest.fn().mockReturnValue(true);
      const mockDatasourceValidate = jest.fn().mockReturnValue(true);
      loadExternalSystemSchema.mockReturnValue(mockSystemValidate);
      loadExternalDataSourceSchema.mockReturnValue(mockDatasourceValidate);
      formatValidationErrors.mockReturnValue([]);

      // Step 3 & 4: Manifest generation and validation
      const mockManifest = {
        key: 'test-external-app',
        displayName: 'Test App',
        type: 'external',
        system: { key: 'test-system' },
        dataSources: [{ key: 'test-datasource' }],
        deploymentKey: 'test-key'
      };
      generateControllerManifest.mockResolvedValue(mockManifest);
      validateControllerManifest.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      const result = await validateExternalSystemComplete(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.steps.application.valid).toBe(true);
      expect(result.steps.components.valid).toBe(true);
      expect(result.steps.manifest.valid).toBe(true);
      expect(generateControllerManifest).toHaveBeenCalledWith(appName);
      expect(validateControllerManifest).toHaveBeenCalledWith(mockManifest);
    });

    it('should stop at Step 2 when system file has errors', async() => {
      // Step 1: Application config valid
      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Step 2: System file has errors
      const systemFilePath = path.join(appPath, 'test-system.json');
      resolveExternalFiles.mockResolvedValue([
        {
          path: systemFilePath,
          fileName: 'test-system.json',
          type: 'external-system'
        }
      ]);

      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath === systemFilePath || filePath.includes('variables.yaml');
      });

      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          // Invalid JSON - missing key field
          return JSON.stringify({ displayName: 'Test System' });
        }
        return '';
      });

      const mockSystemValidate = jest.fn().mockReturnValue(false);
      mockSystemValidate.errors = [{ message: 'Field "key": Must be a string' }];
      loadExternalSystemSchema.mockReturnValue(mockSystemValidate);
      formatValidationErrors.mockReturnValue(['Field "key": Must be a string']);

      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      const result = await validateExternalSystemComplete(appName);

      expect(result.valid).toBe(false);
      expect(result.steps.application.valid).toBe(true);
      expect(result.steps.components.valid).toBe(false);
      expect(result.steps.components.errors.some(e => e.includes('test-system.json') && e.includes('Field "key"')));
      // Should not generate manifest if components invalid
      expect(generateControllerManifest).not.toHaveBeenCalled();
      expect(validateControllerManifest).not.toHaveBeenCalled();
    });

    it('should stop at Step 2 when datasource file has errors', async() => {
      // Step 1: Application config valid
      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Step 2: Datasource file has errors
      resolveExternalFiles.mockResolvedValue([
        {
          file: 'test-system.json',
          type: 'system',
          valid: true,
          errors: [],
          warnings: [],
          path: path.join(appPath, 'test-system.json')
        },
        {
          file: 'test-datasource.json',
          type: 'datasource',
          valid: false,
          errors: ['Field "systemKey": Required field missing'],
          warnings: [],
          path: path.join(appPath, 'test-datasource.json')
        }
      ]);

      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      const result = await validateExternalSystemComplete(appName);

      expect(result.valid).toBe(false);
      expect(result.steps.components.valid).toBe(false);
      expect(result.steps.components.errors.some(e => e.includes('test-datasource.json') && e.includes('systemKey')));
      expect(generateControllerManifest).not.toHaveBeenCalled();
    });

    it('should show Step 2 passed but Step 4 failed when manifest invalid', async() => {
      // Step 1: Application config valid
      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Step 2: Components valid
      const systemFilePath = path.join(appPath, 'test-system.json');
      resolveExternalFiles.mockResolvedValue([
        {
          path: systemFilePath,
          fileName: 'test-system.json',
          type: 'external-system'
        }
      ]);

      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath === systemFilePath || filePath.includes('variables.yaml');
      });

      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          return JSON.stringify({ key: 'test-system', displayName: 'Test System', type: 'openapi' });
        }
        return '';
      });

      const mockSystemValidate = jest.fn().mockReturnValue(true);
      loadExternalSystemSchema.mockReturnValue(mockSystemValidate);
      formatValidationErrors.mockReturnValue([]);

      // Step 3: Generate manifest
      const mockManifest = {
        key: 'test-external-app',
        displayName: 'Test App',
        type: 'external',
        system: { key: 'test-system' },
        dataSources: [],
        deploymentKey: 'test-key'
      };
      generateControllerManifest.mockResolvedValue(mockManifest);

      // Step 4: Manifest validation fails
      validateControllerManifest.mockResolvedValue({
        valid: false,
        errors: ['Required field "deploymentKey" is missing'],
        warnings: []
      });

      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      const result = await validateExternalSystemComplete(appName);

      expect(result.valid).toBe(false);
      expect(result.steps.components.valid).toBe(true);
      expect(result.steps.manifest.valid).toBe(false);
      expect(result.steps.manifest.errors).toContain('Required field "deploymentKey" is missing');
      expect(generateControllerManifest).toHaveBeenCalled();
      expect(validateControllerManifest).toHaveBeenCalled();
    });

    it('should show Step 1 errors when variables.yaml is invalid', async() => {
      // Step 1: Application validation fails
      validator.validateApplication.mockResolvedValue({
        valid: false,
        errors: ['externalIntegration block not found in variables.yaml'],
        warnings: []
      });

      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      const result = await validateExternalSystemComplete(appName);

      expect(result.valid).toBe(false);
      expect(result.steps.application.valid).toBe(false);
      expect(result.steps.application.errors).toContain('externalIntegration block not found in variables.yaml');
      // Should still try to validate components
      expect(resolveExternalFiles).toHaveBeenCalled();
    });

    it('should show clear error when system file is missing', async() => {
      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Components step - file doesn't exist
      const systemFilePath = path.join(appPath, 'test-system.json');
      resolveExternalFiles.mockResolvedValue([
        {
          path: systemFilePath,
          fileName: 'test-system.json',
          type: 'external-system'
        }
      ]);

      // File doesn't exist
      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml');
      });

      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      const result = await validateExternalSystemComplete(appName);

      expect(result.valid).toBe(false);
      expect(result.steps.components.valid).toBe(false);
      expect(result.steps.components.errors.some(e => e.includes('File not found') || e.includes('test-system.json')));
    });

    it('should aggregate errors from all steps', async() => {
      // Step 1: Application has warnings
      validator.validateApplication.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['rbac.yaml not found']
      });

      // Step 2: Components have errors and warnings
      resolveExternalFiles.mockResolvedValue([
        {
          file: 'test-system.json',
          type: 'system',
          valid: false,
          errors: ['Field "key": Must be a string'],
          warnings: ['Optional field missing'],
          path: path.join(appPath, 'test-system.json')
        }
      ]);

      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      const result = await validateExternalSystemComplete(appName);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('rbac.yaml not found');
      // Warnings from components step
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should throw error if appName is invalid', async() => {
      const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
      await expect(validateExternalSystemComplete(null))
        .rejects.toThrow('App name is required and must be a string');
      await expect(validateExternalSystemComplete(''))
        .rejects.toThrow('App name is required and must be a string');
    });
  });
});

