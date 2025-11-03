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
      expect(parsed.build.secrets).toBeNull();
      expect(parsed.port).toBe(3000);
      expect(parsed.requires.database).toBe(true);
      expect(parsed.requires.redis).toBe(false);
      expect(parsed.requires.storage).toBe(false);
      expect(parsed.requires.databases).toEqual([{ name: 'test-app' }]);
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
      expect(parsed.build.secrets).toBeNull();
      expect(parsed.port).toBe(8000);
      expect(parsed.requires.database).toBe(true);
      expect(parsed.requires.redis).toBe(true);
      expect(parsed.requires.storage).toBe(true);
      expect(parsed.requires.databases).toEqual([{ name: 'python-app' }]);
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
      expect(parsed.build.secrets).toBeNull();
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
      expect(parsed.deployment.clientId).toBe('');
      expect(parsed.deployment.clientSecret).toBe('');
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

      expect(result).toContain('NODE_ENV=development');
      expect(result).toContain('PORT=3000');
      expect(result).toContain('APP_NAME=test-app');
      expect(result).toContain('DATABASE_URL=kv://databases-test-app-0-urlKeyVault');
      expect(result).toContain('DB_USER=test-app_user');
      expect(result).toContain('DB_PASSWORD=kv://databases-test-app-0-passwordKeyVault');
      expect(result).toContain('REDIS_URL=kv://redis-url');
      expect(result).toContain('STORAGE_URL=kv://storage-url');
      expect(result).toContain('JWT_SECRET=kv://jwt-secret');
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

      expect(result).toContain('NODE_ENV=development');
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
      expect(result).toContain('MISO_CLIENTID=kv://miso-clientid');
      expect(result).toContain('MISO_CLIENTSECRET=kv://miso-clientsecret');
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
      expect(parsed.data['redis-password']).toBeDefined();
      expect(parsed.data['storage-key']).toBeDefined();
      expect(parsed.data['storage-secret']).toBeDefined();
      expect(parsed.data['jwt-secret']).toBeDefined();
      expect(parsed.data['session-secret']).toBeDefined();

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
});
