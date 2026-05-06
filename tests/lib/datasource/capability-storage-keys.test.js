/**
 * @fileoverview capability-storage-keys
 */

const { storageOpsKey } = require('../../../lib/datasource/capability/capability-storage-keys');

describe('storageOpsKey', () => {
  it('lowercases logical capability names', () => {
    expect(storageOpsKey('updateCountry')).toBe('updatecountry');
    expect(storageOpsKey('createCopy')).toBe('createcopy');
  });
});
