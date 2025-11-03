/**
 * Tests for AI Fabrix Builder Generator Validation
 *
 * @fileoverview Unit tests for generator validation functionality
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const generator = require('../../lib/generator');
const validator = require('../../lib/validator');
const keyGenerator = require('../../lib/key-generator');

// Mock fs module
jest.mock('fs');

describe('Generator Validation Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateDeploymentJson', () => {
    it('should validate correct deployment JSON', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'testapp:latest',
        registryMode: 'acr', // Use 'acr' to avoid external registry requirements
        port: 3000,
        requiresDatabase: false,
        requiresRedis: false,
        requiresStorage: false,
        configuration: [
          { name: 'PORT', value: '3000', location: 'variable', required: false }
        ],
        healthCheck: {
          path: '/health',
          interval: 30
        },
        authentication: {
          type: 'none',
          enableSSO: false,
          requiredRoles: []
        }
      };

      const result = validator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const deployment = {
        port: 3000
        // Missing key, displayName, description, type, image, registryMode
      };

      const result = validator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('key'))).toBe(true);
      expect(result.errors.some(err => err.includes('displayName'))).toBe(true);
      expect(result.errors.some(err => err.includes('image'))).toBe(true);
    });

    it('should detect invalid port', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'testapp:latest',
        registryMode: 'external',
        port: 99999, // Invalid port (> 65535)
        requiresDatabase: false,
        requiresRedis: false,
        requiresStorage: false,
        configuration: []
      };

      const result = validator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('port'))).toBe(true);
    });

    it('should detect invalid field types', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'testapp:latest',
        registryMode: 'external',
        port: 'invalid', // Should be number
        requiresDatabase: false,
        requiresRedis: false,
        requiresStorage: false,
        configuration: []
      };

      const result = validator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid health check values', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'testapp:latest',
        registryMode: 'external',
        port: 3000,
        requiresDatabase: false,
        requiresRedis: false,
        requiresStorage: false,
        configuration: [],
        healthCheck: {
          path: 'health', // Should start with /
          interval: 1 // Should be at least 10
        }
      };

      const result = validator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('healthCheck'))).toBe(true);
    });

    it('should detect missing required authentication fields', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'testapp:latest',
        registryMode: 'external',
        port: 3000,
        requiresDatabase: false,
        requiresRedis: false,
        requiresStorage: false,
        configuration: [],
        authentication: {
          type: 'azure'
          // Missing enableSSO and requiredRoles
        }
      };

      const result = validator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('authentication'))).toBe(true);
    });
  });

  describe('generateDeployJsonWithValidation', () => {
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
        tag: 'latest',
        registry: '',
        registryMode: 'acr' // Use 'acr' to avoid external registry requirements
      },
      requires: {
        database: false,
        redis: false,
        storage: false
      }
    };

    const mockEnvTemplate = 'PORT=3000\nNODE_ENV=development';

    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('variables.yaml') ||
               filePath.includes('env.template');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(mockVariables);
        }
        if (filePath.includes('env.template')) {
          return mockEnvTemplate;
        }
        if (filePath.includes('aifabrix-deploy.json')) {
          return JSON.stringify({
            key: 'testapp',
            displayName: 'Test App',
            description: 'A test application',
            type: 'webapp',
            image: 'testapp:latest',
            registryMode: 'acr',
            port: 3000,
            requiresDatabase: false,
            requiresRedis: false,
            requiresStorage: false,
            databases: [],
            configuration: []
          });
        }
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});
    });

    it('should generate JSON with validation', async() => {
      const appName = 'testapp';
      const builderPath = path.join(process.cwd(), 'builder', appName);
      const jsonPath = path.join(builderPath, 'aifabrix-deploy.json');

      const result = await generator.generateDeployJsonWithValidation(appName);

      expect(result.success).toBe(true);
      expect(result.path).toBe(jsonPath);
      expect(result.validation.valid).toBe(true);
      expect(result.deployment).toBeDefined();
      expect(result.deployment.key).toBe('testapp');
    });

    it('should throw error when validation fails', async() => {
      // Mock invalid variables - missing required fields
      const invalidVariables = {
        port: 99999 // Invalid port and missing required fields
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(invalidVariables);
        }
        if (filePath.includes('env.template')) {
          return mockEnvTemplate;
        }
        return '';
      });

      // generateDeployJson will throw error due to schema validation
      await expect(generator.generateDeployJsonWithValidation('testapp'))
        .rejects.toThrow('Generated deployment JSON does not match schema');
    });
  });
});
