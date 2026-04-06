/**
 * Tests for run-env-compose: cleanApplicationsDir, buildMergedRunEnvAndWrite, assertNoPasswordLiteralsInCompose.
 *
 * @fileoverview Unit tests for lib/app/run-env-compose.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');

jest.mock('../../../lib/utils/paths', () => ({
  getApplicationsBaseDir: jest.fn((id) => require('path').join('/home/.aifabrix', id === 0 ? 'applications' : `applications-dev-${id}`)),
  getBuilderPath: jest.fn((appName) => require('path').join('/tmp/builder', appName))
}));

jest.mock('../../../lib/core/admin-secrets', () => ({
  readAndDecryptAdminSecrets: jest.fn().mockResolvedValue({ POSTGRES_PASSWORD: 'admin' }),
  envObjectToContent: jest.fn((obj) => Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n'))
}));

jest.mock('../../../lib/core/secrets-env-write', () => ({
  resolveAndGetEnvMap: jest.fn().mockResolvedValue({ DB_0_PASSWORD: 'appdb', PORT: '3000' })
}));

jest.mock('../../../lib/infrastructure', () => ({
  ensureAdminSecrets: jest.fn().mockResolvedValue('/home/.aifabrix/admin-secrets.env')
}));

const fsSync = require('fs');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined)
  }
}));

const runEnvCompose = require('../../../lib/app/run-env-compose');
const pathsUtil = require('../../../lib/utils/paths');
const adminSecrets = require('../../../lib/core/admin-secrets');
const secretsEnvWrite = require('../../../lib/core/secrets-env-write');

describe('run-env-compose', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanApplicationsDir', () => {
    it('does nothing when base dir does not exist', () => {
      fsSync.existsSync.mockReturnValue(false);
      runEnvCompose.cleanApplicationsDir(0);
      expect(fsSync.readdirSync).not.toHaveBeenCalled();
      expect(fsSync.unlinkSync).not.toHaveBeenCalled();
    });

    it('removes docker-compose.yaml and .env.* when dir exists', () => {
      const baseDir = path.join('/home/.aifabrix', 'applications');
      fsSync.existsSync.mockImplementation((p) => {
        if (p === baseDir) return true;
        if (p === path.join(baseDir, 'docker-compose.yaml')) return true;
        if (p === path.join(baseDir, '.env.run')) return true;
        if (p === path.join(baseDir, '.env.keycloak')) return true;
        return false;
      });
      fsSync.readdirSync.mockReturnValue(['docker-compose.yaml', '.env.run', '.env.keycloak']);
      runEnvCompose.cleanApplicationsDir(0);
      expect(pathsUtil.getApplicationsBaseDir).toHaveBeenCalledWith(0);
      expect(fsSync.unlinkSync).toHaveBeenCalledWith(path.join(baseDir, 'docker-compose.yaml'));
      expect(fsSync.unlinkSync).toHaveBeenCalledWith(path.join(baseDir, '.env.run'));
      expect(fsSync.unlinkSync).toHaveBeenCalledWith(path.join(baseDir, '.env.keycloak'));
    });

    it('ignores readdir errors', () => {
      fsSync.existsSync.mockReturnValue(true);
      fsSync.readdirSync.mockImplementation(() => {
        throw new Error('readdir failed');
      });
      expect(() => runEnvCompose.cleanApplicationsDir(0)).not.toThrow();
      expect(fsSync.unlinkSync).toHaveBeenCalledWith(path.join('/home/.aifabrix/applications', 'docker-compose.yaml'));
    });
  });

  describe('assertNoPasswordLiteralsInCompose', () => {
    it('does not throw for valid compose without password env', () => {
      const content = 'services:\n  app:\n    image: myapp\n    env_file:\n      - .env.run\n';
      expect(() => runEnvCompose.assertNoPasswordLiteralsInCompose(content)).not.toThrow();
    });

    it('throws when POSTGRES_PASSWORD appears in environment block', () => {
      const content = 'services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: secret\n';
      expect(() => runEnvCompose.assertNoPasswordLiteralsInCompose(content))
        .toThrow(/must not contain password literals/);
    });

    it('throws when DB_0_PASSWORD appears in environment block', () => {
      const content = 'services:\n  x:\n    environment:\n      - DB_0_PASSWORD=foo\n';
      expect(() => runEnvCompose.assertNoPasswordLiteralsInCompose(content))
        .toThrow(/must not contain password literals/);
    });

    it('throws when DB_1_PASSWORD appears in environment block', () => {
      const content = 'services:\n  x:\n    environment:\n      DB_1_PASSWORD: bar\n';
      expect(() => runEnvCompose.assertNoPasswordLiteralsInCompose(content))
        .toThrow(/must not contain password literals/);
    });

    it('does not throw when password appears only in env_file path', () => {
      const content = 'services:\n  x:\n    env_file:\n      - .env.run\n';
      expect(() => runEnvCompose.assertNoPasswordLiteralsInCompose(content)).not.toThrow();
    });
  });

  describe('buildMergedRunEnvAndWrite', () => {
    it('writes .env.run (app-only, no admin) and .env.run.admin (start-only)', async() => {
      const infra = require('../../../lib/infrastructure');
      const devDir = '/home/.aifabrix/applications';
      const result = await runEnvCompose.buildMergedRunEnvAndWrite('myapp', { port: 3000 }, devDir);

      expect(infra.ensureAdminSecrets).toHaveBeenCalled();
      expect(adminSecrets.readAndDecryptAdminSecrets).toHaveBeenCalled();
      expect(secretsEnvWrite.resolveAndGetEnvMap).toHaveBeenCalledWith('myapp', {
        environment: 'docker',
        secretsPath: null,
        force: false,
        runEnvKey: 'dev'
      });
      expect(adminSecrets.envObjectToContent).toHaveBeenCalledTimes(2);
      const appOnlyCall = adminSecrets.envObjectToContent.mock.calls[0][0];
      const dbInitOnlyCall = adminSecrets.envObjectToContent.mock.calls[1][0];
      expect(appOnlyCall).not.toHaveProperty('POSTGRES_PASSWORD');
      expect(appOnlyCall).toHaveProperty('DB_0_PASSWORD', 'appdb');
      expect(appOnlyCall).toHaveProperty('PORT', '3000');
      expect(dbInitOnlyCall).toHaveProperty('POSTGRES_PASSWORD', 'admin');
      expect(dbInitOnlyCall).toHaveProperty('DB_0_PASSWORD', 'appdb');
      expect(fsSync.promises.writeFile).toHaveBeenCalledWith(
        path.join(devDir, '.env.run'),
        expect.any(String),
        { mode: 0o600 }
      );
      expect(fsSync.promises.writeFile).toHaveBeenCalledWith(
        path.join(devDir, '.env.run.admin'),
        expect.any(String),
        { mode: 0o600 }
      );
      expect(result).toEqual({ runEnvPath: path.join(devDir, '.env.run'), runEnvAdminPath: path.join(devDir, '.env.run.admin') });
    });

    it('app env overrides admin for same key; db-init file gets overridden POSTGRES_PASSWORD', async() => {
      secretsEnvWrite.resolveAndGetEnvMap.mockResolvedValueOnce({ POSTGRES_PASSWORD: 'overridden', PORT: '3000' });
      await runEnvCompose.buildMergedRunEnvAndWrite('myapp', {}, '/tmp/apps');
      const dbInitCall = adminSecrets.envObjectToContent.mock.calls[1][0];
      expect(dbInitCall).toHaveProperty('POSTGRES_PASSWORD', 'overridden');
    });

    it('passes through KC_DB_* vars (KC_DB_URL_HOST, KC_DB_URL_PORT, KC_DB_URL_DATABASE, KC_DB_USERNAME, KC_DB_PASSWORD) in app-only file', async() => {
      secretsEnvWrite.resolveAndGetEnvMap.mockResolvedValueOnce({
        KC_DB_URL_HOST: 'postgres',
        KC_DB_URL_PORT: '5432',
        KC_DB_URL_DATABASE: 'keycloak',
        KC_DB_USERNAME: 'keycloak_user',
        KC_DB_PASSWORD: 'keycloak_pass123'
      });
      await runEnvCompose.buildMergedRunEnvAndWrite('keycloak', {}, '/tmp/apps');
      const appOnlyCall = adminSecrets.envObjectToContent.mock.calls[0][0];
      expect(appOnlyCall.KC_DB_URL_HOST).toBe('postgres');
      expect(appOnlyCall.KC_DB_URL_PORT).toBe('5432');
      expect(appOnlyCall.KC_DB_URL_DATABASE).toBe('keycloak');
      expect(appOnlyCall.KC_DB_USERNAME).toBe('keycloak_user');
      expect(appOnlyCall.KC_DB_PASSWORD).toBe('keycloak_pass123');
    });

    it('sets PORT and template port var (e.g. MISO_PORT) to container port from application.yaml, not localPort', async() => {
      const builderPath = path.join('/tmp/builder', 'miso-controller');
      const templatePath = path.join(builderPath, 'env.template');
      pathsUtil.getBuilderPath.mockReturnValue(builderPath);
      fsSync.existsSync.mockImplementation((p) => p === templatePath);
      fsSync.readFileSync.mockImplementation((p) => {
        if (p === templatePath) return 'PORT=${MISO_PORT}\nNODE_ENV=production\n';
        return '';
      });
      secretsEnvWrite.resolveAndGetEnvMap.mockResolvedValueOnce({
        MISO_PORT: '3010',
        PORT: '3010',
        NODE_ENV: 'production'
      });
      const appConfig = { port: 3000, build: { localPort: 3010 } };
      await runEnvCompose.buildMergedRunEnvAndWrite('miso-controller', appConfig, '/tmp/apps');
      const appOnlyCall = adminSecrets.envObjectToContent.mock.calls[0][0];
      expect(appOnlyCall.PORT).toBe('3000');
      expect(appOnlyCall.MISO_PORT).toBe('3000');
    });
  });
});
