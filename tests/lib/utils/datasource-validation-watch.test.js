/**
 * @fileoverview Tests for datasource-validation-watch.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn()
}));

const { getIntegrationPath } = require('../../../lib/utils/paths');
const {
  fingerprintForWatchDiff,
  formatWatchFingerprintDiff,
  buildWatchTargetList
} = require('../../../lib/utils/datasource-validation-watch');

describe('datasource-validation-watch', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dvwatch-'));
    getIntegrationPath.mockReturnValue(path.join(tmp, 'integration-app'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
    jest.clearAllMocks();
  });

  it('fingerprintForWatchDiff captures status, certificate, sorted capabilities', () => {
    const fp = fingerprintForWatchDiff({
      status: 'warn',
      certificate: { status: 'passed' },
      capabilities: [{ key: 'b', status: 'ok' }, { key: 'a', status: 'fail' }]
    });
    expect(fp).toContain('status=warn');
    expect(fp).toContain('cert=passed');
    expect(fp).toContain('a:fail');
    expect(fp).toContain('b:ok');
    expect(fp.indexOf('a:fail')).toBeLessThan(fp.indexOf('b:ok'));
  });

  it('fingerprintForWatchDiff returns empty for null envelope', () => {
    expect(fingerprintForWatchDiff(null)).toBe('');
  });

  it('formatWatchFingerprintDiff returns null when unchanged or no prior', () => {
    const a = 'status=ok|cert=none|caps=';
    expect(formatWatchFingerprintDiff(null, a, false)).toBeNull();
    expect(formatWatchFingerprintDiff(a, a, false)).toBeNull();
  });

  it('formatWatchFingerprintDiff full mode prints before and after', () => {
    const msg = formatWatchFingerprintDiff('x', 'y', true);
    expect(msg).toContain('before:');
    expect(msg).toContain('after:');
    expect(msg).toContain('x');
    expect(msg).toContain('y');
  });

  it('buildWatchTargetList includes integration tree and extra file', () => {
    const intRoot = path.join(tmp, 'integration-app');
    fs.mkdirSync(path.join(intRoot, 'sub'), { recursive: true });
    const extraFile = path.join(tmp, 'extra.json');
    fs.writeFileSync(extraFile, '{}', 'utf8');

    const targets = buildWatchTargetList('myapp', [extraFile], false);
    const paths = targets.map(t => t.path);
    expect(paths).toContain(intRoot);
    expect(paths).toContain(path.join(intRoot, 'sub'));
    expect(paths).toContain(extraFile);
    const kinds = targets.reduce((m, t) => {
      m[t.path] = t.kind;
      return m;
    }, {});
    expect(kinds[extraFile]).toBe('file');
  });

  it('buildWatchTargetList adds application.yaml when flag set', () => {
    const intRoot = path.join(tmp, 'integration-app');
    fs.mkdirSync(intRoot, { recursive: true });
    const yamlPath = path.join(intRoot, 'application.yaml');
    fs.writeFileSync(yamlPath, 'x: 1\n', 'utf8');

    const targets = buildWatchTargetList('myapp', [], true);
    const fileTargets = targets.filter(t => t.kind === 'file').map(t => t.path);
    expect(fileTargets).toContain(yamlPath);
  });
});
