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
const generator = require('../../lib/generator');
const keyGenerator = require('../../lib/key-generator');

// Mock fs module
jest.mock('fs');

describe('Generator Module', () => {
  const appName = 'testapp';
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const templatePath = path.join(builderPath, 'env.template');
  const rbacPath = path.join(builderPath, 'rbac.yaml');
  const jsonPath = path.join(builderPath, 'aifabrix-deploy.json');

  beforeEach(() => {
    jest.clearAllMocks();
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
          return yaml.dump(mockRbac);
        }
        return '';
      });
    });

    it('should generate deployment JSON with all components', async() => {
      const result = await generator.generateDeployJson(appName);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        jsonPath,
        expect.any(String),
        { mode: 0o644 }
      );

      // Verify the written content
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === jsonPath);
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
    });

    it('should handle missing rbac.yaml gracefully', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template');
        // rbac.yaml not found
      });

      const result = await generator.generateDeployJson(appName);

      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === jsonPath);
      const deployment = JSON.parse(writeCall[1]);

      expect(deployment.authentication.enableSSO).toBe(false);
      expect(deployment.authentication.type).toBe('none');
      expect(deployment.authentication.requiredRoles).toEqual([]);
      expect(deployment.roles).toBeUndefined();
      expect(deployment.permissions).toBeUndefined();
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
});
