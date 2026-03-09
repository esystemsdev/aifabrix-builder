/**
 * @fileoverview Tests for lib/utils/external-readme.js (context building only, no template).
 * Full template rendering tests are in tests/local/lib/utils/external-readme.test.js.
 */

const {
  buildExternalReadmeContext
} = require('../../../lib/utils/external-readme');

describe('external-readme (context only)', () => {
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
  });
});
