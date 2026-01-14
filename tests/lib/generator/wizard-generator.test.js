/**
 * Tests for Wizard Generator
 *
 * @fileoverview Tests for lib/wizard-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      mkdir: jest.fn(),
      writeFile: jest.fn(),
      readFile: jest.fn()
    }
  };
});

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = (text) => text;
  });
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

const mockGenerateExternalSystemApplicationSchema = jest.fn();
jest.mock('../../../lib/generator/external', () => ({
  generateExternalSystemApplicationSchema: mockGenerateExternalSystemApplicationSchema
}));

const fsPromises = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const wizardGenerator = require('../../../lib/generator/wizard');

describe('Wizard Generator', () => {
  const appName = 'test-app';
  const systemKey = 'test-system';
  const systemConfig = {
    key: systemKey,
    displayName: 'Test System',
    description: 'Test system description',
    version: '1.0.0',
    authentication: { type: 'apikey' }
  };

  const datasourceConfigs = [
    {
      key: 'ds1',
      systemKey: systemKey,
      entityKey: 'entity1',
      displayName: 'Datasource 1'
    }
  ];

  const mockApplicationSchema = {
    application: { key: systemKey, displayName: 'Test System' },
    dataSources: datasourceConfigs
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue('/workspace');
    fsPromises.mkdir.mockResolvedValue(undefined);
    fsPromises.writeFile.mockResolvedValue(undefined);
    fsPromises.readFile.mockResolvedValue('existing: content');
    mockGenerateExternalSystemApplicationSchema.mockResolvedValue(mockApplicationSchema);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateWizardFiles', () => {
    it('should generate all wizard files successfully', async() => {
      const result = await wizardGenerator.generateWizardFiles(
        appName,
        systemConfig,
        datasourceConfigs,
        systemKey
      );

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        path.join('/workspace', 'integration', appName),
        { recursive: true }
      );
      expect(fsPromises.writeFile).toHaveBeenCalled();
      expect(result.appPath).toBe(path.join('/workspace', 'integration', appName));
      expect(result.systemFilePath).toContain(`${systemKey}-deploy.json`);
    });

    it('should write system JSON file', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey);
      const systemFileCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes(`${systemKey}-deploy.json`)
      );
      expect(systemFileCall).toBeDefined();
      const writtenContent = JSON.parse(systemFileCall[1]);
      expect(writtenContent.key).toBe(systemKey);
      expect(writtenContent.displayName).toBe(systemConfig.displayName);
    });

    it('should write datasource JSON files', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey);
      const datasourceFileCalls = fsPromises.writeFile.mock.calls.filter(call =>
        call[0].includes(`${systemKey}-deploy-`) && call[0].endsWith('.json')
      );
      expect(datasourceFileCalls.length).toBe(datasourceConfigs.length);
    });

    it('should generate variables.yaml', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey);
      const variablesCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('variables.yaml')
      );
      expect(variablesCall).toBeDefined();
      const writtenYaml = yaml.load(variablesCall[1]);
      expect(writtenYaml.externalIntegration).toBeDefined();
      expect(writtenYaml.externalIntegration.systems).toContain(`${systemKey}-deploy.json`);
    });

    it('should generate env.template with authentication variables', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey);
      const envTemplateCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('env.template')
      );
      expect(envTemplateCall).toBeDefined();
      const templateContent = envTemplateCall[1];
      expect(templateContent).toContain('API_KEY');
      expect(templateContent).toContain('kv://secrets');
    });

    it('should generate README.md', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey);
      const readmeCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('README.md')
      );
      expect(readmeCall).toBeDefined();
      const readmeContent = readmeCall[1];
      expect(readmeContent).toContain(systemConfig.displayName);
      expect(readmeContent).toContain('aifabrix deploy');
    });

    it('should generate application-schema.json', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey);
      expect(mockGenerateExternalSystemApplicationSchema).toHaveBeenCalledWith(appName);
      const schemaCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('application-schema.json')
      );
      expect(schemaCall).toBeDefined();
      const writtenSchema = JSON.parse(schemaCall[1]);
      expect(writtenSchema.application).toBeDefined();
    });

    it('should handle empty datasource configs', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, [], systemKey);
      const variablesCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('variables.yaml')
      );
      const writtenYaml = yaml.load(variablesCall[1]);
      expect(writtenYaml.externalIntegration.dataSources).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle directory creation errors', async() => {
      fsPromises.mkdir.mockRejectedValue(new Error('Permission denied'));
      await expect(
        wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey)
      ).rejects.toThrow('Failed to generate wizard files');
    });

    it('should handle file write errors', async() => {
      fsPromises.writeFile.mockRejectedValue(new Error('Disk full'));
      await expect(
        wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey)
      ).rejects.toThrow('Failed to generate wizard files');
    });
  });
});
