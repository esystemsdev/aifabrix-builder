/**
 * @fileoverview Tests for JSON Pointer token escaping
 */

const {
  escapeJsonPointerToken,
  jsonPointerPath
} = require('../../../lib/datasource/capability/json-pointer');

describe('json-pointer', () => {
  it('escapeJsonPointerToken escapes tilde and slash', () => {
    expect(escapeJsonPointerToken('a/b')).toBe('a~1b');
    expect(escapeJsonPointerToken('a~b')).toBe('a~0b');
  });

  it('jsonPointerPath joins segments', () => {
    expect(jsonPointerPath('openapi', 'operations', 'createBasic')).toBe(
      '/openapi/operations/createBasic'
    );
  });
});
