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
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    promises: {
      mkdir: jest.fn(),
      writeFile: jest.fn(),
      readFile: jest.fn(),
      chmod: jest.fn()
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

jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((appPath) => require('path').join(appPath, 'application.yaml'))
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

const configFormat = require('../../../lib/utils/config-format');
const mockGenerateExternalSystemApplicationSchema = jest.fn();
const mockLoadSystemFile = jest.fn();
const mockLoadDatasourceFiles = jest.fn();
jest.mock('../../../lib/generator/external', () => ({
  generateExternalSystemApplicationSchema: mockGenerateExternalSystemApplicationSchema,
  loadSystemFile: mockLoadSystemFile,
  loadDatasourceFiles: mockLoadDatasourceFiles
}));

const fsPromises = require('fs').promises;
const fs = require('fs');
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

  // Track written files and their content across test lifecycle
  const writtenFiles = new Map(); // Map<path, content>

  beforeEach(() => {
    jest.clearAllMocks();
    writtenFiles.clear(); // Clear written files for each test
    jest.spyOn(process, 'cwd').mockReturnValue('/workspace');
    configFormat.loadConfigFile.mockReturnValue({});
    configFormat.writeConfigFile.mockImplementation(() => {});
    fsPromises.mkdir.mockResolvedValue(undefined);

    // Track written files and their content for existsSync/readFileSync mocks
    fsPromises.writeFile.mockImplementation((filePath, content) => {
      const normalizedPath = String(filePath || '').replace(/\\/g, '/');
      writtenFiles.set(normalizedPath, content);
      return Promise.resolve(undefined);
    });

    // Default mock for readFile - can be overridden in specific tests
    fsPromises.readFile.mockResolvedValue('existing: content');
    mockGenerateExternalSystemApplicationSchema.mockResolvedValue(mockApplicationSchema);
    // Mock loadSystemFile and loadDatasourceFiles for generateControllerManifest
    mockLoadSystemFile.mockResolvedValue({
      key: appName,
      displayName: 'Test App',
      authentication: { type: 'apikey' }
    });
    mockLoadDatasourceFiles.mockResolvedValue(datasourceConfigs);

    // Mock existsSync to return true for template files and written files
    fs.existsSync.mockImplementation((filePath) => {
      const normalizedPath = String(filePath || '').replace(/\\/g, '/');
      if (normalizedPath.includes('templates/external-system/README.md.hbs')) {
        return true;
      }
      // Return true for files that have been written
      if (writtenFiles.has(normalizedPath)) {
        return true;
      }
      return false;
    });

    // Mock readFileSync to return content for written files and templates
    fs.readFileSync.mockImplementation((filePath) => {
      const normalizedPath = String(filePath || '').replace(/\\/g, '/');
      if (normalizedPath.includes('templates/external-system/README.md.hbs')) {
        // Return the actual template content
        return '# {{displayName}}\n\n{{description}}\n\n## System Information\n\n- **System Key**: `{{systemKey}}`\n- **System Type**: `{{systemType}}`\n- **Datasources**: {{datasourceCount}}\n\n## Files\n\n- `application.yaml` - Application configuration with externalIntegration block\n- `{{systemKey}}-deploy.json` - External system definition\n{{#each datasources}}\n- `{{fileName}}` - Datasource: {{displayName}}\n{{/each}}\n- `env.template` - Environment variables template\n- `application-schema.json` - Combined system + datasources for deployment\n\n## Quick Start\n\n### 1. Create External System\n\n```bash\naifabrix create {{appName}} --type external\n```\n\n### 2. Configure Authentication and Datasources\n\nEdit configuration files in `integration/{{appName}}/`:\n\n- Update authentication in `{{systemKey}}-deploy.json`\n- Configure field mappings in datasource JSON files\n\n### 3. Validate Configuration\n\n```bash\naifabrix validate {{appName}} --type external\n```\n\n### 4. Generate Deployment JSON\n\n```bash\naifabrix json {{appName}} --type external\n```\n\n### 5. Deploy to Dataplane\n\n```bash\naifabrix deploy {{appName}} --controller <url> --environment dev\n```\n\n## Testing\n\n### Unit Tests (Local Validation)\n\n```bash\naifabrix test {{appName}}\n```\n\n### Integration Tests (Via Dataplane)\n\n```bash\naifabrix test-integration {{appName}} --environment dev\n```\n\n## Deployment\n\nDeploy to dataplane via miso-controller:\n\n```bash\naifabrix deploy {{appName}} --controller <url> --environment dev\n```\n\n## Troubleshooting\n\n- **Validation errors**: Run `aifabrix validate {{appName}} --type external` to check configuration\n- **Deployment issues**: Check controller URL and authentication\n- **File not found**: Ensure you\'re in the project root directory\n';
      }
      // For written files, return the actual content that was written
      if (writtenFiles.has(normalizedPath)) {
        return writtenFiles.get(normalizedPath);
      }
      throw new Error(`File not found: ${filePath}`);
    });
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
        systemKey,
        {}
      );

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        path.join('/workspace', 'integration', appName),
        { recursive: true }
      );
      expect(fsPromises.writeFile).toHaveBeenCalled();
      expect(result.appPath).toBe(path.join('/workspace', 'integration', appName));
      // appName takes priority over systemKey for file naming
      // System file uses -system.yaml naming convention
      expect(result.systemFilePath).toContain(`${appName}-system.yaml`);
    });

    it('should write system YAML file with appName as key and displayName', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      // appName takes priority for file naming
      // System file uses -system.yaml naming convention; written via configFormat.writeConfigFile
      const systemFileCall = configFormat.writeConfigFile.mock.calls.find(call =>
        call[0] && String(call[0]).includes(`${appName}-system.yaml`)
      );
      expect(systemFileCall).toBeDefined();
      const writtenContent = systemFileCall[1];
      // Key and displayName should be generated from appName
      expect(writtenContent.key).toBe(appName);
      // displayName is generated from appName: "test-app" -> "Test App"
      expect(writtenContent.displayName).toBe('Test App');
    });

    it('should write datasource YAML files with appName prefix', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      // appName takes priority for file naming
      // Datasource files use -datasource- naming convention
      const datasourceFileCalls = configFormat.writeConfigFile.mock.calls.filter(call =>
        call[0] && String(call[0]).includes(`${appName}-datasource-`) && String(call[0]).endsWith('.yaml')
      );
      expect(datasourceFileCalls.length).toBe(datasourceConfigs.length);
    });

    it('should generate application.yaml with appName-based system file', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      const variablesCall = configFormat.writeConfigFile.mock.calls.find(call =>
        call[0] && String(call[0]).includes('application.yaml')
      );
      expect(variablesCall).toBeDefined();
      const writtenVars = variablesCall[1];
      expect(writtenVars.externalIntegration).toBeDefined();
      // appName takes priority for file naming
      // System file uses -system.yaml naming convention
      expect(writtenVars.externalIntegration.systems).toContain(`${appName}-system.yaml`);
    });

    it('should generate env.template with authentication variables', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      const envTemplateCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('env.template')
      );
      expect(envTemplateCall).toBeDefined();
      const templateContent = envTemplateCall[1];
      expect(templateContent).toContain('API_KEY');
      expect(templateContent).toContain('kv://secrets');
    });

    it('should generate README.md with appName-based displayName', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      const readmeCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('README.md')
      );
      expect(readmeCall).toBeDefined();
      const readmeContent = readmeCall[1];
      // displayName is generated from appName: "test-app" -> "Test App"
      expect(readmeContent).toContain('Test App');
      expect(readmeContent).toContain('aifabrix deploy');
    });

    it('should generate deployment manifest', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      // Deployment manifest is generated via generateControllerManifest
      expect(mockLoadSystemFile).toHaveBeenCalled();
      expect(mockLoadDatasourceFiles).toHaveBeenCalled();
      // Check for deployment manifest file (<appName>-deploy.json)
      const deployManifestCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes(`${appName}-deploy.json`)
      );
      expect(deployManifestCall).toBeDefined();
      const writtenManifest = JSON.parse(deployManifestCall[1]);
      expect(writtenManifest.key).toBe(appName);
      expect(writtenManifest.type).toBe('external');
      expect(writtenManifest.system).toBeDefined();
    });

    it('should handle empty datasource configs', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, [], systemKey, {});
      const variablesCall = configFormat.writeConfigFile.mock.calls.find(call =>
        call[0] && String(call[0]).includes('application.yaml')
      );
      expect(variablesCall).toBeDefined();
      const writtenVars = variablesCall[1];
      expect(writtenVars.externalIntegration.dataSources).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle directory creation errors', async() => {
      fsPromises.mkdir.mockRejectedValue(new Error('Permission denied'));
      await expect(
        wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {})
      ).rejects.toThrow('Failed to generate wizard files');
    });

    it('should handle file write errors', async() => {
      fsPromises.writeFile.mockRejectedValue(new Error('Disk full'));
      await expect(
        wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {})
      ).rejects.toThrow('Failed to generate wizard files');
    });
  });

  describe('generateDeployScripts', () => {
    const appPath = path.join('/workspace', 'integration', appName);
    const systemFileName = `${systemKey}-deploy.json`;
    const datasourceFileNames = [
      `${systemKey}-deploy-companies.json`,
      `${systemKey}-deploy-contacts.json`
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      fsPromises.writeFile.mockResolvedValue();
      fsPromises.chmod.mockResolvedValue();
      // Mock template file reading - return appropriate template based on path
      // This overrides the parent beforeEach mock
      const fsSync = require('fs');
      fsPromises.readFile.mockImplementation((filePath) => {
        const filePathStr = String(filePath || '');
        const normalizedPath = filePathStr.replace(/\\/g, '/');
        if (normalizedPath.includes('deploy.js.hbs') || normalizedPath.endsWith('deploy.js.hbs')) {
          try {
            const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'external-system', 'deploy.js.hbs');
            if (fsSync.existsSync(templatePath)) {
              return Promise.resolve(fsSync.readFileSync(templatePath, 'utf8'));
            }
          } catch (error) {
            // Fall through to fallback
          }
          return Promise.resolve(
            '#!/usr/bin/env node\n' +
            'const path = require(\'path\');\n' +
            'const scriptDir = __dirname;\n' +
            'const appKey = \'{{systemKey}}\';\n' +
            '{{#each allJsonFiles}}\n' +
            'run(\'aifabrix validate "\' + path.join(scriptDir, \'{{this}}\') + \'"\');\n' +
            '{{/each}}\n' +
            'run(\'aifabrix deploy \' + appKey);\n' +
            'if (process.env.RUN_TESTS !== \'false\') {\n' +
            '  run(\'aifabrix test-integration \' + appKey);\n' +
            '}\n'
          );
        }
        return Promise.resolve('existing: content');
      });
    });

    it('should generate deploy.js script only', async() => {
      const result = await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      expect(fsPromises.writeFile).toHaveBeenCalledTimes(1);
      expect(fsPromises.chmod).not.toHaveBeenCalled();
      expect(result.deployJsPath).toContain('deploy.js');
    });

    it('should generate deploy.js with correct content', async() => {
      await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      const deployJsCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('deploy.js')
      );
      expect(deployJsCall).toBeDefined();
      const scriptContent = deployJsCall[1];
      expect(scriptContent).toContain('#!/usr/bin/env node');
      expect(scriptContent).toContain(systemKey);
      expect(scriptContent).toContain('aifabrix validate');
      expect(scriptContent).toContain('aifabrix deploy');
      expect(scriptContent).toContain('aifabrix test-integration');
      expect(scriptContent).toContain('RUN_TESTS');
    });

    it('should include all JSON files in validation', async() => {
      await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      const deployJsCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('deploy.js')
      );
      const scriptContent = deployJsCall[1];
      expect(scriptContent).toContain(systemFileName);
      datasourceFileNames.forEach(fileName => {
        expect(scriptContent).toContain(fileName);
      });
    });

    it('should handle errors when generating scripts', async() => {
      fsPromises.writeFile.mockRejectedValue(new Error('Disk full'));
      await expect(
        wizardGenerator.generateDeployScripts(
          appPath,
          systemKey,
          systemFileName,
          datasourceFileNames
        )
      ).rejects.toThrow('Failed to generate deployment scripts');
    });
  });
});
