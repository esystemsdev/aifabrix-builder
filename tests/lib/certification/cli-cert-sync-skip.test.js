'use strict';

const { cliOptsSkipCertSync } = require('../../../lib/certification/cli-cert-sync-skip');

describe('cliOptsSkipCertSync', () => {
  it('is false by default', () => {
    expect(cliOptsSkipCertSync({})).toBe(false);
    expect(cliOptsSkipCertSync(undefined)).toBe(false);
  });

  it('is true for Commander --no-cert-sync (certSync false)', () => {
    expect(cliOptsSkipCertSync({ certSync: false })).toBe(true);
  });

  it('is true for legacy noCertSync', () => {
    expect(cliOptsSkipCertSync({ noCertSync: true })).toBe(true);
  });

  it('is false when certSync true (default with --no-cert-sync option registered)', () => {
    expect(cliOptsSkipCertSync({ certSync: true })).toBe(false);
  });
});
