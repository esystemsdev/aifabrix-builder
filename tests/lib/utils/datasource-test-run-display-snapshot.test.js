/**
 * @fileoverview Golden TTY output for DatasourceTestRun (plan §12 / tests-snapshots).
 */

'use strict';

const { formatDatasourceTestRunTTY } = require('../../../lib/utils/datasource-test-run-display');

/** Same fixture as AJV tests — require() so path resolves from this file regardless of cwd. */
const fixtureRich = require('../../fixtures/datasource-test-run-rich.json');

function stripAnsi(s) {
  const esc = String.fromCharCode(27);
  return String(s).replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '');
}

describe('datasource-test-run-display snapshots', () => {
  it('formatDatasourceTestRunTTY stable fixture', () => {
    expect(stripAnsi(formatDatasourceTestRunTTY(fixtureRich))).toMatchSnapshot();
  });
});
