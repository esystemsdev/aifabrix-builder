/**
 * @fileoverview Ensures global Jest setup pins secrets paths under tmpdir (plan 185 Phase 2.5.A).
 */

'use strict';

const path = require('path');
const os = require('os');

const {
  isPreserveFabrixTestEnv,
  initAifabrixJestSandbox,
  applyAifabrixJestSandboxEnv,
  teardownAifabrixJestSandbox
} = require('../../helpers/aifabrix-runtime-sandbox');

const describeUnlessPreserve = isPreserveFabrixTestEnv() ? describe.skip : describe;

describeUnlessPreserve('paths with Jest sandbox (initAifabrixJestSandbox)', () => {
  beforeAll(() => {
    initAifabrixJestSandbox();
    applyAifabrixJestSandboxEnv();
  });

  afterAll(() => {
    teardownAifabrixJestSandbox();
    delete process.env.AIFABRIX_CONFIG;
    delete process.env.AIFABRIX_HOME;
  });

  beforeEach(() => {
    applyAifabrixJestSandboxEnv();
  });

  it('getPrimaryUserSecretsLocalPath resolves under os.tmpdir aifx-jest sandbox', () => {
    const paths = require('../../../lib/utils/paths');
    const secretsPath = paths.getPrimaryUserSecretsLocalPath();
    const resolved = path.resolve(secretsPath);
    const tmpRoot = path.resolve(os.tmpdir());
    expect(resolved.startsWith(`${tmpRoot}${path.sep}`)).toBe(true);
    expect(resolved).toMatch(/aifx-jest-/);
    expect(path.basename(resolved)).toBe('secrets.local.yaml');
  });

  it('getAifabrixSystemDir matches config parent under sandbox', () => {
    const paths = require('../../../lib/utils/paths');
    const configPath = process.env.AIFABRIX_CONFIG;
    expect(configPath).toBeTruthy();
    expect(paths.getAifabrixSystemDir()).toBe(path.dirname(configPath));
  });
});
