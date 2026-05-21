/**
 * @fileoverview Tests for lib/core/config-device-dataplane.js (plan 142.0).
 */

'use strict';

jest.mock('../../../lib/core/config', () => {
  const state = { config: {} };
  return {
    __state: state,
    getConfig: jest.fn(async() => state.config),
    saveConfig: jest.fn(async(next) => {
      state.config = next;
    }),
    normalizeControllerUrl: jest.fn((url) => {
      if (!url) return url;
      return String(url).trim().replace(/\/+$/, '');
    })
  };
});

const configMock = require('../../../lib/core/config');
const {
  getDeviceDataplaneVersions,
  updateDeviceDataplaneVersions,
  isCacheStale,
  DEFAULT_CACHE_TTL_MS
} = require('../../../lib/core/config-device-dataplane');

describe('config-device-dataplane', () => {
  beforeEach(() => {
    configMock.__state.config = {};
    configMock.getConfig.mockClear();
    configMock.saveConfig.mockClear();
    configMock.normalizeControllerUrl.mockClear();
  });

  describe('updateDeviceDataplaneVersions', () => {
    it('creates device map and entry when missing, preserves existing tokens', async() => {
      configMock.__state.config = {
        device: {
          'http://localhost:3100': {
            token: 'tok',
            refreshToken: 'r',
            expiresAt: '2099-01-01T00:00:00Z'
          }
        }
      };
      await updateDeviceDataplaneVersions('http://localhost:3100', {
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0',
        checkedAt: '2026-05-18T10:00:00.000Z'
      });
      const entry = configMock.__state.config.device['http://localhost:3100'];
      expect(entry.token).toBe('tok');
      expect(entry.refreshToken).toBe('r');
      expect(entry['dataplane-version']).toBe('1.9.5');
      expect(entry['dataplane-min-cli-version']).toBe('2.45.0');
      expect(entry['dataplane-checked-at']).toBe('2026-05-18T10:00:00.000Z');
      expect(configMock.saveConfig).toHaveBeenCalledTimes(1);
    });

    it('clears min-cli-version when null/empty (no enforcement removed)', async() => {
      configMock.__state.config = {
        device: {
          'http://localhost:3100': {
            'dataplane-min-cli-version': '2.45.0',
            'dataplane-version': '1.9.4'
          }
        }
      };
      await updateDeviceDataplaneVersions('http://localhost:3100', {
        version: '1.9.5',
        minBuilderCliVersion: null
      });
      const entry = configMock.__state.config.device['http://localhost:3100'];
      expect(entry['dataplane-min-cli-version']).toBeUndefined();
      expect(entry['dataplane-version']).toBe('1.9.5');
      expect(entry['dataplane-checked-at']).toEqual(expect.any(String));
    });

    it('writes default checkedAt timestamp when not provided', async() => {
      const before = Date.now();
      await updateDeviceDataplaneVersions('http://localhost:3100', { version: '1.9.5' });
      const after = Date.now();
      const entry = configMock.__state.config.device['http://localhost:3100'];
      const ts = Date.parse(entry['dataplane-checked-at']);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('matches existing entry under a non-normalized URL key', async() => {
      configMock.__state.config = {
        device: { 'http://localhost:3100/': { token: 'tok' } }
      };
      await updateDeviceDataplaneVersions('http://localhost:3100', {
        version: '1.9.5'
      });
      // updateDeviceDataplaneVersions finds the existing key (with trailing slash) and updates it
      expect(configMock.__state.config.device['http://localhost:3100/']['dataplane-version']).toBe('1.9.5');
    });

    it('throws on missing controllerUrl', async() => {
      await expect(updateDeviceDataplaneVersions(null, {})).rejects.toThrow(
        /controllerUrl is required/
      );
    });
  });

  describe('getDeviceDataplaneVersions', () => {
    it('returns null when device entry is missing', async() => {
      const snap = await getDeviceDataplaneVersions('http://localhost:3100');
      expect(snap).toBeNull();
    });

    it('returns null when entry has no dataplane keys', async() => {
      configMock.__state.config = {
        device: { 'http://localhost:3100': { token: 'only-token' } }
      };
      const snap = await getDeviceDataplaneVersions('http://localhost:3100');
      expect(snap).toBeNull();
    });

    it('returns snapshot with only the keys that exist', async() => {
      configMock.__state.config = {
        device: {
          'http://localhost:3100': {
            'dataplane-version': '1.9.5',
            'dataplane-checked-at': '2026-05-18T10:00:00.000Z'
          }
        }
      };
      const snap = await getDeviceDataplaneVersions('http://localhost:3100');
      expect(snap).toEqual({
        version: '1.9.5',
        checkedAt: '2026-05-18T10:00:00.000Z'
      });
    });

    it('throws on missing controllerUrl', async() => {
      await expect(getDeviceDataplaneVersions('')).rejects.toThrow(
        /controllerUrl is required/
      );
    });
  });

  describe('isCacheStale', () => {
    it('returns true when snapshot is null/undefined', () => {
      expect(isCacheStale(null)).toBe(true);
      expect(isCacheStale(undefined)).toBe(true);
      expect(isCacheStale({})).toBe(true);
    });

    it('returns true when checkedAt is unparseable', () => {
      expect(isCacheStale({ checkedAt: 'not-a-date' })).toBe(true);
    });

    it('returns false when within TTL', () => {
      const now = Date.now();
      const checkedAt = new Date(now - 60 * 1000).toISOString();
      expect(isCacheStale({ checkedAt }, DEFAULT_CACHE_TTL_MS, now)).toBe(false);
    });

    it('returns true at or past TTL boundary', () => {
      const now = Date.now();
      const checkedAt = new Date(now - DEFAULT_CACHE_TTL_MS).toISOString();
      expect(isCacheStale({ checkedAt }, DEFAULT_CACHE_TTL_MS, now)).toBe(true);
    });
  });
});
