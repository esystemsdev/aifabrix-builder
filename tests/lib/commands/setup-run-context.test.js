/**
 * @fileoverview Tests for setup-run-context flags
 */

'use strict';

const ctx = require('../../../lib/commands/setup-run-context');

describe('setup-run-context', () => {
  afterEach(() => {
    ctx.endSetupCommandFlow();
    ctx.endSetupPlatformFlow();
  });

  it('isSetupCommandFlow is true only while setup command runs', () => {
    expect(ctx.isSetupCommandFlow()).toBe(false);
    ctx.beginSetupCommandFlow();
    expect(ctx.isSetupCommandFlow()).toBe(true);
    ctx.endSetupCommandFlow();
    expect(ctx.isSetupCommandFlow()).toBe(false);
  });
});
