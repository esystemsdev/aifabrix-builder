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
      expect(parsed.app.name).toBe('Test App');
      expect(parsed.build.language).toBe('typescript');
      expect(parsed.build.port).toBe(3000);
      expect(parsed.services.database).toBe(true);
      expect(parsed.services.redis).toBe(false);
      expect(parsed.services.storage).toBe(false);
      expect(parsed.services.authentication).toBe(true);
      expect(parsed.security.enableRBAC).toBe(true);
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
      expect(parsed.build.language).toBe('python');
      expect(parsed.build.port).toBe(8000);
      expect(parsed.services.database).toBe(true);
      expect(parsed.services.redis).toBe(true);
      expect(parsed.services.storage).toBe(true);
      expect(parsed.services.authentication).toBe(false);
      expect(parsed.security.enableRBAC).toBe(false);
    });

    it('should handle missing configuration values', () => {
      const appName = 'minimal-app';
      const config = {};

      const result = templates.generateVariablesYaml(appName, config);
      const parsed = yaml.load(result);

      expect(parsed.app.key).toBe('minimal-app');
      expect(parsed.build.language).toBe('typescript');
      expect(parsed.build.port).toBe(3000);
      expect(parsed.services.database).toBe(false);
      expect(parsed.services.redis).toBe(false);
      expect(parsed.services.storage).toBe(false);
      expect(parsed.services.authentication).toBe(false);
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
      expect(result).toContain('DATABASE_URL=kv://database-url');
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

      expect(result).toContain('# AI Fabrix Environment Template');
      expect(result).toContain('# Core Application Settings');
      expect(result).toContain('# Database Configuration');
      expect(result).toContain('# Redis Configuration');
      expect(result).toContain('# Storage Configuration');
      expect(result).toContain('# Authentication Configuration');
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

      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.kind).toBe('RBACConfig');
      expect(parsed.metadata.name).toBe('auth-app-rbac');
      expect(parsed.spec.roles).toHaveLength(3);
      expect(parsed.spec.policies).toHaveLength(3);
      expect(parsed.spec.bindings).toHaveLength(1);
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

      const roles = parsed.spec.roles;
      expect(roles).toContainEqual(
        expect.objectContaining({
          name: 'admin',
          description: 'Full administrative access',
          permissions: ['*']
        })
      );
      expect(roles).toContainEqual(
        expect.objectContaining({
          name: 'user',
          description: 'Standard user access',
          permissions: ['read', 'write']
        })
      );
      expect(roles).toContainEqual(
        expect.objectContaining({
          name: 'viewer',
          description: 'Read-only access',
          permissions: ['read']
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
