/**
 * Tests for AI Fabrix Builder Generator Split Functions
 *
 * @fileoverview Unit tests for splitDeployJson and related functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const generator = require('../../../lib/generator');

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const mockFs = {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn()
    }
  };
  return mockFs;
});

describe('Generator Split Functions', () => {
  const deployJsonPath = path.join(process.cwd(), 'test-deploy.json');
  const outputDir = path.join(process.cwd(), 'output');

  let applicationsReadmeTemplateContent;
  beforeAll(() => {
    const actualFs = jest.requireActual('fs');
    const projectRoot = path.join(__dirname, '..', '..', '..');
    const templatePath = path.join(projectRoot, 'templates', 'applications', 'README.md.hbs');
    applicationsReadmeTemplateContent = actualFs.readFileSync(templatePath, 'utf8');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      const pathStr = String(filePath).replace(/\\/g, '/');
      if (pathStr.includes('applications/README.md.hbs')) {
        return applicationsReadmeTemplateContent;
      }
      if (pathStr.includes('external-system/README.md.hbs')) {
        return jest.requireActual('fs').readFileSync(
          path.join(path.join(__dirname, '..', '..', '..'), 'templates', 'external-system', 'README.md.hbs'),
          'utf8'
        );
      }
      return undefined;
    });
  });

  describe('extractEnvTemplate', () => {
    it('should convert configuration array to env.template format', () => {
      const configuration = [
        { name: 'DATABASE_URL', value: 'databases-miso-controller-0-urlKeyVault', location: 'keyvault', required: true },
        { name: 'PORT', value: '3000', location: 'variable', required: false },
        { name: 'NODE_ENV', value: 'production', location: 'variable', required: false }
      ];

      const result = generator.extractEnvTemplate(configuration);

      expect(result).toContain('DATABASE_URL=kv://databases-miso-controller-0-urlKeyVault');
      expect(result).toContain('PORT=3000');
      expect(result).toContain('NODE_ENV=production');
    });

    it('should handle empty configuration array', () => {
      const result = generator.extractEnvTemplate([]);
      expect(result).toBe('');
    });

    it('should handle null/undefined configuration', () => {
      expect(generator.extractEnvTemplate(null)).toBe('');
      expect(generator.extractEnvTemplate(undefined)).toBe('');
    });

    it('should skip invalid configuration items', () => {
      const configuration = [
        { name: 'VALID', value: 'value', location: 'variable' },
        { name: '', value: 'value', location: 'variable' },
        { name: 'VALID2', value: '', location: 'variable' },
        { name: 'VALID3', value: 'value3', location: 'variable' }
      ];

      const result = generator.extractEnvTemplate(configuration);
      expect(result).toContain('VALID=value');
      expect(result).toContain('VALID3=value3');
      expect(result).not.toContain('VALID2=');
    });

    it('should handle variables with ${VAR} references', () => {
      const configuration = [
        { name: 'DATABASE_URL', value: '${ENVIRONMENT}-db-url', location: 'variable' }
      ];

      const result = generator.extractEnvTemplate(configuration);
      expect(result).toContain('DATABASE_URL=${ENVIRONMENT}-db-url');
    });
  });

  describe('parseImageReference', () => {
    it('should parse full image reference with registry', () => {
      const imageString = 'aifabrixdevacr.azurecr.io/aifabrix/miso-controller:latest';
      const result = generator.parseImageReference(imageString);

      expect(result.registry).toBe('aifabrixdevacr.azurecr.io');
      expect(result.name).toBe('aifabrix/miso-controller');
      expect(result.tag).toBe('latest');
    });

    it('should parse image without registry', () => {
      const imageString = 'myapp:v1.0.0';
      const result = generator.parseImageReference(imageString);

      expect(result.registry).toBeNull();
      expect(result.name).toBe('myapp');
      expect(result.tag).toBe('v1.0.0');
    });

    it('should parse image without tag', () => {
      const imageString = 'aifabrixdevacr.azurecr.io/aifabrix/miso-controller';
      const result = generator.parseImageReference(imageString);

      expect(result.registry).toBe('aifabrixdevacr.azurecr.io');
      expect(result.name).toBe('aifabrix/miso-controller');
      expect(result.tag).toBe('latest');
    });

    it('should handle image with just name', () => {
      const imageString = 'myapp';
      const result = generator.parseImageReference(imageString);

      expect(result.registry).toBeNull();
      expect(result.name).toBe('myapp');
      expect(result.tag).toBe('latest');
    });

    it('should handle null/undefined image string', () => {
      expect(generator.parseImageReference(null)).toEqual({ registry: null, name: null, tag: 'latest' });
      expect(generator.parseImageReference(undefined)).toEqual({ registry: null, name: null, tag: 'latest' });
      expect(generator.parseImageReference('')).toEqual({ registry: null, name: null, tag: 'latest' });
    });

    it('should handle image with multiple slashes in name', () => {
      const imageString = 'registry.io/org/suborg/app:v1.0';
      const result = generator.parseImageReference(imageString);

      expect(result.registry).toBe('registry.io');
      expect(result.name).toBe('org/suborg/app');
      expect(result.tag).toBe('v1.0');
    });
  });

  describe('extractVariablesYaml', () => {
    it('should extract variables from complete deployment JSON', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'myacr.azurecr.io/testapp:v1.0.0',
        registryMode: 'acr',
        port: 3000,
        requiresDatabase: true,
        requiresRedis: true,
        requiresStorage: false,
        databases: [{ name: 'testapp' }],
        healthCheck: {
          path: '/health',
          interval: 30
        },
        authentication: {
          type: 'azure',
          enableSSO: true,
          requiredRoles: ['admin']
        },
        build: {
          dockerfile: 'Dockerfile',
          envOutputPath: '.env'
        }
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.app.key).toBe('testapp');
      expect(result.app.displayName).toBe('Test App');
      expect(result.app.description).toBe('A test application');
      expect(result.app.type).toBe('webapp');
      expect(result.image.name).toBe('testapp');
      expect(result.image.registry).toBe('myacr.azurecr.io');
      expect(result.image.tag).toBe('v1.0.0');
      expect(result.image.registryMode).toBe('acr');
      expect(result.port).toBe(3000);
      expect(result.requires.database).toBe(true);
      expect(result.requires.redis).toBe(true);
      expect(result.requires.storage).toBe(false);
      expect(result.requires.databases).toEqual([{ name: 'testapp' }]);
      expect(result.healthCheck).toEqual({ path: '/health', interval: 30 });
      expect(result.authentication).toEqual({ type: 'azure', enableSSO: true, requiredRoles: ['admin'] });
      expect(result.build).toEqual({ dockerfile: 'Dockerfile', envOutputPath: '.env' });
    });

    it('should handle deployment with minimal fields', () => {
      const deployment = {
        key: 'minimal',
        displayName: 'Minimal App',
        description: 'Minimal description',
        type: 'webapp'
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.app.key).toBe('minimal');
      expect(result.app.displayName).toBe('Minimal App');
      expect(result.app.description).toBe('Minimal description');
      expect(result.app.type).toBe('webapp');
      expect(result.image).toBeUndefined();
      expect(result.port).toBeUndefined();
    });

    it('should extract version from deployment to app section', () => {
      const deployment = {
        key: 'versioned-app',
        displayName: 'Versioned App',
        description: 'App with version',
        type: 'webapp',
        version: '2.1.0'
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.app.key).toBe('versioned-app');
      expect(result.app.version).toBe('2.1.0');
    });

    it('should throw error for invalid deployment object', () => {
      expect(() => generator.extractVariablesYaml(null)).toThrow('Deployment object is required');
      expect(() => generator.extractVariablesYaml(undefined)).toThrow('Deployment object is required');
    });

    it('should not include roles or permissions in variables (they go only to rbac.yml)', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        type: 'webapp',
        roles: [{ value: 'admin', displayName: 'Admin' }],
        permissions: [{ name: 'read', roles: ['admin'] }]
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.roles).toBeUndefined();
      expect(result.permissions).toBeUndefined();
    });

    it('should include only portalInput entries in configuration (no value/location/required)', () => {
      const deployment = {
        key: 'dataplane',
        displayName: 'Dataplane',
        type: 'webapp',
        configuration: [
          { name: 'PORT', value: '3001', location: 'variable', required: false },
          { name: 'LOG_LEVEL', value: 'INFO', location: 'variable', required: false, portalInput: { field: 'select', label: 'Log Level', options: ['DEBUG', 'INFO'] } }
        ]
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.configuration).toHaveLength(1);
      expect(result.configuration[0]).toEqual({ name: 'LOG_LEVEL', portalInput: { field: 'select', label: 'Log Level', options: ['DEBUG', 'INFO'] } });
      expect(result.configuration[0].value).toBeUndefined();
      expect(result.configuration[0].location).toBeUndefined();
    });

    it('should not add configuration to variables when no items have portalInput', () => {
      const deployment = {
        key: 'app',
        displayName: 'App',
        type: 'webapp',
        configuration: [
          { name: 'PORT', value: '3000', location: 'variable', required: false }
        ]
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.configuration).toBeUndefined();
    });

    it('should produce app block, configuration, and externalIntegration for external format (deployment.system)', () => {
      const deployment = {
        system: {
          key: 'test-hubspot',
          displayName: 'Companies',
          description: 'HubSpot CRM integration'
        },
        configuration: [
          {
            name: 'BASEURL',
            value: 'https://api.hubapi.com',
            location: 'variable',
            required: true,
            portalInput: { field: 'text', label: 'Base URL', placeholder: 'https://api.hubapi.com', validation: { required: true } }
          }
        ],
        dataSources: [
          { key: 'companies-data', displayName: 'Companies Data' },
          { key: 'test-hubspot-data', displayName: 'Deals Data' }
        ]
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.app).toEqual({
        key: 'test-hubspot',
        displayName: 'Companies',
        description: 'HubSpot CRM integration',
        type: 'external'
      });
      expect(result.configuration).toHaveLength(1);
      expect(result.configuration[0].name).toBe('BASEURL');
      expect(result.configuration[0].portalInput).toBeDefined();
      expect(result.image).toBeUndefined();
      expect(result.port).toBeUndefined();
      expect(result.externalIntegration).toBeDefined();
      expect(result.externalIntegration.schemaBasePath).toBe('./');
      expect(result.externalIntegration.systems).toEqual(['test-hubspot-system.yaml']);
      expect(result.externalIntegration.dataSources).toEqual([
        'test-hubspot-datasource-companies-data.yaml',
        'test-hubspot-datasource-data.yaml'
      ]);
      expect(result.externalIntegration.autopublish).toBe(true);
      expect(result.externalIntegration.version).toBe('1.0.0');
    });

    it('should handle optional fields', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'Test',
        type: 'webapp',
        repository: { enabled: true, repositoryUrl: 'https://github.com/org/repo' },
        startupCommand: 'npm start',
        runtimeVersion: '18',
        scaling: { minReplicas: 1, maxReplicas: 5 },
        frontDoorRouting: { enabled: true }
      };

      const result = generator.extractVariablesYaml(deployment);

      expect(result.repository).toEqual({ enabled: true, repositoryUrl: 'https://github.com/org/repo' });
      expect(result.startupCommand).toBe('npm start');
      expect(result.runtimeVersion).toBe('18');
      expect(result.scaling).toEqual({ minReplicas: 1, maxReplicas: 5 });
      expect(result.frontDoorRouting).toEqual({ enabled: true });
    });
  });

  describe('extractRbacYaml', () => {
    it('should extract roles and permissions', () => {
      const deployment = {
        roles: [
          { value: 'admin', displayName: 'Administrator' },
          { value: 'user', displayName: 'User' }
        ],
        permissions: [
          { value: 'read', displayName: 'Read' },
          { value: 'write', displayName: 'Write' }
        ]
      };

      const result = generator.extractRbacYaml(deployment);

      expect(result).not.toBeNull();
      expect(result.roles).toHaveLength(2);
      expect(result.permissions).toHaveLength(2);
    });

    it('should return null when no roles or permissions', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App'
      };

      const result = generator.extractRbacYaml(deployment);
      expect(result).toBeNull();
    });

    it('should return null for empty arrays', () => {
      const deployment = {
        roles: [],
        permissions: []
      };

      const result = generator.extractRbacYaml(deployment);
      expect(result).toBeNull();
    });

    it('should extract only roles when permissions missing', () => {
      const deployment = {
        roles: [{ value: 'admin', displayName: 'Administrator' }]
      };

      const result = generator.extractRbacYaml(deployment);
      expect(result).not.toBeNull();
      expect(result.roles).toHaveLength(1);
      expect(result.permissions).toBeUndefined();
    });

    it('should extract only permissions when roles missing', () => {
      const deployment = {
        permissions: [{ value: 'read', displayName: 'Read' }]
      };

      const result = generator.extractRbacYaml(deployment);
      expect(result).not.toBeNull();
      expect(result.permissions).toHaveLength(1);
      expect(result.roles).toBeUndefined();
    });

    it('should handle null/undefined deployment', () => {
      expect(generator.extractRbacYaml(null)).toBeNull();
      expect(generator.extractRbacYaml(undefined)).toBeNull();
    });
  });

  describe('generateReadmeFromDeployJson', () => {
    it('should generate README.md content from applications template', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test Application',
        description: 'A test application for deployment',
        port: 3000,
        image: 'myacr.azurecr.io/testapp:latest'
      };

      const result = generator.generateReadmeFromDeployJson(deployment);

      expect(result).toContain('# Test Application Builder');
      expect(result).toContain('Test Application');
      expect(result).toContain('testapp');
      expect(result).toContain('3000');
      expect(result).toContain('myacr.azurecr.io');
    });

    it('should handle deployment with minimal fields (displayName from key)', () => {
      const deployment = {
        key: 'minimal'
      };

      const result = generator.generateReadmeFromDeployJson(deployment);

      expect(result).toContain('# Minimal Builder');
      expect(result).toContain('minimal');
    });

    it('should generate README from external-system template when deployment has system (external format)', () => {
      const deployment = {
        system: {
          key: 'test-hubspot',
          displayName: 'Companies',
          description: 'HubSpot CRM integration',
          type: 'openapi'
        },
        dataSources: [
          { key: 'companies-data', displayName: 'Companies Data', systemKey: 'test-hubspot' },
          { key: 'deals-data', displayName: 'Deals Data', systemKey: 'test-hubspot' }
        ]
      };

      const result = generator.generateReadmeFromDeployJson(deployment);

      expect(result).toContain('# Companies');
      expect(result).toContain('HubSpot CRM integration');
      expect(result).toContain('test-hubspot');
      expect(result).toContain('openapi');
      expect(result).toContain('aifabrix create test-hubspot --type external');
      expect(result).toContain('integration/test-hubspot');
      expect(result).toContain('Datasource: Companies Data');
      expect(result).toContain('Datasource: Deals Data');
    });

    it('should throw error for invalid deployment', () => {
      expect(() => generator.generateReadmeFromDeployJson(null)).toThrow('Deployment object is required');
      expect(() => generator.generateReadmeFromDeployJson(undefined)).toThrow('Deployment object is required');
    });
  });

  describe('splitDeployJson', () => {
    const mockDeployment = {
      key: 'testapp',
      displayName: 'Test App',
      description: 'A test application',
      type: 'webapp',
      image: 'myacr.azurecr.io/testapp:v1.0.0',
      registryMode: 'acr',
      port: 3000,
      requiresDatabase: true,
      requiresRedis: false,
      requiresStorage: false,
      databases: [{ name: 'testapp' }],
      healthCheck: {
        path: '/health',
        interval: 30
      },
      authentication: {
        type: 'azure',
        enableSSO: true,
        requiredRoles: ['admin']
      },
      configuration: [
        { name: 'DATABASE_URL', value: 'databases-testapp-0-urlKeyVault', location: 'keyvault', required: true },
        { name: 'PORT', value: '3000', location: 'variable', required: false }
      ],
      roles: [
        { value: 'admin', displayName: 'Administrator' }
      ],
      permissions: [
        { value: 'read', displayName: 'Read' }
      ]
    };

    beforeEach(() => {
      fs.promises.readFile.mockResolvedValue(JSON.stringify(mockDeployment));
      fs.promises.writeFile.mockResolvedValue();
      fs.promises.mkdir.mockResolvedValue();
    });

    it('should split deployment JSON into component files', async() => {
      const result = await generator.splitDeployJson(deployJsonPath);

      expect(result).toHaveProperty('envTemplate');
      expect(result).toHaveProperty('variables');
      expect(result).toHaveProperty('rbac');
      expect(result).toHaveProperty('readme');

      expect(fs.promises.readFile).toHaveBeenCalledWith(deployJsonPath, 'utf8');
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(4);
    });

    it('should write env.template correctly', async() => {
      await generator.splitDeployJson(deployJsonPath);

      const writeCalls = fs.promises.writeFile.mock.calls;
      const envTemplateCall = writeCalls.find(call => call[0].endsWith('env.template'));

      expect(envTemplateCall).toBeDefined();
      expect(envTemplateCall[1]).toContain('DATABASE_URL=kv://databases-testapp-0-urlKeyVault');
      expect(envTemplateCall[1]).toContain('PORT=3000');
    });

    it('should write application.yaml correctly', async() => {
      await generator.splitDeployJson(deployJsonPath);

      const writeCalls = fs.promises.writeFile.mock.calls;
      const variablesCall = writeCalls.find(call => call[0].endsWith('application.yaml'));

      expect(variablesCall).toBeDefined();
      const variablesYaml = yaml.load(variablesCall[1]);
      expect(variablesYaml.app.key).toBe('testapp');
      expect(variablesYaml.image.name).toBe('testapp');
      expect(variablesYaml.port).toBe(3000);
    });

    it('should not include roles or permissions in application.yaml (only in rbac.yml)', async() => {
      await generator.splitDeployJson(deployJsonPath);

      const writeCalls = fs.promises.writeFile.mock.calls;
      const variablesCall = writeCalls.find(call => call[0].endsWith('application.yaml'));
      const variablesYaml = yaml.load(variablesCall[1]);

      expect(variablesYaml.roles).toBeUndefined();
      expect(variablesYaml.permissions).toBeUndefined();
    });

    it('should include only portalInput entries in application.yaml (values are in env.template)', async() => {
      const deploymentWithPortalInput = {
        ...mockDeployment,
        configuration: [
          { name: 'PORT', value: '3001', location: 'variable', required: false },
          {
            name: 'LOG_LEVEL',
            value: 'INFO',
            location: 'variable',
            required: false,
            portalInput: { field: 'select', label: 'Log Level', options: ['DEBUG', 'INFO', 'WARNING', 'ERROR'] }
          }
        ]
      };
      fs.promises.readFile.mockResolvedValue(JSON.stringify(deploymentWithPortalInput));

      await generator.splitDeployJson(deployJsonPath);

      const writeCalls = fs.promises.writeFile.mock.calls;
      const variablesCall = writeCalls.find(call => call[0].endsWith('application.yaml'));
      const variablesYaml = yaml.load(variablesCall[1]);

      expect(variablesYaml.configuration).toBeDefined();
      expect(variablesYaml.configuration).toHaveLength(1);
      expect(variablesYaml.configuration[0].name).toBe('LOG_LEVEL');
      expect(variablesYaml.configuration[0].portalInput).toEqual({
        field: 'select',
        label: 'Log Level',
        options: ['DEBUG', 'INFO', 'WARNING', 'ERROR']
      });
      expect(variablesYaml.configuration[0].value).toBeUndefined();
    });

    it('should write rbac.yml when roles/permissions exist', async() => {
      await generator.splitDeployJson(deployJsonPath);

      const writeCalls = fs.promises.writeFile.mock.calls;
      const rbacCall = writeCalls.find(call => call[0].endsWith('rbac.yml'));

      expect(rbacCall).toBeDefined();
      const rbacYaml = yaml.load(rbacCall[1]);
      expect(rbacYaml.roles).toHaveLength(1);
      expect(rbacYaml.permissions).toHaveLength(1);
    });

    it('should not write rbac.yml when no roles/permissions', async() => {
      const deploymentWithoutRbac = { ...mockDeployment };
      delete deploymentWithoutRbac.roles;
      delete deploymentWithoutRbac.permissions;

      fs.promises.readFile.mockResolvedValue(JSON.stringify(deploymentWithoutRbac));

      const result = await generator.splitDeployJson(deployJsonPath);

      expect(result.rbac).toBeUndefined();
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should use custom output directory', async() => {
      await generator.splitDeployJson(deployJsonPath, outputDir);

      const writeCalls = fs.promises.writeFile.mock.calls;
      writeCalls.forEach(call => {
        expect(call[0]).toContain(outputDir);
      });
    });

    it('should create output directory if it does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        const pathStr = String(filePath).replace(/\\/g, '/');
        // Return true for deploy JSON path and README template paths, false for outputDir
        return filePath === deployJsonPath ||
          pathStr.includes('applications/README.md.hbs') ||
          pathStr.includes('external-system/README.md.hbs');
      });

      await generator.splitDeployJson(deployJsonPath, outputDir);

      expect(fs.promises.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
    });

    it('should throw error when JSON file not found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(generator.splitDeployJson(deployJsonPath)).rejects.toThrow('Deployment JSON file not found');
    });

    it('should throw error for invalid JSON', async() => {
      fs.promises.readFile.mockResolvedValue('invalid json {');

      await expect(generator.splitDeployJson(deployJsonPath)).rejects.toThrow('Invalid JSON syntax');
    });

    it('should throw error for invalid path parameter', async() => {
      await expect(generator.splitDeployJson(null)).rejects.toThrow('Deployment JSON path is required');
      await expect(generator.splitDeployJson(undefined)).rejects.toThrow('Deployment JSON path is required');
    });

    it('should handle deployment without configuration array', async() => {
      const deploymentWithoutConfig = { ...mockDeployment };
      delete deploymentWithoutConfig.configuration;

      fs.promises.readFile.mockResolvedValue(JSON.stringify(deploymentWithoutConfig));

      const result = await generator.splitDeployJson(deployJsonPath);

      expect(result).toHaveProperty('envTemplate');
      const writeCalls = fs.promises.writeFile.mock.calls;
      const envTemplateCall = writeCalls.find(call => call[0].endsWith('env.template'));
      expect(envTemplateCall[1]).toBe('');
    });

    it('should handle deployment with external registry mode', async() => {
      const deploymentWithExternal = {
        ...mockDeployment,
        registryMode: 'external',
        image: 'docker.io/library/nginx:latest'
      };

      fs.promises.readFile.mockResolvedValue(JSON.stringify(deploymentWithExternal));

      await generator.splitDeployJson(deployJsonPath);

      const writeCalls = fs.promises.writeFile.mock.calls;
      const variablesCall = writeCalls.find(call => call[0].endsWith('application.yaml'));
      const variablesYaml = yaml.load(variablesCall[1]);
      expect(variablesYaml.image.registryMode).toBe('external');
    });

    it('should handle deployment without optional fields', async() => {
      const minimalDeployment = {
        key: 'minimal',
        displayName: 'Minimal',
        description: 'Minimal description',
        type: 'webapp',
        configuration: []
      };

      fs.promises.readFile.mockResolvedValue(JSON.stringify(minimalDeployment));

      const result = await generator.splitDeployJson(deployJsonPath);

      expect(result).toHaveProperty('envTemplate');
      expect(result).toHaveProperty('variables');
      expect(result).toHaveProperty('readme');
      expect(result.rbac).toBeUndefined();
    });
  });
});

