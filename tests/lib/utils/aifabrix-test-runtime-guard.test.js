/**
 * @fileoverview Tests for Jest write guard on live Fabrix config paths.
 */

'use strict';

const os = require('os');
const path = require('path');

const fs = require('fs');

const {
  isAllowedTestWritePath,
  assertWritableSecretsPathForTests,
  getLiveFabrixConfigDirCandidates,
  ALLOW_ENV
} = require('../../../lib/utils/aifabrix-test-runtime-guard');

describe('aifabrix-test-runtime-guard', () => {
  const originalJestId = process.env.JEST_WORKER_ID;

  beforeEach(() => {
    process.env.JEST_WORKER_ID = '1';
    delete process.env[ALLOW_ENV];
  });

  afterEach(() => {
    if (originalJestId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestId;
    }
    delete process.env[ALLOW_ENV];
  });

  it('allows writes under legacy /home/test mock fabrix dir', () => {
    const p = path.join('/home/test', '.aifabrix', 'secrets.local.yaml');
    expect(isAllowedTestWritePath(p)).toBe(true);
    expect(() => assertWritableSecretsPathForTests(p)).not.toThrow();
  });

  it('allows writes under os.tmpdir()', () => {
    const p = path.join(os.tmpdir(), 'aifx-jest-abc', 'secrets.local.yaml');
    expect(() => assertWritableSecretsPathForTests(p)).not.toThrow();
  });

  it('refuses writes to live ~/.aifabrix during Jest', () => {
    const p = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
    expect(isAllowedTestWritePath(p)).toBe(false);
    expect(() => assertWritableSecretsPathForTests(p)).toThrow(/Refusing to write secrets/);
  });

  it('refuses writes to /workspace/.aifabrix during Jest', () => {
    const p = '/workspace/.aifabrix/secrets.local.yaml';
    expect(isAllowedTestWritePath(p)).toBe(false);
    expect(() => assertWritableSecretsPathForTests(p)).toThrow(/Refusing to write secrets/);
  });

  it('allows live path when ALLOW_AIFABRIX_TEST_WRITE_REAL_CONFIG=1', () => {
    process.env[ALLOW_ENV] = '1';
    const p = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
    expect(() => assertWritableSecretsPathForTests(p)).not.toThrow();
  });

  it('treats symlinked ~/.aifabrix and /workspace/.aifabrix as the same live tree', () => {
    const homeSecrets = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
    const workspaceSecrets = '/workspace/.aifabrix/secrets.local.yaml';
    if (!fs.existsSync(homeSecrets) || !fs.existsSync(workspaceSecrets)) {
      return;
    }
    let homeReal;
    let workspaceReal;
    try {
      homeReal = fs.realpathSync(homeSecrets);
      workspaceReal = fs.realpathSync(workspaceSecrets);
    } catch {
      return;
    }
    if (homeReal !== workspaceReal) {
      return;
    }
    const dirs = getLiveFabrixConfigDirCandidates();
    expect(dirs).toHaveLength(1);
    expect(() => assertWritableSecretsPathForTests(homeSecrets)).toThrow(/Refusing to write secrets/);
    expect(() => assertWritableSecretsPathForTests(workspaceSecrets)).toThrow(/Refusing to write secrets/);
  });
});
