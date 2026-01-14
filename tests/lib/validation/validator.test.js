/**
 * Tests for AI Fabrix Builder Validator Module
 *
 * @fileoverview Unit tests for validator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { exec } = require('child_process');
const validator = require('../../../lib/validation/validator');
const secretsPath = require('../../../lib/utils/secrets-path');

// CRITICAL: Mock fetch FIRST before any modules that might use it
// Ensure global fetch is mocked (from tests/setup.js)
if (!global.fetch || typeof global.fetch.mockResolvedValue !== 'function') {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: jest.fn().mockReturnValue('application/json')
    },
    json: jest.fn().mockResolvedValue({ success: true }),
    text: jest.fn().mockResolvedValue('OK')
  });
}

// Mock modules
jest.mock('fs');
jest.mock('os');
jest.mock('../../../lib/utils/secrets-path', () => ({
  getActualSecretsPath: jest.fn()
}));
jest.mock('net', () => {
  const actualNet = jest.requireActual('net');
  return {
    ...actualNet,
    createServer: jest.fn(() => {
      const mockServer = {
        listen: jest.fn((port, callback) => {
          if (typeof callback === 'function') {
            setImmediate(() => callback());
          }
          return mockServer;
        }),
        close: jest.fn((callback) => {
          if (typeof callback === 'function') {
            setImmediate(() => callback());
          }
          return mockServer;
        }),
        on: jest.fn()
      };
      return mockServer;
    })
  };
});
jest.mock('child_process', () => {
  const actualChildProcess = jest.requireActual('child_process');
  return {
    ...actualChildProcess,
    exec: jest.fn((command, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (typeof cb === 'function') {
        // Default: return success for docker commands
        setImmediate(() => cb(null, { stdout: 'Docker version 20.10.0', stderr: '' }));
      }
      return { stdout: 'Docker version 20.10.0', stderr: '' };
    })
  };
});

describe('Validator Module', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);

    // Reset fetch mock to default implementation
    if (global.fetch && typeof global.fetch.mockResolvedValue === 'function') {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({ success: true }),
        text: jest.fn().mockResolvedValue('OK')
      });
    }

    // Reset child_process.exec mock
    const { exec } = require('child_process');
    exec.mockImplementation((command, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (typeof cb === 'function') {
        // Default: return success for docker commands
        setImmediate(() => cb(null, { stdout: 'Docker version 20.10.0', stderr: '' }));
      }
      return { stdout: 'Docker version 20.10.0', stderr: '' };
    });
  });

  describe('validateVariables', () => {
    const appName = 'testapp';
    const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

    it('should validate valid variables.yaml', async() => {
      const validVariables = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'testapp:latest',
        registryMode: 'public',
        port: 3000
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`key: testapp
displayName: Test App
description: A test application
type: webapp
image: testapp:latest
registryMode: public
port: 3000
requiresDatabase: false
requiresRedis: false
requiresStorage: false`);

      const result = await validator.validateVariables(appName);

      expect(fs.existsSync).toHaveBeenCalledWith(variablesPath);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid variables.yaml', async() => {
      const invalidVariables = {
        key: 'test-app', // invalid pattern
        port: 99999 // invalid range
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`key: test-app
port: 99999`);

      const result = await validator.validateVariables(appName);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should throw error if app name is invalid', async() => {
      await expect(validator.validateVariables()).rejects.toThrow('App name is required and must be a string');
      await expect(validator.validateVariables(123)).rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error if variables.yaml not found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(validator.validateVariables(appName)).rejects.toThrow(`variables.yaml not found: ${variablesPath}`);
    });

    it('should throw error for invalid YAML syntax', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

      await expect(validator.validateVariables(appName)).rejects.toThrow('Invalid YAML syntax in variables.yaml');
    });
  });

  describe('validateRbac', () => {
    const appName = 'testapp';
    const rbacPath = path.join(process.cwd(), 'builder', appName, 'rbac.yaml');

    it('should validate valid rbac.yaml', async() => {
      const validRbac = {
        roles: [
          {
            name: 'Admin',
            value: 'admin',
            description: 'Administrator role'
          }
        ],
        permissions: [
          {
            name: 'app:admin',
            roles: ['admin'],
            description: 'Admin permissions'
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(validRbac));

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return warning if rbac.yaml not found', async() => {
      fs.existsSync.mockReturnValue(false);

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('rbac.yaml not found - authentication disabled');
    });

    it('should return errors for invalid rbac structure', async() => {
      const invalidRbac = {
        roles: [
          {
            name: 'Admin'
            // missing value and description
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(invalidRbac));

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect duplicate roles', async() => {
      const duplicateRbac = {
        roles: [
          { name: 'Admin', value: 'admin', description: 'Admin role' },
          { name: 'User', value: 'admin', description: 'User role' } // duplicate value
        ],
        permissions: []
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(duplicateRbac));

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate role value: admin');
    });

    it('should throw error for invalid YAML syntax', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

      await expect(validator.validateRbac(appName)).rejects.toThrow('Invalid YAML syntax in rbac.yaml');
    });
  });

  describe('validateEnvTemplate', () => {
    const appName = 'testapp';
    const templatePath = path.join(process.cwd(), 'builder', appName, 'env.template');

    it('should validate valid env.template', async() => {
      const validTemplate = 'DATABASE_URL=kv://postgres-urlKeyVault\nPORT=3000\n# Comment line';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(validTemplate);

      const result = await validator.validateEnvTemplate(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid environment variable format', async() => {
      const invalidTemplate = 'INVALID_LINE_WITHOUT_EQUALS\nPORT=3000';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(invalidTemplate);

      const result = await validator.validateEnvTemplate(appName);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate kv:// reference format', async() => {
      const templateWithKv = 'SECRET=kv://valid-secret-name\nPORT=3000';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateWithKv);

      const result = await validator.validateEnvTemplate(appName);

      expect(result.valid).toBe(true);
    });

    it('should allow empty values in environment variables', async() => {
      const templateWithEmptyValue = 'EMPTY_VAR=\nPORT=3000\nKEYCLOAK_PUBLIC_KEY=\n# Comment line';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateWithEmptyValue);

      const result = await validator.validateEnvTemplate(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should allow commented lines with kv:// references', async() => {
      const templateWithCommentedKv = '#MY_VALUE=kv://value-is-not-in-secure file\nPORT=3000\nACTIVE_VAR=kv://active-secret';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateWithCommentedKv);

      const result = await validator.validateEnvTemplate(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should throw error if env.template not found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(validator.validateEnvTemplate(appName)).rejects.toThrow(`env.template not found: ${templatePath}`);
    });
  });

  describe('checkEnvironment', () => {
    it('should return ok status when everything is working', async() => {
      exec.mockImplementation((command, callback) => {
        callback(null, 'Docker version 20.10.0', '');
      });

      const mockServer = {
        listen: jest.fn((port, callback) => {
          // Simulate successful port binding
          setImmediate(callback);
        }),
        close: jest.fn((callback) => {
          if (callback) setImmediate(callback);
        }),
        on: jest.fn()
      };
      net.createServer.mockReturnValue(mockServer);

      const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      secretsPath.getActualSecretsPath.mockResolvedValue({
        userPath: mockSecretsPath,
        buildPath: null
      });
      fs.existsSync.mockReturnValue(true);

      const result = await validator.checkEnvironment();

      expect(result.docker).toBe('ok');
      expect(result.ports).toBe('ok');
      expect(result.secrets).toBe('ok');
    }, 10000);

    it('should return error when Docker is not available', async() => {
      exec.mockImplementation((command, callback) => {
        callback(new Error('Command not found'), '', '');
      });

      const result = await validator.checkEnvironment();

      expect(result.docker).toBe('error');
      expect(result.recommendations).toContain('Install Docker and Docker Compose');
    }, 10000);

    it('should return warning when ports are in use', async() => {
      exec.mockImplementation((command, callback) => {
        callback(null, 'Docker version 20.10.0', '');
      });

      const mockServer = {
        listen: jest.fn((port, callback) => {
          // Simulate port in use by throwing error in listen
          throw new Error('Port in use');
        }),
        close: jest.fn((callback) => {
          if (callback) setImmediate(callback);
        }),
        on: jest.fn()
      };
      net.createServer.mockReturnValue(mockServer);

      const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      secretsPath.getActualSecretsPath.mockResolvedValue({
        userPath: mockSecretsPath,
        buildPath: null
      });
      fs.existsSync.mockReturnValue(true);

      const result = await validator.checkEnvironment();

      expect(result.ports).toBe('warning');
      expect(result.recommendations).toContain('Some required ports (5432, 6379, 5050, 8081) are in use');
    }, 10000);

    it('should return missing when secrets file not found', async() => {
      exec.mockImplementation((command, callback) => {
        callback(null, 'Docker version 20.10.0', '');
      });

      const mockServer = {
        listen: jest.fn((port, callback) => {
          setImmediate(callback);
        }),
        close: jest.fn((callback) => {
          if (callback) setImmediate(callback);
        }),
        on: jest.fn()
      };
      net.createServer.mockReturnValue(mockServer);

      const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      secretsPath.getActualSecretsPath.mockResolvedValue({
        userPath: mockSecretsPath,
        buildPath: null
      });
      fs.existsSync.mockReturnValue(false);

      const result = await validator.checkEnvironment();

      expect(result.secrets).toBe('missing');
      expect(result.recommendations.some(rec => rec.includes('Create secrets file'))).toBe(true);
    }, 10000);
  });

  describe('formatValidationErrors', () => {
    it('should format required field errors', () => {
      const errors = [
        {
          keyword: 'required',
          instancePath: '/app',
          params: { missingProperty: 'displayName' }
        }
      ];

      const result = validator.formatValidationErrors(errors);

      expect(result).toContain('Field "app": Missing required property "displayName"');
    });

    it('should format type errors', () => {
      const errors = [
        {
          keyword: 'type',
          instancePath: '/port',
          params: { type: 'number' },
          data: '3000'
        }
      ];

      const result = validator.formatValidationErrors(errors);

      expect(result).toContain('Field "port": Expected number, got string');
    });

    it('should format minimum/maximum errors', () => {
      const errors = [
        {
          keyword: 'minimum',
          instancePath: '/port',
          params: { limit: 1 }
        },
        {
          keyword: 'maximum',
          instancePath: '/port',
          params: { limit: 65535 }
        }
      ];

      const result = validator.formatValidationErrors(errors);

      expect(result).toContain('Field "port": Value must be at least 1');
      expect(result).toContain('Field "port": Value must be at most 65535');
    });

    it('should handle empty errors array', () => {
      const result = validator.formatValidationErrors([]);

      expect(result).toEqual([]);
    });

    it('should handle non-array input', () => {
      const result = validator.formatValidationErrors(null);

      expect(result).toEqual(['Unknown validation error']);
    });
  });

  describe('validateApplication', () => {
    const appName = 'testapp';

    it('should run complete validation suite', async() => {
      const validVariables = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'testapp:latest',
        registryMode: 'public',
        port: 3000
      };

      const validRbac = {
        roles: [{ name: 'Admin', value: 'admin', description: 'Admin role' }],
        permissions: [{ name: 'app:admin', roles: ['admin'], description: 'Admin permissions' }]
      };

      const validTemplate = 'DATABASE_URL=kv://postgres-urlKeyVault\nPORT=3000';

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('rbac.yaml') ||
               filePath.includes('env.template');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return `key: testapp
displayName: Test App
description: A test application
type: webapp
image: testapp:latest
registryMode: public
port: 3000
requiresDatabase: false
requiresRedis: false
requiresStorage: false`;
        }
        if (filePath.includes('rbac.yaml')) {
          return `roles:
  - name: admin
    value: admin
    description: Administrator role
permissions:
  - name: read
    roles: [admin]
    description: Read permission`;
        }
        if (filePath.includes('env.template')) {
          return validTemplate;
        }
        return '';
      });

      const result = await validator.validateApplication(appName);

      expect(result.valid).toBe(true);
      expect(result.variables.valid).toBe(true);
      expect(result.rbac.valid).toBe(true);
      expect(result.env.valid).toBe(true);
      expect(result.summary.totalErrors).toBe(0);
    });

    it('should aggregate errors from all validations', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('rbac.yaml') ||
               filePath.includes('env.template');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return JSON.stringify({ key: 'invalid-key!' }); // invalid
        }
        if (filePath.includes('rbac.yaml')) {
          return JSON.stringify({ roles: [] }); // missing permissions
        }
        if (filePath.includes('env.template')) {
          return 'INVALID_LINE_WITHOUT_EQUALS'; // invalid format
        }
        return '';
      });

      const result = await validator.validateApplication(appName);

      expect(result.valid).toBe(false);
      expect(result.summary.totalErrors).toBeGreaterThan(0);
    });

    it('should throw error if app name is invalid', async() => {
      await expect(validator.validateApplication()).rejects.toThrow('App name is required and must be a string');
    });
  });

  describe('validateDeploymentJson', () => {
    it('should validate correct deployment JSON', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'myacr.azurecr.io/testapp:v1.0.0',
        registryMode: 'acr',
        port: 3000,
        deploymentKey: '0000000000000000000000000000000000000000000000000000000000000000',
        requiresDatabase: true,
        requiresRedis: false,
        requiresStorage: false,
        databases: [{ name: 'testapp' }],
        configuration: [
          {
            name: 'NODE_ENV',
            value: 'production',
            location: 'variable',
            required: false
          }
        ]
      };

      const result = validator.validateDeploymentJson(deployment);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation for missing required fields', () => {
      const deployment = {
        key: 'testapp'
        // Missing required fields: displayName, description, type, image, registryMode, port
      };

      const result = validator.validateDeploymentJson(deployment);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('displayName'))).toBe(true);
    });

    it('should fail validation for invalid field types', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'myacr.azurecr.io/testapp:v1.0.0',
        registryMode: 'acr',
        port: 'invalid', // Should be number
        requiresDatabase: true,
        databases: [{ name: 'testapp' }],
        configuration: []
      };

      const result = validator.validateDeploymentJson(deployment);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error if deployment is not an object', () => {
      const result = validator.validateDeploymentJson(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Deployment must be an object']);
    });

    it('should validate deployment with all optional fields', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'myacr.azurecr.io/testapp:v1.0.0',
        registryMode: 'acr',
        port: 3000,
        deploymentKey: '0000000000000000000000000000000000000000000000000000000000000000',
        requiresDatabase: true,
        databases: [{ name: 'testapp' }],
        configuration: [],
        healthCheck: {
          path: '/health',
          interval: 30
        },
        authentication: {
          type: 'azure',
          enableSSO: true,
          requiredRoles: ['user']
        },
        repository: {
          enabled: true,
          repositoryUrl: 'https://github.com/test/repo'
        },
        build: {
          language: 'typescript'
        }
      };

      const result = validator.validateDeploymentJson(deployment);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
