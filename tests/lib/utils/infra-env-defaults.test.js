/**
 * Infra vs app-service env default layers (plan 126).
 */

'use strict';

jest.unmock('../../../lib/internal/fs-real-sync');

const fs = jest.requireActual('fs');
const path = require('path');
const os = require('os');

const {
  getDefaultEnvConfig,
  INFRA_ENV_DEFAULTS_DOCKER,
  INFRA_ENV_DEFAULTS_LOCAL,
  APP_SERVICE_ENV_DEFAULTS_DOCKER,
  APP_SERVICE_ENV_DEFAULTS_LOCAL
} = require('../../../lib/utils/infra-env-defaults');

describe('infra-env-defaults', () => {
  it('infra docker layer has no application service keys', () => {
    expect(INFRA_ENV_DEFAULTS_DOCKER).toMatchObject({
      DB_HOST: 'postgres',
      REDIS_HOST: 'redis'
    });
    expect(INFRA_ENV_DEFAULTS_DOCKER).not.toHaveProperty('DATAPLANE_HOST');
    expect(INFRA_ENV_DEFAULTS_DOCKER).not.toHaveProperty('MISO_HOST');
  });

  it('app service docker layer has stack apps only', () => {
    expect(APP_SERVICE_ENV_DEFAULTS_DOCKER.DATAPLANE_HOST).toBe('dataplane');
    expect(APP_SERVICE_ENV_DEFAULTS_DOCKER.MISO_HOST).toBe('miso-controller');
  });

  it('getDefaultEnvConfig merges infra + app for docker and local', () => {
    const cfg = getDefaultEnvConfig();
    expect(cfg.environments.docker.DB_HOST).toBe('postgres');
    expect(cfg.environments.docker.DATAPLANE_HOST).toBe('dataplane');
    expect(cfg.environments.local.DB_HOST).toBe('localhost');
    expect(cfg.environments.local.DATAPLANE_PORT).toBe(3011);
  });

  it('local infra is separate from local app offsets', () => {
    expect(INFRA_ENV_DEFAULTS_LOCAL.REDIS_PORT).toBe(6379);
    expect(APP_SERVICE_ENV_DEFAULTS_LOCAL.DATAPLANE_PORT).toBe(3011);
  });

  it('getDefaultEnvConfig overlays builder app manifests when projectRoot is set', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aifb-infra-defaults-'));
    try {
      const appDir = path.join(tmp, 'builder', 'dataplane');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'application.yaml'),
        'app:\n  key: dataplane\nport: 7777\n',
        'utf8'
      );
      const cfg = getDefaultEnvConfig(tmp);
      expect(cfg.environments.docker.DATAPLANE_PUBLIC_PORT).toBe(7777);
      expect(cfg.environments.local.DATAPLANE_PORT).toBe(7787);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
