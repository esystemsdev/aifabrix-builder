/**
 * Tests for ensureReloadSync and localhost detection in run.js
 *
 * @fileoverview When Docker endpoint, remote-server, or sync-ssh-host is localhost,
 * ensureReloadSync returns null and no Mutagen session is created.
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
    it('returns null when no endpoint and no serverUrl', async() => {
      config.getDockerEndpoint.mockResolvedValue(null);
      config.getRemoteServer.mockResolvedValue(null);
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toBeNull();
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
    });

    it('returns null when Docker endpoint is localhost (no Mutagen)', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://localhost:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toBeNull();
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
      expect(mutagen.ensureSyncSession).not.toHaveBeenCalled();
    });

    it('returns null when remote-server URL is localhost (no Mutagen)', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://dev.aifabrix.dev:2376');
      config.getRemoteServer.mockResolvedValue('https://localhost:8443');
      config.getSyncSshHost.mockResolvedValue('dev.aifabrix.dev');
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toBeNull();
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
    });

    it('returns null when sync-ssh-host is localhost (no Mutagen)', async() => {
      config.getDockerEndpoint.mockResolvedValue('tcp://dev.aifabrix.dev:2376');
      config.getRemoteServer.mockResolvedValue('https://dev.aifabrix.dev');
      config.getSyncSshHost.mockResolvedValue('localhost');
      const result = await run.ensureReloadSync('myapp', '01', false, '/local/path');
      expect(result).toBeNull();
      expect(mutagen.ensureMutagenPath).not.toHaveBeenCalled();
    });

    it('uses Mutagen and returns remote path when all hosts are non-local', async() => {
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

      expect(result).toBe('/home/dev06/dev/myapp');
      expect(mutagen.ensureMutagenPath).toHaveBeenCalled();
      expect(mutagen.getRemotePath).toHaveBeenCalledWith('/home/dev06', 'myapp', undefined);
      expect(mutagen.ensureSyncSession).toHaveBeenCalledWith(
        '/bin/mutagen',
        'aifabrix-01-myapp',
        '/local/code',
        'syncuser@dev.aifabrix.dev:/home/dev06/dev/myapp'
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

      expect(result).toBe('/home/dev06/aifabrix-miso/packages/miso-controller');
      expect(mutagen.getRemotePath).toHaveBeenCalledWith(
        '/home/dev06',
        'miso-controller',
        'aifabrix-miso/packages/miso-controller'
      );
    });
  });
});
