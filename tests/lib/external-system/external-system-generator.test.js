/**
 * Tests for AI Fabrix Builder External System Generator Module
 *
 * @fileoverview Unit tests for external-system-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const handlebars = require('handlebars');

// Mock dependencies
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn()
    }
  };
});
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const logger = require('../../../lib/utils/logger');

describe('External System Generator Module', () => {
  const appName = 'test-external-app';
  const appPath = path.join(process.cwd(), 'integration', appName);
  const variablesPath = path.join(appPath, 'variables.yaml');
  // Generator uses templates/external-system/ (from lib/external-system/generator.js, goes up 2 levels)
  const templateDir = path.join(process.cwd(), 'templates', 'external-system');
  const systemTemplatePath = path.join(templateDir, 'external-system.json.hbs');
  const datasourceTemplatePath = path.join(templateDir, 'external-datasource.json.hbs');

  const mockSystemTemplate = `{
  "key": "{{systemKey}}",
  "displayName": "{{systemDisplayName}}",
  "description": "{{systemDescription}}",
  "type": "{{systemType}}",
  "enabled": true,
  "environment": {
    "baseUrl": "https://api.example.com"
  },
  "authentication": {
    "mode": "{{authType}}"{{#if (eq authType "apikey")}},
    "apikey": {
      "headerName": "X-API-Key",
      "key": "kv://{{systemKey}}-api-key"
    }{{/if}}
  }{{#if (eq systemType "openapi")}},
  "openapi": {
    "documentKey": "{{systemKey}}-api",
    "autoDiscoverEntities": false
  }{{/if}},
  "tags": []
}`;

  const mockDatasourceTemplate = `{
  "key": "{{datasourceKey}}",
  "displayName": "{{datasourceDisplayName}}",
  "description": "{{datasourceDescription}}",
  "systemKey": "{{systemKey}}",
  "entityType": "{{entityType}}",
  "resourceType": "{{resourceType}}",
  "enabled": true
}`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateExternalSystemTemplate', () => {
    it('should generate external system template successfully', async() => {
      const systemKey = 'test-system';
      const config = {
        systemDisplayName: 'Test System',
        systemDescription: 'A test system',
        systemType: 'openapi',
        authType: 'apikey'
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(mockSystemTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      const result = await generateExternalSystemTemplate(appPath, systemKey, config);

      // Files are now in same folder as variables.yaml (not schemas/ subfolder)
      // Naming: <app-name>-deploy.json
      expect(result).toBe(path.join(appPath, `${systemKey}-deploy.json`));
      expect(fsPromises.readFile).toHaveBeenCalledWith(systemTemplatePath, 'utf8');
      // mkdir should not be called (no subfolder needed)
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('should use default values when config is minimal', async() => {
      const systemKey = 'test-system';
      const config = {};

      fsPromises.readFile = jest.fn().mockResolvedValue(mockSystemTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await generateExternalSystemTemplate(appPath, systemKey, config);

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = writeCall[1];
      const parsed = JSON.parse(writtenContent);
      expect(parsed.key).toBe('test-system');
      expect(parsed.type).toBe('openapi');
      expect(parsed.authentication.mode).toBe('apikey');
    });

    it('should format system display name from key', async() => {
      const systemKey = 'my-test-system';
      const config = {};

      fsPromises.readFile = jest.fn().mockResolvedValue(mockSystemTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await generateExternalSystemTemplate(appPath, systemKey, config);

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = writeCall[1];
      const parsed = JSON.parse(writtenContent);
      expect(parsed.displayName).toBe('My Test System');
    });

    it('should throw error if template file does not exist', async() => {
      fsPromises.readFile = jest.fn().mockRejectedValue(new Error('ENOENT'));

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemTemplate(appPath, 'test-system', {}))
        .rejects.toThrow('Failed to generate external system template');
    });

    it('should throw error if template is invalid', async() => {
      fsPromises.readFile = jest.fn().mockResolvedValue('{{invalid template');

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemTemplate(appPath, 'test-system', {}))
        .rejects.toThrow('Failed to generate external system template');
    });

    it('should throw error if write fails', async() => {
      fsPromises.readFile = jest.fn().mockResolvedValue(mockSystemTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockRejectedValue(new Error('Write failed'));

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemTemplate(appPath, 'test-system', {}))
        .rejects.toThrow('Failed to generate external system template');
    });
  });

  describe('generateExternalDataSourceTemplate', () => {
    it('should generate external datasource template successfully', async() => {
      const datasourceKey = 'test-system-entity1';
      const config = {
        systemKey: 'test-system',
        entityType: 'entity1',
        resourceType: 'document',
        systemType: 'openapi',
        datasourceDisplayName: 'Test Entity',
        datasourceDescription: 'A test entity'
      };

      fs.readFile = jest.fn().mockResolvedValue(mockDatasourceTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      // The function adds -deploy suffix internally, so pass just the base key
      // Function expects: <systemKey>-deploy-<datasourceKey>
      const fullDatasourceKey = `test-system-deploy-${datasourceKey}`;
      const result = await generateExternalDataSourceTemplate(appPath, fullDatasourceKey, config);

      // Files are now in same folder as variables.yaml (not schemas/ subfolder)
      // Naming: <app-name>-deploy-<datasource-key>.json (function adds -deploy.json)
      expect(result).toBe(path.join(appPath, `${fullDatasourceKey}-deploy.json`));
      expect(fsPromises.readFile).toHaveBeenCalledWith(datasourceTemplatePath, 'utf8');
      // mkdir should not be called (no subfolder needed)
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('should use default values when config is minimal', async() => {
      const datasourceKey = 'test-system-entity1';
      const config = {
        systemKey: 'test-system'
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(mockDatasourceTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await generateExternalDataSourceTemplate(appPath, datasourceKey, config);

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = writeCall[1];
      const parsed = JSON.parse(writtenContent);
      expect(parsed.key).toBe('test-system-entity1');
      expect(parsed.systemKey).toBe('test-system');
      expect(parsed.resourceType).toBe('document');
    });

    it('should extract entityType from datasourceKey if not provided', async() => {
      const datasourceKey = 'test-system-customer';
      const config = {
        systemKey: 'test-system'
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(mockDatasourceTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await generateExternalDataSourceTemplate(appPath, datasourceKey, config);

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = writeCall[1];
      const parsed = JSON.parse(writtenContent);
      expect(parsed.entityType).toBe('customer');
    });

    it('should format datasource display name from key', async() => {
      const datasourceKey = 'test-system-entity-one';
      const config = {
        systemKey: 'test-system'
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(mockDatasourceTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await generateExternalDataSourceTemplate(appPath, datasourceKey, config);

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = writeCall[1];
      const parsed = JSON.parse(writtenContent);
      expect(parsed.displayName).toContain('Test System Entity One');
    });

    it('should throw error if template file does not exist', async() => {
      fsPromises.readFile = jest.fn().mockRejectedValue(new Error('ENOENT'));

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await expect(generateExternalDataSourceTemplate(appPath, 'test-datasource', { systemKey: 'test' }))
        .rejects.toThrow('Failed to generate external datasource template');
    });

    it('should throw error if write fails', async() => {
      fs.readFile = jest.fn().mockResolvedValue(mockDatasourceTemplate);
      fs.mkdir = jest.fn().mockResolvedValue(undefined);
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Write failed'));

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await expect(generateExternalDataSourceTemplate(appPath, 'test-datasource', { systemKey: 'test' }))
        .rejects.toThrow('Failed to generate external datasource template');
    });
  });

  describe('generateExternalSystemFiles', () => {
    const mockVariables = {
      app: { key: appName },
      port: 3000
    };

    beforeEach(() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        return Promise.reject(new Error('File not found'));
      });

      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);
    });

    it('should generate external system files successfully', async() => {
      const config = {
        systemKey: 'test-system',
        datasourceCount: 2,
        systemDisplayName: 'Test System',
        systemType: 'openapi'
      };

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      const result = await generateExternalSystemFiles(appPath, appName, config);

      // Files are now in same folder with new naming: <app-name>-deploy.json
      expect(result.systemPath).toBe(path.join(appPath, 'test-system-deploy.json'));
      expect(result.datasourcePaths).toHaveLength(2);
      // Datasource naming: <systemKey>-deploy-<entityKey>-deploy.json (function adds -deploy.json)
      expect(result.datasourcePaths[0]).toBe(path.join(appPath, 'test-system-deploy-entity1-deploy.json'));
      expect(result.datasourcePaths[1]).toBe(path.join(appPath, 'test-system-deploy-entity2-deploy.json'));
      expect(logger.log).toHaveBeenCalled();
    });

    it('should use appName as systemKey if not provided', async() => {
      const config = {
        datasourceCount: 1
      };

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      const result = await generateExternalSystemFiles(appPath, appName, config);

      // Files are now in same folder with new naming: <app-name>-deploy.json
      expect(result.systemPath).toBe(path.join(appPath, `${appName}-deploy.json`));
    });

    it('should use default datasourceCount of 1', async() => {
      const config = {
        systemKey: 'test-system'
      };

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      const result = await generateExternalSystemFiles(appPath, appName, config);

      expect(result.datasourcePaths).toHaveLength(1);
    });

    it('should cycle through resource types', async() => {
      const config = {
        systemKey: 'test-system',
        datasourceCount: 5
      };

      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve('{"resourceType": "{{resourceType}}"}');
        }
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        return Promise.reject(new Error('File not found'));
      });

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await generateExternalSystemFiles(appPath, appName, config);

      const writeCalls = fsPromises.writeFile.mock.calls;
      const resourceTypes = ['customer', 'contact', 'person', 'document', 'deal'];
      resourceTypes.forEach((type, index) => {
        const parsed = JSON.parse(writeCalls[index + 1][1]);
        expect(parsed.resourceType).toBe(type);
      });
    });

    it('should update variables.yaml with externalIntegration block', async() => {
      const config = {
        systemKey: 'test-system',
        datasourceCount: 2
      };

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await generateExternalSystemFiles(appPath, appName, config);

      const variablesWriteCall = fsPromises.writeFile.mock.calls.find(call => call[0] === variablesPath);
      expect(variablesWriteCall).toBeDefined();
      const writtenYaml = yaml.load(variablesWriteCall[1]);
      expect(writtenYaml.externalIntegration).toBeDefined();
      // schemaBasePath is now './' (same folder)
      expect(writtenYaml.externalIntegration.schemaBasePath).toBe('./');
      // System file naming: <app-name>-deploy.json
      expect(writtenYaml.externalIntegration.systems).toEqual(['test-system-deploy.json']);
      expect(writtenYaml.externalIntegration.dataSources).toHaveLength(2);
      expect(writtenYaml.externalIntegration.autopublish).toBe(true);
      expect(writtenYaml.externalIntegration.version).toBe('1.0.0');
    });

    it('should throw error if system template generation fails', async() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath) {
          return Promise.reject(new Error('Template read failed'));
        }
        return Promise.resolve(mockSystemTemplate);
      });

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, {}))
        .rejects.toThrow('Failed to generate external system files');
    });

    it('should throw error if datasource template generation fails', async() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        if (filePath === datasourceTemplatePath) {
          return Promise.reject(new Error('Datasource template read failed'));
        }
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        return Promise.reject(new Error('File not found'));
      });

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, { datasourceCount: 1 }))
        .rejects.toThrow('Failed to generate external system files');
    });

    it('should throw error if variables.yaml update fails', async() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        if (filePath === variablesPath) {
          return Promise.reject(new Error('Variables read failed'));
        }
        return Promise.reject(new Error('File not found'));
      });

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, { datasourceCount: 1 }))
        .rejects.toThrow('Failed to generate external system files');
    });
  });

  describe('updateVariablesYamlWithExternalIntegration', () => {
    it('should update variables.yaml with externalIntegration block', async() => {
      const mockVariables = {
        app: { key: appName },
        port: 3000
      };

      const systemKey = 'test-system';
      // Files are now in same folder with new naming: <systemKey>-deploy-<entityKey>-deploy.json
      const datasourcePaths = [
        path.join(appPath, 'test-system-deploy-entity1-deploy.json'),
        path.join(appPath, 'test-system-deploy-entity2-deploy.json')
      ];

      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        return Promise.reject(new Error('File not found'));
      });
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      // Access the internal function via the module
      const module = require('../../../lib/external-system/generator');

      // Since updateVariablesYamlWithExternalIntegration is not exported,
      // we test it indirectly through generateExternalSystemFiles
      const config = {
        systemKey: systemKey,
        datasourceCount: 2
      };

      await module.generateExternalSystemFiles(appPath, appName, config);

      const variablesWriteCall = fsPromises.writeFile.mock.calls.find(call => call[0] === variablesPath);
      expect(variablesWriteCall).toBeDefined();
      const writtenYaml = yaml.load(variablesWriteCall[1]);
      expect(writtenYaml.externalIntegration).toBeDefined();
      // System file naming: <app-name>-deploy.json
      expect(writtenYaml.externalIntegration.systems).toEqual([`${systemKey}-deploy.json`]);
      // Datasource naming: <systemKey>-deploy-<entityKey>-deploy.json (function adds -deploy.json)
      expect(writtenYaml.externalIntegration.dataSources).toEqual([
        'test-system-deploy-entity1-deploy.json',
        'test-system-deploy-entity2-deploy.json'
      ]);
    });

    it('should preserve existing variables when updating', async() => {
      const mockVariables = {
        app: { key: appName },
        port: 3000,
        database: { enabled: true }
      };

      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        return Promise.reject(new Error('File not found'));
      });

      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await generateExternalSystemFiles(appPath, appName, { systemKey: 'test-system', datasourceCount: 1 });

      const variablesWriteCall = fsPromises.writeFile.mock.calls.find(call => call[0] === variablesPath);
      const writtenYaml = yaml.load(variablesWriteCall[1]);
      expect(writtenYaml.app).toEqual(mockVariables.app);
      expect(writtenYaml.port).toBe(3000);
      expect(writtenYaml.database).toEqual(mockVariables.database);
      expect(writtenYaml.externalIntegration).toBeDefined();
    });

    it('should throw error if variables.yaml does not exist', async() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        if (filePath === variablesPath) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.reject(new Error('File not found'));
      });

      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, { systemKey: 'test-system', datasourceCount: 1 }))
        .rejects.toThrow('Failed to generate external system files');
    });

    it('should throw error if variables.yaml is invalid YAML', async() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        if (filePath === variablesPath) {
          return Promise.resolve('invalid: yaml: [unclosed');
        }
        return Promise.reject(new Error('File not found'));
      });

      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, { systemKey: 'test-system', datasourceCount: 1 }))
        .rejects.toThrow('Failed to generate external system files');
    });
  });
});

