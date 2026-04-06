/**
 * @fileoverview Tests for infra parameter catalog loader
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  loadInfraParameterCatalog,
  clearInfraParameterCatalogCache,
  generateValueFromCatalogEntry,
  readRelaxedUpInfraEnsureKeyList,
  readRelaxedEmptyAllowedKeySet,
  standardBootstrapKeysFromDoc
} = require('../../../lib/parameters/infra-parameter-catalog');

const BUNDLED_CATALOG = path.join(__dirname, '../../../lib/schema/infra.parameter.yaml');

describe('infra-parameter-catalog', () => {
  afterEach(() => {
    clearInfraParameterCatalogCache();
  });

  it('loads bundled infra.parameter.yaml and matches database keys', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const e0 = cat.findEntryForKey('databases-miso-controller-0-urlKeyVault');
    expect(e0).toBeTruthy();
    expect(e0.generator.type).toBe('databaseUrl');
    expect(cat.findEntryForKey('redis-url').generator.type).toBe('literal');
    expect(cat.isKeyAllowedEmpty('redis-passwordKeyVault')).toBe(true);
  });

  it('rejects catalog with both key and keyPattern', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-'));
    const bad = path.join(dir, 'bad.yaml');
    fs.writeFileSync(
      bad,
      `version: 1
parameters:
  - key: a
    keyPattern: "^b$"
    scope: infra
    generator: { type: emptyString }
    ensureOn: [upInfra]
`,
      'utf8'
    );
    expect(() => loadInfraParameterCatalog(bad)).toThrow(/exactly one of key or keyPattern/);
  });

  it('generateValueFromCatalogEntry returns literal and random types', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const lit = cat.findEntryForKey('redis-url');
    expect(generateValueFromCatalogEntry('redis-url', lit, require('crypto'))).toContain('REDIS_HOST');
    const rb = cat.findEntryForKey('postgres-passwordKeyVault');
    const v = generateValueFromCatalogEntry('postgres-passwordKeyVault', rb, require('crypto'));
    expect(v.length).toBe(44);
  });

  it('readRelaxedUpInfraEnsureKeyList matches standard bootstrap plus exact upInfra keys', () => {
    const list = readRelaxedUpInfraEnsureKeyList(BUNDLED_CATALOG);
    expect(list).toContain('postgres-passwordKeyVault');
    expect(list).toContain('databases-miso-controller-1-urlKeyVault');
    expect(list).toEqual([...list].sort());
  });

  it('readRelaxedEmptyAllowedKeySet includes redis-passwordKeyVault', () => {
    const set = readRelaxedEmptyAllowedKeySet(BUNDLED_CATALOG);
    expect(set).toBeTruthy();
    expect(set.has('redis-passwordKeyVault')).toBe(true);
  });

  it('standardBootstrapKeysFromDoc reads standardUpInfraEnsureKeys', () => {
    const doc = require('js-yaml').load(require('fs').readFileSync(BUNDLED_CATALOG, 'utf8'));
    expect(standardBootstrapKeysFromDoc(doc)).toContain('databases-miso-controller-0-urlKeyVault');
  });

  it('standardBootstrapKeysFromDoc returns empty array when field missing or invalid', () => {
    expect(standardBootstrapKeysFromDoc({})).toEqual([]);
    expect(standardBootstrapKeysFromDoc({ standardUpInfraEnsureKeys: 'not-array' })).toEqual([]);
  });

  it('getStandardUpInfraBootstrapKeys matches YAML standardUpInfraEnsureKeys', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const fromYaml = standardBootstrapKeysFromDoc(cat.data);
    expect(cat.getStandardUpInfraBootstrapKeys()).toEqual(fromYaml);
    expect(fromYaml).toHaveLength(4);
    expect(fromYaml.every((k) => k.startsWith('databases-miso-controller-'))).toBe(true);
  });

  it('readRelaxedUpInfraEnsureKeyList returns null for missing file', () => {
    expect(readRelaxedUpInfraEnsureKeyList(path.join(os.tmpdir(), 'no-such-infra-parameter.yaml'))).toBeNull();
  });

  it('readRelaxedUpInfraEnsureKeyList returns null when YAML root is not an object', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-relax-'));
    const bad = path.join(dir, 'bad.yaml');
    fs.writeFileSync(bad, 'plain-scalar-not-a-mapping', 'utf8');
    expect(readRelaxedUpInfraEnsureKeyList(bad)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('readRelaxedEmptyAllowedKeySet returns null for missing file', () => {
    expect(readRelaxedEmptyAllowedKeySet(path.join(os.tmpdir(), 'missing-empty-allowed.yaml'))).toBeNull();
  });
});

