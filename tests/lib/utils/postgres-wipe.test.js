/**
 * Tests for `lib/utils/postgres-wipe.js`.
 *
 * @fileoverview Unit tests for postgres-wipe utility
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/core/admin-secrets');
jest.mock('../../../lib/utils/docker-exec');
jest.mock('../../../lib/utils/logger');

const config = require('../../../lib/core/config');
const adminSecrets = require('../../../lib/core/admin-secrets');
const dockerExec = require('../../../lib/utils/docker-exec');
const logger = require('../../../lib/utils/logger');
const {
  wipePostgresData,
  getPostgresContainerName,
  PROTECTED_DATABASES,
  PROTECTED_ROLES
} = require('../../../lib/utils/postgres-wipe');

describe('lib/utils/postgres-wipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log.mockImplementation(() => {});
  });

  describe('getPostgresContainerName', () => {
    it('returns aifabrix-postgres for dev 0', () => {
      expect(getPostgresContainerName(0)).toBe('aifabrix-postgres');
    });

    it('returns dev-scoped name for dev > 0 (string id)', () => {
      expect(getPostgresContainerName('02')).toBe('aifabrix-dev02-postgres');
    });

    it('returns dev-scoped name for dev > 0 (number id)', () => {
      expect(getPostgresContainerName(3)).toBe('aifabrix-dev3-postgres');
    });
  });

  describe('PROTECTED_*', () => {
    it('contains template0/template1 and postgres in protected dbs', () => {
      expect(PROTECTED_DATABASES.has('postgres')).toBe(true);
      expect(PROTECTED_DATABASES.has('template0')).toBe(true);
      expect(PROTECTED_DATABASES.has('template1')).toBe(true);
    });

    it('contains superuser roles in protected roles', () => {
      expect(PROTECTED_ROLES.has('pgadmin')).toBe(true);
      expect(PROTECTED_ROLES.has('postgres')).toBe(true);
    });
  });

  describe('wipePostgresData', () => {
    function setupAdmin(password) {
      config.getDeveloperId.mockResolvedValue('02');
      adminSecrets.readAndDecryptAdminSecrets.mockResolvedValue({
        POSTGRES_PASSWORD: password
      });
    }

    it('throws when admin password is missing', async() => {
      setupAdmin('');
      await expect(wipePostgresData()).rejects.toThrow(/POSTGRES_PASSWORD not found/);
    });

    it('drops every non-template database and every non-superuser role', async() => {
      setupAdmin('s3cret');
      const calls = [];
      dockerExec.execWithDockerEnv.mockImplementation(async(cmd) => {
        calls.push(cmd);
        if (cmd.includes('FROM pg_database')) {
          return { stdout: 'app_db\nintegration_db\n', stderr: '' };
        }
        if (cmd.includes('FROM pg_roles')) {
          return { stdout: 'app_user\nintegration_user\n', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      });

      const result = await wipePostgresData();

      expect(result.databases).toEqual(['app_db', 'integration_db']);
      expect(result.roles).toEqual(['app_user', 'integration_user']);
      expect(calls.some(c => /DROP DATABASE IF EXISTS \\?"app_db\\?"/.test(c))).toBe(true);
      expect(calls.some(c => /DROP DATABASE IF EXISTS \\?"integration_db\\?"/.test(c))).toBe(true);
      expect(calls.some(c => /DROP ROLE IF EXISTS \\?"app_user\\?"/.test(c))).toBe(true);
      expect(calls.some(c => /DROP ROLE IF EXISTS \\?"integration_user\\?"/.test(c))).toBe(true);
    });

    it('passes PGPASSWORD via env (not on command line) for every psql call', async() => {
      setupAdmin('s3cret');
      const envs = [];
      dockerExec.execWithDockerEnv.mockImplementation(async(cmd, opts) => {
        envs.push(opts && opts.env);
        if (cmd.includes('FROM pg_database')) return { stdout: '', stderr: '' };
        if (cmd.includes('FROM pg_roles')) return { stdout: '', stderr: '' };
        return { stdout: '', stderr: '' };
      });
      await wipePostgresData();
      expect(envs.length).toBeGreaterThan(0);
      for (const env of envs) {
        expect(env).toEqual({ PGPASSWORD: 's3cret' });
      }
      // Ensure password never appears on the command line
      expect(dockerExec.execWithDockerEnv.mock.calls.every(([cmd]) => !cmd.includes('s3cret'))).toBe(true);
    });

    it('skips DBs / roles that match protected names', async() => {
      setupAdmin('p');
      dockerExec.execWithDockerEnv.mockImplementation(async(cmd) => {
        if (cmd.includes('FROM pg_database')) {
          return { stdout: 'app_db\npostgres\ntemplate0\ntemplate1\n', stderr: '' };
        }
        if (cmd.includes('FROM pg_roles')) {
          return { stdout: 'app_user\npostgres\npg_signal_backend\n', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      });
      const result = await wipePostgresData();
      expect(result.databases).toEqual(['app_db']);
      expect(result.roles).toEqual(['app_user']);
    });

    it('refuses to drop a DB whose name contains shell metacharacters', async() => {
      setupAdmin('p');
      dockerExec.execWithDockerEnv.mockImplementation(async(cmd) => {
        if (cmd.includes('FROM pg_database')) {
          return { stdout: 'evil; DROP TABLE users\n', stderr: '' };
        }
        if (cmd.includes('FROM pg_roles')) return { stdout: '', stderr: '' };
        return { stdout: '', stderr: '' };
      });
      await expect(wipePostgresData()).rejects.toThrow(/Refusing to drop database/);
    });
  });
});
