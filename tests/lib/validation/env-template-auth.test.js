/**
 * Tests for env-template-auth (auth kv coverage and path consistency)
 *
 * @fileoverview Unit tests for lib/validation/env-template-auth.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');

jest.mock('../../../lib/generator/external', () => ({
  loadExternalIntegrationConfig: jest.fn(),
  loadSystemFile: jest.fn()
}));

const generatorExternal = require('../../../lib/generator/external');
const {
  validateAuthSecurityPathConsistency,
  systemKeyFromFileName
} = require('../../../lib/validation/env-template-auth');

describe('env-template-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('systemKeyFromFileName', () => {
    it('extracts system key from system file name', () => {
      expect(systemKeyFromFileName('hubspot-system.yaml')).toBe('hubspot');
      expect(systemKeyFromFileName('demo-system.yml')).toBe('demo');
      expect(systemKeyFromFileName('my-app-system.json')).toBe('my-app');
    });

    it('is case-insensitive for extension', () => {
      expect(systemKeyFromFileName('hubspot-system.YAML')).toBe('hubspot');
      expect(systemKeyFromFileName('hubspot-system.JSON')).toBe('hubspot');
    });

    it('returns empty string for invalid or empty', () => {
      expect(systemKeyFromFileName('')).toBe('');
      expect(systemKeyFromFileName('not-a-system-file.txt')).toBe('not-a-system-file.txt');
      expect(systemKeyFromFileName(null)).toBe('');
      expect(systemKeyFromFileName(undefined)).toBe('');
    });
  });

  describe('validateAuthSecurityPathConsistency', () => {
    const appPath = path.join(process.cwd(), 'integration', 'demo');

    it('adds no error when all security paths are canonical', async() => {
      generatorExternal.loadExternalIntegrationConfig.mockResolvedValue({
        schemaBasePath: './',
        systemFiles: ['demo-system.yaml']
      });
      generatorExternal.loadSystemFile.mockResolvedValue({
        authentication: {
          security: { apiKey: 'kv://demo/apiKey' }
        }
      });

      const errors = [];
      const warnings = [];
      await validateAuthSecurityPathConsistency(appPath, errors, warnings);

      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it('adds error when security path is non-canonical', async() => {
      generatorExternal.loadExternalIntegrationConfig.mockResolvedValue({
        schemaBasePath: './',
        systemFiles: ['demo-system.yaml']
      });
      generatorExternal.loadSystemFile.mockResolvedValue({
        authentication: {
          security: { apiKey: 'kv://demo/apikey' }
        }
      });

      const errors = [];
      const warnings = [];
      await validateAuthSecurityPathConsistency(appPath, errors, warnings);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('authentication.security.apiKey');
      expect(errors[0]).toContain('kv://demo/apikey');
      expect(errors[0]).toContain('kv://demo/apiKey');
      expect(errors[0]).toMatch(/Run.*aifabrix repair/);
    });

    it('adds error for each non-canonical path in one system file', async() => {
      generatorExternal.loadExternalIntegrationConfig.mockResolvedValue({
        schemaBasePath: './',
        systemFiles: ['hubspot-system.yaml']
      });
      generatorExternal.loadSystemFile.mockResolvedValue({
        authentication: {
          security: {
            clientId: 'kv://hubspot/clientid',
            clientSecret: 'kv://hubspot/clientsecret'
          }
        }
      });

      const errors = [];
      const warnings = [];
      await validateAuthSecurityPathConsistency(appPath, errors, warnings);

      expect(errors).toHaveLength(2);
      expect(errors.some(e => e.includes('clientId') && e.includes('kv://hubspot/clientId'))).toBe(true);
      expect(errors.some(e => e.includes('clientSecret') && e.includes('kv://hubspot/clientSecret'))).toBe(true);
    });

    it('skips non-kv security values', async() => {
      generatorExternal.loadExternalIntegrationConfig.mockResolvedValue({
        schemaBasePath: './',
        systemFiles: ['demo-system.yaml']
      });
      generatorExternal.loadSystemFile.mockResolvedValue({
        authentication: {
          security: { apiKey: 'kv://demo/apiKey', someOther: 'plain-value' }
        }
      });

      const errors = [];
      const warnings = [];
      await validateAuthSecurityPathConsistency(appPath, errors, warnings);

      expect(errors).toHaveLength(0);
    });

    it('adds warning when config load fails', async() => {
      generatorExternal.loadExternalIntegrationConfig.mockRejectedValue(new Error('Config not found'));

      const errors = [];
      const warnings = [];
      await validateAuthSecurityPathConsistency(appPath, errors, warnings);

      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Could not validate auth path consistency');
    });
  });
});
