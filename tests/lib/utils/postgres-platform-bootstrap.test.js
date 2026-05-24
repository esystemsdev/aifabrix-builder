/**
 * @fileoverview Tests for postgres-platform-bootstrap
 */

'use strict';

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/core/admin-secrets');
jest.mock('../../../lib/core/secrets');
jest.mock('../../../lib/core/secrets-ensure', () => ({
  ensureInfraSecrets: jest.fn().mockResolvedValue([])
}));
jest.mock('../../../lib/utils/docker-exec');
jest.mock('../../../lib/utils/logger');

const config = require('../../../lib/core/config');
const adminSecrets = require('../../../lib/core/admin-secrets');
const secrets = require('../../../lib/core/secrets');
const secretsEnsure = require('../../../lib/core/secrets-ensure');
const dockerExec = require('../../../lib/utils/docker-exec');
const {
  bootstrapPlatformPostgresDatabases,
  pgRoleName,
  PLATFORM_DATABASE_SLOTS,
  escapeShellDoubleQuoted
} = require('../../../lib/utils/postgres-platform-bootstrap');

describe('lib/utils/postgres-platform-bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getDeveloperId.mockResolvedValue('06');
    adminSecrets.readAndDecryptAdminSecrets.mockResolvedValue({ POSTGRES_PASSWORD: 'admin123' });
    secrets.loadSecrets.mockResolvedValue({
      'databases-keycloak-0-passwordKeyVault': 'kc-pass',
      'databases-miso-controller-0-passwordKeyVault': 'miso-pass',
      'databases-miso-controller-1-passwordKeyVault': 'miso-logs-pass',
      'databases-dataplane-0-passwordKeyVault': 'dp-pass',
      'databases-dataplane-1-passwordKeyVault': 'dpv-pass',
      'databases-dataplane-2-passwordKeyVault': 'dpl-pass',
      'databases-dataplane-3-passwordKeyVault': 'dpr-pass'
    });
    dockerExec.execWithDockerEnv.mockResolvedValue({ stdout: '' });
  });

  it('maps hyphenated database names to underscore roles', () => {
    expect(pgRoleName('miso-logs')).toBe('miso_logs_user');
    expect(pgRoleName('keycloak')).toBe('keycloak_user');
  });

  it('escapes DO block $$ delimiters for double-quoted shell -c', () => {
    const sql = 'DO $$ BEGIN SELECT 1; END $$;';
    expect(escapeShellDoubleQuoted(sql)).toBe('DO \\$\\$ BEGIN SELECT 1; END \\$\\$;');
  });

  it('covers all platform databases dropped by setup wipe', () => {
    const names = PLATFORM_DATABASE_SLOTS.map((s) => s.dbName);
    expect(names).toEqual(
      expect.arrayContaining([
        'keycloak',
        'miso',
        'miso-logs',
        'dataplane',
        'dataplane-vector',
        'dataplane-logs',
        'dataplane-records'
      ])
    );
  });

  it('creates roles and databases via docker exec psql', async() => {
    dockerExec.execWithDockerEnv.mockImplementation(async(cmd) => {
      if (String(cmd).includes('SELECT 1 FROM pg_database')) {
        return { stdout: '' };
      }
      return { stdout: '' };
    });

    const ensured = await bootstrapPlatformPostgresDatabases();

    expect(secretsEnsure.ensureInfraSecrets).toHaveBeenCalled();
    expect(ensured).toHaveLength(PLATFORM_DATABASE_SLOTS.length);
    expect(dockerExec.execWithDockerEnv).toHaveBeenCalled();
    const cmds = dockerExec.execWithDockerEnv.mock.calls.map((c) => String(c[0]));
    expect(cmds.some((c) => c.includes('keycloak_user'))).toBe(true);
    expect(cmds.some((c) => c.includes('DO \\$\\$ BEGIN'))).toBe(true);
    expect(cmds.some((c) => c.includes('CREATE DATABASE') && c.includes('keycloak'))).toBe(true);
  });

  it('fails when admin password is missing', async() => {
    adminSecrets.readAndDecryptAdminSecrets.mockResolvedValue({});
    await expect(bootstrapPlatformPostgresDatabases()).rejects.toThrow(/POSTGRES_PASSWORD/);
  });
});
