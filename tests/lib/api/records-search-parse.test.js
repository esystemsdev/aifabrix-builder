/**
 * @fileoverview Tests for records-search-parse.js
 */

'use strict';

const { normalizeRecordsSearchClientResponse } = require('../../../lib/api/records-search-parse');

describe('records-search-parse', () => {
  it('unwraps ApiClient envelope with data/meta', () => {
    const out = normalizeRecordsSearchClientResponse({
      success: true,
      status: 200,
      data: {
        data: [{ id: '1' }],
        meta: { excluded: { abac: 2, filter: 0 }, auditRef: 'rss-x' }
      }
    });
    expect(out.success).toBe(true);
    expect(out.data).toEqual([{ id: '1' }]);
    expect(out.meta.excluded.abac).toBe(2);
    expect(out.meta.auditRef).toBe('rss-x');
  });

  it('passes through already-flat success shape', () => {
    const out = normalizeRecordsSearchClientResponse({
      success: true,
      data: [{ id: 'a' }],
      meta: { excluded: { abac: 0 } }
    });
    expect(out.data).toHaveLength(1);
  });

  it('returns failure shape unchanged', () => {
    const raw = { success: false, error: 'denied' };
    expect(normalizeRecordsSearchClientResponse(raw)).toBe(raw);
  });
});
