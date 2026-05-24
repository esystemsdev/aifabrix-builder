/**
 * Per-process Jest sandbox under os.tmpdir() for Fabrix config + secrets.
 *
 * @fileoverview Default AIFABRIX_CONFIG for unit tests (plan 185 Phase 2.5)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const os = require('os');
const fsReal = require('../../lib/internal/fs-real-sync');

let sandboxRoot = null;
let sandboxConfigPath = null;

/**
 * @returns {boolean}
 */
function isPreserveFabrixTestEnv() {
  return process.env.PRESERVE_AIFABRIX_TEST_ENV === 'true';
}

/**
 * Create sandbox and set AIFABRIX_CONFIG / AIFABRIX_HOME (unless PRESERVE).
 * @returns {{ sandboxRoot: string, configPath: string }|null}
 */
function initAifabrixJestSandbox() {
  if (isPreserveFabrixTestEnv()) {
    return null;
  }
  if (sandboxRoot && fsReal.existsSync(sandboxConfigPath)) {
    applyAifabrixJestSandboxEnv();
    return { sandboxRoot, configPath: sandboxConfigPath };
  }
  sandboxRoot = fsReal.mkdtempSync(path.join(os.tmpdir(), 'aifx-jest-'));
  const configDir = path.join(sandboxRoot, '.aifabrix');
  fsReal.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  sandboxConfigPath = path.join(configDir, 'config.yaml');
  const yaml = [
    'developer-id: 0',
    'setupInstallationProfile: dev',
    'traefik: false',
    'pgadmin: true',
    'redisCommander: true',
    'tlsEnabled: false'
  ].join('\n');
  fsReal.writeFileSync(sandboxConfigPath, `${yaml}\n`, { mode: 0o600 });
  fsReal.writeFileSync(path.join(configDir, 'secrets.local.yaml'), '{}\n', { mode: 0o600 });
  applyAifabrixJestSandboxEnv();
  return { sandboxRoot, configPath: sandboxConfigPath };
}

/**
 * Re-apply sandbox env after clearFabrixPathEnvForTests() in beforeEach.
 */
function applyAifabrixJestSandboxEnv() {
  if (isPreserveFabrixTestEnv() || !sandboxConfigPath) return;
  process.env.AIFABRIX_CONFIG = sandboxConfigPath;
  process.env.AIFABRIX_HOME = sandboxRoot;
}

/**
 * Remove sandbox directory.
 */
function teardownAifabrixJestSandbox() {
  if (!sandboxRoot) return;
  try {
    fsReal.rmSync(sandboxRoot, { recursive: true, force: true });
  } catch {
    // ignore
  }
  sandboxRoot = null;
  sandboxConfigPath = null;
}

module.exports = {
  initAifabrixJestSandbox,
  applyAifabrixJestSandboxEnv,
  teardownAifabrixJestSandbox,
  isPreserveFabrixTestEnv
};
