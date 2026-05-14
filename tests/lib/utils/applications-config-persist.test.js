/**
 * @fileoverview persistApplicationReloadFlag
 */

'use strict';

jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  saveConfig: jest.fn()
}));

const config = require('../../../lib/core/config');
const { persistApplicationReloadFlag, persistApplicationRunProxyFlag } = require('../../../lib/utils/applications-config-defaults');

describe('persistApplicationReloadFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges applications.<app>.reload without dropping sibling apps', async() => {
    config.getConfig.mockResolvedValue({
      'developer-id': '0',
      applications: { other: { reload: false, keep: 1 } }
    });
    await persistApplicationReloadFlag('target', true);
    expect(config.saveConfig).toHaveBeenCalledTimes(1);
    const saved = config.saveConfig.mock.calls[0][0];
    expect(saved.applications.target.reload).toBe(true);
    expect(saved.applications.other.reload).toBe(false);
    expect(saved.applications.other.keep).toBe(1);
  });

  it('creates applications entry when missing', async() => {
    config.getConfig.mockResolvedValue({ 'developer-id': '0' });
    await persistApplicationReloadFlag('app', false);
    expect(config.saveConfig.mock.calls[0][0].applications.app.reload).toBe(false);
  });

  it('does not call save when app key is empty', async() => {
    await persistApplicationReloadFlag('', true);
    expect(config.saveConfig).not.toHaveBeenCalled();
  });
});

describe('persistApplicationRunProxyFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges proxy without dropping reload on same app', async() => {
    config.getConfig.mockResolvedValue({
      applications: { myapp: { reload: true } }
    });
    await persistApplicationRunProxyFlag('myapp', false);
    const saved = config.saveConfig.mock.calls[0][0];
    expect(saved.applications.myapp.reload).toBe(true);
    expect(saved.applications.myapp.proxy).toBe(false);
  });

  it('removes legacy noProxy when saving proxy', async() => {
    config.getConfig.mockResolvedValue({
      applications: { myapp: { reload: true, noProxy: true } }
    });
    await persistApplicationRunProxyFlag('myapp', true);
    const saved = config.saveConfig.mock.calls[0][0];
    expect(saved.applications.myapp.proxy).toBe(true);
    expect(saved.applications.myapp.noProxy).toBeUndefined();
  });
});
