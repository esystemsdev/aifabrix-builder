/**
 * Tests for detectAppType (real filesystem)
 * Uses a temp dir and real fs so path resolution and config loading are exercised.
 *
 * @fileoverview Unit tests for detectAppType path resolution
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Use real fs so temp dir and files exist regardless of other tests' fs mocks
jest.mock('fs', () => jest.requireActual('fs'));

const fs = require('fs');
const realFs = jest.requireActual('fs');

/** Create temp dir on real filesystem so it exists even when fs is mocked by other tests. Cross-platform. */
function createTempDirReal(baseDir) {
  const script = 'require(\'fs\').mkdirSync(process.argv[1], { recursive: true })';
  const nodeExe = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
  const cmd = `${nodeExe} -e ${JSON.stringify(script)} ${JSON.stringify(baseDir)}`;
  execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
}

/** Write file on real filesystem via subprocess so it exists when fs is mocked by other tests. */
function writeFileReal(filePath, content) {
  const nodeExe = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const script = 'const fs=require(\'fs\'); const b=Buffer.from(process.argv[2],\'base64\'); fs.writeFileSync(process.argv[1], b.toString(\'utf8\'));';
  execSync(nodeExe + ' -e ' + JSON.stringify(script) + ' ' + JSON.stringify(filePath) + ' ' + JSON.stringify(b64), {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
}

describe('detectAppType', () => {
  let tempDir;
  let originalCwd;
  let originalProjectRoot;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `aifabrix-detect-type-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    createTempDirReal(tempDir);
    writeFileReal(path.join(tempDir, 'package.json'), '{}');
    originalCwd = process.cwd();
    originalProjectRoot = global.PROJECT_ROOT;
  });

  afterEach(() => {
    try {
      process.chdir(originalCwd);
      global.PROJECT_ROOT = originalProjectRoot;
      if (tempDir && realFs.existsSync(tempDir)) {
        realFs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  /** In-process detectAppType for validation-only tests (invalid appName; no fs access). */
  function getDetectAppType() {
    let detectAppType;
    jest.isolateModules(() => {
      const paths = require('../../../lib/utils/paths');
      detectAppType = paths.detectAppType;
    });
    return detectAppType;
  }

  /** Run detectAppType in a subprocess so real fs is always used (avoids Jest fs mock from other tests). */
  function detectAppTypeInSubprocess(appNameArg, optionsArg = {}) {
    const runnerPath = path.resolve(__dirname, 'run-detect-app-type.js');
    const optionsJson = JSON.stringify(optionsArg);
    const nodeExe = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
    try {
      const out = execSync(
        nodeExe + ' ' + JSON.stringify(runnerPath) + ' ' + JSON.stringify(tempDir) + ' ' + JSON.stringify(appNameArg) + ' ' + JSON.stringify(optionsJson),
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: true }
      ).trim();
      return JSON.parse(out);
    } catch (err) {
      const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
      throw new Error(msg || 'detectAppType failed');
    }
  }

  // (1) no type, integration has config → use integration
  it('uses integration when no type and integration has config', async() => {
    const appName = 'myapp';
    createTempDirReal(path.join(tempDir, 'integration', appName));
    writeFileReal(
      path.join(tempDir, 'integration', appName, 'application.yaml'),
      'app:\n  name: myapp\n  type: external\n'
    );
    const result = await detectAppTypeInSubprocess(appName, {});
    expect(result).toEqual(
      expect.objectContaining({
        appPath: path.join(tempDir, 'integration', appName),
        appType: 'external',
        baseDir: 'integration',
        isExternal: true
      })
    );
  });

  // (2) no type, integration empty, builder has config → use builder
  it('uses builder when no type and only builder has config', async() => {
    const appName = 'myapp';
    createTempDirReal(path.join(tempDir, 'builder', appName));
    writeFileReal(
      path.join(tempDir, 'builder', appName, 'application.yaml'),
      'app:\n  name: myapp\n'
    );
    const result = await detectAppTypeInSubprocess(appName, {});
    expect(result).toEqual(
      expect.objectContaining({
        appPath: path.join(tempDir, 'builder', appName),
        appType: 'regular',
        baseDir: 'builder',
        isExternal: false
      })
    );
  });

  // (3) no type, both empty → throw
  it('throws when no type and both integration and builder are empty', () => {
    const appName = 'myapp';
    createTempDirReal(path.join(tempDir, 'integration', appName));
    createTempDirReal(path.join(tempDir, 'builder', appName));
    expect(() => detectAppTypeInSubprocess(appName, {})).toThrow(
      `App '${appName}' not found in integration/${appName} or builder/${appName}`
    );
  });

  // (4) type 'app', builder has config → use builder
  it('uses builder when type is app and builder has config', async() => {
    const appName = 'myapp';
    createTempDirReal(path.join(tempDir, 'builder', appName));
    writeFileReal(
      path.join(tempDir, 'builder', appName, 'application.yaml'),
      'app:\n  name: myapp\n'
    );
    const result = await detectAppTypeInSubprocess(appName, { type: 'app' });
    expect(result).toEqual(
      expect.objectContaining({
        appPath: path.join(tempDir, 'builder', appName),
        appType: 'regular',
        baseDir: 'builder'
      })
    );
  });

  // (5) type 'app', builder empty → throw (implementation ignores options.type; uses generic message)
  it('throws when type is app and builder has no config', () => {
    const appName = 'myapp';
    createTempDirReal(path.join(tempDir, 'builder', appName));
    expect(() => detectAppTypeInSubprocess(appName, { type: 'app' })).toThrow(
      `App '${appName}' not found in integration/${appName} or builder/${appName}`
    );
  });

  // (6) type 'external', integration has config → use integration
  it('uses integration when type is external and integration has config', async() => {
    const appName = 'myapp';
    createTempDirReal(path.join(tempDir, 'integration', appName));
    writeFileReal(
      path.join(tempDir, 'integration', appName, 'application.yaml'),
      'app:\n  name: myapp\n  type: external\n'
    );
    const result = await detectAppTypeInSubprocess(appName, { type: 'external' });
    expect(result).toEqual(
      expect.objectContaining({
        appPath: path.join(tempDir, 'integration', appName),
        appType: 'external',
        baseDir: 'integration',
        isExternal: true
      })
    );
  });

  // (7) type 'external', integration empty → throw (implementation ignores options.type; uses generic message)
  it('throws when type is external and integration has no config', () => {
    const appName = 'myapp';
    createTempDirReal(path.join(tempDir, 'integration', appName));
    expect(() => detectAppTypeInSubprocess(appName, { type: 'external' })).toThrow(
      `App '${appName}' not found in integration/${appName} or builder/${appName}`
    );
  });

  it('throws when appName is empty or not a string', async() => {
    const detectAppType = getDetectAppType();
    await expect(detectAppType('', {})).rejects.toThrow('App name is required and must be a string');
    await expect(detectAppType(null, {})).rejects.toThrow('App name is required and must be a string');
    await expect(detectAppType(undefined, {})).rejects.toThrow('App name is required and must be a string');
  });
});
