/**
 * Tests for resolve-docker-image-ref
 *
 * @fileoverview Unit tests for Docker image reference resolution
 */

const {
  resolveDockerImageRef,
  resolveComposeImageOverrideString,
  normalizeDockerRegistryPrefix,
  getRepositoryPathFromConfig
} = require('../../../lib/utils/resolve-docker-image-ref');

describe('resolve-docker-image-ref', () => {
  describe('normalizeDockerRegistryPrefix', () => {
    it('trims and strips trailing slashes', () => {
      expect(normalizeDockerRegistryPrefix('  my.reg.io///')).toBe('my.reg.io');
    });

    it('returns empty for whitespace or null', () => {
      expect(normalizeDockerRegistryPrefix('  ')).toBe('');
      expect(normalizeDockerRegistryPrefix(null)).toBe('');
      expect(normalizeDockerRegistryPrefix(undefined)).toBe('');
    });
  });

  describe('getRepositoryPathFromConfig', () => {
    it('uses image.name then app.key then appName', () => {
      expect(getRepositoryPathFromConfig({ image: { name: 'n' } }, 'fallback')).toBe('n');
      expect(getRepositoryPathFromConfig({ app: { key: 'k' } }, 'fallback')).toBe('k');
      expect(getRepositoryPathFromConfig({}, 'fallback')).toBe('fallback');
    });
  });

  describe('resolveDockerImageRef', () => {
    const baseCfg = { image: { name: 'aifabrix/app', tag: 'v2' } };

    it('uses --image override and ignores registry', () => {
      const r = resolveDockerImageRef('app', { ...baseCfg, image: { ...baseCfg.image, registry: 'reg.io' } }, {
        image: 'other/full:v9',
        registry: 'cli.io'
      });
      expect(r).toEqual({ imageName: 'other/full', imageTag: 'v9' });
    });

    it('prefixes with CLI registry over manifest', () => {
      const r = resolveDockerImageRef('app', { ...baseCfg, image: { ...baseCfg.image, registry: 'manifest.io' } }, {
        registry: 'cli.io'
      });
      expect(r).toEqual({ imageName: 'cli.io/aifabrix/app', imageTag: 'v2' });
    });

    it('prefixes with manifest image.registry when CLI omitted', () => {
      const r = resolveDockerImageRef('app', { ...baseCfg, image: { ...baseCfg.image, registry: 'manifest.io/' } }, {});
      expect(r).toEqual({ imageName: 'manifest.io/aifabrix/app', imageTag: 'v2' });
    });

    it('leaves unqualified name when no registry', () => {
      const r = resolveDockerImageRef('app', baseCfg, {});
      expect(r).toEqual({ imageName: 'aifabrix/app', imageTag: 'v2' });
    });

    it('treats empty manifest registry as absent', () => {
      const r = resolveDockerImageRef('app', { image: { name: 'x', tag: 't', registry: '  ' } }, {});
      expect(r).toEqual({ imageName: 'x', imageTag: 't' });
    });
  });

  describe('resolveComposeImageOverrideString', () => {
    const cfg = { image: { name: 'aifabrix/app', tag: 'v1' } };

    it('returns null when unqualified ref matches config (no registry)', () => {
      expect(resolveComposeImageOverrideString('app', cfg, {})).toBeNull();
    });

    it('returns full string when manifest has image.registry', () => {
      const c = { image: { name: 'aifabrix/app', tag: 'v1', registry: 'reg.io' } };
      expect(resolveComposeImageOverrideString('app', c, {})).toBe('reg.io/aifabrix/app:v1');
    });
  });
});
