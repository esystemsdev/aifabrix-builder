/**
 * @fileoverview Tests for dimension-display-helpers
 */

const { flattenRootDimensionsForDisplay } = require('../../../lib/validation/dimension-display-helpers');

describe('flattenRootDimensionsForDisplay', () => {
  it('includes local and fk root dimensions', () => {
    const out = flattenRootDimensionsForDisplay({
      market: { type: 'local', field: 'country' },
      owner: {
        type: 'fk',
        actor: 'email',
        via: [{ fk: 'hubspotOwner', dimension: 'owner' }]
      },
      team: { type: 'local', field: 'department' }
    });

    expect(out).toEqual({
      market: 'metadata.country',
      owner: 'fk:hubspotOwner→owner (actor: email)',
      team: 'metadata.department'
    });
  });

  it('returns empty object for non-object root', () => {
    expect(flattenRootDimensionsForDisplay(null)).toEqual({});
    expect(flattenRootDimensionsForDisplay(undefined)).toEqual({});
    expect(flattenRootDimensionsForDisplay([])).toEqual({});
  });
});
