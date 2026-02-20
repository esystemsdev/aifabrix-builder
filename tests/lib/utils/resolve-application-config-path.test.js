/**
 * Tests for resolveApplicationConfigPath (real filesystem)
 * Uses a temp dir and real files to avoid fs mock ordering issues with setup.js.
 *
 * @fileoverview Unit tests for resolveApplicationConfigPath
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Use real fs so created files are visible to the resolver (avoid mock from other test files)
jest.mock('fs', () => jest.requireActual('fs'));

const fs = require('fs');
const realFs = jest.requireActual('fs');

/** Create temp dir on real filesystem so it exists even when fs is mocked by other tests. Cross-platform. */
function createTempDirReal(dir) {
  const script = 'require(\'fs\').mkdirSync(process.argv[1], { recursive: true })';
  const nodeExe = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
  const cmd = `${nodeExe} -e ${JSON.stringify(script)} ${JSON.stringify(dir)}`;
  execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
}

function nodeCmd() {
  return process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
}

/** Write file on real filesystem via subprocess so it exists when fs is mocked by other tests. */
function writeFileReal(filePath, content) {
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const script = 'const fs=require(\'fs\'); const b=Buffer.from(process.argv[2],\'base64\'); fs.writeFileSync(process.argv[1], b.toString(\'utf8\'));';
  execSync(nodeCmd() + ' -e ' + JSON.stringify(script) + ' ' + JSON.stringify(filePath) + ' ' + JSON.stringify(b64), {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
}

/** Check file exists on real filesystem via subprocess (for assertions when fs may be mocked). */
function existsReal(filePath) {
  try {
    const script = 'process.exit(require(\'fs\').existsSync(process.argv[1])?0:1)';
    execSync(nodeCmd() + ' -e ' + JSON.stringify(script) + ' ' + JSON.stringify(filePath), {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    return true;
  } catch {
    return false;
  }
}

/** Read file from real filesystem via subprocess (for assertions when fs may be mocked). */
function readFileReal(filePath, encoding) {
  const script = 'process.stdout.write(require(\'fs\').readFileSync(process.argv[1], process.argv[2] || \'utf8\'));';
  return execSync(nodeCmd() + ' -e ' + JSON.stringify(script) + ' ' + JSON.stringify(filePath) + ' utf8', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
}

/** Resolve config path in a subprocess so real fs is always used (avoids Jest fs mock from other tests). */
function resolveInSubprocess(appPath) {
  const resolverPath = path.resolve(__dirname, '../../../lib/utils/app-config-resolver.js');
  const script = 'const r=require(process.argv[2]); try { console.log(r.resolveApplicationConfigPath(process.argv[1])); } catch(e) { console.error(e.message); process.exit(1); }';
  try {
    return execSync(nodeCmd() + ' -e ' + JSON.stringify(script) + ' ' + JSON.stringify(appPath) + ' ' + JSON.stringify(resolverPath), {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    }).trim();
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    throw new Error(msg || 'resolveApplicationConfigPath failed');
  }
}

/** In-process resolver for validation-only tests (invalid appPath; no fs access). */
function getResolver() {
  let resolveApplicationConfigPath;
  jest.isolateModules(() => {
    resolveApplicationConfigPath = require('../../../lib/utils/app-config-resolver').resolveApplicationConfigPath;
  });
  return resolveApplicationConfigPath;
}

describe('resolveApplicationConfigPath', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `aifabrix-resolve-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    createTempDirReal(tempDir);
  });

  afterEach(() => {
    try {
      if (tempDir && realFs.existsSync(tempDir)) {
        realFs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('returns application.yaml path when it exists', () => {
    const applicationYaml = path.join(tempDir, 'application.yaml');
    writeFileReal(applicationYaml, 'app:\n  name: test');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(applicationYaml);
  });

  it('prefers application.yaml over application.yml when both exist', () => {
    writeFileReal(path.join(tempDir, 'application.yaml'), 'app:\n  name: yaml');
    writeFileReal(path.join(tempDir, 'application.yml'), 'app:\n  name: yml');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(path.join(tempDir, 'application.yaml'));
  });

  it('prefers application.yaml over application.json when both exist', () => {
    writeFileReal(path.join(tempDir, 'application.yaml'), 'app:\n  name: yaml');
    writeFileReal(path.join(tempDir, 'application.json'), '{"app":{"name":"json"}}');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(path.join(tempDir, 'application.yaml'));
  });

  it('prefers application.yml over application.json when both exist', () => {
    writeFileReal(path.join(tempDir, 'application.yml'), 'app:\n  name: yml');
    writeFileReal(path.join(tempDir, 'application.json'), '{"app":{"name":"json"}}');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(path.join(tempDir, 'application.yml'));
  });

  it('does not rename variables.yaml when application.yaml already exists', () => {
    const applicationYaml = path.join(tempDir, 'application.yaml');
    const variablesYaml = path.join(tempDir, 'variables.yaml');
    writeFileReal(applicationYaml, 'app:\n  name: app');
    writeFileReal(variablesYaml, 'app:\n  name: legacy');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(applicationYaml);
    expect(existsReal(variablesYaml)).toBe(true);
    expect(readFileReal(applicationYaml)).toContain('name: app');
  });

  it('returns application.yml path when it exists and application.yaml does not', () => {
    const applicationYml = path.join(tempDir, 'application.yml');
    writeFileReal(applicationYml, 'app:\n  name: test');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(applicationYml);
  });

  it('returns application.json path when only it exists', () => {
    const applicationJson = path.join(tempDir, 'application.json');
    writeFileReal(applicationJson, '{"app":{"name":"test"}}');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(applicationJson);
  });

  it('renames variables.yaml to application.yaml and returns new path when only variables.yaml exists', () => {
    const variablesYaml = path.join(tempDir, 'variables.yaml');
    writeFileReal(variablesYaml, 'app:\n  name: test');
    const result = resolveInSubprocess(tempDir);
    expect(result).toBe(path.join(tempDir, 'application.yaml'));
    expect(existsReal(path.join(tempDir, 'application.yaml'))).toBe(true);
    expect(existsReal(variablesYaml)).toBe(false);
  });

  it('throws when no config file exists', () => {
    expect(() => resolveInSubprocess(tempDir)).toThrow(/Application config not found/);
  });

  it('throws when appPath is empty or not a string', () => {
    const resolveApplicationConfigPath = getResolver();
    expect(() => resolveApplicationConfigPath('')).toThrow(/App path is required/);
    expect(() => resolveApplicationConfigPath(null)).toThrow(/App path is required/);
  });

  it('throws when appPath is undefined', () => {
    const resolveApplicationConfigPath = getResolver();
    expect(() => resolveApplicationConfigPath(undefined)).toThrow(/App path is required/);
  });

  it('throws when appPath is not a string (number)', () => {
    const resolveApplicationConfigPath = getResolver();
    expect(() => resolveApplicationConfigPath(123)).toThrow(/App path is required/);
  });
});
