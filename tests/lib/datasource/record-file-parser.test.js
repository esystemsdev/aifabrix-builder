/**
 * @fileoverview Tests for record-file-parser (plan 144)
 */

'use strict';

const {
  parseJsonArrayContent,
  parseNdjsonContent
} = require('../../../lib/datasource/record-file-parser');

describe('record-file-parser', () => {
  it('parses JSON array', () => {
    const rows = parseJsonArrayContent('[{"id":"1"},{"id":"2"}]');
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('1');
  });

  it('rejects non-array JSON', () => {
    expect(() => parseJsonArrayContent('{"id":"1"}')).toThrow(/top-level array/);
  });

  it('parses NDJSON skipping blank lines', () => {
    const rows = parseNdjsonContent('{"a":1}\n\n{"a":2}\n');
    expect(rows).toHaveLength(2);
  });

  it('reports NDJSON line errors', () => {
    expect(() => parseNdjsonContent('{bad}\n')).toThrow(/line 1/);
  });
});
