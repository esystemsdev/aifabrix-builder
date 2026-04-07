/**
 * @fileoverview Tests for workspace kv:// validation vs catalog
 */

const fs = require('node:fs');
const path = require('path');
const os = require('os');

const {
  validateWorkspaceKvRefsAgainstCatalog,
  validateCatalogRequiredGenerators
} = require('../../../lib/parameters/infra-parameter-validate');
const { loadInfraParameterCatalog } = require('../../../lib/parameters/infra-parameter-catalog');

describe('infra-parameter-validate', () => {
  describe('validateCatalogRequiredGenerators', () => {
    it('passes when no parameters use requiredForLocal', () => {
      const r = validateCatalogRequiredGenerators({ parameters: [{ generator: { type: 'x' } }] });
      expect(r).toEqual({ valid: true, errors: [] });
    });

    it('fails when requiredForLocal is set but generator.type is missing', () => {
      const r = validateCatalogRequiredGenerators({
        parameters: [{ requiredForLocal: true, generator: {} }]
      });
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
      expect(r.errors[0]).toMatch(/parameters\[0\]/);
    });

    it('passes when requiredForLocal has generator.type', () => {
      const r = validateCatalogRequiredGenerators({
        parameters: [{ requiredForLocal: true, generator: { type: 'randomBytes32' } }]
      });
      expect(r).toEqual({ valid: true, errors: [] });
    });

    it('passes when requiredForLocal uses password generator type', () => {
      const r = validateCatalogRequiredGenerators({
        parameters: [{ requiredForLocal: true, generator: { type: 'password' } }]
      });
      expect(r).toEqual({ valid: true, errors: [] });
    });
  });

  describe('validateWorkspaceKvRefsAgainstCatalog', () => {
    it('reports unknown kv:// keys not covered by catalog', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ipv-bad-'));
      const appDir = path.join(tmp, 'app1');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'env.template'),
        'X=kv://this-key-does-not-exist-in-catalog-zzzzz\n',
        'utf8'
      );
      const catalog = loadInfraParameterCatalog();
      const pathsUtil = {
        listBuilderAppNames: () => ['app1'],
        listIntegrationAppNames: () => [],
        getBuilderPath: (n) => path.join(tmp, n),
        getIntegrationPath: (n) => path.join(tmp, 'integration', n)
      };
      const prev = process.cwd();
      process.chdir(tmp);
      try {
        const result = validateWorkspaceKvRefsAgainstCatalog(catalog, pathsUtil);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('this-key-does-not-exist-in-catalog-zzzzz'))).toBe(
          true
        );
      } finally {
        process.chdir(prev);
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it('passes when all kv:// keys match bundled catalog', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ipv-ok-'));
      const appDir = path.join(tmp, 'app2');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'env.template'),
        'PG=kv://postgres-passwordKeyVault\nJWT=kv://miso-controller-jwt-secretKeyVault\n',
        'utf8'
      );
      const catalog = loadInfraParameterCatalog();
      const pathsUtil = {
        listBuilderAppNames: () => ['app2'],
        listIntegrationAppNames: () => [],
        getBuilderPath: (n) => path.join(tmp, n),
        getIntegrationPath: (n) => path.join(tmp, 'integration', n)
      };
      const prev = process.cwd();
      process.chdir(tmp);
      try {
        const result = validateWorkspaceKvRefsAgainstCatalog(catalog, pathsUtil);
        expect(result).toEqual({ valid: true, errors: [] });
      } finally {
        process.chdir(prev);
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
});
