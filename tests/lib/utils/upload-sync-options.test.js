/**
 * @fileoverview Tests for upload-sync-options
 */

'use strict';

const { buildMinimalUploadSyncOptions, isQuietMinimalSync } = require('../../../lib/utils/upload-sync-options');

describe('upload-sync-options', () => {
  it('includes force when options.force is true', () => {
    expect(buildMinimalUploadSyncOptions({ verbose: true, force: true })).toEqual({
      minimal: true,
      verbose: false,
      silentResolve: true,
      syncMode: true,
      force: true
    });
  });

  it('omits force by default', () => {
    expect(buildMinimalUploadSyncOptions({})).toEqual({
      minimal: true,
      verbose: false,
      silentResolve: true,
      syncMode: true
    });
  });

  it('isQuietMinimalSync is true for minimal or syncMode', () => {
    expect(isQuietMinimalSync({ minimal: true, verbose: false })).toBe(true);
    expect(isQuietMinimalSync({ syncMode: true, verbose: false })).toBe(true);
    expect(isQuietMinimalSync({ minimal: true, verbose: true })).toBe(true);
    expect(isQuietMinimalSync({ syncMode: true, verbose: true })).toBe(true);
    expect(isQuietMinimalSync({ minimal: false })).toBe(false);
  });
});
