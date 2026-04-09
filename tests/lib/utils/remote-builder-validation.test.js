/**
 * @fileoverview Tests for remote builder developer-id validation
 */

'use strict';

const {
  remoteServerHostIsNonLocalhost,
  remoteServerDisplayHost,
  assertRemoteBuilderDeveloperId
} = require('../../../lib/utils/remote-builder-validation');

describe('remote-builder-validation', () => {
  describe('remoteServerHostIsNonLocalhost', () => {
    it('returns false for empty, null, localhost, 127.0.0.1', () => {
      expect(remoteServerHostIsNonLocalhost(null)).toBe(false);
      expect(remoteServerHostIsNonLocalhost('')).toBe(false);
      expect(remoteServerHostIsNonLocalhost('   ')).toBe(false);
      expect(remoteServerHostIsNonLocalhost('http://localhost')).toBe(false);
      expect(remoteServerHostIsNonLocalhost('https://127.0.0.1')).toBe(false);
      expect(remoteServerHostIsNonLocalhost('https://[::1]/x')).toBe(false);
    });

    it('returns true for non-loopback hostnames', () => {
      expect(remoteServerHostIsNonLocalhost('https://builder02.local')).toBe(true);
      expect(remoteServerHostIsNonLocalhost('builder02.local')).toBe(true);
      expect(remoteServerHostIsNonLocalhost('http://dev.shared.example.com:443')).toBe(true);
    });
  });

  describe('remoteServerDisplayHost', () => {
    it('returns host from URL', () => {
      expect(remoteServerDisplayHost('https://builder02.local/api')).toContain('builder02.local');
    });
  });

  describe('assertRemoteBuilderDeveloperId', () => {
    it('no-op when remote-server is local or empty', () => {
      expect(() => assertRemoteBuilderDeveloperId(null, '0')).not.toThrow();
      expect(() => assertRemoteBuilderDeveloperId('', 0)).not.toThrow();
      expect(() => assertRemoteBuilderDeveloperId('http://localhost', '0')).not.toThrow();
    });

    it('throws when remote is non-local and developer id is 0', () => {
      expect(() => assertRemoteBuilderDeveloperId('https://builder02.local', '0')).toThrow(
        /Remote builder at .* requires a positive developer-id/
      );
      expect(() => assertRemoteBuilderDeveloperId('https://builder02.local', 0)).toThrow(
        /positive developer-id/
      );
    });

    it('throws when remote is non-local and id missing', () => {
      expect(() => assertRemoteBuilderDeveloperId('https://builder02.local', '')).toThrow(
        /positive developer-id/
      );
      expect(() => assertRemoteBuilderDeveloperId('https://builder02.local', null)).toThrow(
        /positive developer-id/
      );
    });

    it('throws when remote is non-local and id non-numeric', () => {
      expect(() => assertRemoteBuilderDeveloperId('https://builder02.local', 'abc')).toThrow(
        /positive developer-id/
      );
    });

    it('allows positive integer id with remote', () => {
      expect(() => assertRemoteBuilderDeveloperId('https://builder02.local', '1')).not.toThrow();
      expect(() => assertRemoteBuilderDeveloperId('https://builder02.local', 12)).not.toThrow();
    });
  });
});
