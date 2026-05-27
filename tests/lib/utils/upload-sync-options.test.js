/**
 * @fileoverview Tests for upload-sync-options
 */

'use strict';

const { buildMinimalUploadSyncOptions } = require('../../../lib/utils/upload-sync-options');

describe('upload-sync-options', () => {
  it('includes force when options.force is true', () => {
    expect(buildMinimalUploadSyncOptions({ verbose: true, force: true })).toEqual({
      minimal: true,
      verbose: true,
      force: true
    });
  });

  it('omits force by default', () => {
    expect(buildMinimalUploadSyncOptions({})).toEqual({
      minimal: true,
      verbose: false
    });
  });
});
