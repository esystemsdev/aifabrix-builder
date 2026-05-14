/**
 * Tests for `lib/commands/setup-modes.js`.
 *
 * Verifies that each mode handler runs the correct ordered sequence of
 * destructive / refresh actions, then `up-infra` + `up-platform`.
 *
 * @fileoverview Unit tests for setup mode handlers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

jest.mock('fs');
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/infrastructure');
jest.mock('../../../lib/utils/paths');
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/utils/docker');
jest.mock('../../../lib/utils/docker-exec');
jest.mock('../../../lib/utils/postgres-wipe');
jest.mock('../../../lib/commands/up-miso');
jest.mock('../../../lib/commands/up-dataplane');
jest.mock('../../../lib/commands/up-common');
jest.mock('../../../lib/commands/setup-prompts');
jest.mock('../../../lib/commands/login', () => ({
  handleLogin: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../../lib/cli/infra-guided', () => ({
  runGuidedUpPlatform: jest.fn(async(_options, handleUpMiso, handleUpDataplane, handleLogin) => {
    await handleUpMiso({});
    await handleLogin({});
    await handleUpDataplane({});
  })
}));
jest.mock('../../../lib/utils/config-format');
jest.mock('ora', () => {
  return () => ({
    start: () => ({
      succeed: jest.fn(),
      fail: jest.fn(),
      stop: jest.fn()
    })
  });
});

const fs = require('fs');
const config = require('../../../lib/core/config');
const infra = require('../../../lib/infrastructure');
const pathsUtil = require('../../../lib/utils/paths');
const logger = require('../../../lib/utils/logger');
const dockerUtils = require('../../../lib/utils/docker');
const dockerExec = require('../../../lib/utils/docker-exec');
const postgresWipe = require('../../../lib/utils/postgres-wipe');
const upMiso = require('../../../lib/commands/up-miso');
const upDataplane = require('../../../lib/commands/up-dataplane');
const upCommon = require('../../../lib/commands/up-common');
const prompts = require('../../../lib/commands/setup-prompts');
const login = require('../../../lib/commands/login');
const infraGuided = require('../../../lib/cli/infra-guided');

const modes = require('../../../lib/commands/setup-modes');

describe('lib/commands/setup-modes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log = jest.fn();
    config.ensureSecretsEncryptionKey = jest.fn().mockResolvedValue(undefined);
    config.saveConfig = jest.fn().mockResolvedValue(undefined);
    config.getConfig = jest.fn().mockResolvedValue({
      traefik: false,
      pgadmin: true,
      redisCommander: true,
      tlsEnabled: false
    });
    config.getDeveloperId = jest.fn().mockResolvedValue('02');
    infra.startInfra = jest.fn().mockResolvedValue(undefined);
    infra.stopInfraWithVolumes = jest.fn().mockResolvedValue(undefined);
    upMiso.handleUpMiso = jest.fn().mockResolvedValue(undefined);
    upDataplane.handleUpDataplane = jest.fn().mockResolvedValue(undefined);
    upCommon.applyUpPlatformForceConfig = jest.fn().mockResolvedValue(undefined);
    upCommon.cleanBuilderAppDirs = jest.fn().mockResolvedValue(undefined);
    prompts.promptAiTool = jest.fn().mockResolvedValue(undefined);
    prompts.promptBuilderDirConflict = jest.fn().mockResolvedValue('keep');
    pathsUtil.getPrimaryUserSecretsLocalPath = jest
      .fn()
      .mockReturnValue('/home/test/.aifabrix/secrets.local.yaml');
    pathsUtil.getAifabrixSystemDir = jest.fn().mockReturnValue('/home/test/.aifabrix');
    pathsUtil.getBuilderPath = jest.fn().mockImplementation((app) => `/work/builder/${app}`);
    pathsUtil.getBuilderRoot = jest.fn().mockReturnValue('/work/builder');
    pathsUtil.getSystemBuilderRoot = jest.fn().mockReturnValue('/home/test/.aifabrix/builder');
    pathsUtil.resolveApplicationConfigPath = jest
      .fn()
      .mockImplementation((p) => `${p}/application.yaml`);
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => true });
    fs.readdirSync = jest.fn().mockReturnValue([]);
    fs.renameSync = jest.fn();
    fs.rmSync = jest.fn();
    dockerUtils.getComposeCommand = jest.fn().mockResolvedValue('docker compose');
    dockerExec.execWithDockerEnv = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
    postgresWipe.wipePostgresData = jest.fn().mockResolvedValue({ databases: [], roles: [] });
  });

  describe('removeUserLocalSecrets', () => {
    it('returns false and skips removal when file is missing', () => {
      fs.existsSync.mockReturnValue(false);
      expect(modes.removeUserLocalSecrets()).toBe(false);
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('removes file when present', () => {
      fs.existsSync.mockReturnValue(true);
      expect(modes.removeUserLocalSecrets()).toBe(true);
      expect(fs.rmSync).toHaveBeenCalledWith(
        '/home/test/.aifabrix/secrets.local.yaml',
        expect.objectContaining({ force: true })
      );
    });
  });

  describe('startInfraFromConfig', () => {
    it('reads config and starts infra with admin overrides', async() => {
      await modes.startInfraFromConfig({ adminEmail: 'a@b', adminPassword: 'pw12345678' });
      expect(infra.startInfra).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          traefik: false,
          pgadmin: true,
          redisCommander: true,
          adminPassword: 'pw12345678',
          adminEmail: 'a@b',
          tlsEnabled: false
        })
      );
      expect(config.saveConfig).not.toHaveBeenCalled();
    });

    it('passes adminEmail from config when overrides omit email', async() => {
      config.getConfig.mockResolvedValue({
        traefik: false,
        pgadmin: true,
        redisCommander: true,
        tlsEnabled: false,
        adminEmail: 'from-config@example.com'
      });
      await modes.startInfraFromConfig({});
      expect(infra.startInfra).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          adminEmail: 'from-config@example.com',
          tlsEnabled: false
        })
      );
    });

    it('prefers overrides.adminEmail over config adminEmail', async() => {
      config.getConfig.mockResolvedValue({
        traefik: false,
        pgadmin: true,
        redisCommander: true,
        tlsEnabled: false,
        adminEmail: 'from-config@example.com'
      });
      await modes.startInfraFromConfig({ adminEmail: 'override@example.com' });
      expect(infra.startInfra).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ adminEmail: 'override@example.com' })
      );
    });

    it('persists optional infra flags when missing from config after start', async() => {
      config.getConfig.mockResolvedValueOnce({ tlsEnabled: false });
      await modes.startInfraFromConfig({});
      expect(config.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          traefik: false,
          pgadmin: true,
          redisCommander: true,
          tlsEnabled: false
        })
      );
    });
  });

  describe('runUpPlatform', () => {
    it('skips force config when force=false', async() => {
      await modes.runUpPlatform({ force: false });
      expect(upCommon.applyUpPlatformForceConfig).not.toHaveBeenCalled();
      expect(upCommon.cleanBuilderAppDirs).not.toHaveBeenCalled();
      expect(upMiso.handleUpMiso).toHaveBeenCalled();
      expect(upDataplane.handleUpDataplane).toHaveBeenCalled();
      expect(login.handleLogin).toHaveBeenCalled();
      expect(infraGuided.runGuidedUpPlatform).toHaveBeenCalled();
    });

    it('applies force config and cleans builder dirs when force=true', async() => {
      await modes.runUpPlatform({ force: true });
      expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalled();
      expect(upCommon.cleanBuilderAppDirs).toHaveBeenCalledWith(
        ['keycloak', 'miso-controller', 'dataplane'],
        expect.any(Object)
      );
    });

    it('delegates platform UX to guided up-platform helper', async() => {
      await modes.runUpPlatform({ force: false });
      expect(infraGuided.runGuidedUpPlatform).toHaveBeenCalled();
    });

    it('prompts when builder root exists and is non-empty (force=true)', async() => {
      fs.existsSync.mockImplementation((p) => String(p) === '/work/builder');
      fs.readdirSync.mockReturnValue(['keycloak']);
      await modes.runUpPlatform({ force: true });
      expect(prompts.promptBuilderDirConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          builderRoot: '/work/builder',
          totalEntries: 1,
          platformApps: ['keycloak', 'miso-controller', 'dataplane']
        })
      );
    });

    it('backs up existing platform app dirs when user chooses backup (force=true)', async() => {
      prompts.promptBuilderDirConflict.mockResolvedValue('backup');
      fs.existsSync.mockImplementation((p) => {
        const s = String(p);
        if (s === '/work/builder') return true;
        if (s === '/work/builder/keycloak') return true;
        if (s === '/work/builder/miso-controller') return true;
        if (s === '/work/builder/dataplane') return false;
        if (s.includes('.backup-')) return false;
        return false;
      });
      fs.readdirSync.mockImplementation((p) => {
        const s = String(p);
        if (s === '/work/builder') return ['keycloak', 'miso-controller'];
        if (s === '/work/builder/keycloak') return ['application.yaml'];
        if (s === '/work/builder/miso-controller') return ['application.yaml'];
        return [];
      });

      await modes.runUpPlatform({ force: true });

      expect(fs.renameSync).toHaveBeenCalledTimes(2);
      expect(fs.renameSync).toHaveBeenCalledWith(
        '/work/builder/keycloak',
        expect.stringMatching(/\/work\/builder\/keycloak\.backup-\d{8}-\d{6}(-\d+)?$/)
      );
      expect(fs.renameSync).toHaveBeenCalledWith(
        '/work/builder/miso-controller',
        expect.stringMatching(/\/work\/builder\/miso-controller\.backup-\d{8}-\d{6}(-\d+)?$/)
      );
    });

    it('aborts without cleaning when user chooses abort (force=true)', async() => {
      prompts.promptBuilderDirConflict.mockResolvedValue('abort');
      fs.existsSync.mockImplementation((p) => String(p) === '/work/builder');
      fs.readdirSync.mockReturnValue(['keycloak']);

      await modes.runUpPlatform({ force: true });

      expect(upCommon.applyUpPlatformForceConfig).not.toHaveBeenCalled();
      expect(upCommon.cleanBuilderAppDirs).not.toHaveBeenCalled();
      expect(infraGuided.runGuidedUpPlatform).not.toHaveBeenCalled();
    });

    it('keeps platform app folders and continues when user chooses keep-files (force=true)', async() => {
      prompts.promptBuilderDirConflict.mockResolvedValue('keep-files');
      fs.existsSync.mockImplementation((p) => String(p) === '/work/builder');
      fs.readdirSync.mockReturnValue(['keycloak']);

      await modes.runUpPlatform({ force: true });

      expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalled();
      expect(upCommon.cleanBuilderAppDirs).not.toHaveBeenCalled();
      expect(infraGuided.runGuidedUpPlatform).toHaveBeenCalled();
    });

    it('does not prompt when builder root exists but is empty (force=true)', async() => {
      fs.existsSync.mockImplementation((p) => String(p) === '/work/builder');
      fs.readdirSync.mockReturnValue([]);

      await modes.runUpPlatform({ force: true });

      expect(prompts.promptBuilderDirConflict).not.toHaveBeenCalled();
      expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalled();
      expect(upCommon.cleanBuilderAppDirs).toHaveBeenCalled();
    });

    it('prompts when project builder is empty but system builder has a platform app (force=true)', async() => {
      fs.existsSync.mockImplementation((p) => {
        const s = String(p);
        if (s === '/work/builder') return true;
        if (s === '/home/test/.aifabrix/builder') return true;
        if (s === '/home/test/.aifabrix/builder/keycloak') return true;
        return false;
      });
      fs.readdirSync.mockImplementation((p) => {
        const s = String(p);
        if (s === '/work/builder') return [];
        if (s === '/home/test/.aifabrix/builder/keycloak') return ['application.yaml'];
        return [];
      });

      await modes.runUpPlatform({ force: true });

      expect(prompts.promptBuilderDirConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPlatformApps: ['keycloak'],
          totalEntries: 1,
          systemBuilderRoot: '/home/test/.aifabrix/builder'
        })
      );
    });
  });

  describe('runFreshInstall', () => {
    it('prompts AI tool, then up-infra, then up-platform --force', async() => {
      const order = [];
      prompts.promptAiTool.mockImplementation(async() => order.push('ai'));
      infra.startInfra.mockImplementation(async() => order.push('infra'));
      upMiso.handleUpMiso.mockImplementation(async() => order.push('miso'));
      upDataplane.handleUpDataplane.mockImplementation(async() => order.push('dataplane'));

      await modes.runFreshInstall({ adminEmail: 'a@b', adminPassword: 'pw12345678' });

      expect(order).toEqual(['infra', 'ai', 'miso', 'dataplane']);
      expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalled();
    });
  });

  describe('runReinstall', () => {
    it('stops infra with volumes, removes secrets, then up-infra, then up-platform --force', async() => {
      fs.existsSync.mockReturnValue(true);
      const order = [];
      infra.stopInfraWithVolumes.mockImplementation(async() => order.push('down'));
      infra.startInfra.mockImplementation(async() => order.push('up-infra'));
      upMiso.handleUpMiso.mockImplementation(async() => order.push('miso'));
      upDataplane.handleUpDataplane.mockImplementation(async() => order.push('dataplane'));

      await modes.runReinstall();

      expect(order).toEqual(['down', 'up-infra', 'miso', 'dataplane']);
      expect(fs.rmSync).toHaveBeenCalled();
      expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalled();
    });
  });

  describe('runWipeData', () => {
    it('drops dbs/roles, removes secrets, up-infra, up-platform --force', async() => {
      const order = [];
      postgresWipe.wipePostgresData.mockImplementation(async() => {
        order.push('wipe');
        return { databases: ['app_db'], roles: ['app_user'] };
      });
      infra.startInfra.mockImplementation(async() => order.push('up-infra'));
      upMiso.handleUpMiso.mockImplementation(async() => order.push('miso'));

      await modes.runWipeData();

      expect(order[0]).toBe('wipe');
      expect(order).toContain('up-infra');
      expect(order).toContain('miso');
      expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalled();
    });
  });

  describe('runCleanInstallFiles', () => {
    it('removes secrets, up-infra, up-platform --force', async() => {
      fs.existsSync.mockReturnValue(true);
      await modes.runCleanInstallFiles();
      expect(fs.rmSync).toHaveBeenCalled();
      expect(infra.startInfra).toHaveBeenCalled();
      expect(upCommon.applyUpPlatformForceConfig).toHaveBeenCalled();
    });
  });

  describe('runUpdateImages', () => {
    it('pulls infra images when compose file exists', async() => {
      fs.existsSync.mockImplementation((p) => String(p).endsWith('compose.yaml'));
      await modes.runUpdateImages();
      expect(dockerExec.execWithDockerEnv).toHaveBeenCalledWith(
        expect.stringMatching(/docker compose .* pull/),
        expect.any(Object)
      );
      expect(infra.startInfra).toHaveBeenCalled();
      expect(upCommon.applyUpPlatformForceConfig).not.toHaveBeenCalled();
    });

    it('skips infra image pull when compose file is missing', async() => {
      fs.existsSync.mockReturnValue(false);
      await modes.runUpdateImages();
      expect(dockerExec.execWithDockerEnv).not.toHaveBeenCalledWith(
        expect.stringMatching(/docker compose .* pull/),
        expect.any(Object)
      );
    });
  });
});
