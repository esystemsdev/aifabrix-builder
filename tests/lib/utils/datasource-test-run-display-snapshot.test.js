/**
 * @fileoverview Golden TTY output for DatasourceTestRun (plan §12 / tests-snapshots).
 */

'use strict';

const fs = require('node:fs');
const path = require('path');
const { formatDatasourceTestRunTTY } = require('../../../lib/utils/datasource-test-run-display');

function stripAnsi(s) {
  const esc = String.fromCharCode(27);
  return String(s).replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '');
}

describe('datasource-test-run-display snapshots', () => {
  it('formatDatasourceTestRunTTY stable fixture', () => {
    const raw = fs.readFileSync(
      path.join(__dirname, '../../fixtures/datasource-test-run-rich.json'),
      'utf8'
    );
    const env = JSON.parse(raw);
    expect(stripAnsi(formatDatasourceTestRunTTY(env))).toMatchSnapshot();
  });
});
