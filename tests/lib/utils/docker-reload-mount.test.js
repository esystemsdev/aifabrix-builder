/**
 * @fileoverview Unit tests for docker-reload-mount.js
 */

const {
  extractHostFromDockerEndpoint,
  isReloadBindMountOnEngineHost
} = require('../../../lib/utils/docker-reload-mount');

describe('docker-reload-mount', () => {
  describe('extractHostFromDockerEndpoint', () => {
    it('parses tcp host and port', () => {
      expect(extractHostFromDockerEndpoint('tcp://builder02:2376')).toBe('builder02');
      expect(extractHostFromDockerEndpoint('tcp://10.0.0.5:2376')).toBe('10.0.0.5');
    });

    it('parses bracketed IPv6', () => {
      expect(extractHostFromDockerEndpoint('tcp://[::1]:2375')).toBe('::1');
    });

    it('returns null for unix socket', () => {
      expect(extractHostFromDockerEndpoint('unix:///var/run/docker.sock')).toBeNull();
    });
  });

  describe('isReloadBindMountOnEngineHost', () => {
    it('is true when endpoint is empty or unix', () => {
      expect(isReloadBindMountOnEngineHost('')).toBe(true);
      expect(isReloadBindMountOnEngineHost(null)).toBe(true);
      expect(isReloadBindMountOnEngineHost('unix:///var/run/docker.sock')).toBe(true);
    });

    it('matches os.hostname() for tcp endpoint', () => {
      const os = require('os');
      const spy = jest.spyOn(os, 'hostname').mockReturnValue('my-host');
      try {
        expect(isReloadBindMountOnEngineHost('tcp://my-host:2376')).toBe(true);
        expect(isReloadBindMountOnEngineHost('tcp://MY-HOST:2376')).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });

    it('is false for clearly remote tcp host', () => {
      const os = require('os');
      const spy = jest.spyOn(os, 'hostname').mockReturnValue('laptop');
      try {
        expect(isReloadBindMountOnEngineHost('tcp://dev.aifabrix.dev:2376')).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
