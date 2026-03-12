/**
 * @fileoverview Tests for lib/utils/external-readme.js (context building only, no template).
 * Full template rendering tests are in tests/local/lib/utils/external-readme.test.js.
 */

const path = require('path');
const {
  buildExternalReadmeContext,
  generateExternalReadmeContent
} = require('../../../lib/utils/external-readme');

const projectRoot = path.resolve(__dirname, '..', '..', '..');

describe('external-readme (context only)', () => {
  let originalProjectRoot;

  beforeEach(() => {
    originalProjectRoot = global.PROJECT_ROOT;
    global.PROJECT_ROOT = projectRoot;
    const { clearProjectRootCache } = require('../../../lib/utils/paths');
    clearProjectRootCache();
  });

  afterEach(() => {
    global.PROJECT_ROOT = originalProjectRoot;
    const { clearProjectRootCache } = require('../../../lib/utils/paths');
    clearProjectRootCache();
  });

  describe('buildExternalReadmeContext', () => {
    it('returns default fileExt .json when not provided', () => {
      const ctx = buildExternalReadmeContext({ systemKey: 'myapp' });
      expect(ctx.fileExt).toBe('.json');
    });

    it('normalizes fileExt to start with dot', () => {
      const ctx = buildExternalReadmeContext({ systemKey: 'myapp', fileExt: 'yaml' });
      expect(ctx.fileExt).toBe('.yaml');
    });

    it('sets hasDatasources true when datasources exist', () => {
      const ctx = buildExternalReadmeContext({
        systemKey: 'myapp',
        datasources: [{ key: 'myapp-entities-datasource', displayName: 'Entities' }]
      });
      expect(ctx.hasDatasources).toBe(true);
    });

    it('sets hasDatasources false when datasources empty', () => {
      const ctx = buildExternalReadmeContext({ systemKey: 'myapp', datasources: [] });
      expect(ctx.hasDatasources).toBe(false);
    });

    it('includes datasourceKey on each normalized datasource', () => {
      const ctx = buildExternalReadmeContext({
        systemKey: 'hubspot-demo',
        datasources: [
          { key: 'hubspot-demo-companies-datasource', displayName: 'Companies' }
        ]
      });
      expect(ctx.datasources[0]).toMatchObject({
        datasourceKey: 'hubspot-demo-companies-datasource',
        displayName: 'Companies',
        fileName: expect.stringContaining('hubspot-demo-datasource')
      });
    });

    it('uses fileExt for default datasource fileName when no fileName provided', () => {
      const ctx = buildExternalReadmeContext({
        systemKey: 'myapp',
        fileExt: '.yaml',
        datasources: [{ entityType: 'users', displayName: 'Users' }]
      });
      expect(ctx.datasources[0].fileName).toBe('myapp-datasource-users.yaml');
    });

    it('includes secretPaths for apikey authType with path and description (key without kv://)', () => {
      const ctx = buildExternalReadmeContext({
        systemKey: 'hubspot-test',
        authType: 'apikey'
      });
      expect(ctx.secretPaths).toBeDefined();
      expect(ctx.secretPaths.length).toBe(1);
      expect(ctx.secretPaths[0]).toMatchObject({
        path: 'hubspot-test/apiKey',
        description: 'API Key'
      });
    });

    it('includes secretPaths for oauth2 authType (clientId, clientSecret) with keys without kv://', () => {
      const ctx = buildExternalReadmeContext({
        systemKey: 'my-integration',
        authType: 'oauth2'
      });
      expect(ctx.secretPaths).toBeDefined();
      expect(ctx.secretPaths.length).toBe(2);
      expect(ctx.secretPaths.map(p => p.path)).toContain('my-integration/clientId');
      expect(ctx.secretPaths.map(p => p.path)).toContain('my-integration/clientSecret');
    });

    it('includes empty secretPaths for authType none', () => {
      const ctx = buildExternalReadmeContext({
        systemKey: 'no-auth-system',
        authType: 'none'
      });
      expect(ctx.secretPaths).toEqual([]);
    });
  });

  describe('generateExternalReadmeContent with Secrets section', () => {
    const fs = require('fs');
    const templatePath = path.join(projectRoot, 'templates', 'external-system', 'README.md.hbs');

    it('external-system README template exists (required for generateExternalReadmeContent tests)', () => {
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it('generated README contains Secrets section and aifabrix secret set with key (no kv://) when secretPaths present', () => {
      const content = generateExternalReadmeContent({
        systemKey: 'hubspot-test',
        displayName: 'HubSpot Test',
        authType: 'apikey'
      });
      expect(content).toContain('### Secrets');
      expect(content).toContain('aifabrix secret set');
      expect(content).toContain('hubspot-test/apiKey');
      expect(content).toContain('<your value>');
      expect(content).not.toMatch(/aifabrix secret set kv:\/\//);
    });

    it('generated README shows aifabrix secret set with systemKey/key and <your value> for oauth2', () => {
      const content = generateExternalReadmeContent({
        systemKey: 'hubspot-demo',
        displayName: 'HubSpot Demo',
        authType: 'oauth2'
      });
      expect(content).toContain('aifabrix secret set hubspot-demo/clientId <your value>');
      expect(content).toContain('aifabrix secret set hubspot-demo/clientSecret <your value>');
      expect(content).not.toMatch(/aifabrix secret set kv:\/\//);
    });

    it('generated README omits Secrets section when authType none', () => {
      const content = generateExternalReadmeContent({
        systemKey: 'no-secrets',
        displayName: 'No Secrets',
        authType: 'none'
      });
      expect(content).not.toMatch(/### Secrets/);
      expect(content).not.toContain('aifabrix secret set');
    });
  });
});
