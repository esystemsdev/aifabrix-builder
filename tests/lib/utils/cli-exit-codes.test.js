/**
 * @fileoverview Tests for lib/utils/cli-exit-codes.js (plan 142.0).
 */

'use strict';

const {
  EXIT_OK,
  EXIT_NOT_AUTHENTICATED,
  EXIT_CLI_VERSION_INCOMPATIBLE
} = require('../../../lib/utils/cli-exit-codes');

describe('cli-exit-codes', () => {
  it('exposes canonical numeric codes 0 / 1 / 3', () => {
    expect(EXIT_OK).toBe(0);
    expect(EXIT_NOT_AUTHENTICATED).toBe(1);
    expect(EXIT_CLI_VERSION_INCOMPATIBLE).toBe(3);
  });

  it('codes are mutually distinct', () => {
    const set = new Set([EXIT_OK, EXIT_NOT_AUTHENTICATED, EXIT_CLI_VERSION_INCOMPATIBLE]);
    expect(set.size).toBe(3);
  });
});
