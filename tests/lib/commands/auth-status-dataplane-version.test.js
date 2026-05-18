/**
 * @fileoverview Tests for lib/commands/auth-status-dataplane-version.js (plan 142.0).
 */

'use strict';

jest.mock('../../../lib/api/dataplane-health.api');
jest.mock('../../../lib/core/config-device-dataplane');
jest.mock('../../../lib/core/config', () => ({
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/commands/wizard-dataplane');
jest.mock('../../../lib/datasource/deploy');
jest.mock('../../../lib/utils/dataplane-cli-version-gate', () => ({
  getInstalledCliVersion: jest.fn(() => '2.45.0')
}));

const {
  fetchDataplaneGeneralHealth
} = require('../../../lib/api/dataplane-health.api');
const {
  updateDeviceDataplaneVersions,
  getDeviceDataplaneVersions
} = require('../../../lib/core/config-device-dataplane');
const {
  getInstalledCliVersion
} = require('../../../lib/utils/dataplane-cli-version-gate');
const tokenManager = require('../../../lib/utils/token-manager');
const wizardDataplane = require('../../../lib/commands/wizard-dataplane');
const datasourceDeploy = require('../../../lib/datasource/deploy');
const {
  refreshDataplaneVersionInfo,
  loadCachedVersionInfo,
  computeCompatibility,
  tryRefreshDataplaneVersionAfterLogin
} = require('../../../lib/commands/auth-status-dataplane-version');

describe('auth-status-dataplane-version', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstalledCliVersion.mockReturnValue('2.45.0');
  });

  describe('computeCompatibility', () => {
    it('returns true when no min version is configured', () => {
      expect(computeCompatibility('2.45.0', undefined)).toBe(true);
      expect(computeCompatibility('2.45.0', '')).toBe(true);
    });

    it('returns true when versions are invalid (warn-only contract)', () => {
      expect(computeCompatibility('not-semver', '2.45.0')).toBe(true);
      expect(computeCompatibility('2.45.0', 'not-semver')).toBe(true);
    });

    it('returns true when CLI >= min', () => {
      expect(computeCompatibility('2.45.0', '2.45.0')).toBe(true);
      expect(computeCompatibility('2.46.0', '2.45.0')).toBe(true);
    });

    it('returns false when CLI < min', () => {
      expect(computeCompatibility('2.44.0', '2.45.0')).toBe(false);
    });
  });

  describe('refreshDataplaneVersionInfo', () => {
    it('returns live snapshot and persists cache when probe succeeds', async() => {
      fetchDataplaneGeneralHealth.mockResolvedValue({
        status: 'healthy',
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });

      const info = await refreshDataplaneVersionInfo(
        'http://localhost:3100',
        'http://localhost:3201'
      );
      expect(info).toEqual({
        dataplaneVersion: '1.9.5',
        minBuilderCliVersion: '2.45.0',
        cliVersion: '2.45.0',
        compatible: true
      });
      expect(updateDeviceDataplaneVersions).toHaveBeenCalledWith(
        'http://localhost:3100',
        { version: '1.9.5', minBuilderCliVersion: '2.45.0' }
      );
    });

    it('persists null min-cli-version when dataplane stops enforcing', async() => {
      fetchDataplaneGeneralHealth.mockResolvedValue({
        status: 'healthy',
        version: '1.9.5'
      });
      await refreshDataplaneVersionInfo('http://localhost:3100', 'http://localhost:3201');
      expect(updateDeviceDataplaneVersions).toHaveBeenCalledWith(
        'http://localhost:3100',
        { version: '1.9.5', minBuilderCliVersion: null }
      );
    });

    it('falls back to cache when probe fails', async() => {
      fetchDataplaneGeneralHealth.mockResolvedValue(null);
      getDeviceDataplaneVersions.mockResolvedValue({
        version: '1.9.4',
        minBuilderCliVersion: '2.45.0',
        checkedAt: new Date().toISOString()
      });

      const info = await refreshDataplaneVersionInfo(
        'http://localhost:3100',
        'http://localhost:3201'
      );
      expect(info.dataplaneVersion).toBe('1.9.4');
      expect(info.minBuilderCliVersion).toBe('2.45.0');
      expect(updateDeviceDataplaneVersions).not.toHaveBeenCalled();
    });

    it('returns undefined versions when both probe and cache fail', async() => {
      fetchDataplaneGeneralHealth.mockRejectedValue(new Error('boom'));
      getDeviceDataplaneVersions.mockRejectedValue(new Error('boom'));

      const info = await refreshDataplaneVersionInfo(
        'http://localhost:3100',
        'http://localhost:3201'
      );
      expect(info.dataplaneVersion).toBeUndefined();
      expect(info.minBuilderCliVersion).toBeUndefined();
      expect(info.compatible).toBe(true); // No min → compatible
    });

    it('marks incompatible when CLI is older than dataplane minimum', async() => {
      getInstalledCliVersion.mockReturnValue('2.44.0');
      fetchDataplaneGeneralHealth.mockResolvedValue({
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });

      const info = await refreshDataplaneVersionInfo(
        'http://localhost:3100',
        'http://localhost:3201'
      );
      expect(info.compatible).toBe(false);
      expect(info.minBuilderCliVersion).toBe('2.45.0');
      expect(info.cliVersion).toBe('2.44.0');
    });

    it('does not throw if cache write fails', async() => {
      fetchDataplaneGeneralHealth.mockResolvedValue({
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });
      updateDeviceDataplaneVersions.mockRejectedValue(new Error('disk full'));

      await expect(
        refreshDataplaneVersionInfo('http://localhost:3100', 'http://localhost:3201')
      ).resolves.toEqual(
        expect.objectContaining({ dataplaneVersion: '1.9.5', compatible: true })
      );
    });
  });

  describe('loadCachedVersionInfo', () => {
    it('returns cached versions with computed compatibility', async() => {
      getDeviceDataplaneVersions.mockResolvedValue({
        version: '1.9.4',
        minBuilderCliVersion: '2.45.0'
      });
      const info = await loadCachedVersionInfo('http://localhost:3100');
      expect(info.dataplaneVersion).toBe('1.9.4');
      expect(info.minBuilderCliVersion).toBe('2.45.0');
      expect(info.compatible).toBe(true);
    });

    it('returns undefined versions when no cache entry exists', async() => {
      getDeviceDataplaneVersions.mockResolvedValue(null);
      const info = await loadCachedVersionInfo('http://localhost:3100');
      expect(info.dataplaneVersion).toBeUndefined();
      expect(info.minBuilderCliVersion).toBeUndefined();
      expect(info.compatible).toBe(true);
    });

    it('survives cache read errors', async() => {
      getDeviceDataplaneVersions.mockRejectedValue(new Error('disk'));
      const info = await loadCachedVersionInfo('http://localhost:3100');
      expect(info.cliVersion).toBe('2.45.0');
      expect(info.compatible).toBe(true);
    });
  });

  describe('tryRefreshDataplaneVersionAfterLogin', () => {
    it('refreshes version cache when device token and dataplane URL resolve', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({ token: 'tok' });
      wizardDataplane.findDataplaneServiceAppKey.mockResolvedValue('dataplane');
      datasourceDeploy.getDataplaneUrl.mockResolvedValue('http://localhost:3201');
      fetchDataplaneGeneralHealth.mockResolvedValue({
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0'
      });

      await tryRefreshDataplaneVersionAfterLogin('http://localhost:3100', {});

      expect(fetchDataplaneGeneralHealth).toHaveBeenCalledWith('http://localhost:3201');
      expect(updateDeviceDataplaneVersions).toHaveBeenCalled();
    });

    it('no-ops when controllerUrl is empty', async() => {
      await tryRefreshDataplaneVersionAfterLogin('');
      expect(fetchDataplaneGeneralHealth).not.toHaveBeenCalled();
    });
  });
});
