/**
 * @fileoverview Tests for datasource-validation-watch.js
 */

const fs = require('node:fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const { getIntegrationPath } = require('../../../lib/utils/paths');
const logger = require('../../../lib/utils/logger');
const {
  fingerprintForWatchDiff,
  formatWatchFingerprintDiff,
  buildWatchTargetList,
  debounce,
  startWatchers,
  runDatasourceValidationWatchLoop
} = require('../../../lib/utils/datasource-validation-watch');

describe('datasource-validation-watch', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dvwatch-'));
    getIntegrationPath.mockReturnValue(path.join(tmp, 'integration-app'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 15 });
    } catch {
      // ignore
    }
    jest.clearAllMocks();
    // Do not call jest.restoreAllMocks() here: it resets the jest.mock('./paths') factory fn
    // between tests and drops mockReturnValue, leaving getIntegrationPath undefined → flaky targets.
    jest.useRealTimers();
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

  it('buildWatchTargetList does not recurse into node_modules', () => {
    const intRoot = path.join(tmp, 'integration-app');
    const nm = path.join(intRoot, 'node_modules', 'pkg');
    fs.mkdirSync(nm, { recursive: true });
    fs.writeFileSync(path.join(nm, 'x.js'), '', 'utf8');

    const targets = buildWatchTargetList('myapp', [], false);
    const paths = targets.map(t => t.path);
    expect(paths.some(p => p.includes('node_modules'))).toBe(false);
    expect(paths).toContain(intRoot);
  });

  it('debounce coalesces rapid calls into one execution after delay', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('startWatchers invokes onEvent and close() stops watchers', () => {
    const close = jest.fn();
    const watchSpy = jest.spyOn(fs, 'watch').mockImplementation((_p, listener) => {
      if (typeof listener === 'function') {
        listener('change', 'f');
      }
      return { close };
    });
    const onEvent = jest.fn();
    const stop = startWatchers([{ kind: 'dir', path: path.join(tmp, 'w') }], onEvent);
    expect(onEvent).toHaveBeenCalled();
    stop();
    expect(close).toHaveBeenCalled();
    watchSpy.mockRestore();
  });

  it('runDatasourceValidationWatchLoop exits 4 when there is nothing to watch', async() => {
    getIntegrationPath.mockReturnValue(path.join(tmp, 'nonexistent-integration'));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    await runDatasourceValidationWatchLoop({
      appKey: 'app',
      runOnce: async() => ({ exitCode: 0, envelope: null })
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Watch: no directories'));
    expect(exitSpy).toHaveBeenCalledWith(4);
    exitSpy.mockRestore();
  });

  it('runDatasourceValidationWatchLoop with watchCi calls process.exit with run exit code after first run', async() => {
    const intRoot = path.join(tmp, 'integration-app');
    fs.mkdirSync(intRoot, { recursive: true });
    getIntegrationPath.mockReturnValue(intRoot);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const watchSpy = jest.spyOn(fs, 'watch').mockImplementation(() => ({ close: jest.fn() }));
    const runOnce = jest.fn().mockResolvedValue({ exitCode: 2, envelope: { status: 'fail' } });
    await runDatasourceValidationWatchLoop({
      appKey: 'app',
      watchCi: true,
      runOnce
    });
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(2);
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    watchSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
