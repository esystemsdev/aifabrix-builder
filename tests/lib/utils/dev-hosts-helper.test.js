/**
 * @fileoverview Tests for dev-hosts-helper
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  hostnameFromServerUrl,
  hostsNamesForDevInit,
  perDeveloperServerDisplayUrl,
  isValidIpv4,
  hostsFileHasHostname,
  runOptionalHostsSetup
} = require('../../../lib/utils/dev-hosts-helper');

describe('dev-hosts-helper', () => {
  describe('hostnameFromServerUrl', () => {
    it('extracts hostname', () => {
      expect(hostnameFromServerUrl('https://builder02.local')).toBe('builder02.local');
      expect(hostnameFromServerUrl('https://builder02.local:8443/api')).toBe('builder02.local');
    });

    it('throws on invalid URL', () => {
      expect(() => hostnameFromServerUrl('not-a-url')).toThrow('Invalid --server URL');
    });
  });

  describe('isValidIpv4', () => {
    it('accepts valid IPv4', () => {
      expect(isValidIpv4('192.168.1.25')).toBe(true);
      expect(isValidIpv4('10.0.0.1')).toBe(true);
      expect(isValidIpv4('255.255.255.255')).toBe(true);
    });

    it('rejects invalid', () => {
      expect(isValidIpv4('256.1.1.1')).toBe(false);
      expect(isValidIpv4('')).toBe(false);
      expect(isValidIpv4('::1')).toBe(false);
    });
  });

  describe('hostsFileHasHostname', () => {
    it('detects existing mapping', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-hosts-'));
      const p = path.join(dir, 'hosts');
      fs.writeFileSync(p, '# comment\n192.168.1.1 gateway\n192.168.1.25 builder02.local\n', 'utf8');
      expect(hostsFileHasHostname(p, 'builder02.local')).toBe(true);
      expect(hostsFileHasHostname(p, 'other.local')).toBe(false);
      fs.unlinkSync(p);
      fs.rmdirSync(dir);
    });

    it('returns false for missing file', () => {
      const p = path.join(os.tmpdir(), `no-hosts-${Date.now()}`);
      expect(hostsFileHasHostname(p, 'x')).toBe(false);
    });
  });

  describe('hostsNamesForDevInit', () => {
    it('returns primary only when developerId is missing', () => {
      expect(hostsNamesForDevInit(undefined, 'builder02.local')).toEqual(['builder02.local']);
      expect(hostsNamesForDevInit('', 'builder02.local')).toEqual(['builder02.local']);
    });

    it('appends devNN.primary when id set and primary is not already devNN', () => {
      expect(hostsNamesForDevInit('02', 'builder02.local')).toEqual([
        'builder02.local',
        'dev02.builder02.local'
      ]);
    });

    it('does not append when primary is an IPv4', () => {
      expect(hostsNamesForDevInit('02', '192.168.1.25')).toEqual(['192.168.1.25']);
    });

    it('does not double-prefix when primary already looks like devNN.zone', () => {
      expect(hostsNamesForDevInit('02', 'dev02.builder02.local')).toEqual(['dev02.builder02.local']);
    });
  });

  describe('perDeveloperServerDisplayUrl', () => {
    it('returns https URL with devNN host when applicable', () => {
      expect(perDeveloperServerDisplayUrl('02', 'https://builder02.local')).toBe('https://dev02.builder02.local');
    });

    it('preserves non-default port', () => {
      expect(perDeveloperServerDisplayUrl('02', 'https://builder02.local:8443')).toBe('https://dev02.builder02.local:8443');
    });

    it('returns null when no per-dev hostname', () => {
      expect(perDeveloperServerDisplayUrl(undefined, 'https://builder02.local')).toBeNull();
      expect(perDeveloperServerDisplayUrl('02', 'https://192.168.1.25')).toBeNull();
    });
  });

  describe('runOptionalHostsSetup', () => {
    it('throws on invalid --hosts-ip', async() => {
      const logger = { log: jest.fn() };
      await expect(
        runOptionalHostsSetup({
          baseUrl: 'https://builder02.local',
          hostsIp: '999.1.1.1',
          skipConfirm: true,
          logger
        })
      ).rejects.toThrow('Invalid --hosts-ip');
    });
  });
});
