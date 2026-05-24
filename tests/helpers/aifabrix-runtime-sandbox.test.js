/**
 * @fileoverview Jest sandbox isolates AIFABRIX_CONFIG under tmpdir.
 */

'use strict';

const path = require('path');
const fsReal = require('../../lib/internal/fs-real-sync');

const {
  initAifabrixJestSandbox,
  applyAifabrixJestSandboxEnv,
  teardownAifabrixJestSandbox,
  isPreserveFabrixTestEnv
} = require('./aifabrix-runtime-sandbox');

const describeSandbox = isPreserveFabrixTestEnv() ? describe.skip : describe;

describeSandbox('aifabrix-runtime-sandbox', () => {
  afterEach(() => {
    teardownAifabrixJestSandbox();
    delete process.env.AIFABRIX_CONFIG;
    delete process.env.AIFABRIX_HOME;
  });

  it('creates config and secrets under tmpdir', () => {
    const result = initAifabrixJestSandbox();
    expect(result).not.toBeNull();
    expect(fsReal.existsSync(result.configPath)).toBe(true);
    const secretsPath = path.join(path.dirname(result.configPath), 'secrets.local.yaml');
    expect(fsReal.existsSync(secretsPath)).toBe(true);
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
    const result = initAifabrixJestSandbox();
    const root = result.sandboxRoot;
    teardownAifabrixJestSandbox();
    expect(fsReal.existsSync(root)).toBe(false);
  });
});
