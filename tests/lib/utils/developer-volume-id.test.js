/**
 * @fileoverview Tests for lib/utils/developer-volume-id.js
 */

'use strict';

const { collectDeveloperVolumeIdSuffixes } = require('../../../lib/utils/developer-volume-id');

describe('lib/utils/developer-volume-id', () => {
  it('returns padded and unpadded suffixes for single-digit ids', () => {
    expect(collectDeveloperVolumeIdSuffixes('6')).toEqual(['6', '06']);
    expect(collectDeveloperVolumeIdSuffixes(6)).toEqual(['6', '06']);
  });

  it('preserves zero-padded developer ids', () => {
    expect(collectDeveloperVolumeIdSuffixes('06')).toEqual(['6', '06']);
  });

  it('returns 0 for developer id 0', () => {
    expect(collectDeveloperVolumeIdSuffixes(0)).toEqual(['0']);
  });
});
