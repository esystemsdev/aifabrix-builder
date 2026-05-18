/**
 * @fileoverview Tests for auth status Commander help text (plan 142.0).
 */

const { AUTH_STATUS_HELP_AFTER } = require('../../../lib/cli/setup-auth');

describe('setup-auth help (plan 142.0)', () => {
  it('AUTH_STATUS_HELP_AFTER documents --validate exit codes 1 and 3', () => {
    expect(AUTH_STATUS_HELP_AFTER).toContain('Exit codes (--validate only)');
    expect(AUTH_STATUS_HELP_AFTER).toMatch(/\b1\b.*Not authenticated/s);
    expect(AUTH_STATUS_HELP_AFTER).toMatch(/\b3\b.*Builder CLI/s);
    expect(AUTH_STATUS_HELP_AFTER).toContain('dataplane-version');
    expect(AUTH_STATUS_HELP_AFTER).toContain('dataplane-min-cli-version');
  });
});
