/**
 * @fileoverview Tests for lib/utils/dataplane-cli-version-gate.js (plan 142.0).
 */

'use strict';

jest.mock('../../../lib/api/dataplane-health.api');
jest.mock('../../../lib/core/config-device-dataplane');

const {
  fetchDataplaneGeneralHealth
} = require('../../../lib/api/dataplane-health.api');
const {
  getDeviceDataplaneVersions,
  updateDeviceDataplaneVersions,
  isCacheStale
} = require('../../../lib/core/config-device-dataplane');

const gate = require('../../../lib/utils/dataplane-cli-version-gate');
const originalCliVersion = gate.getInstalledCliVersion;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  gate.getInstalledCliVersion = originalCliVersion;
});

/**
 * Stub the installed CLI version via module.exports so the gate's internal
 * dispatch (`module.exports.getInstalledCliVersion()`) picks up the override.
 * @param {string} version
 */
function stubCliVersion(version) {
  gate.getInstalledCliVersion = () => version;
}

describe('dataplane-cli-version-gate', () => {
  describe('assertDataplaneCliVersionCompatible — early exits', () => {
    it('is a no-op when dataplaneUrl is missing', async() => {
      await expect(gate.assertDataplaneCliVersionCompatible('')).resolves.toBeUndefined();
      expect(fetchDataplaneGeneralHealth).not.toHaveBeenCalled();
    });

    it('does not throw when dataplane omits minBuilderCliVersion', async() => {
      isCacheStale.mockReturnValue(true);
      fetchDataplaneGeneralHealth.mockResolvedValue({
        status: 'healthy',
        version: '1.9.5'
      });
      getDeviceDataplaneVersions.mockResolvedValue(null);

      await expect(
        gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
          controllerUrl: 'http://localhost:3100'
        })
      ).resolves.toBeUndefined();
      expect(updateDeviceDataplaneVersions).toHaveBeenCalledWith(
        'http://localhost:3100',
        expect.objectContaining({ version: '1.9.5', minBuilderCliVersion: null })
      );
    });

    it('does not throw when dataplane is unreachable and no cache', async() => {
      isCacheStale.mockReturnValue(true);
      fetchDataplaneGeneralHealth.mockResolvedValue(null);
      getDeviceDataplaneVersions.mockResolvedValue(null);

      await expect(
        gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
          controllerUrl: 'http://localhost:3100'
        })
      ).resolves.toBeUndefined();
    });

    it('does not throw when dataplane advertises invalid semver', async() => {
      isCacheStale.mockReturnValue(true);
      fetchDataplaneGeneralHealth.mockResolvedValue({
        status: 'healthy',
        version: '1.9.5',
        minBuilderCliVersion: 'not-a-semver'
      });
      getDeviceDataplaneVersions.mockResolvedValue(null);

      await expect(
        gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
          controllerUrl: 'http://localhost:3100'
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('assertDataplaneCliVersionCompatible — cache vs fresh', () => {
    it('uses fresh cache when not stale and skips fetch', async() => {
      isCacheStale.mockReturnValue(false);
      getDeviceDataplaneVersions.mockResolvedValue({
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0',
        checkedAt: new Date().toISOString()
      });
      stubCliVersion('2.45.0');

      await gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
        controllerUrl: 'http://localhost:3100'
      });
      expect(fetchDataplaneGeneralHealth).not.toHaveBeenCalled();
    });

    it('forceRefresh skips cache and probes health', async() => {
      isCacheStale.mockReturnValue(false);
      getDeviceDataplaneVersions.mockResolvedValue({
        minBuilderCliVersion: '2.45.0',
        checkedAt: new Date().toISOString()
      });
      fetchDataplaneGeneralHealth.mockResolvedValue({
        status: 'healthy',
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });
      stubCliVersion('2.45.0');

      await gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
        controllerUrl: 'http://localhost:3100',
        forceRefresh: true
      });
      expect(fetchDataplaneGeneralHealth).toHaveBeenCalled();
    });
  });

  describe('assertDataplaneCliVersionCompatible — version check', () => {
    it('throws CLI_VERSION_INCOMPATIBLE when installed CLI < dataplane minimum', async() => {
      isCacheStale.mockReturnValue(true);
      fetchDataplaneGeneralHealth.mockResolvedValue({
        status: 'healthy',
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });
      stubCliVersion('2.44.0');

      await expect(
        gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
          controllerUrl: 'http://localhost:3100'
        })
      ).rejects.toMatchObject({
        code: 'CLI_VERSION_INCOMPATIBLE',
        required: '2.45.0',
        installed: '2.44.0'
      });
    });

    it('attaches formatted multi-line block with Next actions', async() => {
      isCacheStale.mockReturnValue(true);
      fetchDataplaneGeneralHealth.mockResolvedValue({
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });
      stubCliVersion('2.44.0');

      let captured;
      try {
        await gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
          controllerUrl: 'http://localhost:3100'
        });
      } catch (err) {
        captured = err;
      }
      expect(captured).toBeDefined();
      expect(captured.formatted).toContain('Next actions');
      expect(captured.formatted).toContain('npm install -g @aifabrix/builder@2.45.0');
    });

    it('does not throw when installed CLI is equal to minimum', async() => {
      isCacheStale.mockReturnValue(true);
      fetchDataplaneGeneralHealth.mockResolvedValue({
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });
      stubCliVersion('2.45.0');

      await expect(
        gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
          controllerUrl: 'http://localhost:3100'
        })
      ).resolves.toBeUndefined();
    });

    it('does not throw when installed CLI > minimum', async() => {
      isCacheStale.mockReturnValue(true);
      fetchDataplaneGeneralHealth.mockResolvedValue({
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });
      stubCliVersion('2.46.1');

      await expect(
        gate.assertDataplaneCliVersionCompatible('http://localhost:3201', {
          controllerUrl: 'http://localhost:3100'
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('isCliVersionIncompatibleError', () => {
    it('identifies errors thrown by this gate', () => {
      const err = Object.assign(new Error('x'), { code: gate.ERROR_CODE });
      expect(gate.isCliVersionIncompatibleError(err)).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(gate.isCliVersionIncompatibleError(new Error('x'))).toBe(false);
      expect(gate.isCliVersionIncompatibleError(null)).toBe(false);
    });
  });
});
