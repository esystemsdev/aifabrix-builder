/**
 * @fileoverview Tests for lib/utils/external-readme.js (context building only, no template).
 * Template rendering tests (generateExternalReadmeContent) are in tests/manual/external-readme-template.test.js (excluded from CI).
 */

const path = require('path');
const { buildExternalReadmeContext } = require('../../../lib/utils/external-readme');

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
});
