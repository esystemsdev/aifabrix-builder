/**
 * @fileoverview Tests for dev-show-display (grouped output, remote gating)
 */

'use strict';

jest.mock('fs');
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/core/config', () => ({
  getCurrentEnvironment: jest.fn(),
  getControllerUrl: jest.fn(),
  getFormat: jest.fn(),
  getUseEnvironmentScopedResources: jest.fn(),
  getAifabrixSecretsPath: jest.fn(),
  getRemoteServer: jest.fn(),
  getDockerEndpoint: jest.fn(),
  getDockerTlsSkipVerify: jest.fn(),
  getUserMutagenFolder: jest.fn(),
  getSyncSshUser: jest.fn(),
  getSyncSshHost: jest.fn(),
  CONFIG_DIR: '/mock/.aifabrix'
}));

jest.mock('../../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/mock/home'),
  getAifabrixWork: jest.fn(() => null)
}));

jest.mock('../../../lib/utils/dev-cert-helper', () => ({
  getCertDir: jest.fn((dir, id) => `/certs/${id}`),
  getCertValidNotAfter: jest.fn(),
  getCertSubjectDeveloperId: jest.fn(),
  developerIdsMatchNumeric: jest.fn()
}));

const fs = require('fs');
const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const devConfig = require('../../../lib/utils/dev-config');
const certHelper = require('../../../lib/utils/dev-cert-helper');
const { displayDevConfig } = require('../../../lib/commands/dev-show-display');

const HEADER_NO_REMOTE = '\n🔧 AI Fabrix • Developer Configuration\n';
const EM = '\u2013';
const LABEL = 18;
function row(label, value) {
  const v = value === null || value === undefined || value === '' ? EM : String(value);
  return `  ${label.padEnd(LABEL)} ${v}`;
}

describe('dev-show-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    devConfig.getDevPorts.mockReturnValue({
      app: 3100,
      postgres: 5532,
      redis: 6479,
      pgadmin: 5150,
      redisCommander: 8181
    });
    config.getCurrentEnvironment.mockResolvedValue('dev');
    config.getControllerUrl.mockResolvedValue(null);
    config.getFormat.mockResolvedValue('yaml');
    config.getUseEnvironmentScopedResources.mockResolvedValue(false);
    config.getAifabrixSecretsPath.mockResolvedValue(null);
    config.getRemoteServer.mockResolvedValue(null);
    config.getDockerEndpoint.mockResolvedValue(null);
    config.getDockerTlsSkipVerify.mockResolvedValue(false);
    config.getUserMutagenFolder.mockResolvedValue(null);
    config.getSyncSshUser.mockResolvedValue(null);
    config.getSyncSshHost.mockResolvedValue(null);
  });

  describe('without remote-server', () => {
    it('uses plain header and omits Remote and Identity (cert not read)', async() => {
      await displayDevConfig('02');

      expect(logger.log).toHaveBeenCalledWith(HEADER_NO_REMOTE);
      expect(logger.log).toHaveBeenCalledWith('👤 Developer');
      expect(logger.log).toHaveBeenCalledWith(row('ID', '02'));
      expect(logger.log).toHaveBeenCalledWith('🚀 Ports');
      expect(logger.log).toHaveBeenCalledWith('⚙️ Configuration');
      expect(logger.log).toHaveBeenCalledWith('📁 Paths');
      expect(logger.log).toHaveBeenCalledWith('🔗 Integrations');

      const allLogs = logger.log.mock.calls.map((c) => c[0]);
      expect(allLogs.some((m) => m === '🌐 Remote')).toBe(false);
      expect(allLogs.some((m) => m === '🔐 Identity')).toBe(false);

      expect(certHelper.getCertValidNotAfter).not.toHaveBeenCalled();
      expect(certHelper.getCertSubjectDeveloperId).not.toHaveBeenCalled();
      expect(certHelper.developerIdsMatchNumeric).not.toHaveBeenCalled();
    });

    it('treats whitespace-only remote-server as absent', async() => {
      config.getRemoteServer.mockResolvedValue('   \t  ');

      await displayDevConfig('1');

      expect(logger.log).toHaveBeenCalledWith(HEADER_NO_REMOTE);
      const allLogs = logger.log.mock.calls.map((c) => c[0]);
      expect(allLogs.some((m) => m === '🌐 Remote')).toBe(false);
      expect(certHelper.getCertSubjectDeveloperId).not.toHaveBeenCalled();
    });
  });

  describe('with remote-server', () => {
    it('adds header context, Remote, Identity, TLS Verify, and reads cert', async() => {
      config.getRemoteServer.mockResolvedValue('https://builder.example');
      config.getDockerEndpoint.mockResolvedValue('tcp://127.0.0.1:2376');
      config.getSyncSshUser.mockResolvedValue('dev');
      config.getSyncSshHost.mockResolvedValue('host.local');
      config.getDockerTlsSkipVerify.mockResolvedValue(true);

      const certPath = '/certs/01/cert.pem';
      fs.existsSync.mockImplementation((p) => String(p).replace(/\\/g, '/') === certPath.replace(/\\/g, '/'));
      certHelper.getCertValidNotAfter.mockReturnValue(new Date(Date.now() + 86400000));
      certHelper.getCertSubjectDeveloperId.mockReturnValue('01');
      certHelper.developerIdsMatchNumeric.mockReturnValue(true);

      await displayDevConfig('01');

      expect(logger.log).toHaveBeenCalledWith(
        '\n🔧 AI Fabrix • Developer Configuration (dev01 @ builder.example)\n'
      );
      expect(logger.log).toHaveBeenCalledWith('🌐 Remote');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('https://builder.example'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('TLS Verify'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/OFF\s*$/));
      expect(logger.log).toHaveBeenCalledWith('🔐 Identity');
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/Certificate\s+VALID ✅/));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('tcp://127.0.0.1:2376'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('dev@host.local'));

      expect(certHelper.getCertValidNotAfter).toHaveBeenCalled();
      expect(certHelper.getCertSubjectDeveloperId).toHaveBeenCalled();
    });

    it('uses ON 🔒 when TLS verify is not skipped', async() => {
      config.getRemoteServer.mockResolvedValue('https://builder.example');
      config.getDockerTlsSkipVerify.mockResolvedValue(false);
      const certPath = '/certs/02/cert.pem';
      fs.existsSync.mockImplementation((p) => String(p).replace(/\\/g, '/') === certPath.replace(/\\/g, '/'));
      certHelper.getCertValidNotAfter.mockReturnValue(new Date(Date.now() + 86400000));
      certHelper.getCertSubjectDeveloperId.mockReturnValue('02');
      certHelper.developerIdsMatchNumeric.mockReturnValue(true);

      await displayDevConfig('02');

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('🔧 AI Fabrix • Developer Configuration (dev02 @ builder.example)')
      );
      const tlsLine = logger.log.mock.calls.map((c) => c[0]).find((s) => typeof s === 'string' && s.includes('TLS Verify'));
      expect(tlsLine).toBeDefined();
      expect(tlsLine).toMatch(/ON 🔒/);
    });

    it('prints mismatch block when cert CN id disagrees with config', async() => {
      config.getRemoteServer.mockResolvedValue('https://builder.example');
      const certPath = '/certs/01/cert.pem';
      fs.existsSync.mockImplementation((p) => String(p).replace(/\\/g, '/') === certPath.replace(/\\/g, '/'));
      certHelper.getCertValidNotAfter.mockReturnValue(new Date(Date.now() + 86400000));
      certHelper.getCertSubjectDeveloperId.mockReturnValue('02');
      certHelper.developerIdsMatchNumeric.mockReturnValue(false);

      await displayDevConfig('01');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('VALID ⚠️'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/Developer mismatch/));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('af dev sync'));
    });
  });
});
