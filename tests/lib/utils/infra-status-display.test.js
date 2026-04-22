/**
 * @fileoverview Tests for infra status display (aligned with dev show TLS / scoped labels)
 */

'use strict';

jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn(),
  getCurrentEnvironment: jest.fn(),
  getTlsEnabled: jest.fn(),
  getRemoteServer: jest.fn(),
  getUseEnvironmentScopedResources: jest.fn(),
  getTraefikEnabled: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const {
  formatInfraStatusTitleLine,
  loadInfraStatusSummary,
  logInfraStatusConfigurationSummary
} = require('../../../lib/utils/infra-status-display');

describe('infra-status-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatInfraStatusTitleLine', () => {
    it('includes dev handle and remote hostname when remote URL is set', () => {
      expect(formatInfraStatusTitleLine('2', 'https://builder02.local/path')).toBe(
        '📊 Infrastructure Status (dev02 @ builder02.local)'
      );
    });

    it('uses dev handle only when remote is missing', () => {
      expect(formatInfraStatusTitleLine('2', null)).toBe('📊 Infrastructure Status (dev02)');
    });
  });

  describe('loadInfraStatusSummary', () => {
    it('aggregates config fields', async() => {
      config.getDeveloperId.mockResolvedValue('1');
      config.getCurrentEnvironment.mockResolvedValue('tst');
      config.getTlsEnabled.mockResolvedValue(true);
      config.getRemoteServer.mockResolvedValue('https://x.example');
      config.getUseEnvironmentScopedResources.mockResolvedValue(true);
      config.getTraefikEnabled.mockResolvedValue(false);

      const s = await loadInfraStatusSummary();
      expect(s).toEqual({
        devIdStr: '1',
        environment: 'tst',
        tlsEnabled: true,
        remoteServer: 'https://x.example',
        useScoped: true,
        traefikEnabled: false
      });
    });
  });

  describe('logInfraStatusConfigurationSummary', () => {
    it('logs TLS/SSL, Traefik, environment (uppercase), and scoped rows', () => {
      logInfraStatusConfigurationSummary({
        remoteServer: 'https://h',
        tlsEnabled: true,
        traefikEnabled: true,
        environment: 'dev',
        useScoped: false
      });
      expect(logger.log).toHaveBeenCalledWith('⚙️ Configuration');
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/TLS\/SSL\s+ON 🔒/));
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/Traefik proxy\s+ON 🟢/));
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/Environment\s+DEV/));
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/Scoped resources\s+OFF \(DEFAULT\)/));
    });
  });
});
