/**
 * @fileoverview Tests for lib/utils/datasource-test-run-exit.js
 */

const {
  computeExitCodeFromDatasourceTestRun,
  exitCodeForPollTimeout
} = require('../../../lib/utils/datasource-test-run-exit');

describe('datasource-test-run-exit', () => {
  it('fail → 1', () => {
    expect(computeExitCodeFromDatasourceTestRun({ status: 'fail' })).toBe(1);
  });

  it('warn → 0 unless warningsAsErrors', () => {
    expect(computeExitCodeFromDatasourceTestRun({ status: 'warn' })).toBe(0);
    expect(
      computeExitCodeFromDatasourceTestRun({ status: 'warn' }, { warningsAsErrors: true })
    ).toBe(1);
  });

  it('requireCert missing certificate → 2', () => {
    expect(
      computeExitCodeFromDatasourceTestRun({ status: 'ok' }, { requireCert: true })
    ).toBe(2);
  });

  it('requireCert not_passed → 2', () => {
    expect(
      computeExitCodeFromDatasourceTestRun(
        { status: 'ok', certificate: { status: 'not_passed' } },
        { requireCert: true }
      )
    ).toBe(2);
  });

  it('requireCert passed → 0', () => {
    expect(
      computeExitCodeFromDatasourceTestRun(
        { status: 'ok', certificate: { status: 'passed' } },
        { requireCert: true }
      )
    ).toBe(0);
  });

  it('invalid body → 3', () => {
    expect(computeExitCodeFromDatasourceTestRun(null)).toBe(3);
  });

  it('exitCodeForPollTimeout', () => {
    expect(exitCodeForPollTimeout({ status: 'fail' })).toBe(1);
    expect(exitCodeForPollTimeout({ status: 'ok' })).toBe(3);
  });
});
