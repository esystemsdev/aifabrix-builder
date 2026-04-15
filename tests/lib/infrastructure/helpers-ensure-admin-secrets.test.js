/**
 * @fileoverview Tests admin-secrets.env updates from ensureAdminSecrets (up-infra credential path).
 */

'use strict';

/** Real disk I/O — worker may have jest.mock('fs') from other suites */
const fs = jest.requireActual('node:fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn()
}));

const { parseAdminEnvContent } = require('../../../lib/core/admin-secrets');

describe('infrastructure/helpers ensureAdminSecrets', () => {
  let tmpDir;
  let adminPath;
  /** Fresh after jest.resetModules() — other suites reset the registry; stale paths breaks spies. */
  let config;
  let paths;
  let secretsEnsure;

  beforeEach(() => {
    jest.resetModules();
    config = require('../../../lib/core/config');
    paths = require('../../../lib/utils/paths');
    secretsEnsure = require('../../../lib/core/secrets-ensure');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-admin-secrets-'));
    adminPath = path.join(tmpDir, 'admin-secrets.env');
    jest.spyOn(paths, 'getAifabrixSystemDir').mockReturnValue(tmpDir);
    jest.spyOn(config, 'getSecretsEncryptionKey').mockResolvedValue(null);
    jest.spyOn(secretsEnsure, 'setSecretInStore').mockResolvedValue();
    fs.writeFileSync(
      adminPath,
      [
        'POSTGRES_PASSWORD=oldpass',
        'PGADMIN_DEFAULT_EMAIL=old@example.com',
        'PGADMIN_DEFAULT_PASSWORD=oldpass',
        'REDIS_COMMANDER_PASSWORD=oldpass',
        'REDIS_COMMANDER_USER=admin',
        'REDIS_HOST=local:redis:6379:0:'
      ].join('\n'),
      { mode: 0o600 }
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    jest.restoreAllMocks();
  });

  it('writes CLI adminPassword and adminEmail into admin-secrets.env (shared DB/pgAdmin/Redis Commander password)', async() => {
    const { ensureAdminSecrets } = require('../../../lib/infrastructure/helpers');
    await ensureAdminSecrets({
      adminPassword: 'admin1234',
      adminEmail: 'admin@esystems.fi',
      userPassword: 'user1234',
      tlsEnabled: false
    });

    const written = parseAdminEnvContent(fs.readFileSync(adminPath, 'utf8'));
    expect(written.POSTGRES_PASSWORD).toBe('admin1234');
    expect(written.PGADMIN_DEFAULT_PASSWORD).toBe('admin1234');
    expect(written.REDIS_COMMANDER_PASSWORD).toBe('admin1234');
    expect(written.PGADMIN_DEFAULT_EMAIL).toBe('admin@esystems.fi');
    expect(written.REDIS_COMMANDER_USER).toBe('admin');
    expect(secretsEnsure.setSecretInStore).toHaveBeenCalledWith('postgres-passwordKeyVault', 'admin1234');
  });

  it('does not put userPassword in admin-secrets.env (Keycloak default user lives in secrets store)', async() => {
    const { ensureAdminSecrets } = require('../../../lib/infrastructure/helpers');
    await ensureAdminSecrets({
      adminPassword: 'ap',
      adminEmail: 'a@b.c',
      userPassword: 'user-only',
      tlsEnabled: false
    });
    const written = parseAdminEnvContent(fs.readFileSync(adminPath, 'utf8'));
    expect(written).not.toHaveProperty('USER_PASSWORD');
    expect(Object.values(written).join(' ')).not.toContain('user-only');
  });
});
