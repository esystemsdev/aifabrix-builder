/**
 * Tests for ensureReloadSync and localhost detection in run.js
 *
 * @fileoverview When Docker endpoint or sync-ssh-host is localhost,
 * ensureReloadSync returns bind-mount summary and no Mutagen session is created.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/core/config', () => ({
  getDockerEndpoint: jest.fn(),
  getRemoteServer: jest.fn(),
  getSyncSshHost: jest.fn(),
  getUserMutagenFolder: jest.fn(),
  getSyncSshUser: jest.fn()
}));

jest.mock('../../../lib/utils/mutagen', () => ({
  ensureMutagenPath: jest.fn(),
  getRemotePath: jest.fn(),
  getSyncSshUrl: jest.fn(),
  getSessionName: jest.fn(),
  ensureSyncSession: jest.fn()
}));

const config = require('../../../lib/core/config');
const mutagen = require('../../../lib/utils/mutagen');
const run = require('../../../lib/app/run');

describe('run (ensureReloadSync and localhost helpers)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isLocalhostHost', () => {
    it('returns true for localhost and 127.0.0.1', () => {
      expect(run.isLocalhostHost('localhost')).toBe(true);
      expect(run.isLocalhostHost('127.0.0.1')).toBe(true);
      expect(run.isLocalhostHost('LOCALHOST')).toBe(true);
      expect(run.isLocalhostHost('127.0.0.1')).toBe(true);
    });

    it('returns false for other hosts or empty', () => {
      expect(run.isLocalhostHost('dev.aifabrix.dev')).toBe(false);
      expect(run.isLocalhostHost('')).toBe(false);
      expect(run.isLocalhostHost()).toBe(false);
    });
  });

  describe('isLocalhostEndpoint', () => {
    it('returns true for tcp://localhost and tcp://127.0.0.1', () => {
      expect(run.isLocalhostEndpoint('tcp://localhost:2376')).toBe(true);
      expect(run.isLocalhostEndpoint('tcp://127.0.0.1:2376')).toBe(true);
    });

    it('returns true for https://localhost and https://127.0.0.1', () => {
      expect(run.isLocalhostEndpoint('https://localhost:8443')).toBe(true);
      expect(run.isLocalhostEndpoint('https://127.0.0.1:8443')).toBe(true);
    });

    it('returns false for remote endpoint or server', () => {
      expect(run.isLocalhostEndpoint('tcp://dev.aifabrix.dev:2376')).toBe(false);
      expect(run.isLocalhostEndpoint('https://dev.aifabrix.dev')).toBe(false);
    });

    it('returns false for empty or invalid', () => {
      expect(run.isLocalhostEndpoint('')).toBe(false);
      expect(run.isLocalhostEndpoint()).toBe(false);
    });
  });

  describe('ensureReloadSync', () => {
    it('returns bind-mount summary when no endpoint and no serverUrl', async() => {
      config.getDockerEndpoint.mockResolvedValue(null);
      config.getRemoteServer.mockResolvedValue(null);
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toEqual({ transport: 'bind-mount', hostPath: '/local/path' });
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
    });

    it('returns bind-mount when Docker endpoint is localhost (no Mutagen)', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://localhost:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toEqual({ transport: 'bind-mount', hostPath: '/local/path' });
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
      expect(mutagen.ensureSyncSession).not.toHaveBeenCalled();
    });

    it('returns bind-mount when docker-endpoint unset even if remote-server is set (no Mutagen)', async() => {
      config.getDockerEndpoint.mockResolvedValue(null);
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toEqual({ transport: 'bind-mount', hostPath: '/local/path' });
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
    });

    it('returns bind-mount when docker-endpoint host matches this machine (no Mutagen)', async() => {
      const os = require('os');
      const spy = jest.spyOn(os, 'hostname').mockReturnValue('builder02');
      try {
        config.getDockerEndpoint.mockResolvedValue('tcp://builder02:2376');
        config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
        config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
        const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
        expect(result).toEqual({ transport: 'bind-mount', hostPath: '/local/path' });
        expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('returns bind-mount when sync-ssh-host is localhost (no Mutagen)', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://dev.aifabrix.dev:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('localhost');
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toEqual({ transport: 'bind-mount', hostPath: '/local/path' });
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
    });

    it('uses Mutagen and returns summary when all hosts are non-local', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://dev.aifabrix.dev:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      config.getUserMutagenFolder.mockResolvedValue('/home/dev06');
      config.getSyncSshUser.mockResolvedValue('syncuser');
      mutagen.ensureMutagenPath.mockResolvedValue('/bin/mutagen');
      mutagen.getRemotePath.mockReturnValue('/home/dev06/dev/myapp');
      mutagen.getSyncSshUrl.mockReturnValue('syncuser@dev.aifabrix.dev:/home/dev06/dev/myapp');
      mutagen.getSessionName.mockReturnValue('aifabrix-01-myapp');

      const result = await run.ensureReloadSync('myapp', '01', false, '/local/code');

      expect(result).toEqual({
        transport: 'mutagen',
        remotePath: '/home/dev06/dev/myapp',
        sessionName: 'aifabrix-01-myapp',
        localPath: '/local/code',
        syncSshHost: 'dev.aifabrix.dev',
        sshUrl: 'syncuser@dev.aifabrix.dev:/home/dev06/dev/myapp'
      });
      expect(mutagen.ensureMutagenPath).toHaveBeenCalled();
      expect(mutagen.getRemotePath).toHaveBeenCalledWith('/home/dev06', 'myapp', undefined);
      expect(mutagen.ensureSyncSession).toHaveBeenCalledWith(
        '/bin/mutagen',
        'aifabrix-01-myapp',
        '/local/code',
        'syncuser@dev.aifabrix.dev:/home/dev06/dev/myapp'
      );
    });

    it('throws when remote is non-local but mutagen sync settings are incomplete (plan 122 Matrix D5)', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://dev.aifabrix.dev:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      config.getUserMutagenFolder.mockResolvedValue(null);
      config.getSyncSshUser.mockResolvedValue('syncuser');
      await expect(run.ensureReloadSync('myapp', '01', false, '/local/code')).rejects.toThrow(
        'run --reload requires remote server sync settings'
      );
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
    });

    it('throws Matrix D5 when sync-ssh-user is missing', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://dev.aifabrix.dev:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      config.getUserMutagenFolder.mockResolvedValue('/home/dev');
      config.getSyncSshUser.mockResolvedValue(null);
      await expect(run.ensureReloadSync('myapp', '01', false, '/local/code')).rejects.toThrow(
        'run --reload requires remote server sync settings'
      );
    });

    it('passes remoteSyncPath to getRemotePath when provided', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://dev.aifabrix.dev:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      config.getUserMutagenFolder.mockResolvedValue('/home/dev06');
      config.getSyncSshUser.mockResolvedValue('syncuser');
      mutagen.ensureMutagenPath.mockResolvedValue('/bin/mutagen');
      mutagen.getRemotePath.mockReturnValue('/home/dev06/aifabrix-miso/packages/miso-controller');
      mutagen.getSyncSshUrl.mockReturnValue('syncuser@dev.aifabrix.dev:/home/dev06/aifabrix-miso/packages/miso-controller');
      mutagen.getSessionName.mockReturnValue('aifabrix-01-miso-controller');

      const result = await run.ensureReloadSync(
        'miso-controller',
        '06',
        false,
        '/local/code',
        'aifabrix-miso/packages/miso-controller'
      );

      expect(result).toMatchObject({
        transport: 'mutagen',
        remotePath: '/home/dev06/aifabrix-miso/packages/miso-controller',
        sessionName: 'aifabrix-01-miso-controller',
        localPath: '/local/code',
        syncSshHost: 'dev.aifabrix.dev'
      });
      expect(mutagen.getRemotePath).toHaveBeenCalledWith(
        '/home/dev06',
        'miso-controller',
        'aifabrix-miso/packages/miso-controller'
      );
    });
  });
});
