/**
 * @fileoverview Tests for datasource-test-run-tty-log (JSON / summary / TTY + debug appendix wiring).
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/datasource-test-run-debug-display', () => ({
  resolveDebugDisplayMode: jest.fn(() => null),
  formatDatasourceTestRunDebugBlock: jest.fn(() => '')
}));

const logger = require('../../../lib/utils/logger');
const { printDatasourceTestRunForTTY, logEnvelopeForInteractiveCli } = require('../../../lib/utils/datasource-test-run-tty-log');

function stripAnsi(s) {
  const ESC = String.fromCharCode(27);
  const re = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
  return String(s).replace(re, '');
}

function envelope() {
  return {
    datasourceKey: 'ds.one',
    systemKey: 'sys',
    runType: 'test',
    status: 'ok',
    developer: { executiveSummary: '✔ ok' }
  };
}

describe('datasource-test-run-tty-log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('printDatasourceTestRunForTTY', () => {
    it('prints JSON when options.json', () => {
      const e = envelope();
      printDatasourceTestRunForTTY(e, { json: true });
      expect(logger.log).toHaveBeenCalledWith(JSON.stringify(e));
    });

    it('prints summary line when options.summary', () => {
      printDatasourceTestRunForTTY(envelope(), { summary: true });
      expect(logger.log).toHaveBeenCalledTimes(1);
      const line = String(logger.log.mock.calls[0][0]);
      expect(line).toContain('ds.one');
      expect(line).toContain('OK');
    });

    it('prints full TTY block when not json or summary', () => {
      printDatasourceTestRunForTTY(envelope(), {});
      expect(logger.log).toHaveBeenCalledTimes(1);
      const block = stripAnsi(String(logger.log.mock.calls[0][0]));
      expect(block).toContain('Datasource:');
      expect(block).toContain('ds.one');
      expect(block).toContain('sys');
      expect(block).toContain('Verdict:');
    });
  });

  describe('logEnvelopeForInteractiveCli', () => {
    it('no-ops on null envelope', () => {
      logEnvelopeForInteractiveCli(null, {});
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('prints TTY for a valid envelope', () => {
      logEnvelopeForInteractiveCli(envelope(), {});
      expect(logger.log).toHaveBeenCalled();
      expect(String(logger.log.mock.calls[0][0])).toContain('ds.one');
    });
  });
});
