/**
 * Manual tests for external-readme template rendering (generateExternalReadmeContent).
 * Requires templates/external-system/README.md.hbs to exist. Excluded from CI (tests/manual/).
 *
 * @fileoverview External system README template rendering tests (manual / no CI)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const {
  generateExternalReadmeContent
} = require('../../lib/utils/external-readme');

const projectRoot = path.resolve(__dirname, '..', '..');

describe('external-readme template (manual)', () => {
  let originalProjectRoot;

  beforeEach(() => {
    originalProjectRoot = global.PROJECT_ROOT;
    global.PROJECT_ROOT = projectRoot;
    const { clearProjectRootCache } = require('../../lib/utils/paths');
    clearProjectRootCache();
  });

  afterEach(() => {
    global.PROJECT_ROOT = originalProjectRoot;
    const { clearProjectRootCache } = require('../../lib/utils/paths');
    clearProjectRootCache();
  });

  describe('generateExternalReadmeContent with Secrets section', () => {
    const fs = require('fs');
    const templatePath = path.join(projectRoot, 'templates', 'external-system', 'README.md.hbs');

    it('external-system README template exists (required for generateExternalReadmeContent tests)', () => {
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it('generated README contains Secrets section and aifabrix secret set with key (no kv://) when secretPaths present', () => {
      const content = generateExternalReadmeContent({
        systemKey: 'wizard-e2e-demo',
        displayName: 'Wizard E2E Demo',
        authType: 'apikey'
      });
      expect(content).toContain('### Secrets');
      expect(content).toContain('aifabrix secret set');
      expect(content).toContain('wizard-e2e-demo/apiKey');
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
