/**
 * @fileoverview Tests for lib/utils/build-resolve-image.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('../../../lib/utils/docker-exec', () => ({
  execWithDockerEnv: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { execWithDockerEnv } = require('../../../lib/utils/docker-exec');
const {
  resolveBuildImageRepositoryName,
  wantsLocalDockerImageDiscovery,
  pickBaseFromDockerLines
} = require('../../../lib/utils/build-resolve-image');

describe('build-resolve-image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('wantsLocalDockerImageDiscovery', () => {
    it('returns true when image is absent', () => {
      expect(wantsLocalDockerImageDiscovery({ app: { key: 'x' } })).toBe(true);
    });

    it('returns true for empty string image', () => {
      expect(wantsLocalDockerImageDiscovery({ image: '  ' })).toBe(true);
    });

    it('returns true for empty object image', () => {
      expect(wantsLocalDockerImageDiscovery({ image: {} })).toBe(true);
    });

    it('returns false when image has registry only', () => {
      expect(wantsLocalDockerImageDiscovery({ image: { registry: 'ghcr.io/a' } })).toBe(false);
    });

    it('returns false when image has tag only', () => {
      expect(wantsLocalDockerImageDiscovery({ image: { tag: '1.0' } })).toBe(false);
    });
  });

  describe('pickBaseFromDockerLines', () => {
    it('strips -devN and matches app tail', () => {
      const base = pickBaseFromDockerLines('keycloak', ['aifabrix/keycloak-dev2:latest'], 2);
      expect(base).toBe('aifabrix/keycloak');
    });

    it('prefers repository ending with current developer id', () => {
      const base = pickBaseFromDockerLines(
        'myapp',
        ['org/myapp-dev2:latest', 'org/myapp-dev3:latest'],
        3
      );
      expect(base).toBe('org/myapp');
    });

    it('returns null when no match', () => {
      expect(pickBaseFromDockerLines('other', ['x/y:latest'], 1)).toBeNull();
    });

    it('handles -extra suffix', () => {
      const base = pickBaseFromDockerLines('svc', ['registry/svc-extra:1'], 0);
      expect(base).toBe('registry/svc');
    });
  });

  describe('resolveBuildImageRepositoryName', () => {
    it('uses resolveDockerImageRef when manifest defines image fields', async() => {
      execWithDockerEnv.mockRejectedValue(new Error('should not run'));
      const name = await resolveBuildImageRepositoryName(
        'my-app',
        { app: { key: 'my-app' }, image: { registry: 'r.io', name: 'n' } },
        2
      );
      expect(name).toBe('r.io/n');
    });

    it('discovers from docker when image omitted', async() => {
      execWithDockerEnv.mockResolvedValue({ stdout: 'aifabrix/keycloak-dev2:latest\n', stderr: '' });
      const name = await resolveBuildImageRepositoryName('keycloak', { app: { key: 'keycloak' } }, 2);
      expect(name).toBe('aifabrix/keycloak');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Using image repository from local Docker')
      );
    });

    it('falls back to app key when docker has no match', async() => {
      execWithDockerEnv.mockResolvedValue({ stdout: '', stderr: '' });
      const name = await resolveBuildImageRepositoryName(
        'folder-name',
        { app: { key: 'manifest-key' } },
        1
      );
      expect(name).toBe('manifest-key');
      expect(logger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Using image repository from local Docker')
      );
    });
  });
});
