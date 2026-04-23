/**
 * Tests for infrastructure services: startDockerServicesAndConfigure temp .env write and delete (ISO 27K).
 *
 * @fileoverview Unit tests for lib/infrastructure/services.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');

jest.mock('../../../lib/core/admin-secrets', () => ({
  readAndDecryptAdminSecrets: jest.fn().mockResolvedValue({ POSTGRES_PASSWORD: 'admin', PGADMIN_DEFAULT_EMAIL: 'a@b' }),
  envObjectToContent: jest.fn((obj) => Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n'))
}));

const fs = require('fs');
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

jest.mock('../../../lib/utils/docker', () => ({
  getComposeCommand: jest.fn().mockResolvedValue('docker compose')
}));

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(0)
}));

jest.mock('../../../lib/utils/remote-docker-env', () => ({
  getDockerExecEnv: jest.fn().mockImplementation(async() => ({ ...process.env }))
}));

jest.mock('../../../lib/utils/infra-containers', () => ({
  checkServiceWithHealthCheck: jest.fn().mockResolvedValue('healthy'),
  checkServiceWithoutHealthCheck: jest.fn().mockResolvedValue('healthy')
}));

const { exec } = require('child_process');
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    setImmediate(() => cb(null, '', ''));
    return { kill: jest.fn() };
  })
}));

const adminSecrets = require('../../../lib/core/admin-secrets');
const services = require('../../../lib/infrastructure/services');

describe('Infrastructure services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    adminSecrets.readAndDecryptAdminSecrets.mockResolvedValue({ POSTGRES_PASSWORD: 'p', A: 'b' });
    adminSecrets.envObjectToContent.mockReturnValue('POSTGRES_PASSWORD=p\nA=b');
    jest.spyOn(services, 'checkInfraHealth').mockResolvedValue({
      postgres: 'healthy',
      redis: 'healthy',
      pgadmin: 'healthy',
      'redis-commander': 'healthy'
    });
  });

  afterEach(() => {
    services.checkInfraHealth.mockRestore();
  });

  it('startDockerServicesAndConfigure writes temp .env.run and unlinks it in finally', async() => {
    const infraDir = '/home/.aifabrix/infra';
    const runEnvPath = path.join(infraDir, '.env.run');

    await services.startDockerServicesAndConfigure('/path/compose.yaml', 0, 0, infraDir);

    expect(adminSecrets.readAndDecryptAdminSecrets).toHaveBeenCalled();
    expect(adminSecrets.envObjectToContent).toHaveBeenCalledWith(expect.any(Object));
    expect(fs.writeFileSync).toHaveBeenCalledWith(runEnvPath, expect.any(String), { mode: 0o600 });
    expect(fs.unlinkSync).toHaveBeenCalledWith(runEnvPath);
  });

  it('startDockerServicesAndConfigure writes only .env.run when pgadmin is disabled', async() => {
    const infraDir = '/home/.aifabrix/infra';
    const runEnvPath = path.join(infraDir, '.env.run');

    await services.startDockerServicesAndConfigure('/path/compose.yaml', 0, 0, infraDir, { pgadmin: false });

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(fs.writeFileSync).toHaveBeenCalledWith(runEnvPath, expect.any(String), { mode: 0o600 });
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith(runEnvPath);
  });

  it('startDockerServicesAndConfigure unlinks .env.run even when startDockerServices throws', async() => {
    const infraDir = '/tmp/infra';
    const runEnvPath = path.join(infraDir, '.env.run');
    exec.mockImplementationOnce((cmd, opts, cb) => {
      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }
      setImmediate(() => cb(new Error('compose failed'), '', ''));
      return { kill: jest.fn() };
    });

    await expect(services.startDockerServicesAndConfigure('/path/compose.yaml', 0, 0, infraDir))
      .rejects.toThrow();
    expect(fs.writeFileSync).toHaveBeenCalledWith(runEnvPath, expect.any(String), { mode: 0o600 });
    expect(fs.unlinkSync).toHaveBeenCalledWith(runEnvPath);
  });
});
