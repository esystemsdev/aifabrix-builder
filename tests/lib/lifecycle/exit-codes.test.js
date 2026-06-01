/**
 * @fileoverview Tests for certification exit codes (plan 150.0).
 */

'use strict';

const { exitCodeFromVerdict } = require('../../../lib/lifecycle/exit-codes');
const { VERDICT } = require('../../../lib/lifecycle/product-model');

describe('exit-codes', () => {
  it('returns 0 for VERIFIED', () => {
    expect(exitCodeFromVerdict(VERDICT.VERIFIED)).toBe(0);
  });

  it('returns 1 for FAILED', () => {
    expect(exitCodeFromVerdict(VERDICT.FAILED)).toBe(1);
  });

  it('returns 2 for partial / NOT_VERIFIED when partial flag set', () => {
    expect(exitCodeFromVerdict(VERDICT.NOT_VERIFIED, { partial: true })).toBe(2);
  });
});
