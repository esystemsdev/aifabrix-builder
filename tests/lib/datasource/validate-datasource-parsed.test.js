/**
 * @fileoverview Tests for validateDatasourceParsed (in-memory datasource validation)
 *
 * Isolated Jest project (`validate-datasource-parsed` in jest.projects.js): other suites spy on
 * {@link module:lib/internal/fs-real-sync}; a dedicated process avoids flaky schema loads.
 */

const { validateDatasourceParsed } = require('../../../lib/datasource/validate');

describe('validateDatasourceParsed', () => {
  it('rejects non-objects', () => {
    const r = validateDatasourceParsed(null);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects empty object (schema required fields)', () => {
    const r = validateDatasourceParsed({});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
