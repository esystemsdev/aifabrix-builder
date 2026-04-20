/**
 * @fileoverview runLogViewer with logType test (via --file path).
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const os = require('os');

const logger = require('../../../lib/utils/logger');
const { runLogViewer } = require('../../../lib/datasource/log-viewer');

describe('runLogViewer (structural / test)', () => {
  let tmpFile;

  beforeEach(() => {
    jest.clearAllMocks();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logv-run-'));
    tmpFile = path.join(dir, 'test-2026-04-16T00-00-00-000Z.json');
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        request: { datasourceKey: 'ds-1', runType: 'test', includeDebug: true },
        response: { status: 'ok', reportCompleteness: 'full', runId: 'run-x' }
      }),
      'utf8'
    );
  });

  afterEach(() => {
    if (tmpFile) {
      try {
        fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
      } catch (_) { /* ignore */ }
    }
  });

  it('formats structural log when --file points at saved JSON', async() => {
    await runLogViewer('ignored-key', { file: tmpFile, logType: 'test' });
    expect(logger.log).toHaveBeenCalled();
    const joined = logger.log.mock.calls.map(c => String(c[0] ?? '')).join('\n');
    expect(joined).toContain('Structural validation log');
    expect(joined).toContain('ds-1');
    expect(joined).toContain('ok');
  });

  it('rejects invalid JSON', async() => {
    fs.writeFileSync(tmpFile, '{ not json', 'utf8');
    await expect(
      runLogViewer('k', { file: tmpFile, logType: 'test' })
    ).rejects.toThrow(/Invalid JSON/);
  });
});
