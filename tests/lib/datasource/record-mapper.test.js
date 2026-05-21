/**
 * @fileoverview Tests for record-mapper (plan 144)
 */

'use strict';

const {
  isCanonicalBulkRecord,
  mapPayloadToBulkRecord,
  normalizeRecordsForBulk
} = require('../../../lib/datasource/record-mapper');

describe('record-mapper', () => {
  const datasource = {
    primaryKey: ['externalId'],
    resourceType: 'item',
    labelKey: ['name']
  };

  it('detects canonical bulk records', () => {
    expect(
      isCanonicalBulkRecord({
        key: 'k1',
        displayName: 'One',
        recordType: 'item',
        metadata: { externalId: 'k1' }
      })
    ).toBe(true);
  });

  it('maps payload-only rows', () => {
    const row = mapPayloadToBulkRecord(datasource, {
      externalId: 'ext-1',
      name: 'Row one',
      email: 'a@example.com'
    });
    expect(row.key).toBe('ext-1');
    expect(row.recordType).toBe('item');
    expect(row.displayName).toBe('Row one');
    expect(row.metadata.email).toBe('a@example.com');
  });

  it('builds composite keys as field=value pairs', () => {
    const compositeDs = {
      primaryKey: ['country', 'id'],
      resourceType: 'item'
    };
    const row = mapPayloadToBulkRecord(compositeDs, { country: 'FI', id: '9' });
    expect(row.key).toBe('country=FI,id=9');
  });

  it('normalizes mixed file content', () => {
    const rows = normalizeRecordsForBulk(
      [
        { externalId: 'a', name: 'A' },
        {
          key: 'b',
          displayName: 'B',
          recordType: 'item',
          metadata: { externalId: 'b' }
        }
      ],
      datasource
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].key).toBe('a');
    expect(rows[1].key).toBe('b');
  });
});
