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
        image: 'testapp:latest',
        port: 3000,
        deploymentKey: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        configuration: [
          { name: 'PORT', value: '3000', location: 'variable', required: false }
        ],
        healthCheck: {
          path: '/health',
          interval: 30
        },
        authentication: {
          enabled: false,
          type: 'none'
        }
      };

      const result = generator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const deployment = {
        port: 3000
        // Missing key, displayName, image, deploymentKey
      };

      const result = generator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: key');
      expect(result.errors).toContain('Missing required field: displayName');
      expect(result.errors).toContain('Missing required field: image');
      expect(result.errors).toContain('Missing required field: deploymentKey');
    });

    it('should detect invalid port', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        image: 'testapp:latest',
        port: 99999, // Invalid port
        deploymentKey: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        configuration: []
      };

      const result = generator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid port: must be between 1 and 65535');
    });

    it('should detect invalid deployment key format', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        image: 'testapp:latest',
        port: 3000,
        deploymentKey: 'invalid-key', // Invalid format
        configuration: []
      };

      const result = generator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid deployment key format');
    });

    it('should generate warnings for health check issues', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        image: 'testapp:latest',
        port: 3000,
        deploymentKey: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        configuration: [],
        healthCheck: {
          path: 'health', // Should start with /
          interval: 1 // Should be at least 5
        }
      };

      const result = generator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Health check path should start with /');
      expect(result.warnings).toContain('Health check interval should be between 5 and 300 seconds');
    });

    it('should generate warnings for authentication issues', () => {
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        image: 'testapp:latest',
        port: 3000,
        deploymentKey: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        configuration: [],
        authentication: {
          enabled: true
        }
        // Missing roles and permissions
      };

      const result = generator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Authentication enabled but no roles defined');
      expect(result.warnings).toContain('Authentication enabled but no permissions defined');
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
        tag: 'latest'
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
            image: 'testapp:latest',
            port: 3000,
            deploymentKey: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
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

    it('should return validation errors when invalid', async() => {
      // Mock invalid variables
      const invalidVariables = {
        port: 99999 // Invalid port
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return yaml.dump(invalidVariables);
        }
        if (filePath.includes('env.template')) {
          return mockEnvTemplate;
        }
        if (filePath.includes('aifabrix-deploy.json')) {
          return JSON.stringify({
            key: 'testapp',
            displayName: 'Test App',
            port: 99999, // Invalid port
            deploymentKey: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
            configuration: []
          });
        }
        return '';
      });

      const result = await generator.generateDeployJsonWithValidation('testapp');

      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });
});
