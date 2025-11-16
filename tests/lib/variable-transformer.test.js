/**
 * Tests for AI Fabrix Builder Variable Transformer Module
 *
 * @fileoverview Unit tests for variable-transformer.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { transformVariablesForValidation } = require('../../lib/utils/variable-transformer');

describe('Variable Transformer Module', () => {
  const defaultAppName = 'testapp';

  describe('transformVariablesForValidation', () => {
    describe('flat structure', () => {
      it('should return flat structure as-is with defaults', () => {
        const variables = {
          key: 'myapp',
          image: 'myapp:latest',
          displayName: 'My App'
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.key).toBe('myapp');
        expect(result.image).toBe('myapp:latest');
        expect(result.displayName).toBe('My App');
        expect(result.description).toBe('');
        expect(result.type).toBe('webapp');
        expect(result.registryMode).toBe('external');
        expect(result.port).toBe(3000);
        expect(result.requiresDatabase).toBe(false);
      });

      it('should preserve all flat structure fields', () => {
        const variables = {
          key: 'myapp',
          image: 'myapp:latest',
          displayName: 'My App',
          description: 'Description',
          type: 'api',
          registryMode: 'internal',
          port: 8080,
          requiresDatabase: true,
          requiresRedis: true,
          requiresStorage: true,
          databases: [{ name: 'db1' }],
          customField: 'custom'
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.key).toBe('myapp');
        expect(result.image).toBe('myapp:latest');
        expect(result.customField).toBe('custom');
        expect(result.requiresDatabase).toBe(true);
        expect(result.databases).toEqual([{ name: 'db1' }]);
      });

      it('should use appName fallback when key is missing in flat structure', () => {
        const variables = {
          image: 'myapp:latest',
          displayName: 'My App'
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.key).toBe(defaultAppName);
      });

      it('should use appName fallback when displayName is missing in flat structure', () => {
        const variables = {
          key: 'myapp',
          image: 'myapp:latest'
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.displayName).toBe(defaultAppName);
      });
    });

    describe('nested structure - basic transformation', () => {
      it('should transform nested app structure', () => {
        const variables = {
          app: {
            key: 'myapp',
            displayName: 'My App',
            description: 'Test app',
            type: 'api'
          },
          image: {
            name: 'myapp',
            registry: 'myregistry',
            tag: 'v1.0.0',
            registryMode: 'internal'
          },
          port: 8080
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.key).toBe('myapp');
        expect(result.displayName).toBe('My App');
        expect(result.description).toBe('Test app');
        expect(result.type).toBe('api');
        expect(result.image).toBe('myregistry/myapp:v1.0.0');
        expect(result.registryMode).toBe('internal');
        expect(result.port).toBe(8080);
      });

      it('should use appName fallback when app.key missing', () => {
        const variables = {
          image: {
            name: 'myapp',
            tag: 'latest'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.key).toBe(defaultAppName);
        expect(result.displayName).toBe(defaultAppName);
        expect(result.image).toBe('myapp:latest');
      });

      it('should handle image without registry', () => {
        const variables = {
          app: { key: 'myapp' },
          image: {
            name: 'myapp',
            tag: 'latest'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.image).toBe('myapp:latest');
      });

      it('should default image tag to latest', () => {
        const variables = {
          app: { key: 'myapp' },
          image: {
            name: 'myapp'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.image).toBe('myapp:latest');
      });

      it('should use image.name or app.key or appName for image name', () => {
        const variables1 = {
          image: {
            name: 'imagename',
            tag: 'latest'
          }
        };
        const result1 = transformVariablesForValidation(variables1, defaultAppName);
        expect(result1.image).toBe('imagename:latest');

        const variables2 = {
          app: { key: 'appkey' },
          image: { tag: 'latest' }
        };
        const result2 = transformVariablesForValidation(variables2, defaultAppName);
        expect(result2.image).toBe('appkey:latest');

        const variables3 = {
          image: { tag: 'latest' }
        };
        const result3 = transformVariablesForValidation(variables3, defaultAppName);
        expect(result3.image).toBe(`${defaultAppName}:latest`);
      });
    });

    describe('nested structure - requires fields', () => {
      it('should transform requires.database to requiresDatabase', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          requires: {
            database: true
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.requiresDatabase).toBe(true);
        expect(result.requiresRedis).toBe(false);
        expect(result.requiresStorage).toBe(false);
      });

      it('should transform requires.redis to requiresRedis', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          requires: {
            redis: true
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.requiresRedis).toBe(true);
      });

      it('should transform requires.storage to requiresStorage', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          requires: {
            storage: true
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.requiresStorage).toBe(true);
      });

      it('should create databases array when requires.database is true', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          requires: {
            database: true
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.databases).toEqual([{ name: 'myapp' }]);
      });

      it('should use appName fallback in databases when app.key is missing', () => {
        const variables = {
          image: { name: 'myapp', tag: 'latest' },
          requires: {
            database: true
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.databases).toEqual([{ name: defaultAppName }]);
      });

      it('should use requires.databases if provided', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          requires: {
            database: true,
            databases: [{ name: 'db1' }, { name: 'db2' }]
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.databases).toEqual([{ name: 'db1' }, { name: 'db2' }]);
      });
    });

    describe('optional fields - healthCheck', () => {
      it('should include healthCheck when present', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          healthCheck: { path: '/health', interval: 30 }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.healthCheck).toEqual({ path: '/health', interval: 30 });
      });
    });

    describe('optional fields - authentication', () => {
      it('should include authentication when present with all fields', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          authentication: { type: 'oauth2', enableSSO: true, requiredRoles: ['admin'] }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.authentication.type).toBe('azure');
        expect(result.authentication.enableSSO).toBe(true);
        expect(result.authentication.requiredRoles).toEqual(['admin']);
      });

      it('should handle authentication with enableSSO false and missing type/requiredRoles', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          authentication: { enableSSO: false }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.authentication.enableSSO).toBe(false);
        expect(result.authentication.type).toBe('none');
        expect(result.authentication.requiredRoles).toEqual([]);
      });

      it('should handle authentication with enableSSO true and missing type/requiredRoles', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          authentication: { enableSSO: true }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.authentication.enableSSO).toBe(true);
        expect(result.authentication.type).toBe('azure');
        expect(result.authentication.requiredRoles).toEqual([]);
      });

      it('should sanitize keycloak type to azure', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          authentication: { type: 'keycloak', enableSSO: true, requiredRoles: ['user'] }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.authentication.type).toBe('azure');
        expect(result.authentication.enableSSO).toBe(true);
        expect(result.authentication.requiredRoles).toEqual(['user']);
      });
    });

    describe('optional fields - repository', () => {
      it('should include repository when enabled is true', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            enabled: true
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository).toEqual({ enabled: true });
      });

      it('should include repository when repositoryUrl is valid GitHub URL', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            enabled: false,
            repositoryUrl: 'https://github.com/user/repo'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository).toEqual({
          enabled: false,
          repositoryUrl: 'https://github.com/user/repo'
        });
      });

      it('should include repository when repositoryUrl is valid GitLab URL', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            repositoryUrl: 'https://gitlab.com/user/repo'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository.repositoryUrl).toBe('https://gitlab.com/user/repo');
      });

      it('should include repository when repositoryUrl is valid Azure DevOps URL', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            repositoryUrl: 'https://dev.azure.com/org/project/repo'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository.repositoryUrl).toBe('https://dev.azure.com/org/project/repo');
      });

      it('should not include repositoryUrl when URL is empty string', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            enabled: false,
            repositoryUrl: ''
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository).toBeUndefined();
      });

      it('should not include repositoryUrl when URL is whitespace only', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            enabled: false,
            repositoryUrl: '   '
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository).toBeUndefined();
      });

      it('should not include repositoryUrl when URL is invalid', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            enabled: false,
            repositoryUrl: 'http://invalid-url.com'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository).toBeUndefined();
      });

      it('should not include repository when both enabled is false and repositoryUrl is invalid', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          repository: {
            enabled: false,
            repositoryUrl: 'invalid'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.repository).toBeUndefined();
      });
    });

    describe('optional fields - build', () => {
      it('should include build with envOutputPath', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            envOutputPath: '.env.production'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build.envOutputPath).toBe('.env.production');
      });

      it('should not include build when undefined', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            envOutputPath: '.env'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build.envOutputPath).toBe('.env');
      });

      it('should not include secrets when empty string', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            secrets: ''
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toBeUndefined();
      });

      it('should exclude secrets when empty string but include other valid fields', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            secrets: '',
            localPort: 3001
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toBeDefined();
        expect(result.build.localPort).toBe(3001);
      });

      it('should include build with localPort', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            localPort: 3001
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build.localPort).toBe(3001);
      });

      it('should include build with language', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            language: 'typescript'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build.language).toBe('typescript');
      });

      it('should include build with context', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            context: './src'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build.context).toBe('./src');
      });

      it('should include build with dockerfile when not empty', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            dockerfile: 'Dockerfile.prod'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build.dockerfile).toBe('Dockerfile.prod');
      });

      it('should not include dockerfile when empty string', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            dockerfile: ''
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toBeUndefined();
      });

      it('should exclude dockerfile when empty string but include other valid fields', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            dockerfile: '',
            language: 'typescript'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toBeDefined();
        expect(result.build.dockerfile).toBeUndefined();
        expect(result.build.language).toBe('typescript');
      });

      it('should not include dockerfile when whitespace only', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            dockerfile: '   '
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toBeUndefined();
      });

      it('should exclude dockerfile when whitespace only but include other valid fields', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            dockerfile: '   ',
            context: './src'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toBeDefined();
        expect(result.build.dockerfile).toBeUndefined();
        expect(result.build.context).toBe('./src');
      });

      it('should not include build when all fields are empty/missing', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {}
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toBeUndefined();
      });

      it('should include build with all fields', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          build: {
            envOutputPath: '.env',
            localPort: 3001,
            language: 'typescript',
            context: './src',
            dockerfile: 'Dockerfile.prod'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.build).toEqual({
          envOutputPath: '.env',
          localPort: 3001,
          language: 'typescript',
          context: './src',
          dockerfile: 'Dockerfile.prod'
        });
      });
    });

    describe('optional fields - deployment', () => {
      it('should include deployment with valid controllerUrl', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          deployment: {
            controllerUrl: 'https://controller.example.com'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.deployment.controllerUrl).toBe('https://controller.example.com');
      });

      it('should not include controllerUrl when empty string', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          deployment: {
            controllerUrl: ''
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.deployment).toBeUndefined();
      });

      it('should not include controllerUrl when whitespace only', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          deployment: {
            controllerUrl: '   '
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.deployment).toBeUndefined();
      });

      it('should not include controllerUrl when not https', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          deployment: {
            controllerUrl: 'http://controller.example.com'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.deployment).toBeUndefined();
      });

      it('should not include deployment when controllerUrl is invalid', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          deployment: {
            controllerUrl: 'http://invalid'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.deployment).toBeUndefined();
      });

      it('should include deployment with valid controllerUrl', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          deployment: {
            controllerUrl: 'https://controller.example.com'
          }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.deployment).toEqual({
          controllerUrl: 'https://controller.example.com'
        });
      });
    });

    describe('optional fields - startupCommand', () => {
      it('should include startupCommand when present', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          startupCommand: 'npm start'
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.startupCommand).toBe('npm start');
      });
    });

    describe('optional fields - runtimeVersion', () => {
      it('should include runtimeVersion when present', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          runtimeVersion: '18.0.0'
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.runtimeVersion).toBe('18.0.0');
      });
    });

    describe('optional fields - scaling', () => {
      it('should include scaling when present', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          scaling: { min: 1, max: 10 }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.scaling).toEqual({ min: 1, max: 10 });
      });
    });

    describe('optional fields - frontDoorRouting', () => {
      it('should include frontDoorRouting when present', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          frontDoorRouting: { enabled: true, path: '/api' }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.frontDoorRouting).toEqual({ enabled: true, path: '/api' });
      });
    });

    describe('optional fields - roles', () => {
      it('should include roles when present', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          roles: ['admin', 'user']
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.roles).toEqual(['admin', 'user']);
      });
    });

    describe('optional fields - permissions', () => {
      it('should include permissions when present', () => {
        const variables = {
          app: { key: 'myapp' },
          image: { name: 'myapp', tag: 'latest' },
          permissions: { read: true, write: false }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.permissions).toEqual({ read: true, write: false });
      });
    });

    describe('complex nested structure', () => {
      it('should transform complete nested structure with all optional fields', () => {
        const variables = {
          app: {
            key: 'myapp',
            displayName: 'My Application',
            description: 'A comprehensive test application',
            type: 'api'
          },
          image: {
            name: 'myapp',
            registry: 'myregistry.azurecr.io',
            tag: 'v2.0.0',
            registryMode: 'internal'
          },
          port: 8080,
          requires: {
            database: true,
            redis: true,
            storage: false,
            databases: [{ name: 'primary' }, { name: 'secondary' }]
          },
          healthCheck: { path: '/health', interval: 30 },
          authentication: { type: 'oauth2' },
          repository: {
            enabled: true,
            repositoryUrl: 'https://github.com/user/repo'
          },
          build: {
            envOutputPath: '.env.prod',
            localPort: 3001,
            language: 'typescript',
            context: './',
            dockerfile: 'Dockerfile.prod'
          },
          deployment: {
            controllerUrl: 'https://controller.example.com'
          },
          startupCommand: 'npm run start:prod',
          runtimeVersion: '18.0.0',
          scaling: { min: 2, max: 10 },
          frontDoorRouting: { enabled: true, path: '/api' },
          roles: ['admin', 'user', 'viewer'],
          permissions: { read: true, write: true, delete: false }
        };

        const result = transformVariablesForValidation(variables, defaultAppName);

        expect(result.key).toBe('myapp');
        expect(result.image).toBe('myregistry.azurecr.io/myapp:v2.0.0');
        expect(result.requiresDatabase).toBe(true);
        expect(result.requiresRedis).toBe(true);
        expect(result.requiresStorage).toBe(false);
        expect(result.databases).toEqual([{ name: 'primary' }, { name: 'secondary' }]);
        expect(result.healthCheck).toEqual({ path: '/health', interval: 30 });
        expect(result.authentication.type).toBe('azure');
        expect(result.authentication.enableSSO).toBe(true);
        expect(result.authentication.requiredRoles).toEqual([]);
        expect(result.repository.enabled).toBe(true);
        expect(result.build.dockerfile).toBe('Dockerfile.prod');
        expect(result.deployment.controllerUrl).toBe('https://controller.example.com');
        expect(result.startupCommand).toBe('npm run start:prod');
        expect(result.runtimeVersion).toBe('18.0.0');
        expect(result.scaling).toEqual({ min: 2, max: 10 });
        expect(result.frontDoorRouting).toEqual({ enabled: true, path: '/api' });
        expect(result.roles).toEqual(['admin', 'user', 'viewer']);
        expect(result.permissions).toEqual({ read: true, write: true, delete: false });
      });
    });
  });
});

