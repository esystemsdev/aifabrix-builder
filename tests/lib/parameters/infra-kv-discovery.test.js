/**
 * @fileoverview Tests for infra kv discovery (up-infra key union)
 */

// Real disk I/O; workers may retain jest.mock('fs') / mocked fs-real-sync (e.g. admin-secrets.test.js).
jest.unmock('../../../lib/internal/fs-real-sync');

const fs = jest.requireActual('node:fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const {
  extractKvKeysFromEnvContent,
  listAppDirsForDiscovery,
  deriveDatabaseKvKeysFromWorkspace,
  discoverKvKeysFromEnvTemplatesForHook,
  getAllInfraEnsureKeys
} = require('../../../lib/parameters/infra-kv-discovery');
const {
  loadInfraParameterCatalog,
  standardBootstrapKeysFromDoc
} = require('../../../lib/parameters/infra-parameter-catalog');

function bundledInfraCatalogPath() {
  const fromTest = path.join(__dirname, '../../../lib/schema/infra.parameter.yaml');
  if (fs.existsSync(fromTest)) {
    return fromTest;
  }
  const fromCwd = path.join(process.cwd(), 'lib/schema/infra.parameter.yaml');
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  throw new Error(
    'infra.parameter.yaml not found (lib/schema/). Restore with: git checkout HEAD -- lib/schema/'
  );
}

describe('infra-kv-discovery', () => {
  const rmTmp = (tmp) => {
    // In CI simulation (copy-to-/tmp + parallel Jest), Linux can intermittently throw ENOTEMPTY
    // during recursive deletes. Retries make this deterministic without masking real test failures.
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  };

  describe('extractKvKeysFromEnvContent', () => {
    it('returns empty for non-string input', () => {
      expect(extractKvKeysFromEnvContent(null)).toEqual([]);
      expect(extractKvKeysFromEnvContent(undefined)).toEqual([]);
    });

    it('skips blank lines and # comments', () => {
      const content = '# FOO=kv://ignored\n\nX=kv://keep-me\n';
      expect(extractKvKeysFromEnvContent(content)).toEqual(['keep-me']);
    });

    it('deduplicates keys across lines', () => {
      const content = 'A=kv://same\nB=kv://same\n';
      expect(extractKvKeysFromEnvContent(content)).toEqual(['same']);
    });

    it('collects multiple distinct kv refs on one line', () => {
      const content = 'A=kv://one B=kv://two\n';
      expect(extractKvKeysFromEnvContent(content).sort()).toEqual(['one', 'two']);
    });
  });

  describe('listAppDirsForDiscovery', () => {
    it('returns builder apps when directory exists', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ikv-b-'));
      const appDir = path.join(tmp, 'alpha');
      fs.mkdirSync(appDir, { recursive: true });
      const pathsUtil = {
        listBuilderAppNames: () => ['alpha'],
        listIntegrationAppNames: () => [],
        getBuilderPath: (n) => path.join(tmp, n),
        getIntegrationPath: (n) => path.join(tmp, 'integration', n)
      };
      expect(listAppDirsForDiscovery(pathsUtil)).toEqual([{ appKey: 'alpha', dir: appDir }]);
      rmTmp(tmp);
    });

    it('prefers builder over integration when the same name exists in both', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ikv-dup-'));
      const bDir = path.join(tmp, 'builder', 'same');
      const iDir = path.join(tmp, 'integration', 'same');
      fs.mkdirSync(bDir, { recursive: true });
      fs.mkdirSync(iDir, { recursive: true });
      const pathsUtil = {
        listBuilderAppNames: () => ['same'],
        listIntegrationAppNames: () => ['same'],
        getBuilderPath: () => bDir,
        getIntegrationPath: () => iDir
      };
      expect(listAppDirsForDiscovery(pathsUtil)).toEqual([{ appKey: 'same', dir: bDir }]);
      rmTmp(tmp);
    });

    it('includes integration-only app when not in builder list', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ikv-int-'));
      const iDir = path.join(tmp, 'integration', 'ext');
      fs.mkdirSync(iDir, { recursive: true });
      const pathsUtil = {
        listBuilderAppNames: () => [],
        listIntegrationAppNames: () => ['ext'],
        getBuilderPath: (n) => path.join(tmp, 'builder', n),
        getIntegrationPath: (n) => path.join(tmp, 'integration', n)
      };
      expect(listAppDirsForDiscovery(pathsUtil)).toEqual([{ appKey: 'ext', dir: iDir }]);
      rmTmp(tmp);
    });
  });

  describe('deriveDatabaseKvKeysFromWorkspace', () => {
    it('emits url and password keys per requires.databases index', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ikv-db-'));
      const appDir = path.join(tmp, 'dataplane');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'application.yaml'),
        yaml.dump({
          app: { key: 'dataplane' },
          requires: { databases: [{ name: 'main' }, { name: 'logs' }] }
        }),
        'utf8'
      );
      const pathsUtil = {
        listBuilderAppNames: () => ['dataplane'],
        listIntegrationAppNames: () => [],
        getBuilderPath: (n) => path.join(tmp, n),
        getIntegrationPath: (n) => path.join(tmp, 'integration', n)
      };
      const keys = deriveDatabaseKvKeysFromWorkspace(pathsUtil).sort();
      expect(keys).toEqual([
        'databases-dataplane-0-passwordKeyVault',
        'databases-dataplane-0-urlKeyVault',
        'databases-dataplane-1-passwordKeyVault',
        'databases-dataplane-1-urlKeyVault'
      ]);
      rmTmp(tmp);
    });
  });

  describe('discoverKvKeysFromEnvTemplatesForHook', () => {
    it('includes only keys whose catalog entry matches the hook', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ikv-env-'));
      const appDir = path.join(tmp, 'svc');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'env.template'),
        'A=kv://postgres-passwordKeyVault\nB=kv://npm-token-secretKeyVault\n',
        'utf8'
      );
      const catalog = loadInfraParameterCatalog(bundledInfraCatalogPath());
      const pathsUtil = {
        listBuilderAppNames: () => ['svc'],
        listIntegrationAppNames: () => [],
        getBuilderPath: (n) => path.join(tmp, n),
        getIntegrationPath: (n) => path.join(tmp, 'integration', n)
      };
      const keys = discoverKvKeysFromEnvTemplatesForHook(pathsUtil, 'upInfra', catalog).sort();
      expect(keys).toContain('postgres-passwordKeyVault');
      expect(keys).not.toContain('npm-token-secretKeyVault');
      rmTmp(tmp);
    });
  });

  describe('getAllInfraEnsureKeys', () => {
    it('unions catalog upInfra keys, standard miso DB keys, derived DB keys, and template hook keys', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ikv-all-'));
      const appDir = path.join(tmp, 'svc');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'application.yaml'),
        yaml.dump({
          requires: { databases: [{ name: 'one' }] }
        }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(appDir, 'env.template'),
        'PG=kv://postgres-passwordKeyVault\n',
        'utf8'
      );
      const catalog = loadInfraParameterCatalog(bundledInfraCatalogPath());
      const pathsUtil = {
        listBuilderAppNames: () => ['svc'],
        listIntegrationAppNames: () => [],
        getBuilderPath: (n) => path.join(tmp, n),
        getIntegrationPath: (n) => path.join(tmp, 'integration', n)
      };
      const keys = getAllInfraEnsureKeys(catalog, pathsUtil);
      expect(keys).toContain('postgres-passwordKeyVault');
      expect(keys).toContain('databases-svc-0-urlKeyVault');
      const bootstrap = standardBootstrapKeysFromDoc(
        yaml.load(fs.readFileSync(bundledInfraCatalogPath(), 'utf8'))
      );
      for (const k of bootstrap) {
        expect(keys).toContain(k);
      }
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
      rmTmp(tmp);
    });
  });
});
