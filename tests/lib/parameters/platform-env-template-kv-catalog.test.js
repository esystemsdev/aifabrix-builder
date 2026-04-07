/**
 * @fileoverview Platform templates: every kv:// ref must match infra.parameter.yaml
 */

const fs = jest.requireActual('node:fs');
const path = require('path');
const {
  getInfraParameterCatalog,
  clearInfraParameterCatalogCache
} = require('../../../lib/parameters/infra-parameter-catalog');
const { extractKvKeysFromEnvContent } = require('../../../lib/parameters/infra-kv-discovery');

/**
 * Repo root: derive from this file only. Other suites mutate global.PROJECT_ROOT; using it here
 * produced paths like tests/lib/schema when PROJECT_ROOT pointed at tests/.
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'lib', 'schema', 'infra.parameter.yaml');
const PLATFORM_APPS = ['keycloak', 'miso-controller', 'dataplane'];

describe('platform env.template kv catalog coverage', () => {
  beforeEach(() => {
    clearInfraParameterCatalogCache();
  });

  it('every active kv:// in shipped platform templates has a catalog entry', () => {
    expect(fs.existsSync(CATALOG_PATH)).toBe(true);
    const catalog = getInfraParameterCatalog(CATALOG_PATH);
    for (const app of PLATFORM_APPS) {
      const envPath = path.join(REPO_ROOT, 'templates', 'applications', app, 'env.template');
      expect(fs.existsSync(envPath)).toBe(true);
      const content = fs.readFileSync(envPath, 'utf8');
      for (const key of extractKvKeysFromEnvContent(content)) {
        expect(catalog.findEntryForKey(key)).toBeTruthy();
      }
    }
  });
});
