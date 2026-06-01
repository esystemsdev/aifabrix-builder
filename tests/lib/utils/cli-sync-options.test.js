'use strict';

const { cliOptsSkipSync } = require('../../../lib/utils/cli-sync-options');

describe('cli-sync-options', () => {
  it('returns false for empty options', () => {
    expect(cliOptsSkipSync(null)).toBe(false);
    expect(cliOptsSkipSync(undefined)).toBe(false);
  });

  it('detects noSync: true', () => {
    expect(cliOptsSkipSync({ noSync: true })).toBe(true);
  });

  it('detects sync: false from Commander --no-sync', () => {
    expect(cliOptsSkipSync({ sync: false })).toBe(true);
  });

  it('detects --no-sync in rawArgs', () => {
    expect(cliOptsSkipSync({}, { rawArgs: ['node', 'aifabrix', 'verify-trust', 'app', '--no-sync'] })).toBe(
      true
    );
  });

  it('returns false when sync is true and no flag', () => {
    expect(cliOptsSkipSync({ sync: true, noSync: false })).toBe(false);
  });
});
