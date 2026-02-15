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
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((appPath) => require('path').join(appPath, 'application.yaml'))
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const configFormat = require('../../../lib/utils/config-format');

describe('External System Generator Module', () => {
  const appName = 'test-external-app';
  const appPath = path.join(process.cwd(), 'integration', appName);
  const variablesPath = path.join(appPath, 'application.yaml');
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
  "authentication": {
    "type": "{{authType}}"{{#if (eq authType "apikey")}},
    "apikey": {
      "headerName": "X-API-Key",
      "key": "kv://{{systemKey}}-api-key"
    }{{/if}}
  }{{#if (eq systemType "openapi")}},
  "openapi": {
    "documentKey": "{{systemKey}}-api",
    "autoDiscoverEntities": false
  }{{/if}},
  "tags": [],
  "configuration": []
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

      // Files are now in same folder as application.yaml (not schemas/ subfolder)
      // Naming: <app-name>-system.yaml
      expect(result).toBe(path.join(appPath, `${systemKey}-system.yaml`));
      expect(fsPromises.readFile).toHaveBeenCalledWith(systemTemplatePath, 'utf8');
      // mkdir should not be called (no subfolder needed)
      expect(configFormat.writeConfigFile).toHaveBeenCalled();
    });

    it('should use default values when config is minimal', async() => {
      const systemKey = 'test-system';
      const config = {};

      fsPromises.readFile = jest.fn().mockResolvedValue(mockSystemTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      configFormat.writeConfigFile.mockClear();

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await generateExternalSystemTemplate(appPath, systemKey, config);

      const systemCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-system.yaml'));
      expect(systemCall).toBeDefined();
      const parsed = systemCall[1];
      expect(parsed.key).toBe('test-system');
      expect(parsed.type).toBe('openapi');
      expect(parsed.authentication.type).toBe('apikey');
      expect(Array.isArray(parsed.configuration)).toBe(true);
      expect(parsed.configuration).toHaveLength(0);
    });

    it('should emit empty configuration (BASEURL comes from credential, not config)', async() => {
      const systemKey = 'test-system';
      const config = { baseUrl: 'https://api.hubapi.com' };

      fsPromises.readFile = jest.fn().mockResolvedValue(mockSystemTemplate);
      configFormat.writeConfigFile.mockClear();

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await generateExternalSystemTemplate(appPath, systemKey, config);

      const systemCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-system.yaml'));
      const parsed = systemCall[1];
      expect(parsed.configuration).toEqual([]);
    });

    it('should format system display name from key', async() => {
      const systemKey = 'my-test-system';
      const config = {};

      fsPromises.readFile = jest.fn().mockResolvedValue(mockSystemTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      configFormat.writeConfigFile.mockClear();

      const { generateExternalSystemTemplate } = require('../../../lib/external-system/generator');
      await generateExternalSystemTemplate(appPath, systemKey, config);

      const systemCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-system.yaml'));
      const parsed = systemCall[1];
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
      configFormat.writeConfigFile.mockImplementationOnce(() => {
        throw new Error('Write failed');
      });

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
      // Function expects just the entity key (like 'entity1'), it will extract the key part
      // and generate: <systemKey>-datasource-<datasourceKeyOnly>.yaml
      const result = await generateExternalDataSourceTemplate(appPath, datasourceKey, config);

      // Files are now in same folder as application.yaml (not schemas/ subfolder)
      // Naming: <systemKey>-datasource-<datasourceKeyOnly>.yaml
      // Since datasourceKey is 'test-system-entity1' and systemKey is 'test-system',
      // the function extracts 'entity1' and generates 'test-system-datasource-entity1.yaml'
      expect(result).toBe(path.join(appPath, 'test-system-datasource-entity1.yaml'));
      expect(fsPromises.readFile).toHaveBeenCalledWith(datasourceTemplatePath, 'utf8');
      // mkdir should not be called (no subfolder needed)
      expect(configFormat.writeConfigFile).toHaveBeenCalled();
    });

    it('should use default values when config is minimal', async() => {
      const datasourceKey = 'test-system-entity1';
      const config = {
        systemKey: 'test-system'
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(mockDatasourceTemplate);
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      configFormat.writeConfigFile.mockClear();

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await generateExternalDataSourceTemplate(appPath, datasourceKey, config);

      const dsCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-datasource-'));
      expect(dsCall).toBeDefined();
      const parsed = dsCall[1];
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

      const dsCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-datasource-'));
      expect(dsCall).toBeDefined();
      const parsed = dsCall[1];
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

      const dsCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-datasource-'));
      const parsed = dsCall[1];
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

    it('should emit default dimensions and schema-valid attribute expressions when dimensions/attributes are empty', async() => {
      const realTemplate = fs.readFileSync(datasourceTemplatePath, 'utf8');
      fsPromises.readFile = jest.fn().mockResolvedValue(realTemplate);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await generateExternalDataSourceTemplate(appPath, 'test-ds', {
        systemKey: 'test-system',
        entityType: 'recordStorage',
        resourceType: 'document',
        systemType: 'rest'
      });

      const dsCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-datasource-'));
      const parsed = dsCall[1];

      expect(parsed.fieldMappings.dimensions).toEqual({
        country: 'metadata.country',
        department: 'metadata.department'
      });
      expect(parsed.fieldMappings.attributes.id).toMatchObject({
        expression: '{{raw.id}}',
        type: 'string',
        indexed: true
      });
      expect(parsed.fieldMappings.attributes.name).toMatchObject({
        expression: '{{raw.name}}',
        type: 'string',
        indexed: false
      });
      expect(parsed.exposed.attributes).toEqual(['id', 'name']);
    });

    it('should generate datasource JSON that validates against external-datasource schema', async() => {
      const Ajv = require('ajv');
      const realTemplate = fs.readFileSync(datasourceTemplatePath, 'utf8');
      fsPromises.readFile = jest.fn().mockResolvedValue(realTemplate);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalDataSourceTemplate } = require('../../../lib/external-system/generator');
      await generateExternalDataSourceTemplate(appPath, 'test-ds', {
        systemKey: 'test-system',
        entityType: 'recordStorage',
        resourceType: 'document',
        systemType: 'rest'
      });

      const dsCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-datasource-'));
      const json = dsCall[1];

      let schema = require('../../../lib/schema/external-datasource.schema.json');
      if (schema.$schema && schema.$schema.includes('2020-12')) {
        schema = { ...schema };
        delete schema.$schema;
      }
      const ajv = new Ajv({ allErrors: true, strict: false });
      ajv.addSchema(schema, schema.$id);
      const valid = ajv.validate(schema.$id, json);

      expect(valid).toBe(true);
      if (!valid) {
        expect(ajv.errors).toBeNull();
      }
    });
  });

  describe('generateExternalSystemFiles', () => {
    const mockVariables = {
      app: { key: appName },
      port: 3000
    };

    beforeEach(() => {
      configFormat.loadConfigFile.mockReturnValue(mockVariables);
      configFormat.writeConfigFile.mockClear();
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
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

      // Files are now in same folder with new naming: <app-name>-system.yaml
      expect(result.systemPath).toBe(path.join(appPath, 'test-system-system.yaml'));
      expect(result.datasourcePaths).toHaveLength(2);
      // Datasource naming: <systemKey>-datasource-<entityKey>.yaml
      expect(result.datasourcePaths[0]).toBe(path.join(appPath, 'test-system-datasource-entity1.yaml'));
      expect(result.datasourcePaths[1]).toBe(path.join(appPath, 'test-system-datasource-entity2.yaml'));
      expect(logger.log).toHaveBeenCalled();
    });

    it('should use appName as systemKey if not provided', async() => {
      const config = {
        datasourceCount: 1
      };

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      const result = await generateExternalSystemFiles(appPath, appName, config);

      // Files are now in same folder with new naming: <app-name>-system.yaml
      expect(result.systemPath).toBe(path.join(appPath, `${appName}-system.yaml`));
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

      configFormat.loadConfigFile.mockReturnValue(mockVariables);
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve('{"resourceType": "{{resourceType}}"}');
        }
        return Promise.reject(new Error('File not found'));
      });

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await generateExternalSystemFiles(appPath, appName, config);

      const datasourceCalls = configFormat.writeConfigFile.mock.calls.filter(c => c[0] && String(c[0]).includes('-datasource-'));
      const resourceTypes = ['customer', 'contact', 'person', 'document', 'deal'];
      resourceTypes.forEach((type, index) => {
        expect(datasourceCalls[index][1].resourceType).toBe(type);
      });
    });

    it('should update application.yaml with externalIntegration block', async() => {
      const config = {
        systemKey: 'test-system',
        datasourceCount: 2
      };

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await generateExternalSystemFiles(appPath, appName, config);

      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(variablesPath, expect.objectContaining({
        externalIntegration: expect.objectContaining({
          schemaBasePath: './',
          systems: ['test-system-system.yaml'],
          dataSources: expect.any(Array),
          autopublish: true,
          version: '1.0.0'
        })
      }));
      const applicationYamlCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('application.yaml'));
      expect(applicationYamlCall).toBeDefined();
      const writtenVariables = applicationYamlCall[1];
      expect(writtenVariables.externalIntegration.dataSources).toHaveLength(2);
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
        return Promise.reject(new Error('File not found'));
      });

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, { datasourceCount: 1 }))
        .rejects.toThrow('Failed to generate external system files');
    });

    it('should throw error if application.yaml update fails', async() => {
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('Variables read failed');
      });

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, { datasourceCount: 1 }))
        .rejects.toThrow('Failed to generate external system files');
    });
  });

  describe('updateVariablesYamlWithExternalIntegration', () => {
    it('should update application.yaml with externalIntegration block', async() => {
      const mockVariables = {
        app: { key: appName },
        port: 3000
      };

      const systemKey = 'test-system';
      // Files are now in same folder with new naming: <systemKey>-datasource-<entityKey>.json
      const datasourcePaths = [
        path.join(appPath, 'test-system-datasource-entity1.yaml'),
        path.join(appPath, 'test-system-datasource-entity2.yaml')
      ];

      configFormat.loadConfigFile.mockReturnValue(mockVariables);
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        return Promise.reject(new Error('File not found'));
      });
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const module = require('../../../lib/external-system/generator');
      const config = {
        systemKey: systemKey,
        datasourceCount: 2
      };

      await module.generateExternalSystemFiles(appPath, appName, config);

      expect(configFormat.writeConfigFile).toHaveBeenCalledWith(variablesPath, expect.objectContaining({
        externalIntegration: expect.objectContaining({
          systems: [`${systemKey}-system.yaml`],
          dataSources: ['test-system-datasource-entity1.yaml', 'test-system-datasource-entity2.yaml']
        })
      }));
    });

    it('should preserve existing variables when updating', async() => {
      const mockVariablesWithDb = {
        app: { key: appName },
        port: 3000,
        database: { enabled: true }
      };

      configFormat.loadConfigFile.mockReturnValue(mockVariablesWithDb);
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        return Promise.reject(new Error('File not found'));
      });
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await generateExternalSystemFiles(appPath, appName, { systemKey: 'test-system', datasourceCount: 1 });

      const applicationYamlCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('application.yaml'));
      expect(applicationYamlCall).toBeDefined();
      const writtenVariables = applicationYamlCall[1];
      expect(writtenVariables.app).toEqual(mockVariablesWithDb.app);
      expect(writtenVariables.port).toBe(3000);
      expect(writtenVariables.database).toEqual(mockVariablesWithDb.database);
      expect(writtenVariables.externalIntegration).toBeDefined();
    });

    it('should throw error if application.yaml does not exist', async() => {
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('Application config not found');
      });
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
        }
        return Promise.reject(new Error('File not found'));
      });
      fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
      fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

      const { generateExternalSystemFiles } = require('../../../lib/external-system/generator');
      await expect(generateExternalSystemFiles(appPath, appName, { systemKey: 'test-system', datasourceCount: 1 }))
        .rejects.toThrow('Failed to generate external system files');
    });

    it('should throw error if application.yaml is invalid YAML', async() => {
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('Invalid YAML syntax');
      });
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemTemplatePath || filePath === datasourceTemplatePath) {
          return Promise.resolve(mockSystemTemplate);
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

