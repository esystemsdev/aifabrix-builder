/**
 * @fileoverview Tests for test-trust CLI option normalization.
 */

const { normalizeTestTrustCliOptions } = require('../../../lib/commands/test-trust-cli-options');

describe('test-trust-cli-options', () => {
  it('normalizes flags from rawArgs when Commander omits booleans', () => {
    const opts = normalizeTestTrustCliOptions(
      { env: 'dev' },
      { rawArgs: ['node', 'aifabrix', 'verify-trust', 'hubspot', '-d', '-v', '--revalidate'] }
    );
    expect(opts.debug).toBe(true);
    expect(opts.verbose).toBe(true);
    expect(opts.revalidate).toBe(true);
  });

  it('keeps explicit Commander booleans', () => {
    const opts = normalizeTestTrustCliOptions(
      { debug: true, verbose: false, revalidate: true },
      { rawArgs: [] }
    );
    expect(opts.debug).toBe(true);
    expect(opts.verbose).toBe(false);
    expect(opts.revalidate).toBe(true);
  });
});
