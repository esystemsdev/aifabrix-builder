/**
 * @fileoverview Tests for local-data-paths (plan 144)
 */

'use strict';

const {
  computeEntitySuffix,
  defaultDataBasename,
  inferFormatFromPath
} = require('../../../lib/datasource/local-data-paths');

describe('local-data-paths', () => {
  it('computeEntitySuffix strips systemKey prefix', () => {
    expect(computeEntitySuffix('hubspot-test', 'hubspot-test-company')).toBe('company');
  });

  it('computeEntitySuffix uses last segment when prefix does not match', () => {
    expect(computeEntitySuffix('other', 'my-datasource-users')).toBe('users');
  });

  it('defaultDataBasename follows naming convention', () => {
    expect(defaultDataBasename('hubspot-test', 'company')).toBe('hubspot-test-data-company');
  });

  it('inferFormatFromPath detects ndjson', () => {
    expect(inferFormatFromPath('/tmp/rows.ndjson')).toBe('ndjson');
    expect(inferFormatFromPath('/tmp/rows.json')).toBe('json');
  });
});
