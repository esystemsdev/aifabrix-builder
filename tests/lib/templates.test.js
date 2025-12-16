/**
 * Tests for AI Fabrix Builder Templates Module
 *
 * @fileoverview Unit tests for templates.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const templates = require('../../lib/templates');
const yaml = require('js-yaml');

describe('Templates Module', () => {
  describe('generateVariablesYaml', () => {
    it('should generate valid YAML for TypeScript application', () => {
      const appName = 'test-app';
      const config = {
        language: 'typescript',
        port: 3000,
        database: true,
        redis: false,
        storage: false,
        authentication: true
      };

      const result = templates.generateVariablesYaml(appName, config);

      // Verify it's valid YAML
      const parsed = yaml.load(result);
      expect(parsed).toBeDefined();

      // Verify structure
      expect(parsed.app.key).toBe('test-app');
      expect(parsed.app.displayName).toBe('Test App');
      expect(parsed.app.version).toBeUndefined(); // version removed
      expect(parsed.image.name).toBe('test-app');
      expect(parsed.image.tag).toBe('latest');
      expect(parsed.build.language).toBe('typescript');
      expect(parsed.port).toBe(3000);
      expect(parsed.requires.database).toBe(true);
      expect(parsed.requires.redis).toBe(false);
      expect(parsed.requires.storage).toBe(false);
      expect(parsed.requires.databases).toEqual([{ name: 'test_app' }]);
      expect(parsed.authentication).toBeDefined();
      expect(parsed.authentication.type).toBe('azure');
      expect(parsed.authentication.enableSSO).toBe(true);
      expect(parsed.security).toBeUndefined(); // security section removed
      expect(parsed.monitoring).toBeUndefined(); // monitoring section removed
      expect(parsed.healthCheck).toBeDefined();
      expect(parsed.healthCheck.path).toBe('/health');
    });

    it('should generate valid YAML for Python application', () => {
      const appName = 'python-app';
      const config = {
        language: 'python',
        port: 8000,
        database: true,
        redis: true,
        storage: true,
        authentication: false
      };

      const result = templates.generateVariablesYaml(appName, config);
      const parsed = yaml.load(result);

      expect(parsed.app.key).toBe('python-app');
      expect(parsed.app.version).toBeUndefined(); // version removed
      expect(parsed.image.name).toBe('python-app');
      expect(parsed.image.tag).toBe('latest');
      expect(parsed.build.language).toBe('python');
      expect(parsed.port).toBe(8000);
      expect(parsed.requires.database).toBe(true);
      expect(parsed.requires.redis).toBe(true);
      expect(parsed.requires.storage).toBe(true);
      expect(parsed.requires.databases).toEqual([{ name: 'python_app' }]);
      expect(parsed.authentication).toBeUndefined();
      expect(parsed.security).toBeUndefined(); // security section removed
      expect(parsed.monitoring).toBeUndefined(); // monitoring section removed
      expect(parsed.healthCheck).toBeDefined();
    });

    it('should handle missing configuration values', () => {
      const appName = 'minimal-app';
      const config = {};

      const result = templates.generateVariablesYaml(appName, config);
      const parsed = yaml.load(result);

      expect(parsed.app.key).toBe('minimal-app');
      expect(parsed.app.version).toBeUndefined(); // version removed
      expect(parsed.image.name).toBe('minimal-app');
      expect(parsed.image.tag).toBe('latest');
      expect(parsed.build.language).toBe('typescript');
      expect(parsed.port).toBe(3000);
      expect(parsed.requires.database).toBe(false);
      expect(parsed.requires.redis).toBe(false);
      expect(parsed.requires.storage).toBe(false);
      expect(parsed.authentication).toBeUndefined();
      expect(parsed.security).toBeUndefined(); // security section removed
      expect(parsed.monitoring).toBeUndefined(); // monitoring section removed
      expect(parsed.healthCheck).toBeDefined();
    });

    it('should include deployment section with default values', () => {
      const appName = 'test-app';
      const config = {};

      const result = templates.generateVariablesYaml(appName, config);
      const parsed = yaml.load(result);

      expect(parsed.deployment).toBeDefined();
      expect(parsed.deployment.controllerUrl).toBe('');
      expect(parsed.deployment.environment).toBe('dev');
    });

    it('should include deployment section in all generated YAMLs', () => {
      const appName = 'deployment-test';
      const configs = [
        { language: 'typescript', port: 3000 },
        { language: 'python', port: 8000, database: true },
        { language: 'typescript', authentication: true }
      ];

      configs.forEach(config => {
        const result = templates.generateVariablesYaml(appName, config);
        const parsed = yaml.load(result);
        expect(parsed.deployment).toBeDefined();
        expect(parsed.deployment.environment).toBe('dev');
      });
    });

    it('should generate variables.yaml for external type with config values', () => {
      const appName = 'test-external';
      const config = {
        type: 'external',
        systemKey: 'test-external',
        systemDisplayName: 'Test External',
        systemDescription: 'Test external system integration'
      };

      const result = templates.generateVariablesYaml(appName, config);
      const parsed = yaml.load(result);

      expect(parsed.app.key).toBe('test-external');
      expect(parsed.app.displayName).toBe('Test External');
      expect(parsed.app.description).toBe('Test external system integration');
      expect(parsed.app.type).toBe('external');
      expect(parsed.externalIntegration).toBeDefined();
      expect(parsed.externalIntegration.schemaBasePath).toBe('./');
    });

    it('should use defaults for external type when config values are missing', () => {
      const appName = 'test-external';
      const config = {
        type: 'external'
        // No systemKey, systemDisplayName, systemDescription provided
      };

      const result = templates.generateVariablesYaml(appName, config);
      const parsed = yaml.load(result);

      expect(parsed.app.key).toBe('test-external'); // Uses appName
      expect(parsed.app.displayName).toBe('Test External'); // Uses appName transformation
      expect(parsed.app.description).toBe('External system integration for test-external'); // Uses prompt default
      expect(parsed.app.type).toBe('external');
    });

    it('should use appName as fallback for systemKey in external type', () => {
      const appName = 'my-external-app';
      const config = {
        type: 'external',
        systemDisplayName: 'My External App',
        systemDescription: 'My external system'
        // systemKey not provided
      };

      const result = templates.generateVariablesYaml(appName, config);
      const parsed = yaml.load(result);

      expect(parsed.app.key).toBe('my-external-app'); // Uses appName as fallback
      expect(parsed.app.displayName).toBe('My External App'); // Uses provided value
      expect(parsed.app.description).toBe('My external system'); // Uses provided value
    });
  });

  describe('generateEnvTemplate', () => {
    it('should generate environment template with all services', () => {
      const config = {
        port: 3000,
        appName: 'test-app',
        database: true,
        redis: true,
        storage: true,
        authentication: true
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('NODE_ENV=${NODE_ENV}');
      expect(result).toContain('PORT=3000');
      expect(result).toContain('APP_NAME=test-app');
      expect(result).toContain('DATABASE_URL=kv://databases-test-app-0-urlKeyVault');
      expect(result).toContain('DB_USER=test_app_user');
      expect(result).toContain('DB_PASSWORD=kv://databases-test-app-0-passwordKeyVault');
      expect(result).toContain('REDIS_URL=kv://redis-url');
      expect(result).toContain('JWT_SECRET=kv://miso-controller-jwt-secretKeyVault');
    });

    it('should generate minimal environment template', () => {
      const config = {
        port: 3000,
        appName: 'minimal-app',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('NODE_ENV=${NODE_ENV}');
      expect(result).toContain('PORT=3000');
      expect(result).toContain('APP_NAME=minimal-app');
      expect(result).not.toContain('DATABASE_URL');
      expect(result).not.toContain('REDIS_URL');
      expect(result).not.toContain('STORAGE_URL');
      expect(result).not.toContain('JWT_SECRET');
    });

    it('should include proper section headers', () => {
      const config = {
        port: 3000,
        appName: 'test-app',
        database: true,
        redis: true,
        storage: true,
        authentication: true
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('# Environment Variables Template');
      expect(result).toContain('# APPLICATION ENVIRONMENT');
      expect(result).toContain('# DATABASE CONFIGURATION');
      expect(result).toContain('# REDIS CONFIGURATION');
      expect(result).toContain('# STORAGE CONFIGURATION');
      expect(result).toContain('# AUTHENTICATION CONFIGURATION');
      expect(result).toContain('# =============================================================================');
    });

    it('should include MISO Controller variables when controller is enabled', () => {
      const config = {
        port: 3000,
        appName: 'test-app',
        controller: true
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('# MISO Controller Configuration');
      expect(result).toContain('MISO_CONTROLLER_URL=https://controller.aifabrix.ai');
      expect(result).toContain('MISO_ENVIRONMENT=dev');
      expect(result).toContain('MISO_CLIENTID=kv://miso-controller-client-idKeyVault');
      expect(result).toContain('MISO_CLIENTSECRET=kv://miso-controller-client-secretKeyVault');
      expect(result).toContain('MISO_WEB_SERVER_URL=kv://miso-controller-web-server-url');
    });

    it('should use custom controllerUrl when provided', () => {
      const config = {
        port: 3000,
        appName: 'test-app',
        controller: true,
        controllerUrl: 'https://custom.controller.com'
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('MISO_CONTROLLER_URL=https://custom.controller.com');
    });

    it('should not include MISO Controller variables when controller is disabled', () => {
      const config = {
        port: 3000,
        appName: 'test-app',
        controller: false
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).not.toContain('# MISO Controller Configuration');
      expect(result).not.toContain('MISO_CONTROLLER_URL');
      expect(result).not.toContain('MISO_ENVIRONMENT');
      expect(result).not.toContain('MISO_CLIENTID');
      expect(result).not.toContain('MISO_CLIENTSECRET');
      expect(result).not.toContain('MISO_WEB_SERVER_URL');
    });

    it('should include MISO Controller section with all other services', () => {
      const config = {
        port: 3000,
        appName: 'test-app',
        database: true,
        redis: true,
        storage: true,
        authentication: true,
        controller: true,
        controllerUrl: 'https://controller.example.com'
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('# DATABASE CONFIGURATION');
      expect(result).toContain('# REDIS CONFIGURATION');
      expect(result).toContain('# STORAGE CONFIGURATION');
      expect(result).toContain('# AUTHENTICATION CONFIGURATION');
      expect(result).toContain('# MISO Controller Configuration');
      expect(result).toContain('MISO_CONTROLLER_URL=https://controller.example.com');
      expect(result).toContain('MISO_WEB_SERVER_URL=kv://miso-controller-web-server-url');
    });

    it('should include ALLOWED_ORIGINS and WEB_SERVER_URL in APPLICATION ENVIRONMENT section', () => {
      const config = {
        port: 3000,
        appName: 'test-app'
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('# APPLICATION ENVIRONMENT');
      expect(result).toContain('ALLOWED_ORIGINS=http://localhost:*,');
      expect(result).toContain('WEB_SERVER_URL=http://localhost:${PORT},');
    });

    it('should include ALLOWED_ORIGINS and WEB_SERVER_URL after PORT variable', () => {
      const config = {
        port: 3000,
        appName: 'test-app'
      };

      const result = templates.generateEnvTemplate(config);
      const lines = result.split('\n');
      const portIndex = lines.findIndex(line => line.startsWith('PORT='));
      const allowedOriginsIndex = lines.findIndex(line => line.startsWith('ALLOWED_ORIGINS='));
      const webServerUrlIndex = lines.findIndex(line => line.startsWith('WEB_SERVER_URL='));

      expect(portIndex).toBeGreaterThan(-1);
      expect(allowedOriginsIndex).toBeGreaterThan(portIndex);
      expect(webServerUrlIndex).toBeGreaterThan(allowedOriginsIndex);
    });
  });

  describe('generateRbacYaml', () => {
    it('should generate RBAC configuration when authentication is enabled', () => {
      const appName = 'auth-app';
      const config = {
        authentication: true
      };

      const result = templates.generateRbacYaml(appName, config);

      expect(result).toBeDefined();
      const parsed = yaml.load(result);

      expect(parsed.roles).toBeDefined();
      expect(parsed.permissions).toBeDefined();
      expect(parsed.roles).toHaveLength(3);
      expect(parsed.permissions).toHaveLength(4);
      expect(parsed.roles[0].name).toBe('AI Fabrix Admin');
      expect(parsed.roles[0].value).toBe('aifabrix-admin');
    });

    it('should return null when authentication is disabled', () => {
      const appName = 'no-auth-app';
      const config = {
        authentication: false
      };

      const result = templates.generateRbacYaml(appName, config);

      expect(result).toBeNull();
    });

    it('should include proper role definitions', () => {
      const appName = 'rbac-test';
      const config = {
        authentication: true
      };

      const result = templates.generateRbacYaml(appName, config);
      const parsed = yaml.load(result);

      const roles = parsed.roles;
      expect(roles).toContainEqual(
        expect.objectContaining({
          name: 'AI Fabrix Admin',
          value: 'aifabrix-admin',
          description: 'Full access to all application features and configurations'
        })
      );
      expect(roles).toContainEqual(
        expect.objectContaining({
          name: 'AI Fabrix User',
          value: 'aifabrix-user',
          description: 'Basic user access to the application'
        })
      );
      expect(roles).toContainEqual(
        expect.objectContaining({
          name: 'AI Fabrix Developer',
          value: 'aifabrix-developer',
          description: 'Developer access for testing and debugging'
        })
      );

      // Check permissions include app name
      const permissions = parsed.permissions;
      expect(permissions).toContainEqual(
        expect.objectContaining({
          name: 'rbac-test:read',
          roles: expect.arrayContaining(['aifabrix-user', 'aifabrix-admin', 'aifabrix-developer'])
        })
      );
      expect(permissions).toContainEqual(
        expect.objectContaining({
          name: 'rbac-test:admin',
          roles: ['aifabrix-admin']
        })
      );
    });
  });

  describe('generateSecretsYaml', () => {
    it('should generate secrets configuration with all services', () => {
      const config = {
        database: true,
        redis: true,
        storage: true,
        authentication: true
      };

      const existingSecrets = {
        'custom-secret': 'custom-value',
        'api-key': 'api-value'
      };

      const result = templates.generateSecretsYaml(config, existingSecrets);
      const parsed = yaml.load(result);

      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.kind).toBe('Secret');
      expect(parsed.metadata.name).toBe('app-secrets');
      expect(parsed.type).toBe('Opaque');

      // Check service-specific secrets
      expect(parsed.data['database-password']).toBeDefined();
      expect(parsed.data['redis-passwordKeyVault']).toBeDefined();
      expect(parsed.data['miso-controller-jwt-secretKeyVault']).toBeDefined();

      // Check existing secrets
      expect(parsed.data['custom-secret']).toBeDefined();
      expect(parsed.data['api-key']).toBeDefined();
    });

    it('should generate minimal secrets configuration', () => {
      const config = {
        database: false,
        redis: false,
        storage: false,
        authentication: false
      };

      const result = templates.generateSecretsYaml(config, {});
      const parsed = yaml.load(result);

      expect(parsed.data).toBeDefined();
      expect(Object.keys(parsed.data)).toHaveLength(0);
    });
  });

  describe('buildPythonEnv', () => {
    it('should return Python environment variables when language is python', () => {
      const config = {
        language: 'python'
      };

      // Access the function directly if exported, or test via generateEnvTemplate
      // Since buildPythonEnv is not exported, we test it via generateEnvTemplate
      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('PYTHONUNBUFFERED=${PYTHONUNBUFFERED}');
      expect(result).toContain('PYTHONDONTWRITEBYTECODE=${PYTHONDONTWRITEBYTECODE}');
      expect(result).toContain('PYTHONIOENCODING=${PYTHONIOENCODING}');
    });

    it('should not return Python variables when language is typescript', () => {
      const config = {
        language: 'typescript',
        port: 3000,
        appName: 'test-app'
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).not.toContain('PYTHONUNBUFFERED');
      expect(result).not.toContain('PYTHONDONTWRITEBYTECODE');
      expect(result).not.toContain('PYTHONIOENCODING');
      expect(result).toContain('NODE_ENV=${NODE_ENV}');
    });

    it('should not return Python variables when language is not specified (defaults to typescript)', () => {
      const config = {
        port: 3000,
        appName: 'test-app'
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).not.toContain('PYTHONUNBUFFERED');
      expect(result).not.toContain('PYTHONDONTWRITEBYTECODE');
      expect(result).not.toContain('PYTHONIOENCODING');
      expect(result).toContain('NODE_ENV=${NODE_ENV}');
    });

    it('should include Python variables in core variables section for Python apps', () => {
      const config = {
        language: 'python',
        port: 8000,
        appName: 'python-app'
      };

      const result = templates.generateEnvTemplate(config);

      // Python variables should appear in APPLICATION ENVIRONMENT section
      const lines = result.split('\n');
      const appEnvSectionIndex = lines.findIndex(line => line.includes('# APPLICATION ENVIRONMENT'));
      const pythonVarsStart = lines.slice(appEnvSectionIndex);

      expect(pythonVarsStart.some(line => line.includes('PYTHONUNBUFFERED=${PYTHONUNBUFFERED}'))).toBe(true);
      expect(pythonVarsStart.some(line => line.includes('PYTHONDONTWRITEBYTECODE=${PYTHONDONTWRITEBYTECODE}'))).toBe(true);
      expect(pythonVarsStart.some(line => line.includes('PYTHONIOENCODING=${PYTHONIOENCODING}'))).toBe(true);
    });
  });

  describe('generateEnvTemplate - Language-specific behavior', () => {
    it('should use ${NODE_ENV} interpolation for TypeScript apps', () => {
      const config = {
        language: 'typescript',
        port: 3000,
        appName: 'ts-app'
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('NODE_ENV=${NODE_ENV}');
      expect(result).not.toContain('NODE_ENV=development');
      expect(result).not.toContain('NODE_ENV=production');
    });

    it('should include Python variables for Python apps with all services', () => {
      const config = {
        language: 'python',
        port: 8000,
        appName: 'python-app',
        database: true,
        redis: true,
        storage: true,
        authentication: true
      };

      const result = templates.generateEnvTemplate(config);

      // Should have Python variables
      expect(result).toContain('PYTHONUNBUFFERED=${PYTHONUNBUFFERED}');
      expect(result).toContain('PYTHONDONTWRITEBYTECODE=${PYTHONDONTWRITEBYTECODE}');
      expect(result).toContain('PYTHONIOENCODING=${PYTHONIOENCODING}');

      // NODE_ENV is still included (buildCoreEnv always includes it, even for Python)
      // This is fine - Python apps can ignore it if not needed
      expect(result).toContain('NODE_ENV=${NODE_ENV}');

      // Should have other services
      expect(result).toContain('DATABASE_URL');
      expect(result).toContain('REDIS_URL');
      expect(result).toContain('STORAGE_TYPE');
      expect(result).toContain('JWT_SECRET');
    });

    it('should include Python variables for minimal Python app', () => {
      const config = {
        language: 'python',
        port: 8000,
        appName: 'minimal-python',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      };

      const result = templates.generateEnvTemplate(config);

      expect(result).toContain('PYTHONUNBUFFERED=${PYTHONUNBUFFERED}');
      expect(result).toContain('PYTHONDONTWRITEBYTECODE=${PYTHONDONTWRITEBYTECODE}');
      expect(result).toContain('PYTHONIOENCODING=${PYTHONIOENCODING}');
      expect(result).toContain('PORT=8000');
      expect(result).toContain('APP_NAME=minimal-python');
    });
  });
});
