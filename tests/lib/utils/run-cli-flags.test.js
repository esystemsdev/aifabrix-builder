/**
 * @fileoverview run-cli-flags (Commander --proxy / --no-proxy)
 */

'use strict';

const { isRunCliNoProxy } = require('../../../lib/utils/run-cli-flags');

describe('run-cli-flags', () => {
  it('isRunCliNoProxy is false by default', () => {
    expect(isRunCliNoProxy({})).toBe(false);
    expect(isRunCliNoProxy({ proxy: true })).toBe(false);
    expect(isRunCliNoProxy(undefined)).toBe(false);
  });

  it('isRunCliNoProxy is true when Commander sets proxy false (--no-proxy)', () => {
    expect(isRunCliNoProxy({ proxy: false })).toBe(true);
  });

  it('isRunCliNoProxy is true when explicit --no-proxy sets noProxy', () => {
    expect(isRunCliNoProxy({ proxy: true, noProxy: true })).toBe(true);
    expect(isRunCliNoProxy({ noProxy: true })).toBe(true);
  });
});
