/**
 * @fileoverview Tests for lib/utils/datasource-test-run-report-version.js
 */

const {
  parseMajor,
  getReportVersionStderrMessage,
  SUPPORTED_MAJOR
} = require('../../../lib/utils/datasource-test-run-report-version');

describe('datasource-test-run-report-version', () => {
  it('parseMajor', () => {
    expect(parseMajor('1.2.3')).toBe(1);
    expect(parseMajor('v2.0.0')).toBe(2);
    expect(parseMajor('')).toBeNull();
  });

  it('no message for supported major', () => {
    expect(getReportVersionStderrMessage(`${SUPPORTED_MAJOR}.0.0`)).toBeNull();
    expect(getReportVersionStderrMessage(`${SUPPORTED_MAJOR - 1}.9.0`)).toBeNull();
  });

  it('info when major newer than supported', () => {
    const m = getReportVersionStderrMessage(`${SUPPORTED_MAJOR + 1}.0.0`);
    expect(m && m.level).toBe('info');
  });
});
