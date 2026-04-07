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
  readRelaxedCatalogDefaults,
  listKvKeysWithLiteralPlaceholder,
  standardBootstrapKeysFromDoc,
  mergeInfraParameterDefaultsForCli,
  expandInfraCatalogPlaceholders
} = require('../../../lib/parameters/infra-parameter-catalog');

/** Align with lib/parameters/infra-parameter-catalog.js DEFAULT_CATALOG_PATH (not test __dirname — CI copy / layout safe). */
const BUNDLED_CATALOG = path.join(
  path.dirname(require.resolve('../../../lib/parameters/infra-parameter-catalog.js')),
  '..',
  'schema',
  'infra.parameter.yaml'
);

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

  it('miso-controller-admin-emailKeyVault is literal with {{adminEmail}} (not pattern *KeyVault → randomBytes32)', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const entry = cat.findEntryForKey('miso-controller-admin-emailKeyVault');
    expect(entry).toBeTruthy();
    expect(entry.key).toBe('miso-controller-admin-emailKeyVault');
    expect(entry.generator.type).toBe('literal');
    expect(entry.generator.value).toBe('{{adminEmail}}');
  });

  it('readRelaxedCatalogDefaults returns shipped adminEmail and adminPassword from bundled YAML', () => {
    const d = readRelaxedCatalogDefaults(BUNDLED_CATALOG);
    expect(d.adminEmail).toBe('admin@aifabrix.dev');
    expect(d.adminPassword).toBe('admin123');
    expect(d.userPassword).toBe('user123');
  });

  it('listKvKeysWithLiteralPlaceholder lists all {{adminPassword}} literal keys in bundled catalog', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const keys = listKvKeysWithLiteralPlaceholder(cat, 'adminPassword');
    expect(keys).toEqual(
      expect.arrayContaining([
        'postgres-passwordKeyVault',
        'keycloak-admin-passwordKeyVault',
        'miso-controller-admin-passwordKeyVault'
      ])
    );
    expect(keys).toHaveLength(3);
  });

  it('listKvKeysWithLiteralPlaceholder returns userPassword and adminEmail keys', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    expect(listKvKeysWithLiteralPlaceholder(cat, 'userPassword')).toEqual([
      'keycloak-default-passwordKeyVault'
    ]);
    expect(listKvKeysWithLiteralPlaceholder(cat, 'adminEmail')).toEqual(['miso-controller-admin-emailKeyVault']);
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

  it('generateValueFromCatalogEntry returns literal, placeholder-expanded literal, and randomBytes32', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const crypto = require('crypto');
    const vars = mergeInfraParameterDefaultsForCli(cat.data, {});
    const lit = cat.findEntryForKey('redis-url');
    expect(generateValueFromCatalogEntry('redis-url', lit, crypto)).toContain('REDIS_HOST');
    const pg = cat.findEntryForKey('postgres-passwordKeyVault');
    expect(generateValueFromCatalogEntry('postgres-passwordKeyVault', pg, crypto, vars)).toBe('admin123');
    const apiKey = cat.findEntryForKey('api-key');
    expect(apiKey).toBeTruthy();
    const rb = generateValueFromCatalogEntry('api-key', apiKey, crypto);
    expect(rb.length).toBe(44);
  });

  it('generateValueFromCatalogEntry supports randomAlphanumeric (charset [a-zA-Z0-9])', () => {
    const cryptoStub = {
      randomBytes: jest.fn((n) => Buffer.alloc(n, 0))
    };
    const entry = { generator: { type: 'randomAlphanumeric', length: 6 } };
    const v = generateValueFromCatalogEntry('any-key', entry, cryptoStub);
    expect(v).toBe('aaaaaa');
    expect(v).toMatch(/^[a-zA-Z0-9]+$/);
    expect(cryptoStub.randomBytes).toHaveBeenCalledWith(6);
  });

  it('generateValueFromCatalogEntry supports password (default length 8, [a-zA-Z0-9])', () => {
    const cryptoStub = {
      randomBytes: jest.fn((n) => Buffer.alloc(n, 0))
    };
    const entry = { generator: { type: 'password' } };
    const v = generateValueFromCatalogEntry('any-key', entry, cryptoStub);
    expect(v).toHaveLength(8);
    expect(v).toBe('aaaaaaaa');
    expect(v).toMatch(/^[a-zA-Z0-9]+$/);
    expect(cryptoStub.randomBytes).toHaveBeenCalledWith(8);
  });

  it('password generator accepts optional length', () => {
    const cryptoStub = {
      randomBytes: jest.fn((n) => Buffer.alloc(n, 5))
    };
    const entry = { generator: { type: 'password', length: 4 } };
    const v = generateValueFromCatalogEntry('k', entry, cryptoStub);
    expect(v).toHaveLength(4);
    expect(v).toBe('ffff');
    expect(cryptoStub.randomBytes).toHaveBeenCalledWith(4);
  });

  it('loads minimal catalog with password generator (AJV)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-pwd-'));
    const yamlPath = path.join(dir, 'infra.parameter.yaml');
    fs.writeFileSync(
      yamlPath,
      `version: 1
parameters:
  - key: demo-passwordKeyVault
    scope: app
    generator:
      type: password
    ensureOn: [resolveApp]
`,
      'utf8'
    );
    try {
      const cat = loadInfraParameterCatalog(yamlPath);
      const e = cat.findEntryForKey('demo-passwordKeyVault');
      expect(e.generator.type).toBe('password');
      const v = generateValueFromCatalogEntry('demo-passwordKeyVault', e, require('crypto'));
      expect(v).toHaveLength(8);
      expect(v).toMatch(/^[a-zA-Z0-9]+$/);
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it('mergeInfraParameterDefaultsForCli overlays CLI on catalog defaults', () => {
    const doc = { defaults: { adminPassword: 'p1', adminEmail: 'a@b.c', userPassword: 'u1' } };
    const m = mergeInfraParameterDefaultsForCli(doc, { adminPassword: 'from-cli', userPassword: 'u2' });
    expect(m.adminPassword).toBe('from-cli');
    expect(m.adminEmail).toBe('a@b.c');
    expect(m.userPassword).toBe('u2');
    expect(m.TLS_ENABLED).toBe('false');
    expect(m.HTTP_ENABLED).toBe('true');
  });

  it('expandInfraCatalogPlaceholders replaces {{tokens}} and preserves unknown', () => {
    expect(expandInfraCatalogPlaceholders('pre-{{adminPassword}}-post', { adminPassword: 'x' })).toBe('pre-x-post');
    expect(expandInfraCatalogPlaceholders('plain', { adminPassword: 'x' })).toBe('plain');
    expect(expandInfraCatalogPlaceholders('{{unknown}}', { adminPassword: 'x' })).toBe('{{unknown}}');
    expect(expandInfraCatalogPlaceholders('t={{TLS_ENABLED}} h={{HTTP_ENABLED}}', { TLS_ENABLED: 'false', HTTP_ENABLED: 'true' })).toBe(
      't=false h=true'
    );
  });

  it('shipped catalog literals resolve defaults and {{placeholders}}', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const crypto = require('crypto');
    const vars = mergeInfraParameterDefaultsForCli(cat.data, {});
    const cases = [
      ['postgres-passwordKeyVault', 'admin123'],
      ['keycloak-client-idKeyVault', 'miso-controller-miso-keycloak'],
      ['miso-controller-client-idKeyVault', 'miso-controller-miso-miso-controller'],
      ['dataplane-client-idKeyVault', 'miso-controller-dev-dataplane'],
      ['keycloak-default-passwordKeyVault', 'user123'],
      ['keycloak-admin-passwordKeyVault', 'admin123'],
      ['miso-controller-admin-emailKeyVault', 'admin@aifabrix.dev'],
      ['miso-controller-admin-passwordKeyVault', 'admin123']
    ];
    for (const [key, expected] of cases) {
      const e = cat.findEntryForKey(key);
      expect(e).toBeTruthy();
      expect(e.generator.type).toBe('literal');
      expect(generateValueFromCatalogEntry(key, e, crypto, vars)).toBe(expected);
    }
  });

  it('miso-controller encryption and JWT catalog entries use randomBytes32 (autogenerated)', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const cryptoStub = {
      randomBytes: jest.fn((n) => Buffer.alloc(n, 7))
    };
    for (const key of [
      'miso-controller-secrets-encryptionKeyVault',
      'miso-controller-jwt-secretKeyVault',
      'miso-controller-secretKeyVault',
      'dataplane-client-secretKeyVault',
      'dataplane-secrets-encryptionKeyVault',
      'api-key'
    ]) {
      const e = cat.findEntryForKey(key);
      expect(e).toBeTruthy();
      expect(e.generator.type).toBe('randomBytes32');
      expect(generateValueFromCatalogEntry(key, e, cryptoStub)).toHaveLength(44);
    }
    expect(cryptoStub.randomBytes).toHaveBeenCalledTimes(6);
    expect(cryptoStub.randomBytes).toHaveBeenCalledWith(32);
  });

  it('mergeInfraParameterDefaultsForCli sets TLS_ENABLED and HTTP_ENABLED from tlsEnabled boolean', () => {
    const cat = loadInfraParameterCatalog(BUNDLED_CATALOG);
    const on = mergeInfraParameterDefaultsForCli(cat.data, { tlsEnabled: true });
    expect(on.TLS_ENABLED).toBe('true');
    expect(on.HTTP_ENABLED).toBe('false');
    const off = mergeInfraParameterDefaultsForCli(cat.data, { tlsEnabled: false });
    expect(off.TLS_ENABLED).toBe('false');
    expect(off.HTTP_ENABLED).toBe('true');
    const def = mergeInfraParameterDefaultsForCli(cat.data, {});
    expect(def.TLS_ENABLED).toBe('false');
    expect(def.HTTP_ENABLED).toBe('true');
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
    const doc = require('js-yaml').load(
      jest.requireActual('node:fs').readFileSync(BUNDLED_CATALOG, 'utf8')
    );
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
    expect(fromYaml.filter((k) => k.startsWith('databases-miso-controller-'))).toHaveLength(4);
    expect(fromYaml.filter((k) => k.startsWith('databases-dataplane-'))).toHaveLength(8);
    expect(fromYaml).toHaveLength(12);
  });

  it('readRelaxedUpInfraEnsureKeyList returns null for missing file', () => {
    expect(readRelaxedUpInfraEnsureKeyList(path.join(os.tmpdir(), 'no-such-infra-parameter.yaml'))).toBeNull();
  });

  it('readRelaxedUpInfraEnsureKeyList returns null when YAML root is not an object', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-relax-'));
    const bad = path.join(dir, 'bad.yaml');
    try {
      fs.writeFileSync(bad, 'plain-scalar-not-a-mapping', 'utf8');
      expect(readRelaxedUpInfraEnsureKeyList(bad)).toBeNull();
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore flaky ENOTEMPTY under parallel load */
      }
    }
  });

  it('readRelaxedEmptyAllowedKeySet returns null for missing file', () => {
    expect(readRelaxedEmptyAllowedKeySet(path.join(os.tmpdir(), 'missing-empty-allowed.yaml'))).toBeNull();
  });
});

