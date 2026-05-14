/**
 * @fileoverview Tests for restart-display.js (post-restart mount summary)
 */

'use strict';

jest.mock('../../../lib/utils/docker-exec', () => ({
  execWithDockerEnv: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  getDockerEndpoint: jest.fn(),
  getConfig: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const dockerExec = require('../../../lib/utils/docker-exec');
const config = require('../../../lib/core/config');
const { findAppBindMount, logRestartDevMountSummary } = require('../../../lib/app/restart-display');

describe('restart-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logger.log.mockRestore();
  });

  describe('findAppBindMount', () => {
    it('returns bind mount for /app', () => {
      const mounts = [
        { Type: 'volume', Name: 'data', Destination: '/mnt/data' },
        { Type: 'bind', Source: '/host/ws', Destination: '/app', RW: true }
      ];
      expect(findAppBindMount(mounts)).toEqual(mounts[1]);
    });

    it('returns null when no /app bind', () => {
      expect(findAppBindMount([{ Type: 'bind', Source: '/x', Destination: '/other' }])).toBeNull();
      expect(findAppBindMount(null)).toBeNull();
    });
  });

  describe('logRestartDevMountSummary', () => {
    it('logs direct bind when engine is co-located', async() => {
      config.getDockerEndpoint.mockResolvedValue(null);
      config.getConfig.mockResolvedValue({ applications: {} });
      dockerExec.execWithDockerEnv.mockResolvedValue({
        stdout: JSON.stringify([{ Type: 'bind', Source: '/opt/repo', Destination: '/app', RW: true }])
      });
      await logRestartDevMountSummary('aifabrix-dev02-miso-controller', 'miso-controller');
      expect(dockerExec.execWithDockerEnv).toHaveBeenCalledWith(
        expect.stringContaining('docker inspect'),
        expect.any(Object)
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dev workspace'));
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Direct bind mount on the Docker host (no Mutagen)')
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('/opt/repo'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Reload (config)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('reload off'));
    });

    it('logs remote-engine bind when docker-endpoint is remote', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://remote.example:2376');
      config.getConfig.mockResolvedValue({ applications: {} });
      dockerExec.execWithDockerEnv.mockResolvedValue({
        stdout: JSON.stringify([{ Type: 'bind', Source: '/data/sync', Destination: '/app', RW: true }])
      });
      await logRestartDevMountSummary('ctr', 'svc');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Bind mount on the Docker engine')
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Reload (config)'));
    });

    it('logs Reload (config) when inspect fails but appName is set', async() => {
      config.getConfig.mockResolvedValue({
        applications: { myapp: { reload: true } }
      });
      dockerExec.execWithDockerEnv.mockRejectedValue(new Error('boom'));
      await logRestartDevMountSummary('ctr', 'myapp');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Reload (config)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('reload on'));
    });

    it('no-op when inspect fails and no appName', async() => {
      dockerExec.execWithDockerEnv.mockRejectedValue(new Error('boom'));
      await logRestartDevMountSummary('ctr');
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('logs Reload when no /app bind but appName is set', async() => {
      config.getDockerEndpoint.mockResolvedValue(null);
      config.getConfig.mockResolvedValue({ applications: { svc: { reload: false } } });
      dockerExec.execWithDockerEnv.mockResolvedValue({
        stdout: JSON.stringify([{ Type: 'volume', Destination: '/mnt/data' }])
      });
      await logRestartDevMountSummary('ctr', 'svc');
      expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Dev workspace'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Reload (config)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('reload off'));
    });
  });
});
