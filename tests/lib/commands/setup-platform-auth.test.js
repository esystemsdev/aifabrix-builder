/**
 * @fileoverview Tests for lib/commands/setup-platform-auth.js
 */

'use strict';

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/commands/up-common');
jest.mock('../../../lib/utils/platform-controller-url');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/utils/logger');

const config = require('../../../lib/core/config');
const upCommon = require('../../../lib/commands/up-common');
const platformUrl = require('../../../lib/utils/platform-controller-url');
const controllerUrl = require('../../../lib/utils/controller-url');
const { ensureSetupPlatformAuth } = require('../../../lib/commands/setup-platform-auth');

describe('lib/commands/setup-platform-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformUrl.resolvePlatformControllerUrl.mockResolvedValue('http://localhost:3600');
    config.getPlatformControllerUrl.mockResolvedValue('http://localhost:3600');
    config.setPlatformControllerUrl.mockResolvedValue(undefined);
    config.setControllerUrl.mockResolvedValue(undefined);
    controllerUrl.isPlatformAuthValidForController.mockResolvedValue(false);
    upCommon.applyUpPlatformForceConfig.mockResolvedValue({
      deviceCleared: 1,
      clientCleared: 0,
      defaultControllerUrl: 'http://localhost:3600',
      environment: 'dev'
    });
  });

  it('persists platform-controller and controller URLs', async() => {
    await ensureSetupPlatformAuth();
    expect(config.setPlatformControllerUrl).toHaveBeenCalledWith('http://localhost:3600');
    expect(config.setControllerUrl).toHaveBeenCalledWith('http://localhost:3600');
  });

  it('applyUpPlatformForceConfig clears tokens when not authenticated', async() => {
    await ensureSetupPlatformAuth({ applyForceConfig: true });
    expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalledWith({
      silent: true,
      clearTokens: true,
      defaultControllerUrl: 'http://localhost:3600'
    });
  });

  it('applyUpPlatformForceConfig skips token clear when device token is usable', async() => {
    controllerUrl.isPlatformAuthValidForController.mockResolvedValue(true);
    upCommon.applyUpPlatformForceConfig.mockResolvedValue({
      deviceCleared: 0,
      clientCleared: 0,
      defaultControllerUrl: 'http://localhost:3600',
      environment: 'dev'
    });
    const result = await ensureSetupPlatformAuth({ applyForceConfig: true });
    expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalledWith({
      silent: true,
      clearTokens: false,
      defaultControllerUrl: 'http://localhost:3600'
    });
    expect(result.skipLoginIfAuthenticated).toBe(true);
  });

  it('clears tokens when a stale device entry exists but refresh fails', async() => {
    controllerUrl.isPlatformAuthValidForController.mockResolvedValue(false);
    const result = await ensureSetupPlatformAuth({ applyForceConfig: true });
    expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalledWith({
      silent: true,
      clearTokens: true,
      defaultControllerUrl: 'http://localhost:3600'
    });
    expect(result.skipLoginIfAuthenticated).toBe(false);
  });

  it('forces login after force config clears stored device tokens', async() => {
    controllerUrl.isPlatformAuthValidForController.mockResolvedValue(true);
    upCommon.applyUpPlatformForceConfig.mockResolvedValue({
      deviceCleared: 2,
      clientCleared: 0,
      defaultControllerUrl: 'http://localhost:3600',
      environment: 'dev'
    });
    const result = await ensureSetupPlatformAuth({ applyForceConfig: true });
    expect(result.skipLoginIfAuthenticated).toBe(false);
  });

  it('[EDGE] does not call applyUpPlatformForceConfig when applyForceConfig is false', async() => {
    await ensureSetupPlatformAuth({ applyForceConfig: false });
    expect(upCommon.applyUpPlatformForceConfig).not.toHaveBeenCalled();
  });

  it('clearTokensAlways clears tokens even when platform auth appears valid', async() => {
    controllerUrl.isPlatformAuthValidForController.mockResolvedValue(true);
    upCommon.applyUpPlatformForceConfig.mockResolvedValue({
      deviceCleared: 1,
      clientCleared: 0,
      defaultControllerUrl: 'http://localhost:3600',
      environment: 'dev'
    });
    const result = await ensureSetupPlatformAuth({
      applyForceConfig: true,
      clearTokensAlways: true
    });
    expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalledWith({
      silent: true,
      clearTokens: true,
      defaultControllerUrl: 'http://localhost:3600'
    });
    expect(result.skipLoginIfAuthenticated).toBe(false);
  });
});
