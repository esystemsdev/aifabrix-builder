/**
 * Tests for AI Fabrix Builder Environment Config Loader Module
 *
 * @fileoverview loadEnvConfig returns code-owned defaults (no YAML merge)
 * @author AI Fabrix Team
 * @version 2.1.0
 */

const { loadEnvConfig, loadSchemaEnvConfig } = require('../../../lib/utils/env-config-loader');
const { getDefaultEnvConfig } = require('../../../lib/utils/infra-env-defaults');

describe('Environment Config Loader Module', () => {
  describe('loadEnvConfig', () => {
    it('should return infra defaults (same shape as getDefaultEnvConfig)', async() => {
      const expected = getDefaultEnvConfig();
      const result = await loadEnvConfig();
      expect(result).toEqual(expected);
    });

    it('should return a fresh clone each call', async() => {
      const a = await loadEnvConfig();
      const b = await loadEnvConfig();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      a.environments.docker.DB_HOST = 'mutated';
      const c = await loadEnvConfig();
      expect(c.environments.docker.DB_HOST).toBe('postgres');
    });
  });

  describe('loadSchemaEnvConfig', () => {
    it('should match getDefaultEnvConfig', () => {
      expect(loadSchemaEnvConfig()).toEqual(getDefaultEnvConfig());
    });
  });
});
