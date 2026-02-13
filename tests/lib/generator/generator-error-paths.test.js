/**
 * Tests for Generator Error Paths
 *
 * @fileoverview Unit tests for generator.js error handling paths
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const generator = require('../../../lib/generator');

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  };
});

// Mock paths module
jest.mock('../../../lib/utils/paths', () => {
  const actualPaths = jest.requireActual('../../../lib/utils/paths');
  return {
    ...actualPaths,
    detectAppType: jest.fn(),
    getDeployJsonPath: jest.fn()
  };
});

// Mock validator
jest.mock('../../../lib/validation/validator', () => ({
  validateDeploymentJson: jest.fn()
}));

// Mock variable loader
jest.mock('../../../lib/core/env-reader', () => ({
  loadVariables: jest.fn()
}));

const paths = require('../../../lib/utils/paths');
const validator = require('../../../lib/validation/validator');
const envReader = require('../../../lib/core/env-reader');

describe('Generator Error Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDeployJson for external systems', () => {
    const appName = 'testapp';
    const appPath = path.join(process.cwd(), 'builder', appName);
    const variablesPath = path.join(appPath, 'application.yaml');
    const deployJsonPath = path.join(appPath, `${appName}-deploy.json`);
    const systemFilePath = path.join(appPath, 'system.json');

    beforeEach(() => {
      paths.detectAppType.mockResolvedValue({
        isExternal: true,
        appPath,
        appType: 'external',
        baseDir: 'builder'
      });
      paths.getDeployJsonPath.mockReturnValue(deployJsonPath);
    });

    it('should throw error when app name is missing', async() => {
      await expect(
        generator.generateDeployJson(null)
      ).rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error when app name is not a string', async() => {
      await expect(
        generator.generateDeployJson(123)
      ).rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error when externalIntegration block is missing', async() => {
      const yaml = require('js-yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ app: { type: 'external' } }));

      await expect(generator.generateDeployJson(appName))
        .rejects.toThrow('externalIntegration block not found in application.yaml');
    });

    it('should throw error when system file does not exist', async() => {
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          schemaBasePath: './'
        }
      });
      fs.existsSync.mockImplementation((filePath) => filePath === variablesPath);
      fs.readFileSync.mockReturnValue(variablesContent);

      await expect(generator.generateDeployJson(appName))
        .rejects.toThrow('System file not found');
    });

    it('should throw error when system file contains invalid JSON', async() => {
      const yaml = require('js-yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          schemaBasePath: './'
        }
      }));
      fs.promises.readFile.mockResolvedValue('invalid json content');

      await expect(generator.generateDeployJson(appName))
        .rejects.toThrow();
    });

    it('should throw error when file write fails', async() => {
      const mockSystemJson = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' }
      };
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          schemaBasePath: './'
        }
      });
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === variablesPath || filePath === systemFilePath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === systemFilePath) return JSON.stringify(mockSystemJson);
        return '';
      });
      fs.promises.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(generator.generateDeployJson(appName))
        .rejects.toThrow('Write failed');
    });
  });

  describe('generateDeployJson', () => {
    const appName = 'testapp';
    const appPath = path.join(process.cwd(), 'builder', appName);
    const variablesPath = path.join(appPath, 'application.yaml');

    beforeEach(() => {
      paths.detectAppType.mockResolvedValue({
        isExternal: false,
        appPath,
        appType: 'regular',
        baseDir: 'builder'
      });
      paths.getDeployJsonPath.mockReturnValue(
        path.join(appPath, `${appName}-deploy.json`)
      );
    });

    it('should throw error when application.yaml is missing', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(
        generator.generateDeployJson(appName)
      ).rejects.toThrow();
    });

    it('should throw error when application.yaml has invalid YAML', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [');
      envReader.loadVariables.mockImplementation(() => {
        throw new Error('Invalid YAML syntax');
      });

      await expect(
        generator.generateDeployJson(appName)
      ).rejects.toThrow('Invalid YAML syntax');
    });
  });

  describe('generateDeployJsonWithValidation', () => {
    const appName = 'testapp';
    const appPath = path.join(process.cwd(), 'builder', appName);
    const deployJsonPath = path.join(appPath, `${appName}-deploy.json`);

    beforeEach(() => {
      paths.detectAppType.mockResolvedValue({
        isExternal: false,
        appPath,
        appType: 'regular',
        baseDir: 'builder'
      });
      paths.getDeployJsonPath.mockReturnValue(deployJsonPath);
    });

    it('should throw error when deployment JSON validation fails', async() => {
      const mockDeployment = { invalid: 'deployment' };
      validator.validateDeploymentJson.mockReturnValue({
        valid: false,
        errors: ['Missing required field: name'],
        warnings: []
      });

      // Mock generateDeployJson to succeed but validation fails
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(deployJsonPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockDeployment));

      // generateDeployJsonWithValidation should throw when validation fails
      await expect(
        generator.generateDeployJsonWithValidation(appName)
      ).rejects.toThrow('Generated deployment JSON does not match schema');
    });

    it('should throw error when deployment JSON file cannot be read', async() => {
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(deployJsonPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read failed');
      });

      await expect(
        generator.generateDeployJsonWithValidation(appName)
      ).rejects.toThrow('File read failed');
    });

    it('should throw error when deployment JSON contains invalid JSON', async() => {
      jest.spyOn(generator, 'generateDeployJson').mockResolvedValue(deployJsonPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      await expect(
        generator.generateDeployJsonWithValidation(appName)
      ).rejects.toThrow();
    });
  });

  describe('generateExternalSystemApplicationSchema', () => {
    const appName = 'testapp';
    const appPath = path.join(process.cwd(), 'builder', appName);
    const variablesPath = path.join(appPath, 'application.yaml');

    beforeEach(() => {
      paths.detectAppType.mockResolvedValue({
        isExternal: true,
        appPath,
        appType: 'external',
        baseDir: 'builder'
      });
    });

    it('should throw error when app name is missing', async() => {
      await expect(
        generator.generateExternalSystemApplicationSchema(null)
      ).rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error when app name is not a string', async() => {
      await expect(
        generator.generateExternalSystemApplicationSchema(123)
      ).rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error when externalIntegration block is missing', async() => {
      envReader.loadVariables.mockReturnValue({
        parsed: { name: 'test' }
      });
      fs.existsSync.mockReturnValue(true);

      await expect(
        generator.generateExternalSystemApplicationSchema(appName)
      ).rejects.toThrow('externalIntegration block not found in application.yaml');
    });

    it('should throw error when no system files specified', async() => {
      const variablesPath = path.join(appPath, 'application.yaml');
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: [],
          schemaBasePath: './'
        }
      });
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === variablesPath;
      });
      fs.readFileSync.mockReturnValue(variablesContent);

      await expect(
        generator.generateExternalSystemApplicationSchema(appName)
      ).rejects.toThrow('No system files specified in externalIntegration.systems');
    });

    it('should throw error when system file not found', async() => {
      const variablesPath = path.join(appPath, 'application.yaml');
      const systemFilePath = path.join(appPath, 'system.json');
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          schemaBasePath: './'
        }
      });
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === variablesPath; // application.yaml exists, system.json doesn't
      });
      fs.readFileSync.mockReturnValue(variablesContent);

      await expect(
        generator.generateExternalSystemApplicationSchema(appName)
      ).rejects.toThrow('System file not found');
    });

    it('should throw error when system file contains invalid JSON', async() => {
      const systemFilePath = path.join(appPath, 'system.json');
      envReader.loadVariables.mockReturnValue({
        parsed: {
          externalIntegration: {
            systems: ['system.json'],
            schemaBasePath: './'
          }
        }
      });
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockResolvedValue('invalid json');

      await expect(
        generator.generateExternalSystemApplicationSchema(appName)
      ).rejects.toThrow();
    });
  });
});

