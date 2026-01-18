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
    // Default mock for readFile - can be overridden in specific tests
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
        systemKey,
        {}
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
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      const systemFileCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes(`${systemKey}-deploy.json`)
      );
      expect(systemFileCall).toBeDefined();
      const writtenContent = JSON.parse(systemFileCall[1]);
      expect(writtenContent.key).toBe(systemKey);
      expect(writtenContent.displayName).toBe(systemConfig.displayName);
    });

    it('should write datasource JSON files', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      const datasourceFileCalls = fsPromises.writeFile.mock.calls.filter(call =>
        call[0].includes(`${systemKey}-deploy-`) && call[0].endsWith('.json')
      );
      expect(datasourceFileCalls.length).toBe(datasourceConfigs.length);
    });

    it('should generate variables.yaml', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      const variablesCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('variables.yaml')
      );
      expect(variablesCall).toBeDefined();
      const writtenYaml = yaml.load(variablesCall[1]);
      expect(writtenYaml.externalIntegration).toBeDefined();
      expect(writtenYaml.externalIntegration.systems).toContain(`${systemKey}-deploy.json`);
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

    it('should generate README.md', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      const readmeCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('README.md')
      );
      expect(readmeCall).toBeDefined();
      const readmeContent = readmeCall[1];
      expect(readmeContent).toContain(systemConfig.displayName);
      expect(readmeContent).toContain('aifabrix deploy');
    });

    it('should generate application-schema.json', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, {});
      expect(mockGenerateExternalSystemApplicationSchema).toHaveBeenCalledWith(appName);
      const schemaCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('application-schema.json')
      );
      expect(schemaCall).toBeDefined();
      const writtenSchema = JSON.parse(schemaCall[1]);
      expect(writtenSchema.application).toBeDefined();
    });

    it('should handle empty datasource configs', async() => {
      await wizardGenerator.generateWizardFiles(appName, systemConfig, [], systemKey, {});
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
        // Normalize path separators for cross-platform compatibility
        const normalizedPath = filePathStr.replace(/\\/g, '/');
        if (normalizedPath.includes('deploy.sh.hbs') || normalizedPath.endsWith('deploy.sh.hbs')) {
          // Read actual template file
          try {
            const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'external-system', 'deploy.sh.hbs');
            if (fsSync.existsSync(templatePath)) {
              return Promise.resolve(fsSync.readFileSync(templatePath, 'utf8'));
            }
          } catch (error) {
            // Fall through to fallback
          }
          // Fallback if file doesn't exist - return valid template content
          return Promise.resolve('#!/bin/bash\n' +
            '# Deploy {{systemKey}} external system and datasources using aifabrix CLI\n' +
            '\n' +
            'set -e\n' +
            '\n' +
            'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"\n' +
            'ENVIRONMENT="${ENVIRONMENT:-dev}"\n' +
            'CONTROLLER="${CONTROLLER:-http://localhost:3000}"\n' +
            '\n' +
            'echo "🔍 Validating {{systemKey}} configuration files..."\n' +
            '{{#each allJsonFiles}}\n' +
            'aifabrix validate "${SCRIPT_DIR}/{{this}}" || exit 1\n' +
            '{{/each}}\n' +
            '\n' +
            'echo "✅ Validation passed"\n' +
            '\n' +
            'echo "🚀 Deploying {{systemKey}} external system and datasources..."\n' +
            'echo "   Environment: ${ENVIRONMENT}"\n' +
            'echo "   Controller: ${CONTROLLER}"\n' +
            '\n' +
            '# Deploy datasources\n' +
            '{{#each datasourceFileNames}}\n' +
            'aifabrix datasource deploy {{../systemKey}} "${SCRIPT_DIR}/{{this}}" \\\n' +
            '  --environment "${ENVIRONMENT}" --controller "${CONTROLLER}" || exit 1\n' +
            '{{/each}}\n' +
            '\n' +
            'echo "✅ Deployment complete"\n' +
            '\n' +
            '# Optional: Run tests\n' +
            'if [ "${RUN_TESTS:-false}" = "true" ]; then\n' +
            '  echo "🧪 Running integration tests..."\n' +
            '  aifabrix test-integration {{systemKey}} --environment "${ENVIRONMENT}" --controller "${CONTROLLER}"\n' +
            'fi\n');
        } else if (normalizedPath.includes('deploy.ps1.hbs') || normalizedPath.endsWith('deploy.ps1.hbs')) {
          // Read actual template file
          try {
            const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'external-system', 'deploy.ps1.hbs');
            if (fsSync.existsSync(templatePath)) {
              return Promise.resolve(fsSync.readFileSync(templatePath, 'utf8'));
            }
          } catch (error) {
            // Fall through to fallback
          }
          // Fallback if file doesn't exist - return valid template content
          return Promise.resolve('# Deploy {{systemKey}} external system and datasources using aifabrix CLI\n' +
            '\n' +
            '$ErrorActionPreference = "Stop"\n' +
            '\n' +
            '$SCRIPT_DIR = $PSScriptRoot\n' +
            '$env:ENVIRONMENT = if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }\n' +
            '$env:CONTROLLER = if ($env:CONTROLLER) { $env:CONTROLLER } else { "http://localhost:3000" }\n' +
            '\n' +
            'Write-Host "🔍 Validating {{systemKey}} configuration files..."\n' +
            '{{#each allJsonFiles}}\n' +
            'aifabrix validate "${SCRIPT_DIR}\\{{this}}"\n' +
            'if ($LASTEXITCODE -ne 0) { exit 1 }\n' +
            '{{/each}}\n' +
            '\n' +
            'Write-Host "✅ Validation passed"\n' +
            '\n' +
            'Write-Host "🚀 Deploying {{systemKey}} external system and datasources..."\n' +
            'Write-Host "   Environment: $env:ENVIRONMENT"\n' +
            'Write-Host "   Controller: $env:CONTROLLER"\n' +
            '\n' +
            '# Deploy datasources\n' +
            '{{#each datasourceFileNames}}\n' +
            'aifabrix datasource deploy {{../systemKey}} "${SCRIPT_DIR}\\{{this}}" --environment $env:ENVIRONMENT --controller $env:CONTROLLER\n' +
            'if ($LASTEXITCODE -ne 0) { exit 1 }\n' +
            '{{/each}}\n' +
            '\n' +
            'Write-Host "✅ Deployment complete"\n' +
            '\n' +
            '# Optional: Run tests\n' +
            'if ($env:RUN_TESTS -eq "true") {\n' +
            '  Write-Host "🧪 Running integration tests..."\n' +
            '  aifabrix test-integration {{systemKey}} --environment $env:ENVIRONMENT --controller $env:CONTROLLER\n' +
            '}\n');
        }
        // For other files, return the default mock value
        return Promise.resolve('existing: content');
      });
    });

    it('should generate deploy.sh and deploy.ps1 scripts', async() => {
      const result = await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      expect(fsPromises.writeFile).toHaveBeenCalledTimes(2);
      expect(fsPromises.chmod).toHaveBeenCalledTimes(1);
      expect(result.deployShPath).toContain('deploy.sh');
      expect(result.deployPs1Path).toContain('deploy.ps1');
    });

    it('should generate deploy.sh with correct content', async() => {
      await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      const deployShCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('deploy.sh')
      );
      expect(deployShCall).toBeDefined();
      const scriptContent = deployShCall[1];
      expect(scriptContent).toContain('#!/bin/bash');
      expect(scriptContent).toContain(systemKey);
      expect(scriptContent).toContain('aifabrix validate');
      expect(scriptContent).toContain('aifabrix datasource deploy');
      expect(scriptContent).toContain('ENVIRONMENT');
      expect(scriptContent).toContain('CONTROLLER');
      expect(scriptContent).toContain('RUN_TESTS');
    });

    it('should generate deploy.ps1 with correct content', async() => {
      await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      const deployPs1Call = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('deploy.ps1')
      );
      expect(deployPs1Call).toBeDefined();
      const scriptContent = deployPs1Call[1];
      expect(scriptContent).toContain('$ErrorActionPreference');
      expect(scriptContent).toContain(systemKey);
      expect(scriptContent).toContain('aifabrix validate');
      expect(scriptContent).toContain('aifabrix datasource deploy');
      expect(scriptContent).toContain('$env:ENVIRONMENT');
      expect(scriptContent).toContain('$env:CONTROLLER');
      expect(scriptContent).toContain('$env:RUN_TESTS');
    });

    it('should make deploy.sh executable', async() => {
      await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      const chmodCall = fsPromises.chmod.mock.calls.find(call =>
        call[0].includes('deploy.sh')
      );
      expect(chmodCall).toBeDefined();
      expect(chmodCall[1]).toBe(0o755);
    });

    it('should include all JSON files in validation', async() => {
      await wizardGenerator.generateDeployScripts(
        appPath,
        systemKey,
        systemFileName,
        datasourceFileNames
      );

      const deployShCall = fsPromises.writeFile.mock.calls.find(call =>
        call[0].includes('deploy.sh')
      );
      const scriptContent = deployShCall[1];
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
