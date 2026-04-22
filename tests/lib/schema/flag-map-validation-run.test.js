/**
 * @fileoverview flag-map-validation-run.json is valid JSON with operationId runValidation.
 */

const map = require('../../../lib/schema/flag-map-validation-run.json');

describe('flag-map-validation-run.json', () => {
  it('has operationId and flags array', () => {
    expect(map.operationId).toBe('runValidation');
    expect(Array.isArray(map.flags)).toBe(true);
    expect(map.flags.length).toBeGreaterThan(3);
  });
});
