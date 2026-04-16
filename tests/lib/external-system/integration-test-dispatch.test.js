/**
 * @fileoverview Tests for integration-test-dispatch.js
 */

const { shouldUseSystemLevelIntegrationCall } = require('../../../lib/external-system/integration-test-dispatch');

describe('integration-test-dispatch', () => {
  const two = [{ data: { key: 'a' } }, { data: { key: 'b' } }];

  it('uses system call for multiple datasources by default', () => {
    expect(shouldUseSystemLevelIntegrationCall({}, two, null)).toBe(true);
  });

  it('uses per-datasource when --per-datasource', () => {
    expect(shouldUseSystemLevelIntegrationCall({ perDatasource: true }, two, null)).toBe(false);
  });

  it('uses per-datasource when datasource filter set', () => {
    expect(shouldUseSystemLevelIntegrationCall({ datasource: 'a' }, two, null)).toBe(false);
  });

  it('uses per-datasource when custom payload provided', () => {
    expect(shouldUseSystemLevelIntegrationCall({}, two, { x: 1 })).toBe(false);
  });

  it('does not use system call for single datasource', () => {
    expect(shouldUseSystemLevelIntegrationCall({}, [two[0]], null)).toBe(false);
  });
});
