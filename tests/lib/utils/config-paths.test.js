/**
 * Tests for Config Paths Module
 *
 * @fileoverview Unit tests for lib/utils/config-paths.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const pathMod = require('path');
const os = require('os');

const {
  getPathConfig,
  setPathConfig,
  createPathConfigFunctions,
  getDefaultEnvConfigPath,
  SETTINGS_RESPONSE_KEYS
} = require('../../../lib/utils/config-paths');
const pathsModule = require('../../../lib/utils/paths');

/** GET /api/dev/settings response parameter names per .cursor/plans/builder-cli.md §1 */
const BUILDER_CLI_SETTINGS_KEYS = [
  'user-mutagen-folder',
  'secrets-encryption',
  'aifabrix-secrets',
  'aifabrix-env-config',
  'remote-server',
  'docker-endpoint',
  'docker-tls-skip-verify',
  'sync-ssh-user',
  'sync-ssh-host'
];

describe('Config Paths Module', () => {
  describe('SETTINGS_RESPONSE_KEYS (builder-cli.md contract)', () => {
    it('should match GET /api/dev/settings response parameters from builder-cli.md §1', () => {
      expect(SETTINGS_RESPONSE_KEYS).toEqual(BUILDER_CLI_SETTINGS_KEYS);
    });
  });
  describe('getPathConfig', () => {
    it('should return path value from config', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({ 'test-key': '/test/path' });
      const result = await getPathConfig(getConfigFn, 'test-key');
      expect(result).toBe('/test/path');
      expect(getConfigFn).toHaveBeenCalled();
    });

    it('should return null if key does not exist', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({});
      const result = await getPathConfig(getConfigFn, 'non-existent-key');
      expect(result).toBeNull();
    });

    it('should return null if config value is falsy', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({ 'test-key': '' });
      const result = await getPathConfig(getConfigFn, 'test-key');
      expect(result).toBeNull();
    });
  });

  describe('setPathConfig', () => {
    it('should set path value in config', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({});
      const saveConfigFn = jest.fn().mockResolvedValue();
      const errorMsg = 'Path is required';

      await setPathConfig(getConfigFn, saveConfigFn, 'test-key', '/test/path', errorMsg);

      expect(getConfigFn).toHaveBeenCalled();
      expect(saveConfigFn).toHaveBeenCalledWith({ 'test-key': '/test/path' });
    });

    it('should throw error if value is not provided', async() => {
      const getConfigFn = jest.fn();
      const saveConfigFn = jest.fn();
      const errorMsg = 'Path is required';

      await expect(setPathConfig(getConfigFn, saveConfigFn, 'test-key', null, errorMsg))
        .rejects.toThrow('Path is required');
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should throw error if value is not a string', async() => {
      const getConfigFn = jest.fn();
      const saveConfigFn = jest.fn();
      const errorMsg = 'Path is required';

      await expect(setPathConfig(getConfigFn, saveConfigFn, 'test-key', 123, errorMsg))
        .rejects.toThrow('Path is required');
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should throw error if value is empty string', async() => {
      const getConfigFn = jest.fn();
      const saveConfigFn = jest.fn();
      const errorMsg = 'Path is required';

      await expect(setPathConfig(getConfigFn, saveConfigFn, 'test-key', '', errorMsg))
        .rejects.toThrow('Path is required');
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should preserve existing config values', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({ 'other-key': '/other/path' });
      const saveConfigFn = jest.fn().mockResolvedValue();
      const errorMsg = 'Path is required';

      await setPathConfig(getConfigFn, saveConfigFn, 'test-key', '/test/path', errorMsg);

      expect(saveConfigFn).toHaveBeenCalledWith({
        'other-key': '/other/path',
        'test-key': '/test/path'
      });
    });
  });

  describe('createPathConfigFunctions', () => {
    let getConfigFn;
    let saveConfigFn;
    let pathConfigFunctions;

    beforeEach(() => {
      getConfigFn = jest.fn().mockResolvedValue({});
      saveConfigFn = jest.fn().mockResolvedValue();
      pathConfigFunctions = createPathConfigFunctions(getConfigFn, saveConfigFn);
    });

    describe('getAifabrixHomeOverride', () => {
      it('should get aifabrix-home path from config', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-home': '/custom/home' });
        const result = await pathConfigFunctions.getAifabrixHomeOverride();
        expect(result).toBe('/custom/home');
      });

      it('should return null if aifabrix-home not in config', async() => {
        const result = await pathConfigFunctions.getAifabrixHomeOverride();
        expect(result).toBeNull();
      });
    });

    describe('setAifabrixHomeOverride', () => {
      it('should set aifabrix-home path in config', async() => {
        await pathConfigFunctions.setAifabrixHomeOverride('/custom/home');
        expect(saveConfigFn).toHaveBeenCalledWith({ 'aifabrix-home': '/custom/home' });
      });

      it('should throw error if home path is not provided', async() => {
        await expect(pathConfigFunctions.setAifabrixHomeOverride(null))
          .rejects.toThrow('Home path is required and must be a string');
      });

      it('should throw error if home path is not a string', async() => {
        await expect(pathConfigFunctions.setAifabrixHomeOverride(123))
          .rejects.toThrow('Home path is required and must be a string');
      });
    });

    describe('getAifabrixWorkOverride / setAifabrixWorkOverride', () => {
      it('should get aifabrix-work from config', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-work': '/workspace/repos' });
        const result = await pathConfigFunctions.getAifabrixWorkOverride();
        expect(result).toBe('/workspace/repos');
      });

      it('should return null if aifabrix-work not in config', async() => {
        const result = await pathConfigFunctions.getAifabrixWorkOverride();
        expect(result).toBeNull();
      });

      it('should set aifabrix-work as resolved absolute path', async() => {
        const pathMod = require('path');
        await pathConfigFunctions.setAifabrixWorkOverride('relative-work');
        expect(saveConfigFn).toHaveBeenCalledWith({
          'aifabrix-work': pathMod.resolve('relative-work')
        });
      });

      it('should clear aifabrix-work when empty string', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-work': '/old' });
        await pathConfigFunctions.setAifabrixWorkOverride('  ');
        expect(saveConfigFn).toHaveBeenCalledWith({ 'aifabrix-work': undefined });
      });

      it('should throw if work path is not a string', async() => {
        await expect(pathConfigFunctions.setAifabrixWorkOverride(null))
          .rejects.toThrow('Work path is required and must be a string');
      });
    });

    describe('getAifabrixSecretsPath', () => {
      it('should get aifabrix-secrets path from config', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-secrets': '/custom/secrets' });
        const result = await pathConfigFunctions.getAifabrixSecretsPath();
        expect(result).toBe('/custom/secrets');
      });

      it('should return null if aifabrix-secrets not in config', async() => {
        const result = await pathConfigFunctions.getAifabrixSecretsPath();
        expect(result).toBeNull();
      });
    });

    describe('setAifabrixSecretsPath', () => {
      it('should set aifabrix-secrets path in config', async() => {
        await pathConfigFunctions.setAifabrixSecretsPath('/custom/secrets');
        expect(saveConfigFn).toHaveBeenCalledWith({ 'aifabrix-secrets': '/custom/secrets' });
      });

      it('should throw error if secrets path is not provided', async() => {
        await expect(pathConfigFunctions.setAifabrixSecretsPath(null))
          .rejects.toThrow('Secrets path is required and must be a string');
      });
    });

    describe('getAifabrixEnvConfigPath', () => {
      it('should get aifabrix-env-config path from config', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-env-config': '/custom/env-config' });
        const result = await pathConfigFunctions.getAifabrixEnvConfigPath();
        expect(result).toBe('/custom/env-config');
      });

      it('should resolve relative aifabrix-env-config against aifabrix-work (independent of cwd)', async() => {
        const fakeWork = pathMod.join(os.tmpdir(), `af-work-${process.pid}-${Date.now()}`);
        const rel = 'aifabrix-miso/builder/env-config.yaml';
        getConfigFn.mockResolvedValue({
          'aifabrix-work': fakeWork,
          'aifabrix-env-config': rel
        });
        const cwdBefore = process.cwd();
        try {
          process.chdir(os.tmpdir());
          const envPath = await pathConfigFunctions.getAifabrixEnvConfigPath();
          const builderDir = await pathConfigFunctions.getAifabrixBuilderDir();
          const expected = pathMod.normalize(pathMod.resolve(fakeWork, rel));
          expect(envPath).toBe(expected);
          expect(builderDir).toBe(pathMod.dirname(expected));
        } finally {
          process.chdir(cwdBefore);
        }
      });

      it('should prefer aifabrix-work over aifabrix-home when both set', async() => {
        const fakeWork = pathMod.join(os.tmpdir(), 'work-root');
        const fakeHome = pathMod.join(os.tmpdir(), 'home-root');
        getConfigFn.mockResolvedValue({
          'aifabrix-work': fakeWork,
          'aifabrix-home': fakeHome,
          'aifabrix-env-config': 'sub/env.yaml'
        });
        const expected = pathMod.normalize(pathMod.resolve(fakeWork, 'sub/env.yaml'));
        expect(await pathConfigFunctions.getAifabrixEnvConfigPath()).toBe(expected);
      });

      it('should fall back to aifabrix-home when aifabrix-work unset', async() => {
        const fakeHome = pathMod.join(os.tmpdir(), `af-home-fb-${process.pid}-${Date.now()}`);
        getConfigFn.mockResolvedValue({
          'aifabrix-home': fakeHome,
          'aifabrix-env-config': 'rel/env.yaml'
        });
        const expected = pathMod.normalize(pathMod.resolve(fakeHome, 'rel/env.yaml'));
        expect(await pathConfigFunctions.getAifabrixEnvConfigPath()).toBe(expected);
      });

      it('should resolve relative path using getAifabrixHome when work and home unset in config', async() => {
        const spyWork = jest.spyOn(pathsModule, 'getAifabrixWork').mockReturnValue(null);
        const spyHome = jest.spyOn(pathsModule, 'getAifabrixHome').mockReturnValue('/fallback/aifabrix');
        getConfigFn.mockResolvedValue({ 'aifabrix-env-config': 'rel/env.yaml' });
        const expected = pathMod.normalize(pathMod.resolve('/fallback/aifabrix', 'rel/env.yaml'));
        expect(await pathConfigFunctions.getAifabrixEnvConfigPath()).toBe(expected);
        expect(await pathConfigFunctions.getAifabrixBuilderDir()).toBe(pathMod.dirname(expected));
        spyWork.mockRestore();
        spyHome.mockRestore();
      });

      it('should return default schema path if aifabrix-env-config not in config', async() => {
        getConfigFn.mockResolvedValue({});
        const result = await pathConfigFunctions.getAifabrixEnvConfigPath();
        expect(result).toBe(getDefaultEnvConfigPath());
      });
    });

    describe('setAifabrixEnvConfigPath', () => {
      it('should set aifabrix-env-config path in config', async() => {
        await pathConfigFunctions.setAifabrixEnvConfigPath('/custom/env-config');
        expect(saveConfigFn).toHaveBeenCalledWith({ 'aifabrix-env-config': '/custom/env-config' });
      });

      it('should throw error if env config path is not provided', async() => {
        await expect(pathConfigFunctions.setAifabrixEnvConfigPath(null))
          .rejects.toThrow('Env config path is required and must be a string');
      });
    });

    describe('mergeRemoteSettings', () => {
      it('should merge only GET /api/dev/settings contract keys into config', async() => {
        getConfigFn.mockResolvedValue({ existing: 'keep' });
        const settings = {
          'user-mutagen-folder': '/opt/workspace/dev-01',
          'aifabrix-secrets': '/secrets.yaml',
          'unknown-key': 'ignored'
        };
        await pathConfigFunctions.mergeRemoteSettings(settings);
        expect(saveConfigFn).toHaveBeenCalledWith({
          existing: 'keep',
          'user-mutagen-folder': '/opt/workspace/dev-01',
          'aifabrix-secrets': '/secrets.yaml'
        });
        expect(saveConfigFn.mock.calls[0][0]['unknown-key']).toBeUndefined();
      });

      it('should trim string values from settings', async() => {
        getConfigFn.mockResolvedValue({});
        await pathConfigFunctions.mergeRemoteSettings({
          'remote-server': '  https://dev.example.com/  '
        });
        expect(saveConfigFn).toHaveBeenCalledWith({
          'remote-server': 'https://dev.example.com/',
          'sync-ssh-host': 'dev.example.com',
          'docker-endpoint': 'tcp://dev.example.com:2376'
        });
      });

      it('should not overwrite config with empty string from server', async() => {
        getConfigFn.mockResolvedValue({
          'aifabrix-env-config': '/existing/env-config.yaml',
          'remote-server': 'https://builder01.aifabrix.dev'
        });
        await pathConfigFunctions.mergeRemoteSettings({
          'aifabrix-env-config': '',
          'remote-server': 'https://other.example.com'
        });
        expect(saveConfigFn).toHaveBeenCalledWith(
          expect.objectContaining({
            'aifabrix-env-config': '/existing/env-config.yaml',
            'remote-server': 'https://other.example.com'
          })
        );
      });

      it('should set aifabrix-secrets to remote URL when remote-server is set and server sends path', async() => {
        getConfigFn.mockResolvedValue({});
        await pathConfigFunctions.mergeRemoteSettings({
          'remote-server': 'https://builder01.aifabrix.dev',
          'aifabrix-secrets': '/workspace/aifabrix-miso/builder/secrets.local.yaml'
        });
        expect(saveConfigFn).toHaveBeenCalledWith(
          expect.objectContaining({
            'remote-server': 'https://builder01.aifabrix.dev',
            'aifabrix-secrets': 'https://builder01.aifabrix.dev/api/dev/secrets'
          })
        );
      });

      it('should remove legacy aifabrix-secrets-path on merge', async() => {
        getConfigFn.mockResolvedValue({
          'aifabrix-secrets-path': '/old/path.yaml',
          existing: 'x'
        });
        await pathConfigFunctions.mergeRemoteSettings({
          'remote-server': 'https://builder01.aifabrix.dev'
        });
        const saved = saveConfigFn.mock.calls[0][0];
        expect(saved['aifabrix-secrets-path']).toBeUndefined();
        expect(saved.existing).toBe('x');
      });

      it('should not override aifabrix-secrets when already an https URL', async() => {
        getConfigFn.mockResolvedValue({});
        const url = 'https://builder01.aifabrix.dev/api/custom/secrets';
        await pathConfigFunctions.mergeRemoteSettings({
          'remote-server': 'https://builder01.aifabrix.dev',
          'aifabrix-secrets': url
        });
        expect(saveConfigFn).toHaveBeenCalledWith(
          expect.objectContaining({
            'aifabrix-secrets': url
          })
        );
      });

      it('should derive sync-ssh-host and docker-endpoint from remote-server when server does not send them', async() => {
        getConfigFn.mockResolvedValue({
          'remote-server': 'https://builder.aifabrix.dev',
          'user-mutagen-folder': '/data/workspace/dev-06',
          'sync-ssh-user': 'aifabrix-sync'
        });
        await pathConfigFunctions.mergeRemoteSettings({
          'user-mutagen-folder': '/data/workspace/dev-06',
          'sync-ssh-user': 'aifabrix-sync'
        });
        expect(saveConfigFn).toHaveBeenCalledWith(
          expect.objectContaining({
            'user-mutagen-folder': '/data/workspace/dev-06',
            'sync-ssh-user': 'aifabrix-sync',
            'sync-ssh-host': 'builder.aifabrix.dev',
            'docker-endpoint': 'tcp://builder.aifabrix.dev:2376'
          })
        );
      });

      it('should not override sync-ssh-host or docker-endpoint when server sends them', async() => {
        getConfigFn.mockResolvedValue({});
        await pathConfigFunctions.mergeRemoteSettings({
          'remote-server': 'https://builder.aifabrix.dev',
          'sync-ssh-host': 'ssh.aifabrix.dev',
          'docker-endpoint': 'tcp://docker.aifabrix.dev:2376'
        });
        expect(saveConfigFn).toHaveBeenCalledWith(
          expect.objectContaining({
            'sync-ssh-host': 'ssh.aifabrix.dev',
            'docker-endpoint': 'tcp://docker.aifabrix.dev:2376'
          })
        );
      });

      it('should merge docker-tls-skip-verify from server', async() => {
        getConfigFn.mockResolvedValue({});
        await pathConfigFunctions.mergeRemoteSettings({
          'remote-server': 'https://builder.aifabrix.dev',
          'docker-tls-skip-verify': true
        });
        expect(saveConfigFn).toHaveBeenCalledWith(
          expect.objectContaining({
            'docker-tls-skip-verify': true
          })
        );
      });
    });

    describe('getDockerTlsSkipVerify', () => {
      const envKey = 'AIFABRIX_DOCKER_TLS_SKIP_VERIFY';

      afterEach(() => {
        delete process.env[envKey];
      });

      it('should return false when unset in config and env', async() => {
        getConfigFn.mockResolvedValue({});
        const result = await pathConfigFunctions.getDockerTlsSkipVerify();
        expect(result).toBe(false);
      });

      it('should honor truthy config values', async() => {
        getConfigFn.mockResolvedValue({ 'docker-tls-skip-verify': '1' });
        expect(await pathConfigFunctions.getDockerTlsSkipVerify()).toBe(true);
        getConfigFn.mockResolvedValue({ 'docker-tls-skip-verify': true });
        expect(await pathConfigFunctions.getDockerTlsSkipVerify()).toBe(true);
      });

      it('should prefer env over config when env is non-empty', async() => {
        getConfigFn.mockResolvedValue({ 'docker-tls-skip-verify': false });
        process.env[envKey] = '1';
        expect(await pathConfigFunctions.getDockerTlsSkipVerify()).toBe(true);
      });

      it('should not infer skip-verify from .local docker-endpoint alone', async() => {
        getConfigFn.mockResolvedValue({
          'docker-endpoint': 'tcp://engine.local:2376'
        });
        expect(await pathConfigFunctions.getDockerTlsSkipVerify()).toBe(false);
      });

      it('should not infer skip-verify from multi-label .local host without flag', async() => {
        getConfigFn.mockResolvedValue({
          'docker-endpoint': 'tcp://docker.dev.local:2376'
        });
        expect(await pathConfigFunctions.getDockerTlsSkipVerify()).toBe(false);
      });
    });

    describe('setDockerTlsSkipVerify', () => {
      it('should persist boolean and clear on null', async() => {
        await pathConfigFunctions.setDockerTlsSkipVerify(true);
        expect(saveConfigFn).toHaveBeenCalledWith({ 'docker-tls-skip-verify': true });
        getConfigFn.mockResolvedValue({ 'docker-tls-skip-verify': true });
        await pathConfigFunctions.setDockerTlsSkipVerify(null);
        expect(saveConfigFn).toHaveBeenLastCalledWith({ 'docker-tls-skip-verify': undefined });
      });
    });
  });
});

