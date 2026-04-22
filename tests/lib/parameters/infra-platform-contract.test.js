/**
 * @fileoverview Platform contract: shipped infra.parameter.yaml + generateSecretValue + up-infra bootstrap keys.
 * Uses real filesystem (no fs mock) so regressions in catalog or DB URL logic fail CI.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
  loadInfraParameterCatalog,
  clearInfraParameterCatalogCache,
  DEFAULT_CATALOG_PATH
} = require('../../../lib/parameters/infra-parameter-catalog');
const { generateSecretValue } = require('../../../lib/utils/secrets-generator');
const { getAllInfraEnsureKeys } = require('../../../lib/parameters/infra-kv-discovery');

const CATALOG_PATH = path.resolve(DEFAULT_CATALOG_PATH);

describe('infra platform contract (real disk)', () => {
  let bootstrapKeys;

  beforeAll(() => {
    const doc = yaml.load(fs.readFileSync(CATALOG_PATH, 'utf8'));
    bootstrapKeys = doc.standardUpInfraEnsureKeys || [];
  });

  beforeEach(() => {
    clearInfraParameterCatalogCache();
  });

  it('shipped catalog defines standardUpInfraEnsureKeys (miso-controller + dataplane slots)', () => {
    expect(bootstrapKeys.length).toBeGreaterThanOrEqual(12);
    expect(bootstrapKeys.filter((k) => k.startsWith('databases-miso-controller-'))).toHaveLength(4);
    expect(bootstrapKeys.filter((k) => k.startsWith('databases-dataplane-'))).toHaveLength(8);
  });

  it('every bootstrap key has a catalog entry', () => {
    const cat = loadInfraParameterCatalog(CATALOG_PATH);
    for (const k of bootstrapKeys) {
      const entry = cat.findEntryForKey(k);
      expect(entry).toBeTruthy();
      expect(entry.generator && entry.generator.type).toBeTruthy();
    }
  });

  it('generateSecretValue produces stable, usable values for every bootstrap key', () => {
    for (const k of bootstrapKeys) {
      const v = generateSecretValue(k);
      expect(typeof v).toBe('string');
      if (k.includes('-urlKeyVault')) {
        expect(v).toContain('postgresql://');
        expect(v).toContain('${DB_HOST}');
      }
      if (k.includes('-passwordKeyVault')) {
        expect(v.length).toBeGreaterThan(0);
        expect(v).toMatch(/pass123$/);
      }
    }
  });

  it('dataplane URL secrets follow shipped templates/applications/dataplane requires.databases order', () => {
    const expectedDbNames = ['dataplane', 'dataplane-vector', 'dataplane-logs', 'dataplane-records'];
    for (let i = 0; i < 4; i++) {
      const url = generateSecretValue(`databases-dataplane-${i}-urlKeyVault`);
      const name = expectedDbNames[i];
      expect(url).toContain(`/${name}`);
      const user = name.replace(/-/g, '_') + '_user';
      expect(url).toContain(user);
    }
  });

  it('miso-controller-admin-emailKeyVault is a literal email (not random *KeyVault)', () => {
    expect(generateSecretValue('miso-controller-admin-emailKeyVault')).toBe('admin@aifabrix.dev');
  });

  it('typical app *KeyVault secret (catch-all pattern) resolves through catalog', () => {
    const cat = loadInfraParameterCatalog(CATALOG_PATH);
    const key = 'miso-controller-secrets-apiKeyVault';
    expect(cat.findEntryForKey(key)).toBeTruthy();
    const v = generateSecretValue(key);
    expect(v.length).toBe(44);
  });

  it('getAllInfraEnsureKeys includes all bootstrap keys with empty pathsUtil discovery', () => {
    const cat = loadInfraParameterCatalog(CATALOG_PATH);
    const pathsStub = {
      listBuilderAppNames: () => [],
      listIntegrationAppNames: () => [],
      getBuilderPath: (n) => `/builder/${n}`,
      getIntegrationPath: (n) => `/integration/${n}`
    };
    const keys = getAllInfraEnsureKeys(cat, pathsStub);
    for (const k of bootstrapKeys) {
      expect(keys).toContain(k);
    }
  });
});
