/**
 * Tests for external-env-template (buildExternalEnvTemplateContext, generateExternalEnvTemplateContent)
 * @fileoverview Unit tests for lib/utils/external-env-template.js
 */

const path = require('path');
const fs = require('fs');

// Mock fs so readFileSync returns the env template when the implementation reads it.
// This isolates the test from other suites' fs mocks and from CI path/cwd differences.
jest.mock('fs', () => {
  const pathMod = require('path');
  const actual = jest.requireActual('fs');
  const externalEnvTemplate = `# Environment variables for external system integration
# Use kv:// (or aifabrix secret set) for sensitive values; plain values for non-sensitive configuration.
#

{{#if authMethod}}
# Authentication
# Type: {{authMethod}}
{{#each authSecureVars}}
{{name}}={{value}}
{{/each}}
{{#if authNonSecureVarNames}}
# Non-secure (e.g. URLs): {{#each authNonSecureVarNames}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{/if}}
{{#if configuration.length}}
# Configuration
{{#each configuration}}
# {{comment}}
{{name}}={{value}}
{{/each}}
{{/if}}
`;
  return {
    ...actual,
    readFileSync: (filePath, encoding) => {
      const p = pathMod.isAbsolute(filePath) ? filePath : pathMod.resolve(process.cwd(), filePath);
      if (String(p).includes('env.template.hbs') && String(p).includes('external-system')) {
        return externalEnvTemplate;
      }
      return actual.readFileSync(filePath, encoding);
    }
  };
});

jest.mock('../../../lib/utils/credential-secrets-env', () => ({
  systemKeyToKvPrefix: jest.fn((k) => (k || '').replace(/-/g, '_').toUpperCase()),
  kvEnvKeyToPath: jest.fn((envKey, systemKey) => {
    if (!envKey || !systemKey) return null;
    const rest = envKey.replace(/^KV_/, '').replace(/_/g, '').toLowerCase();
    return `kv://${systemKey}/${rest}`;
  }),
  securityKeyToVar: jest.fn((k) => (k || '').replace(/_/g, '').toUpperCase())
}));

const {
  buildExternalEnvTemplateContext,
  generateExternalEnvTemplateContent
} = require('../../../lib/utils/external-env-template');

describe('external-env-template', () => {
  describe('buildExternalEnvTemplateContext', () => {
    it('returns authMethod and authSecureVars from authentication.security', () => {
      const system = {
        key: 'hubspot',
        authentication: {
          method: 'oauth2',
          security: { clientId: 'kv://hubspot/clientId', clientSecret: 'kv://hubspot/clientSecret' }
        }
      };
      const ctx = buildExternalEnvTemplateContext(system);
      expect(ctx.authMethod).toBe('oauth2');
      expect(ctx.authSecureVars).toBeDefined();
      expect(Array.isArray(ctx.authSecureVars)).toBe(true);
      expect(ctx.authSecureVars.length).toBeGreaterThanOrEqual(2);
      expect(ctx.authSecureVars.some(v => v.name && v.name.includes('CLIENTID'))).toBe(true);
      expect(ctx.authSecureVars.some(v => v.value && v.value.startsWith('kv://'))).toBe(true);
    });

    it('returns authNonSecureVarNames from authentication.variables', () => {
      const system = {
        key: 'hubspot',
        authentication: {
          method: 'oauth2',
          variables: { baseUrl: 'https://api.hubspot.com', tokenUrl: 'https://api.hubspot.com/oauth/token' }
        }
      };
      const ctx = buildExternalEnvTemplateContext(system);
      expect(ctx.authNonSecureVarNames).toEqual(['baseUrl', 'tokenUrl']);
    });

    it('returns configuration with name, value, comment from portalInput', () => {
      const system = {
        key: 'hubspot',
        configuration: [
          {
            name: 'API_VERSION',
            value: 'v3',
            location: 'variable',
            portalInput: { label: 'API Version', options: ['v1', 'v2', 'v3'] }
          }
        ]
      };
      const ctx = buildExternalEnvTemplateContext(system);
      expect(ctx.configuration).toHaveLength(1);
      expect(ctx.configuration[0].name).toBe('API_VERSION');
      expect(ctx.configuration[0].value).toBe('v3');
      expect(ctx.configuration[0].comment).toContain('API Version');
      expect(ctx.configuration[0].comment).toMatch(/enum|v1|v2|v3/);
    });

    it('handles missing authentication and configuration (fallback apikey vars)', () => {
      const ctx = buildExternalEnvTemplateContext({ key: 'minimal' });
      expect(ctx.authMethod).toBe('apikey');
      expect(ctx.authSecureVars.length).toBe(1);
      expect(ctx.authSecureVars[0].name).toBe('KV_MINIMAL_APIKEY');
      expect(ctx.authSecureVars[0].value).toContain('kv://minimal/');
      expect(ctx.authNonSecureVarNames).toEqual([]);
      expect(ctx.configuration).toEqual([]);
    });
  });

  describe('generateExternalEnvTemplateContent', () => {
    it('generates content with Authentication and Configuration sections', () => {
      const system = {
        key: 'hubspot',
        authentication: { method: 'oauth2', security: { clientId: 'x', clientSecret: 'y' } },
        configuration: [
          { name: 'PAGE_SIZE', value: '100', location: 'variable', portalInput: { label: 'Page size' } }
        ]
      };
      const content = generateExternalEnvTemplateContent(system);
      expect(content).toContain('# Environment variables for external system integration');
      expect(content).toContain('# Authentication');
      expect(content).toContain('Type: oauth2');
      expect(content).toContain('# Configuration');
      expect(content).toContain('PAGE_SIZE=');
      expect(content).toContain('Page size');
    });

    it('returns intro-only content for null/empty system', () => {
      const content = generateExternalEnvTemplateContent(null);
      expect(content).toContain('# Environment variables for external system integration');
      expect(content).toContain('kv://');
    });
  });
});
