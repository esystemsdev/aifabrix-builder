/**
 * Tests for Variable Transformer Module
 *
 * @fileoverview Unit tests for lib/utils/variable-transformer.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { transformVariablesForValidation } = require('../../../lib/utils/variable-transformer');

describe('Variable Transformer Module', () => {
  describe('transformVariablesForValidation', () => {
    it('should transform flat structure with all fields', () => {
      const variables = {
        key: 'test-app',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'test-image:latest',
        port: 8080,
        requiresDatabase: true,
        requiresRedis: false,
        requiresStorage: true,
        databases: [{ name: 'test-db' }],
        authentication: {
          type: 'azure',
          enableSSO: true,
          requiredRoles: ['admin']
        }
      };
      const appName = 'test-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.key).toBe('test-app');
      expect(result.displayName).toBe('Test App');
      expect(result.description).toBe('A test application');
      expect(result.type).toBe('webapp');
      expect(result.image).toBe('test-image:latest');
      expect(result.port).toBe(8080);
      expect(result.requiresDatabase).toBe(true);
      expect(result.requiresRedis).toBe(false);
      expect(result.requiresStorage).toBe(true);
      expect(result.databases).toEqual([{ name: 'test-db' }]);
      expect(result.authentication.type).toBe('azure');
    });

    it('should transform flat structure with minimal fields', () => {
      const variables = {
        key: 'minimal-app'
      };
      const appName = 'minimal-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.key).toBe('minimal-app');
      expect(result.displayName).toBe('minimal-app');
      expect(result.description).toBe('');
      expect(result.type).toBe('webapp');
      expect(result.port).toBe(3000);
      expect(result.requiresDatabase).toBe(false);
      expect(result.requiresRedis).toBe(false);
      expect(result.requiresStorage).toBe(false);
      expect(result.databases).toEqual([]);
    });

    it('should transform nested structure with app and image objects', () => {
      const variables = {
        app: {
          key: 'nested-app',
          displayName: 'Nested App',
          description: 'A nested structure app',
          type: 'webapp'
        },
        image: {
          name: 'nested-image',
          registry: 'myregistry.azurecr.io',
          tag: 'v1.0.0',
          registryMode: 'external'
        },
        port: 4000,
        requires: {
          database: true,
          redis: true,
          storage: false,
          databases: [{ name: 'nested-db' }]
        }
      };
      const appName = 'nested-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.key).toBe('nested-app');
      expect(result.displayName).toBe('Nested App');
      expect(result.description).toBe('A nested structure app');
      expect(result.type).toBe('webapp');
      expect(result.image).toBe('myregistry.azurecr.io/nested-image:v1.0.0');
      expect(result.registryMode).toBe('external');
      expect(result.port).toBe(4000);
      expect(result.requiresDatabase).toBe(true);
      expect(result.requiresRedis).toBe(true);
      expect(result.requiresStorage).toBe(false);
      expect(result.databases).toEqual([{ name: 'nested-db' }]);
    });

    it('should transform nested structure with minimal fields', () => {
      const variables = {
        app: {
          key: 'minimal-nested'
        }
      };
      const appName = 'minimal-nested';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.key).toBe('minimal-nested');
      expect(result.displayName).toBe('minimal-nested');
      expect(result.description).toBe('');
      expect(result.type).toBe('webapp');
      expect(result.image).toBe('minimal-nested:latest');
      expect(result.registryMode).toBe('external');
      expect(result.port).toBe(3000);
      expect(result.requiresDatabase).toBe(false);
      expect(result.requiresRedis).toBe(false);
      expect(result.requiresStorage).toBe(false);
      expect(result.databases).toEqual([]);
    });

    it('should sanitize keycloak auth type to azure', () => {
      const variables = {
        key: 'test-app',
        authentication: {
          type: 'keycloak',
          enableSSO: true
        }
      };
      const appName = 'test-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.authentication.type).toBe('azure');
    });

    it('should handle authentication with enableSSO false', () => {
      const variables = {
        key: 'test-app',
        authentication: {
          enableSSO: false
        }
      };
      const appName = 'test-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.authentication.type).toBe('none');
      expect(result.authentication.requiredRoles).toEqual([]);
    });

    it('should handle authentication with enableSSO true', () => {
      const variables = {
        key: 'test-app',
        authentication: {
          enableSSO: true
        }
      };
      const appName = 'test-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.authentication.type).toBe('azure');
      expect(result.authentication.requiredRoles).toEqual([]);
    });

    it('should handle nested structure with database requirement', () => {
      const variables = {
        app: {
          key: 'db-app'
        },
        requires: {
          database: true
        }
      };
      const appName = 'db-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.requiresDatabase).toBe(true);
      expect(result.databases).toEqual([{ name: 'db-app' }]);
    });

    it('should use appName as fallback for key', () => {
      const variables = {};
      const appName = 'fallback-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.key).toBe('fallback-app');
      expect(result.displayName).toBe('fallback-app');
    });

    it('should handle image without registry', () => {
      const variables = {
        app: {
          key: 'no-registry-app'
        },
        image: {
          name: 'simple-image',
          tag: 'v1.0.0'
        }
      };
      const appName = 'no-registry-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.image).toBe('simple-image:v1.0.0');
    });

    it('should handle image with default tag', () => {
      const variables = {
        app: {
          key: 'default-tag-app'
        },
        image: {
          name: 'default-tag-image'
        }
      };
      const appName = 'default-tag-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.image).toBe('default-tag-image:latest');
    });

    it('should handle invalid auth type by defaulting to azure', () => {
      const variables = {
        key: 'test-app',
        authentication: {
          type: 'invalid-type',
          enableSSO: true
        }
      };
      const appName = 'test-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.authentication.type).toBe('azure');
    });

    it('should handle repository configuration', () => {
      const variables = {
        key: 'repo-app',
        repository: {
          enabled: true,
          repositoryUrl: 'https://github.com/user/repo'
        }
      };
      const appName = 'repo-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.repository).toBeDefined();
      expect(result.repository.enabled).toBe(true);
      expect(result.repository.repositoryUrl).toBe('https://github.com/user/repo');
    });

    it('should handle build configuration', () => {
      const variables = {
        key: 'build-app',
        build: {
          context: './src',
          dockerfile: 'Dockerfile.custom',
          language: 'typescript'
        }
      };
      const appName = 'build-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.build).toBeDefined();
      expect(result.build.context).toBe('./src');
      expect(result.build.dockerfile).toBe('Dockerfile.custom');
      expect(result.build.language).toBe('typescript');
    });

    it('should not emit deployment from variables (manifest is generic)', () => {
      const variables = {
        key: 'deploy-app',
        deployment: {
          controllerUrl: 'https://controller.example.com'
        }
      };
      const appName = 'deploy-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.deployment).toBeUndefined();
    });

    it('should handle optional fields', () => {
      const variables = {
        key: 'optional-app',
        startupCommand: 'npm start',
        runtimeVersion: '18',
        scaling: { min: 1, max: 5 },
        roles: ['admin', 'user'],
        permissions: ['read', 'write']
      };
      const appName = 'optional-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.startupCommand).toBe('npm start');
      expect(result.runtimeVersion).toBe('18');
      expect(result.scaling).toEqual({ min: 1, max: 5 });
      expect(result.roles).toEqual(['admin', 'user']);
      expect(result.permissions).toEqual(['read', 'write']);
    });

    it('should handle healthCheck configuration', () => {
      const variables = {
        key: 'health-app',
        healthCheck: {
          path: '/health',
          interval: 30
        }
      };
      const appName = 'health-app';

      const result = transformVariablesForValidation(variables, appName);

      expect(result.healthCheck).toBeDefined();
      expect(result.healthCheck.path).toBe('/health');
      expect(result.healthCheck.interval).toBe(30);
    });
  });
});

