/**
 * @fileoverview Tests for docker run fallback when Compose CLI is missing
 */

const { canUseDockerRunWithoutCompose, storageVolumeName } = require('../../../lib/app/run-docker-fallback');

describe('run-docker-fallback', () => {
  describe('canUseDockerRunWithoutCompose', () => {
    it('returns false when requires block is missing', () => {
      expect(canUseDockerRunWithoutCompose({ port: 3000 }, {})).toBe(false);
    });

    it('returns false when database is required', () => {
      expect(
        canUseDockerRunWithoutCompose(
          { requires: { database: true, redis: false, databases: [{ name: 'a' }] } },
          {}
        )
      ).toBe(false);
    });

    it('returns false when redis is required', () => {
      expect(canUseDockerRunWithoutCompose({ requires: { database: false, redis: true } }, {})).toBe(false);
    });

    it('returns false when frontDoorRouting is enabled', () => {
      expect(
        canUseDockerRunWithoutCompose(
          { requires: { database: false, redis: false }, frontDoorRouting: { enabled: true } },
          {}
        )
      ).toBe(false);
    });

    it('returns false when devMountPath is set', () => {
      expect(
        canUseDockerRunWithoutCompose({ requires: { database: false, redis: false } }, { devMountPath: '/src' })
      ).toBe(false);
    });

    it('returns true when requires opts out of db/redis and no traefik or mount', () => {
      expect(canUseDockerRunWithoutCompose({ requires: { database: false, redis: false } }, {})).toBe(true);
    });

    it('returns true when requires has storage but no db/redis', () => {
      expect(
        canUseDockerRunWithoutCompose({ requires: { database: false, redis: false, storage: true } }, {})
      ).toBe(true);
    });
  });

  describe('storageVolumeName', () => {
    it('uses dev0 naming', () => {
      expect(storageVolumeName('builder-server', 0)).toBe('aifabrix_builder-server_data');
    });

    it('uses devN naming', () => {
      expect(storageVolumeName('myapp', 2)).toBe('aifabrix_dev2_myapp_data');
    });
  });
});
