/**
 * @fileoverview Tests for environment-scoped resources helpers (plan 117)
 */

'use strict';

const {
  computeEffectiveEnvironmentScopedResources,
  redisDbIndexForScopedRunEnv,
  buildEnvScopedTraefikPath,
  composeTraefikServiceKey,
  resolveRunContainerName,
  buildScopedLocalContainerName
} = require('../../lib/utils/environment-scoped-resources');
const {
  collectMissingSecrets,
  replaceKvInContent,
  mergeSecretsWithPrefixedCopies
} = require('../../lib/utils/secrets-helpers');
const { applyRedisDbIndexToEnvContent } = require('../../lib/utils/redis-env-scope');

describe('environment-scoped-resources', () => {
  describe('computeEffectiveEnvironmentScopedResources', () => {
    it('is true only when gate, app, and dev|tst', () => {
      expect(computeEffectiveEnvironmentScopedResources(true, true, 'dev')).toBe(true);
      expect(computeEffectiveEnvironmentScopedResources(true, true, 'tst')).toBe(true);
      expect(computeEffectiveEnvironmentScopedResources(true, true, 'pro')).toBe(false);
      expect(computeEffectiveEnvironmentScopedResources(false, true, 'dev')).toBe(false);
      expect(computeEffectiveEnvironmentScopedResources(true, false, 'dev')).toBe(false);
    });
  });

  describe('redisDbIndexForScopedRunEnv', () => {
    it('maps dev/tst', () => {
      expect(redisDbIndexForScopedRunEnv('dev')).toBe(0);
      expect(redisDbIndexForScopedRunEnv('tst')).toBe(1);
      expect(redisDbIndexForScopedRunEnv('pro')).toBe(null);
    });
  });

  describe('buildEnvScopedTraefikPath', () => {
    it('prefixes env before pattern base', () => {
      expect(buildEnvScopedTraefikPath('/api', 'dev')).toBe('/dev/api');
      expect(buildEnvScopedTraefikPath('/', 'tst')).toBe('/tst');
    });
  });

  describe('composeTraefikServiceKey', () => {
    it('combines env and app', () => {
      expect(composeTraefikServiceKey('myapp', 'dev')).toBe('dev-myapp');
    });
  });

  describe('resolveRunContainerName', () => {
    it('uses scoped name when effective', () => {
      expect(resolveRunContainerName('x', '0', true, 'dev')).toBe('aifabrix-dev-x');
      expect(resolveRunContainerName('x', '2', true, 'dev')).toBe('aifabrix-dev2-dev-x');
    });
    it('uses default when not effective', () => {
      expect(resolveRunContainerName('x', '0', false, 'dev')).toBe('aifabrix-x');
      expect(resolveRunContainerName('x', '2', false, 'dev')).toBe('aifabrix-dev2-x');
    });
  });

  describe('secrets-helpers scoped kv', () => {
    const template = 'FOO=kv://bar-baz\n';
    it('collectMissingSecrets uses prefixed key when effective', () => {
      const secrets = { 'dev-bar-baz': 'secret1' };
      const scopedKv = { effective: true, envKey: 'dev' };
      expect(collectMissingSecrets(template, secrets, scopedKv)).toEqual([]);
    });
    it('collectMissingSecrets falls back to base key', () => {
      const secrets = { 'bar-baz': 'secret2' };
      const scopedKv = { effective: true, envKey: 'dev' };
      expect(collectMissingSecrets(template, secrets, scopedKv)).toEqual([]);
    });
    it('replaceKvInContent resolves prefixed lookup', () => {
      const secrets = { 'bar-baz': 'frombase' };
      const scopedKv = { effective: true, envKey: 'dev' };
      const out = replaceKvInContent(template, secrets, {}, scopedKv);
      expect(out).toBe('FOO=frombase\n');
    });
    it('mergeSecretsWithPrefixedCopies adds dev- alias', () => {
      const merged = mergeSecretsWithPrefixedCopies({ a: '1', 'dev-b': '2' }, 'dev');
      expect(merged['dev-a']).toBe('1');
    });
  });

  describe('applyRedisDbIndexToEnvContent', () => {
    it('sets REDIS_DB and path in REDIS_URL', () => {
      const c = 'REDIS_DB=0\nREDIS_URL=redis://localhost:6379/0\n';
      const out = applyRedisDbIndexToEnvContent(c, 1);
      expect(out).toContain('REDIS_DB=1');
      expect(out).toContain('redis://localhost:6379/1');
    });
  });

  describe('buildScopedLocalContainerName', () => {
    it('embeds env key in container name', () => {
      expect(buildScopedLocalContainerName('app', '0', 0, 'dev')).toBe('aifabrix-dev-app');
      expect(buildScopedLocalContainerName('app', '3', 3, 'tst')).toBe('aifabrix-dev3-tst-app');
    });
  });
});
