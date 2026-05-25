/**
 * @fileoverview Jest sandbox isolates AIFABRIX_CONFIG under tmpdir.
 */

'use strict';

const path = require('path');

const {
  initAifabrixJestSandbox,
  applyAifabrixJestSandboxEnv,
  teardownAifabrixJestSandbox,
  isPreserveFabrixTestEnv,
  sandboxFs
} = require('./aifabrix-runtime-sandbox');

const describeSandbox = isPreserveFabrixTestEnv() ? describe.skip : describe;

describeSandbox('aifabrix-runtime-sandbox', () => {
  beforeEach(() => {
    teardownAifabrixJestSandbox();
    delete process.env.AIFABRIX_CONFIG;
    delete process.env.AIFABRIX_HOME;
  });

  afterEach(() => {
    teardownAifabrixJestSandbox();
    delete process.env.AIFABRIX_CONFIG;
    delete process.env.AIFABRIX_HOME;
  });

  it('creates config and secrets under tmpdir', () => {
    const fs = sandboxFs();
    const result = initAifabrixJestSandbox();
    expect(result).not.toBeNull();
    expect(fs.existsSync(result.configPath)).toBe(true);
    const secretsPath = path.join(path.dirname(result.configPath), 'secrets.local.yaml');
    expect(fs.existsSync(secretsPath)).toBe(true);
    applyAifabrixJestSandboxEnv();
    expect(process.env.AIFABRIX_CONFIG).toBe(result.configPath);
    expect(process.env.AIFABRIX_HOME).toBe(result.sandboxRoot);
  });

  it('re-applies env after clearing AIFABRIX_CONFIG', () => {
    const result = initAifabrixJestSandbox();
    delete process.env.AIFABRIX_CONFIG;
    applyAifabrixJestSandboxEnv();
    expect(process.env.AIFABRIX_CONFIG).toBe(result.configPath);
  });

  it('teardown removes sandbox root', () => {
    const fs = sandboxFs();
    const result = initAifabrixJestSandbox();
    const root = result.sandboxRoot;
    teardownAifabrixJestSandbox();
    expect(fs.existsSync(root)).toBe(false);
  });

  it('getPrimaryUserSecretsLocalPath is under sandbox tmpdir when env is applied', () => {
    const paths = require('../../lib/utils/paths');
    const result = initAifabrixJestSandbox();
    applyAifabrixJestSandboxEnv();
    const secretsPath = paths.getPrimaryUserSecretsLocalPath();
    expect(secretsPath).toContain('aifx-jest-');
    expect(secretsPath).toBe(
      path.join(path.dirname(result.configPath), 'secrets.local.yaml')
    );
  });
});
