/**
 * Tests for AI Fabrix Builder Generator Module
 *
 * @fileoverview Unit tests for generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const generator = require('../../../lib/generator');
const keyGenerator = require('../../../lib/core/key-generator');
const validator = require('../../../lib/validation/validator');

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
      writeFile: jest.fn()
    }
  };
  return mockFs;
});

// Mock paths module to return builder path for regular apps
jest.mock('../../../lib/utils/paths', () => {
  const actualPaths = jest.requireActual('../../../lib/utils/paths');
  const path = require('path');
  return {
    ...actualPaths,
    detectAppType: jest.fn().mockResolvedValue({
      isExternal: false,
      appPath: path.join(process.cwd(), 'builder', 'testapp'),
      appType: 'regular',
      baseDir: 'builder'
    }),
    getDeployJsonPath: jest.fn((appName, appType, preferNew) => {
      const appPath = path.join(process.cwd(), 'builder', appName);
      return path.join(appPath, `${appName}-deploy.json`);
    })
  };
});

describe('Generator Module', () => {
  const appName = 'testapp';
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const templatePath = path.join(builderPath, 'env.template');
  const rbacPath = path.join(builderPath, 'rbac.yaml');
  const jsonPath = path.join(builderPath, 'testapp-deploy.json');
  const writtenFiles = {};

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear writtenFiles
    Object.keys(writtenFiles).forEach(key => delete writtenFiles[key]);
  });

  describe('generateDeployJson', () => {
    const mockVariables = {
      app: {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp'
      },
      port: 3000,
      image: {
        name: 'testapp',
        registry: 'myacr.azurecr.io',
        tag: 'v1.0.0',
        registryMode: 'acr'
      },
      requires: {
        database: true,
        databases: [{ name: 'testapp' }],
        redis: true,
        storage: false
      },
      healthCheck: {
        path: '/health',
        interval: 30
      }
    };

    const mockEnvTemplate = `NODE_ENV=development
PORT=3000
DATABASE_URL=kv://postgres-urlKeyVault
REDIS_URL=redis://localhost:6379
API_KEY=kv://api-keyKeyVault
PUBLIC_CONFIG=public-value`;

    const mockRbac = {
      roles: [
        {
          name: 'Admin',
          value: 'admin',
          description: 'Administrator role'
        },
        {
          name: 'User',
          value: 'user',
          description: 'Regular user role'
        }
      ],
      permissions: [
        {
          name: 'app:read',
          roles: ['user', 'admin'],
          description: 'Read access to application'
        },
        {
          name: 'app:write',
          roles: ['admin'],
          description: 'Write access to application'
        }
      ]
    };

    beforeEach(() => {
      // Clear writtenFiles for this describe block
      Object.keys(writtenFiles).forEach(key => delete writtenFiles[key]);

      fs.writeFileSync.mockImplementation((filePath, content) => {
        writtenFiles[filePath] = content;
      });

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template') ||
               filePath.includes('rbac.yaml');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        // First check if this file was written (for deploy.json files)
        if (writtenFiles[filePath]) {
          return writtenFiles[filePath];
        }
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(mockVariables);
        }
        if (filePath.includes('env.template')) {
          return mockEnvTemplate;
        }
        if (filePath.includes('rbac.yaml')) {
          return yaml.dump(mockRbac);
        }
        if (filePath.includes('testapp-deploy.json')) {
          // Return what was written, or empty if nothing
          return writtenFiles[filePath] || '';
        }
        return '';
      });
    });

    it('should generate deployment JSON with all components', async() => {
      const result = await generator.generateDeployJson(appName);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('testapp-deploy.json'),
        expect.any(String),
        { mode: 0o644 }
      );

      // Verify the written content - use the result path or find by filename
      const resultPath = result || jsonPath;
      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        path.normalize(call[0]) === path.normalize(resultPath) ||
        call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.key).toBe('testapp');
      expect(deployment.displayName).toBe('Test App');
      expect(deployment.description).toBe('A test application');
      expect(deployment.type).toBe('webapp');
      expect(deployment.image).toBe('myacr.azurecr.io/testapp:v1.0.0');
      expect(deployment.registryMode).toBe('acr');
      expect(deployment.port).toBe(3000);
      expect(deployment.requiresDatabase).toBe(true);
      expect(deployment.requiresRedis).toBe(true);
      expect(deployment.requiresStorage).toBe(false);
      expect(deployment.databases).toEqual([{ name: 'testapp' }]);
      expect(deployment.configuration).toHaveLength(6);
      expect(deployment.roles).toHaveLength(2);
      expect(deployment.permissions).toHaveLength(2);
      expect(deployment.authentication).toBeDefined();
      // authentication should have type, enableSSO, requiredRoles from schema
      expect(deployment.authentication.type).toBeDefined();
      expect(deployment.authentication.enableSSO).toBeDefined();
      expect(deployment.authentication.requiredRoles).toBeDefined();
      // deploymentKey should be present and valid SHA256 hash
      expect(deployment.deploymentKey).toBeDefined();
      expect(deployment.deploymentKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should merge portalInput from variables.yaml into deployment JSON', async() => {
      const variablesWithPortalInput = {
        ...mockVariables,
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              field: 'password',
              label: 'MISO Client ID',
              placeholder: 'Enter your MISO client ID',
              masked: true,
              validation: {
                required: true
              }
            }
          },
          {
            name: 'API_KEY',
            portalInput: {
              field: 'select',
              label: 'API Key Type',
              placeholder: 'Select API key type',
              options: ['development', 'production']
            }
          }
        ]
      };

      const envTemplateWithVars = `MISO_CLIENTID=kv://miso-test-client-idKeyVault
API_KEY=kv://api-keyKeyVault
NODE_ENV=development
PORT=3000
DATABASE_URL=kv://postgres-urlKeyVault
REDIS_URL=redis://localhost:6379`;

      fs.readFileSync.mockImplementation((filePath) => {
        if (writtenFiles[filePath]) {
          return writtenFiles[filePath];
        }
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variablesWithPortalInput);
        }
        if (filePath.includes('env.template')) {
          return envTemplateWithVars;
        }
        if (filePath.includes('rbac.yaml')) {
          return yaml.dump(mockRbac);
        }
        return '';
      });

      const result = await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      const misoClientIdConfig = deployment.configuration.find(c => c.name === 'MISO_CLIENTID');
      expect(misoClientIdConfig).toBeDefined();
      expect(misoClientIdConfig.portalInput).toEqual({
        field: 'password',
        label: 'MISO Client ID',
        placeholder: 'Enter your MISO client ID',
        masked: true,
        validation: {
          required: true
        }
      });

      const apiKeyConfig = deployment.configuration.find(c => c.name === 'API_KEY');
      expect(apiKeyConfig).toBeDefined();
      expect(apiKeyConfig.portalInput).toEqual({
        field: 'select',
        label: 'API Key Type',
        placeholder: 'Select API key type',
        options: ['development', 'production']
      });

      // Variables without portalInput should not have it
      const nodeEnvConfig = deployment.configuration.find(c => c.name === 'NODE_ENV');
      expect(nodeEnvConfig).toBeDefined();
      expect(nodeEnvConfig.portalInput).toBeUndefined();
    });

    it('should handle missing rbac.yaml gracefully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template');
        // rbac.yaml not found
      });

      const result = await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.authentication.enableSSO).toBe(false);
      expect(deployment.authentication.type).toBe('none');
      // deploymentKey should be present and valid SHA256 hash
      expect(deployment.deploymentKey).toBeDefined();
      expect(deployment.deploymentKey).toMatch(/^[a-f0-9]{64}$/);
      expect(deployment.authentication.requiredRoles).toEqual([]);
      expect(deployment.roles).toBeUndefined();
      expect(deployment.permissions).toBeUndefined();
    });

    it('should throw error when validation fails', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000
      };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') || filePath.includes('env.template');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({
        valid: false,
        errors: ['Error 1', 'Error 2']
      });

      await expect(generator.generateDeployJson(appName)).rejects.toThrow(
        'Generated deployment JSON does not match schema'
      );
    });

    it('should throw error if app name is invalid', async() => {
      await expect(generator.generateDeployJson()).rejects.toThrow('App name is required and must be a string');
      await expect(generator.generateDeployJson(123)).rejects.toThrow('App name is required and must be a string');
      await expect(generator.generateDeployJson('')).rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error if variables.yaml not found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(generator.generateDeployJson(appName)).rejects.toThrow(`variables.yaml not found: ${variablesPath}`);
    });

    it('should throw error if env.template not found', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml');
        // env.template not found
      });

      await expect(generator.generateDeployJson(appName)).rejects.toThrow(`env.template not found: ${templatePath}`);
    });

    it('should throw error for invalid YAML syntax in variables.yaml', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

      await expect(generator.generateDeployJson(appName)).rejects.toThrow('Invalid YAML syntax in variables.yaml');
    });

    it('should throw error for invalid YAML syntax in rbac.yaml', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template') ||
               filePath.includes('rbac.yaml');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(mockVariables);
        }
        if (filePath.includes('env.template')) {
          return mockEnvTemplate;
        }
        if (filePath.includes('rbac.yaml')) {
          return 'invalid: yaml: content: [unclosed';
        }
        return '';
      });

      await expect(generator.generateDeployJson(appName)).rejects.toThrow('Invalid YAML syntax in rbac.yaml');
    });
  });

  describe('parseEnvironmentVariables', () => {
    it('should parse environment variables correctly', () => {
      const template = `NODE_ENV=development
PORT=3000
DATABASE_URL=kv://postgres-urlKeyVault
REDIS_URL=redis://localhost:6379
API_KEY=kv://api-keyKeyVault
PUBLIC_CONFIG=public-value
# This is a comment
EMPTY_LINE=

INVALID_LINE_WITHOUT_EQUALS`;

      const result = generator.parseEnvironmentVariables(template);

      expect(result).toHaveLength(6);

      // Check kv:// references are marked as keyvault
      const kvRefs = result.filter(config => config.location === 'keyvault');
      expect(kvRefs).toHaveLength(2);
      expect(kvRefs[0].name).toBe('DATABASE_URL');
      expect(kvRefs[0].value).toBe('postgres-urlKeyVault');
      expect(kvRefs[0].required).toBe(true);

      // Check regular variables
      const regularVars = result.filter(config => config.location === 'variable');
      expect(regularVars).toHaveLength(4);
      expect(regularVars.find(v => v.name === 'NODE_ENV').value).toBe('development');
      expect(regularVars.find(v => v.name === 'PORT').value).toBe('3000');
    });

    it('should mark sensitive variables as required', () => {
      const template = `PASSWORD=secret123
API_KEY=key123
AUTH_TOKEN=token123
DATABASE_PASSWORD=dbpass
NORMAL_VAR=value`;

      const result = generator.parseEnvironmentVariables(template);

      const requiredVars = result.filter(config => config.required);
      expect(requiredVars).toHaveLength(4);
      expect(requiredVars.map(v => v.name)).toEqual(['PASSWORD', 'API_KEY', 'AUTH_TOKEN', 'DATABASE_PASSWORD']);
    });

    it('should handle empty template', () => {
      const result = generator.parseEnvironmentVariables('');
      expect(result).toEqual([]);
    });

    it('should handle template with only comments', () => {
      const template = `# This is a comment
# Another comment
# Final comment`;

      const result = generator.parseEnvironmentVariables(template);
      expect(result).toEqual([]);
    });

    it('should merge portalInput from variables.yaml with env.template', () => {
      const template = `MISO_CLIENTID=kv://miso-test-client-idKeyVault
API_KEY=kv://api-keyKeyVault
NORMAL_VAR=value`;

      const variablesConfig = {
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              field: 'password',
              label: 'MISO Client ID',
              placeholder: 'Enter your MISO client ID',
              masked: true,
              validation: {
                required: true
              }
            }
          },
          {
            name: 'API_KEY',
            portalInput: {
              field: 'text',
              label: 'API Key',
              placeholder: 'Enter API key',
              validation: {
                required: true,
                pattern: '^[A-Z0-9-]+$'
              }
            }
          }
        ]
      };

      const result = generator.parseEnvironmentVariables(template, variablesConfig);

      expect(result).toHaveLength(3);

      const misoClientId = result.find(c => c.name === 'MISO_CLIENTID');
      expect(misoClientId).toBeDefined();
      expect(misoClientId.portalInput).toEqual({
        field: 'password',
        label: 'MISO Client ID',
        placeholder: 'Enter your MISO client ID',
        masked: true,
        validation: {
          required: true
        }
      });

      const apiKey = result.find(c => c.name === 'API_KEY');
      expect(apiKey).toBeDefined();
      expect(apiKey.portalInput).toEqual({
        field: 'text',
        label: 'API Key',
        placeholder: 'Enter API key',
        validation: {
          required: true,
          pattern: '^[A-Z0-9-]+$'
        }
      });

      const normalVar = result.find(c => c.name === 'NORMAL_VAR');
      expect(normalVar).toBeDefined();
      expect(normalVar.portalInput).toBeUndefined();
    });

    it('should handle variables without portalInput (backward compatibility)', () => {
      const template = `MISO_CLIENTID=kv://miso-test-client-idKeyVault
API_KEY=kv://api-keyKeyVault`;

      const result = generator.parseEnvironmentVariables(template);

      expect(result).toHaveLength(2);
      expect(result[0].portalInput).toBeUndefined();
      expect(result[1].portalInput).toBeUndefined();
    });

    it('should handle empty configuration section', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {
        configuration: []
      };

      const result = generator.parseEnvironmentVariables(template, variablesConfig);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toBeUndefined();
    });

    it('should ignore portalInput for variables not in env.template', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              field: 'password',
              label: 'MISO Client ID'
            }
          },
          {
            name: 'NONEXISTENT_VAR',
            portalInput: {
              field: 'text',
              label: 'Non-existent Variable'
            }
          }
        ]
      };

      const result = generator.parseEnvironmentVariables(template, variablesConfig);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MISO_CLIENTID');
      expect(result[0].portalInput).toBeDefined();
    });

    it('should validate portalInput structure - missing field', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              label: 'MISO Client ID'
              // Missing field
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'MISO_CLIENTID\': field is required and must be a string');
    });

    it('should validate portalInput structure - missing label', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              field: 'password'
              // Missing label
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'MISO_CLIENTID\': label is required and must be a string');
    });

    it('should validate portalInput structure - invalid field type', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              field: 'invalid-type',
              label: 'MISO Client ID'
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'MISO_CLIENTID\': field must be one of: password, text, textarea, select');
    });

    it('should validate portalInput structure - select field without options', () => {
      const template = 'API_KEY_TYPE=kv://api-key-typeKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'API_KEY_TYPE',
            portalInput: {
              field: 'select',
              label: 'API Key Type'
              // Missing options
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'API_KEY_TYPE\': select field requires a non-empty options array');
    });

    it('should validate portalInput structure - select field with empty options', () => {
      const template = 'API_KEY_TYPE=kv://api-key-typeKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'API_KEY_TYPE',
            portalInput: {
              field: 'select',
              label: 'API Key Type',
              options: []
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'API_KEY_TYPE\': select field requires a non-empty options array');
    });

    it('should validate portalInput structure - select field with options', () => {
      const template = 'API_KEY_TYPE=kv://api-key-typeKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'API_KEY_TYPE',
            portalInput: {
              field: 'select',
              label: 'API Key Type',
              placeholder: 'Select API key type',
              options: ['development', 'production', 'staging']
            }
          }
        ]
      };

      const result = generator.parseEnvironmentVariables(template, variablesConfig);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toEqual({
        field: 'select',
        label: 'API Key Type',
        placeholder: 'Select API key type',
        options: ['development', 'production', 'staging']
      });
    });

    it('should validate portalInput structure - invalid placeholder type', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              field: 'password',
              label: 'MISO Client ID',
              placeholder: 123 // Invalid type
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'MISO_CLIENTID\': placeholder must be a string');
    });

    it('should validate portalInput structure - invalid masked type', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'MISO_CLIENTID',
            portalInput: {
              field: 'password',
              label: 'MISO Client ID',
              masked: 'true' // Invalid type (string instead of boolean)
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'MISO_CLIENTID\': masked must be a boolean');
    });

    it('should validate portalInput structure - options on non-select field', () => {
      const template = 'API_KEY=kv://api-keyKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'API_KEY',
            portalInput: {
              field: 'text',
              label: 'API Key',
              options: ['option1', 'option2'] // Options not allowed for text field
            }
          }
        ]
      };

      expect(() => {
        generator.parseEnvironmentVariables(template, variablesConfig);
      }).toThrow('Invalid portalInput for variable \'API_KEY\': options can only be used with select field type');
    });

    it('should handle textarea field type', () => {
      const template = 'DESCRIPTION=kv://descriptionKeyVault';

      const variablesConfig = {
        configuration: [
          {
            name: 'DESCRIPTION',
            portalInput: {
              field: 'textarea',
              label: 'Description',
              placeholder: 'Enter description',
              validation: {
                minLength: 10,
                maxLength: 500
              }
            }
          }
        ]
      };

      const result = generator.parseEnvironmentVariables(template, variablesConfig);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toEqual({
        field: 'textarea',
        label: 'Description',
        placeholder: 'Enter description',
        validation: {
          minLength: 10,
          maxLength: 500
        }
      });
    });

    it('should handle null variablesConfig (backward compatibility)', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const result = generator.parseEnvironmentVariables(template, null);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toBeUndefined();
    });

    it('should handle variablesConfig without configuration section', () => {
      const template = 'MISO_CLIENTID=kv://miso-test-client-idKeyVault';

      const variablesConfig = {};

      const result = generator.parseEnvironmentVariables(template, variablesConfig);

      expect(result).toHaveLength(1);
      expect(result[0].portalInput).toBeUndefined();
    });
  });

  describe('buildImageReference', () => {
    it('should build image reference with registry', () => {
      const variables = {
        image: {
          name: 'myapp',
          registry: 'myacr.azurecr.io',
          tag: 'v1.0.0'
        }
      };

      const result = generator.buildImageReference(variables);
      expect(result).toBe('myacr.azurecr.io/myapp:v1.0.0');
    });

    it('should build image reference without registry', () => {
      const variables = {
        image: {
          name: 'myapp',
          tag: 'latest'
        }
      };

      const result = generator.buildImageReference(variables);
      expect(result).toBe('myapp:latest');
    });

    it('should use app key as fallback for image name', () => {
      const variables = {
        app: {
          key: 'myapp'
        },
        image: {
          tag: 'latest'
        }
      };

      const result = generator.buildImageReference(variables);
      expect(result).toBe('myapp:latest');
    });

    it('should use default values when image config is missing', () => {
      const variables = {};

      const result = generator.buildImageReference(variables);
      expect(result).toBe('app:latest');
    });
  });

  describe('buildHealthCheck', () => {
    it('should build health check with custom values', () => {
      const variables = {
        healthCheck: {
          path: '/api/v1/health',
          interval: 60,
          timeout: 15,
          retries: 5
        }
      };

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/api/v1/health',
        interval: 60
      });
    });

    it('should use default values when health check config is missing', () => {
      const variables = {};

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/health',
        interval: 30
      });
    });

    it('should use partial custom values', () => {
      const variables = {
        healthCheck: {
          path: '/custom/health'
        }
      };

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/custom/health',
        interval: 30
      });
    });

    it('should include probePath when provided', () => {
      const variables = {
        healthCheck: {
          path: '/health',
          interval: 30,
          probePath: '/probe'
        }
      };

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/health',
        interval: 30,
        probePath: '/probe'
      });
    });

    it('should include probeRequestType when provided', () => {
      const variables = {
        healthCheck: {
          path: '/health',
          interval: 30,
          probeRequestType: 'POST'
        }
      };

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/health',
        interval: 30,
        probeRequestType: 'POST'
      });
    });

    it('should include probeProtocol when provided', () => {
      const variables = {
        healthCheck: {
          path: '/health',
          interval: 30,
          probeProtocol: 'HTTPS'
        }
      };

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/health',
        interval: 30,
        probeProtocol: 'HTTPS'
      });
    });

    it('should include probeIntervalInSeconds when provided', () => {
      const variables = {
        healthCheck: {
          path: '/health',
          interval: 30,
          probeIntervalInSeconds: 60
        }
      };

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/health',
        interval: 30,
        probeIntervalInSeconds: 60
      });
    });

    it('should include all probe fields when provided', () => {
      const variables = {
        healthCheck: {
          path: '/health',
          interval: 30,
          probePath: '/probe',
          probeRequestType: 'POST',
          probeProtocol: 'HTTPS',
          probeIntervalInSeconds: 60
        }
      };

      const result = generator.buildHealthCheck(variables);
      expect(result).toEqual({
        path: '/health',
        interval: 30,
        probePath: '/probe',
        probeRequestType: 'POST',
        probeProtocol: 'HTTPS',
        probeIntervalInSeconds: 60
      });
    });
  });

  describe('buildRequirements', () => {
    it('should build requirements with all services', () => {
      const variables = {
        requires: {
          database: true,
          databases: [
            { name: 'app' },
            { name: 'app-analytics' }
          ],
          redis: true,
          storage: true,
          storageSize: '5Gi'
        }
      };

      const result = generator.buildRequirements(variables);
      expect(result).toEqual({
        database: true,
        databases: [
          { name: 'app' },
          { name: 'app-analytics' }
        ],
        redis: true,
        storage: true,
        storageSize: '5Gi'
      });
    });

    it('should build requirements with defaults', () => {
      const variables = {};

      const result = generator.buildRequirements(variables);
      expect(result).toEqual({
        database: false,
        databases: [],
        redis: false,
        storage: false,
        storageSize: '1Gi'
      });
    });

    it('should create default database when database is true but no databases specified', () => {
      const variables = {
        app: { key: 'myapp' },
        requires: {
          database: true
        }
      };

      const result = generator.buildRequirements(variables);
      expect(result.database).toBe(true);
      expect(result.databases).toEqual([{ name: 'myapp' }]);
    });
  });

  describe('buildAuthenticationConfig', () => {
    it('should build authentication config with enableSSO false and missing fields', () => {
      const variables = {
        authentication: {
          enableSSO: false
          // Missing type and requiredRoles
        }
      };

      const result = generator.buildAuthenticationConfig(variables, null);
      expect(result).toEqual({
        enableSSO: false,
        type: 'none',
        requiredRoles: []
      });
    });

    it('should build authentication config with enableSSO true and missing fields', () => {
      const variables = {
        authentication: {
          enableSSO: true
          // Missing type and requiredRoles
        }
      };

      const result = generator.buildAuthenticationConfig(variables, null);
      expect(result).toEqual({
        enableSSO: true,
        type: 'azure',
        requiredRoles: []
      });
    });

    it('should build authentication config with all fields provided', () => {
      const variables = {
        authentication: {
          type: 'azure',
          enableSSO: true,
          requiredRoles: ['admin', 'user']
        }
      };

      const result = generator.buildAuthenticationConfig(variables, null);
      expect(result).toEqual({
        type: 'azure',
        enableSSO: true,
        requiredRoles: ['admin', 'user']
      });
    });

    it('should build authentication config with endpoints', () => {
      const variables = {
        authentication: {
          type: 'local',
          enableSSO: true,
          requiredRoles: ['user'],
          endpoints: {
            local: 'http://localhost:8080/auth',
            custom: 'https://custom.example.com/auth'
          }
        }
      };

      const result = generator.buildAuthenticationConfig(variables, null);
      expect(result).toEqual({
        type: 'local',
        enableSSO: true,
        requiredRoles: ['user'],
        endpoints: {
          local: 'http://localhost:8080/auth',
          custom: 'https://custom.example.com/auth'
        }
      });
    });

    it('should fall back to RBAC when authentication not in variables', () => {
      const variables = {};
      const rbac = {
        roles: [
          { name: 'Admin', value: 'admin', description: 'Admin role' }
        ]
      };

      const result = generator.buildAuthenticationConfig(variables, rbac);
      expect(result).toEqual({
        type: 'azure',
        enableSSO: true,
        requiredRoles: ['admin']
      });
    });
  });

  describe('buildAuthentication', () => {
    it('should build authentication with RBAC', () => {
      const rbac = {
        roles: [
          { name: 'Admin', value: 'admin', description: 'Admin role' }
        ],
        permissions: [
          { name: 'app:admin', roles: ['admin'], description: 'Admin permissions' }
        ]
      };

      const result = generator.buildAuthentication(rbac);
      expect(result).toEqual({
        type: 'azure',
        enableSSO: true,
        requiredRoles: ['admin']
      });
    });

    it('should build disabled authentication when no RBAC', () => {
      const result = generator.buildAuthentication(null);
      expect(result).toEqual({
        type: 'none',
        enableSSO: false,
        requiredRoles: []
      });
    });

    it('should handle empty RBAC', () => {
      const rbac = {};

      const result = generator.buildAuthentication(rbac);
      expect(result).toEqual({
        type: 'azure',
        enableSSO: true,
        requiredRoles: []
      });
    });
  });

  describe('generateDeployJson - registry mode filtering', () => {
    it('should filter configuration for external registry mode', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        image: { registryMode: 'external' }
      };

      const envTemplate = `NODE_ENV=development
DOCKER_REGISTRY_SERVER_URL=https://registry.example.com
DOCKER_REGISTRY_SERVER_USERNAME=user
DOCKER_REGISTRY_SERVER_PASSWORD=pass
OTHER_VAR=value`;

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') || filePath.includes('env.template');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return envTemplate;
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // Only DOCKER_REGISTRY_* vars should be included
      const configNames = deployment.configuration.map(c => c.name);
      expect(configNames).toContain('DOCKER_REGISTRY_SERVER_URL');
      expect(configNames).toContain('DOCKER_REGISTRY_SERVER_USERNAME');
      expect(configNames).toContain('DOCKER_REGISTRY_SERVER_PASSWORD');
      expect(configNames).not.toContain('NODE_ENV');
      expect(configNames).not.toContain('OTHER_VAR');
    });

    it('should not filter configuration for acr registry mode', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        image: { registryMode: 'acr' }
      };

      const envTemplate = `NODE_ENV=development
DOCKER_REGISTRY_SERVER_URL=https://registry.example.com
OTHER_VAR=value`;

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') || filePath.includes('env.template');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return envTemplate;
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // All vars should be included for acr mode
      const configNames = deployment.configuration.map(c => c.name);
      expect(configNames).toContain('NODE_ENV');
      expect(configNames).toContain('DOCKER_REGISTRY_SERVER_URL');
      expect(configNames).toContain('OTHER_VAR');
    });
  });

  describe('generateDeployJson - optional fields', () => {
    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') || filePath.includes('env.template');
      });
    });

    it('should include repository when only enabled flag is true', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        repository: { enabled: true }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.repository).toEqual({ enabled: true });
    });

    it('should include repository when enabled', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        repository: { enabled: true, repositoryUrl: 'https://github.com/user/repo' }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.repository).toEqual({
        enabled: true,
        repositoryUrl: 'https://github.com/user/repo'
      });
    });

    it('should include repository when only repositoryUrl provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        repository: { repositoryUrl: 'https://github.com/user/repo' }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.repository).toEqual({
        enabled: false,
        repositoryUrl: 'https://github.com/user/repo'
      });
    });

    it('should include build fields when provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        build: {
          envOutputPath: '../.env',
          dockerfile: 'Dockerfile.prod'
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.build).toEqual({
        envOutputPath: '../.env',
        dockerfile: 'Dockerfile.prod'
      });
    });

    it('should include deployment fields when provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com'
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.deployment).toEqual({
        controllerUrl: 'https://controller.example.com'
      });
    });

    it('should include startupCommand when provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        startupCommand: 'npm start'
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.startupCommand).toBe('npm start');
    });

    it('should include runtimeVersion when provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        runtimeVersion: '18'
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.runtimeVersion).toBe('18');
    });

    it('should include scaling when provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        scaling: { minInstances: 1, maxInstances: 5 }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.scaling).toEqual({ minInstances: 1, maxInstances: 5 });
    });

    it('should include frontDoorRouting when provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        frontDoorRouting: { enabled: true, path: '/api' }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.frontDoorRouting).toEqual({ enabled: true, path: '/api' });
    });

    it('should prioritize variables.roles over rbac.roles', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        roles: [{ name: 'CustomRole', value: 'custom' }]
      };

      const rbac = {
        roles: [{ name: 'RBACRole', value: 'rbac' }]
      };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template') ||
               filePath.includes('rbac.yaml');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        if (filePath.includes('rbac.yaml')) {
          return yaml.dump(rbac);
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.roles).toEqual([{ name: 'CustomRole', value: 'custom' }]);
    });

    it('should use rbac.roles when variables.roles not provided', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000
      };

      const rbac = {
        roles: [{ name: 'RBACRole', value: 'rbac' }]
      };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template') ||
               filePath.includes('rbac.yaml');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        if (filePath.includes('rbac.yaml')) {
          return yaml.dump(rbac);
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.roles).toEqual([{ name: 'RBACRole', value: 'rbac' }]);
    });

    it('should prioritize variables.permissions over rbac.permissions', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        permissions: [{ name: 'custom:permission', roles: ['admin'] }]
      };

      const rbac = {
        permissions: [{ name: 'rbac:permission', roles: ['user'] }]
      };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template') ||
               filePath.includes('rbac.yaml');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        if (filePath.includes('rbac.yaml')) {
          return yaml.dump(rbac);
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.permissions).toEqual([{ name: 'custom:permission', roles: ['admin'] }]);
    });
  });

  describe('generateDeployJson - buildBaseDeployment edge cases', () => {
    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') || filePath.includes('env.template');
      });
      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });
    });

    it('should use app.key fallback when app.displayName missing', async() => {
      const variables = {
        app: { key: 'testapp' },
        port: 3000
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.displayName).toBe('testapp');
    });

    it('should use appName fallback when app.key missing', async() => {
      const variables = {
        app: { displayName: 'Test App' },
        port: 3000
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.key).toBe(appName);
    });

    it('should use default port when port missing', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.port).toBe(3000);
    });

    it('should create default database when database true but databases missing', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        requires: { database: true }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.databases).toEqual([{ name: 'testapp' }]);
    });

    it('should use default app name when app.key missing for database', async() => {
      const variables = {
        app: { displayName: 'Test App' },
        port: 3000,
        requires: { database: true }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // When app.key is missing, defaults to 'app' (not appName)
      expect(deployment.databases).toEqual([{ name: 'app' }]);
    });
  });

  describe('generateDeployJson - validation edge cases', () => {
    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') || filePath.includes('env.template');
      });
    });

    it('should reject deployment config with http controllerUrl', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'http://controller.example.com'
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // http:// URLs should be filtered out, so deployment should be undefined
      expect(deployment.deployment).toBeUndefined();
    });

    it('should reject deployment config with empty strings', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        deployment: {
          controllerUrl: 'https://controller.example.com'
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // Empty strings should be filtered out
      expect(deployment.deployment.controllerUrl).toBe('https://controller.example.com');
    });

    it('should reject build config with empty dockerfile', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        build: {
          envOutputPath: '../.env',
          dockerfile: '   '
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // Empty dockerfile should be filtered out
      expect(deployment.build).not.toHaveProperty('dockerfile');
      expect(deployment.build.envOutputPath).toBe('../.env');
    });

    it('should reject build config with non-string secrets', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        build: {
          secrets: 123
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // Non-string secrets should be filtered out, so build should be null/undefined
      expect(deployment.build).toBeUndefined();
    });

    it('should reject repository config with empty repositoryUrl', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000,
        repository: {
          enabled: false,
          repositoryUrl: '   '
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({ valid: true });

      await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call =>
        call[0] === jsonPath || call[0].includes('testapp-deploy.json')
      );
      expect(writeCall).toBeDefined();
      const deployment = JSON.parse(writeCall[1]);

      // Empty repositoryUrl should result in null repository
      expect(deployment.repository).toBeUndefined();
    });
  });

  describe('parseEnvironmentVariables - edge cases', () => {
    it('should handle variables with empty values', () => {
      const template = `KEY1=value1
KEY2=
KEY3=value3`;

      const result = generator.parseEnvironmentVariables(template);

      expect(result).toHaveLength(2);
      expect(result.find(c => c.name === 'KEY1')).toBeDefined();
      expect(result.find(c => c.name === 'KEY3')).toBeDefined();
      expect(result.find(c => c.name === 'KEY2')).toBeUndefined();
    });

    it('should handle variables with whitespace around equals', () => {
      const template = `KEY1 = value1
KEY2=value2
KEY3 =value3
KEY4= value4`;

      const result = generator.parseEnvironmentVariables(template);

      expect(result).toHaveLength(4);
      expect(result.find(c => c.name === 'KEY1').value).toBe('value1');
      expect(result.find(c => c.name === 'KEY2').value).toBe('value2');
      expect(result.find(c => c.name === 'KEY3').value).toBe('value3');
      expect(result.find(c => c.name === 'KEY4').value).toBe('value4');
    });

    it('should handle variables with kv:// in value but not at start', () => {
      const template = `KEY1=value kv://something
KEY2=kv://actual-keyvault`;

      const result = generator.parseEnvironmentVariables(template);

      const kvRef = result.find(c => c.location === 'keyvault');
      expect(kvRef).toBeDefined();
      expect(kvRef.name).toBe('KEY2');
      expect(kvRef.value).toBe('actual-keyvault');
    });

    it('should handle variables with multiple sensitive keywords', () => {
      const template = `API_SECRET_TOKEN=value123
NORMAL_VAR=value456`;

      const result = generator.parseEnvironmentVariables(template);

      const requiredVars = result.filter(c => c.required);
      expect(requiredVars.length).toBeGreaterThan(0);
      expect(requiredVars.find(v => v.name === 'API_SECRET_TOKEN')).toBeDefined();
    });
  });

  describe('generateDeployJsonWithValidation', () => {
    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template');
      });
    });

    it('should generate and validate deployment JSON', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000
      };

      fs.readFileSync.mockImplementation((filePath) => {
        // First check if this file was written (for deploy.json files)
        if (writtenFiles[filePath]) {
          return writtenFiles[filePath];
        }
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        if (filePath.includes('testapp-deploy.json')) {
          // Return what was written, or a default if nothing was written yet
          return writtenFiles[filePath] || JSON.stringify({ key: 'testapp', port: 3000 });
        }
        return '';
      });

      jest.spyOn(validator, 'validateDeploymentJson').mockReturnValue({
        valid: true,
        errors: []
      });

      const result = await generator.generateDeployJsonWithValidation(appName);

      expect(result.success).toBe(true);
      expect(result.path).toBe(jsonPath);
      expect(result.validation.valid).toBe(true);
      expect(result.deployment).toBeDefined();
      expect(result.deployment.key).toBe('testapp');
    });

    it('should return validation result when validation fails on second check', async() => {
      const variables = {
        app: { key: 'testapp', displayName: 'Test App' },
        port: 3000
      };

      fs.readFileSync.mockImplementation((filePath) => {
        // First check if this file was written (for deploy.json files)
        if (writtenFiles[filePath]) {
          return writtenFiles[filePath];
        }
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(variables);
        }
        if (filePath.includes('env.template')) {
          return 'NODE_ENV=development';
        }
        if (filePath.includes('testapp-deploy.json')) {
          // Return what was written, or a default if nothing was written yet
          return writtenFiles[filePath] || JSON.stringify({ key: 'testapp', port: 3000 });
        }
        return '';
      });

      // First validation (in generateDeployJson) passes, second (in generateDeployJsonWithValidation) fails
      jest.spyOn(validator, 'validateDeploymentJson')
        .mockReturnValueOnce({ valid: true, errors: [] })
        .mockReturnValueOnce({ valid: false, errors: ['Validation error'] });

      const result = await generator.generateDeployJsonWithValidation(appName);

      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toEqual(['Validation error']);
    });
  });

  describe('generateExternalSystemApplicationSchema', () => {
    const externalAppName = 'hubspot';
    const externalAppPath = path.join(process.cwd(), 'integration', externalAppName);
    const externalVariablesPath = path.join(externalAppPath, 'variables.yaml');
    const systemFilePath = path.join(externalAppPath, 'hubspot-deploy.json');
    const datasourceFile1 = path.join(externalAppPath, 'hubspot-deploy-company.json');
    const datasourceFile2 = path.join(externalAppPath, 'hubspot-deploy-contact.json');

    const mockExternalVariables = {
      externalIntegration: {
        schemaBasePath: './',
        systems: ['hubspot-deploy.json'],
        dataSources: ['hubspot-deploy-company.json', 'hubspot-deploy-contact.json'],
        version: '1.0.0'
      }
    };

    const mockSystemJson = {
      key: 'hubspot',
      displayName: 'HubSpot CRM',
      description: 'HubSpot CRM integration',
      type: 'openapi',
      authentication: {
        type: 'oauth2'
      }
    };

    const mockDatasourceJson1 = {
      key: 'hubspot-companies-get',
      displayName: 'HubSpot Companies',
      systemKey: 'hubspot',
      entityType: 'company',
      resourceType: 'customer',
      fieldMappings: {
        dimensions: {
          country: 'metadata.country'
        },
        attributes: {
          country: {
            expression: '{{properties.country.value}} | toUpper',
            type: 'string'
          }
        }
      }
    };

    const mockDatasourceJson2 = {
      key: 'hubspot-contacts-get',
      displayName: 'HubSpot Contacts',
      systemKey: 'hubspot',
      entityType: 'contact',
      resourceType: 'contact',
      fieldMappings: {
        dimensions: {
          email: 'metadata.email'
        },
        attributes: {
          email: {
            expression: '{{properties.email.value}} | trim',
            type: 'string'
          }
        }
      }
    };

    beforeEach(() => {
      const { detectAppType } = require('../../../lib/utils/paths');
      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: externalAppPath,
        appType: 'external'
      });

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === systemFilePath ||
               filePath === datasourceFile1 ||
               filePath === datasourceFile2 ||
               filePath === externalVariablesPath;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === externalVariablesPath) {
          return yaml.dump(mockExternalVariables);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock fs.promises for async file operations
      if (!fs.promises) {
        fs.promises = {};
      }
      fs.promises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          return Promise.resolve(JSON.stringify(mockSystemJson));
        }
        if (filePath === datasourceFile1) {
          return Promise.resolve(JSON.stringify(mockDatasourceJson1));
        }
        if (filePath === datasourceFile2) {
          return Promise.resolve(JSON.stringify(mockDatasourceJson2));
        }
        throw new Error(`File not found: ${filePath}`);
      });
    });

    it('should generate application schema successfully', async() => {
      const result = await generator.generateExternalSystemApplicationSchema(externalAppName);

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('application');
      expect(result).toHaveProperty('dataSources');
      expect(result.version).toBe('1.0.0');
      expect(result.application).toEqual(mockSystemJson);
      expect(result.dataSources).toHaveLength(2);
      expect(result.dataSources[0]).toEqual(mockDatasourceJson1);
      expect(result.dataSources[1]).toEqual(mockDatasourceJson2);
    });

    it('should throw error when externalIntegration block is missing', async() => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === externalVariablesPath) {
          return yaml.dump({ name: 'test' });
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      await expect(
        generator.generateExternalSystemApplicationSchema(externalAppName)
      ).rejects.toThrow('externalIntegration block not found');
    });

    it('should throw error when system file is missing', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(
        generator.generateExternalSystemApplicationSchema(externalAppName)
      ).rejects.toThrow('variables.yaml not found');
    });

    it('should throw error when datasource file is missing', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === systemFilePath || filePath === externalVariablesPath;
      });

      await expect(
        generator.generateExternalSystemApplicationSchema(externalAppName)
      ).rejects.toThrow('Datasource file not found');
    });
  });
});
