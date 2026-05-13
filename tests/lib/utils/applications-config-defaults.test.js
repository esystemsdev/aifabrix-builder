/**
 * @fileoverview applications.*.reload / proxy defaults from config.yaml
 */

'use strict';

const {
  isApplicationsReloadDefaultOn,
  getApplicationsRunProxyHint,
  isDeclarativeTraefikUrlsEnabled
} = require('../../../lib/utils/applications-config-defaults');

describe('applications-config-defaults', () => {
  it('returns false when applications missing or reload not true', () => {
    expect(isApplicationsReloadDefaultOn(null, 'a')).toBe(false);
    expect(isApplicationsReloadDefaultOn({}, 'a')).toBe(false);
    expect(isApplicationsReloadDefaultOn({ applications: {} }, 'a')).toBe(false);
    expect(isApplicationsReloadDefaultOn({ applications: { a: {} } }, 'a')).toBe(false);
    expect(isApplicationsReloadDefaultOn({ applications: { a: { reload: false } } }, 'a')).toBe(false);
  });

  it('returns true when applications.<key>.reload is true', () => {
    const cfg = { applications: { 'miso-controller': { reload: true } } };
    expect(isApplicationsReloadDefaultOn(cfg, 'miso-controller')).toBe(true);
  });

  describe('getApplicationsRunProxyHint', () => {
    it('returns false when applications missing or entry missing', () => {
      expect(getApplicationsRunProxyHint(null, 'a')).toBe(false);
      expect(getApplicationsRunProxyHint({}, 'a')).toBe(false);
      expect(getApplicationsRunProxyHint({ applications: {} }, 'a')).toBe(false);
      expect(getApplicationsRunProxyHint({ applications: { a: {} } }, 'a')).toBe(false);
    });

    it('returns false when applications.<key>.proxy is false', () => {
      const cfg = { applications: { x: { proxy: false } } };
      expect(getApplicationsRunProxyHint(cfg, 'x')).toBe(false);
    });

    it('returns true when applications.<key>.proxy is true', () => {
      const cfg = { applications: { x: { proxy: true } } };
      expect(getApplicationsRunProxyHint(cfg, 'x')).toBe(true);
    });

    it('migrates legacy noProxy: true to false', () => {
      const cfg = { applications: { x: { noProxy: true } } };
      expect(getApplicationsRunProxyHint(cfg, 'x')).toBe(false);
    });

    it('migrates legacy noProxy: false to true when proxy absent', () => {
      const cfg = { applications: { x: { noProxy: false } } };
      expect(getApplicationsRunProxyHint(cfg, 'x')).toBe(true);
    });

    it('prefers explicit proxy over legacy noProxy', () => {
      const cfg = { applications: { x: { noProxy: false, proxy: false } } };
      expect(getApplicationsRunProxyHint(cfg, 'x')).toBe(false);
    });
  });

  describe('isDeclarativeTraefikUrlsEnabled', () => {
    it('is false when traefik is not set in user config', () => {
      expect(isDeclarativeTraefikUrlsEnabled({}, 'myapp')).toBe(false);
      expect(isDeclarativeTraefikUrlsEnabled({ traefik: false }, 'myapp')).toBe(false);
    });

    it('is false when traefik is true but app proxy hint is false (default)', () => {
      expect(isDeclarativeTraefikUrlsEnabled({ traefik: true }, 'myapp')).toBe(false);
      expect(isDeclarativeTraefikUrlsEnabled({ traefik: true, applications: { myapp: {} } }, 'myapp')).toBe(false);
      expect(isDeclarativeTraefikUrlsEnabled({ traefik: true, applications: { myapp: { proxy: false } } }, 'myapp')).toBe(
        false
      );
    });

    it('is true when traefik is true and applications.<app>.proxy is true', () => {
      const cfg = { traefik: true, applications: { myapp: { proxy: true } } };
      expect(isDeclarativeTraefikUrlsEnabled(cfg, 'myapp')).toBe(true);
    });

    it('is true for legacy noProxy false when proxy absent', () => {
      const cfg = { traefik: true, applications: { myapp: { noProxy: false } } };
      expect(isDeclarativeTraefikUrlsEnabled(cfg, 'myapp')).toBe(true);
    });
  });
});
