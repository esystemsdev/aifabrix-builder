/**
 * @fileoverview Unit tests for health-check-url (Traefik public app + health URLs)
 */

'use strict';

jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  getRemoteServer: jest.fn(),
  getDeveloperId: jest.fn()
}));

jest.mock('../../../lib/utils/url-declarative-public-base', () => ({
  computePublicUrlBaseString: jest.fn()
}));

const config = require('../../../lib/core/config');
const { computePublicUrlBaseString } = require('../../../lib/utils/url-declarative-public-base');
const {
  joinUrlPath,
  normalizeFrontDoorPatternForHealth,
  computeTraefikPublicAppUrl,
  computeTraefikHealthCheckUrl
} = require('../../../lib/utils/health-check-url');

describe('health-check-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getRemoteServer.mockResolvedValue('');
    config.getDeveloperId.mockResolvedValue(2);
    computePublicUrlBaseString.mockReturnValue('https://dev02.builder02.local');
  });

  describe('joinUrlPath', () => {
    it('joins base path and segment with single slash', () => {
      expect(joinUrlPath('https://h.example', 'miso')).toBe('https://h.example/miso');
      expect(joinUrlPath('/auth', '/health/ready')).toBe('/auth/health/ready');
    });
  });

  describe('normalizeFrontDoorPatternForHealth', () => {
    it('strips wildcard suffix from pattern', () => {
      expect(normalizeFrontDoorPatternForHealth('/miso/*')).toBe('/miso');
    });
  });

  describe('computeTraefikPublicAppUrl', () => {
    const fdApp = {
      port: 3000,
      frontDoorRouting: {
        enabled: true,
        pattern: '/miso/*',
        host: 'dev${developerId}.builder02.local',
        tls: true
      }
    };

    it('returns null when appConfig is null', async() => {
      await expect(computeTraefikPublicAppUrl('app', 3200, null)).resolves.toBeNull();
    });

    it('returns null when front door is disabled', async() => {
      config.getConfig.mockResolvedValue({ traefik: true });
      await expect(
        computeTraefikPublicAppUrl('app', 3200, {
          ...fdApp,
          frontDoorRouting: { ...fdApp.frontDoorRouting, enabled: false }
        })
      ).resolves.toBeNull();
    });

    it('returns null when traefik is off in user config', async() => {
      config.getConfig.mockResolvedValue({ traefik: false, tlsEnabled: false });
      await expect(computeTraefikPublicAppUrl('app', 3200, fdApp)).resolves.toBeNull();
    });

    it('returns null when front door pattern is missing', async() => {
      config.getConfig.mockResolvedValue({ traefik: true });
      await expect(
        computeTraefikPublicAppUrl('app', 3200, {
          port: 3000,
          frontDoorRouting: { enabled: true, host: 'h', tls: true }
        })
      ).resolves.toBeNull();
    });

    it('returns public base joined with mount path when Traefik and front door apply', async() => {
      config.getConfig.mockResolvedValue({ traefik: true, tlsEnabled: true });
      await expect(computeTraefikPublicAppUrl('miso-controller', 3200, fdApp)).resolves.toBe(
        'https://dev02.builder02.local/miso'
      );
      expect(computePublicUrlBaseString).toHaveBeenCalledWith(
        expect.objectContaining({
          traefik: true,
          pathActive: true,
          hostTemplate: fdApp.frontDoorRouting.host
        })
      );
    });
  });

  describe('computeTraefikHealthCheckUrl', () => {
    it('appends healthCheck.path to public app base', async() => {
      config.getConfig.mockResolvedValue({ traefik: true, tlsEnabled: true });
      const app = {
        port: 3000,
        healthCheck: { path: '/health' },
        frontDoorRouting: {
          enabled: true,
          pattern: '/miso/*',
          host: 'dev${developerId}.builder02.local',
          tls: true
        }
      };
      await expect(computeTraefikHealthCheckUrl('miso-controller', 3200, app)).resolves.toBe(
        'https://dev02.builder02.local/miso/health'
      );
    });
  });
});
