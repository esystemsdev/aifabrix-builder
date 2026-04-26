/**
 * @fileoverview Tests for datasource declaration order vs system JSON (schema-resolver).
 * Isolated Jest project `schema-resolver-order`: other suites use jest.mock('fs'); real
 * tempdir reads here must not share a worker with those mocks.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { orderDatasourceFileNamesBySystemKeys } = require('../../../lib/utils/schema-resolver');

describe('orderDatasourceFileNamesBySystemKeys', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-schema-order-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('orders datasource filenames by system dataSources key order', () => {
    fs.writeFileSync(
      path.join(dir, 'sys.json'),
      JSON.stringify({
        key: 'demo',
        dataSources: ['demo-users', 'demo-companies']
      })
    );
    fs.writeFileSync(
      path.join(dir, 'demo-datasource-companies.json'),
      JSON.stringify({ key: 'demo-companies', systemKey: 'demo' })
    );
    fs.writeFileSync(
      path.join(dir, 'demo-datasource-users.json'),
      JSON.stringify({ key: 'demo-users', systemKey: 'demo' })
    );

    const names = ['demo-datasource-companies.json', 'demo-datasource-users.json'];
    const ordered = orderDatasourceFileNamesBySystemKeys(dir, ['sys.json'], names);
    expect(ordered).toEqual(['demo-datasource-users.json', 'demo-datasource-companies.json']);
  });
});
