/**
 * @fileoverview Tests for dev-server-https (merged CA + JSON over https)
 */

const tls = require('tls');
const { mergedCaForDevServer, shouldUseMtlsForUrl } = require('../../../lib/api/dev-server-https');

describe('dev-server-https', () => {
  describe('mergedCaForDevServer', () => {
    it('returns null for empty or non-string', () => {
      expect(mergedCaForDevServer('')).toBeNull();
      expect(mergedCaForDevServer('   ')).toBeNull();
      expect(mergedCaForDevServer(null)).toBeNull();
    });

    it('appends trimmed PEM after Node rootCertificates', () => {
      const extra = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
      const merged = mergedCaForDevServer(extra);
      expect(Array.isArray(merged)).toBe(true);
      expect(merged.length).toBe(tls.rootCertificates.length + 1);
      expect(merged[merged.length - 1]).toBe(extra);
    });
  });

  describe('shouldUseMtlsForUrl', () => {
    it('is false without key or for http URL', () => {
      expect(shouldUseMtlsForUrl('https://x/api', '')).toBe(false);
      expect(shouldUseMtlsForUrl('http://x/api', '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----')).toBe(
        false
      );
    });

    it('is true for https URL when key is non-empty string', () => {
      const key = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';
      expect(shouldUseMtlsForUrl('https://builder.example.com/api/dev/settings', key)).toBe(true);
    });
  });
});
