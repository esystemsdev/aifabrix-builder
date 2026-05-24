/**
 * @fileoverview Tests for lib/core/config-platform-controller.js (plan 147)
 */

'use strict';

const {
  getPlatformControllerUrlFromConfig,
  setPlatformControllerUrlInConfig
} = require('../../../lib/core/config-platform-controller');
const { normalizeControllerUrl } = require('../../../lib/core/config-normalize');

describe('lib/core/config-platform-controller', () => {
  it('getPlatformControllerUrlFromConfig strips trailing slashes', async() => {
    const getConfig = jest.fn().mockResolvedValue({ 'platform-controller': 'http://localhost:3600///' });
    await expect(getPlatformControllerUrlFromConfig(getConfig)).resolves.toBe('http://localhost:3600');
  });

  it('setPlatformControllerUrlInConfig round-trips normalized URL', async() => {
    let saved = {};
    const getConfig = jest.fn().mockImplementation(async() => ({ ...saved }));
    const saveConfig = jest.fn().mockImplementation(async(cfg) => {
      saved = cfg;
    });
    await setPlatformControllerUrlInConfig(
      getConfig,
      saveConfig,
      normalizeControllerUrl,
      'http://localhost:3600/'
    );
    expect(saved['platform-controller']).toBe('http://localhost:3600');
    await expect(getPlatformControllerUrlFromConfig(getConfig)).resolves.toBe('http://localhost:3600');
  });
});
