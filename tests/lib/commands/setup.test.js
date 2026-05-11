/**
 * Tests for `lib/commands/setup.js` (handler + state detection + dispatch).
 *
 * @fileoverview Unit tests for setup orchestrator
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

jest.mock('../../../lib/infrastructure');
jest.mock('../../../lib/core/config', () => ({
  setDeveloperId: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../../lib/commands/setup-prompts', () => ({
  MODE: {
    REINSTALL: 'reinstall',
    WIPE_DATA: 'wipe-data',
    CLEAN_FILES: 'clean-files',
    UPDATE_IMAGES: 'update-images'
  },
  AI_KEYS: {
    OPENAI_API_KEY: 'secrets-openaiApiKeyVault',
    AZURE_OPENAI_URL: 'azure-openaiapi-urlKeyVault',
    AZURE_OPENAI_API_KEY: 'secrets-azureOpenaiApiKeyVault'
  },
  promptModeSelection: jest.fn(),
  promptAdminCredentials: jest.fn(),
  confirmDestructiveMode: jest.fn(),
  promptAiTool: jest.fn(),
  detectAiToolStatus: jest.fn()
}));
jest.mock('../../../lib/commands/setup-modes');
jest.mock('../../../lib/utils/logger');

const infra = require('../../../lib/infrastructure');
const config = require('../../../lib/core/config');
const prompts = require('../../../lib/commands/setup-prompts');
const modes = require('../../../lib/commands/setup-modes');
const logger = require('../../../lib/utils/logger');

const { handleSetup, isInfraRunning, dispatchMode } = require('../../../lib/commands/setup');

describe('lib/commands/setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log.mockImplementation(() => {});
    prompts.confirmDestructiveMode.mockResolvedValue(true);
  });

  describe('isInfraRunning', () => {
    it('returns false when getInfraStatus throws', async() => {
      infra.getInfraStatus.mockRejectedValue(new Error('docker offline'));
      await expect(isInfraRunning()).resolves.toBe(false);
    });

    it('returns false when no service is running/healthy', async() => {
      infra.getInfraStatus.mockResolvedValue({
        postgres: { status: 'stopped' },
        redis: { status: 'not_found' }
      });
      await expect(isInfraRunning()).resolves.toBe(false);
    });

    it('returns true when at least one service is running', async() => {
      infra.getInfraStatus.mockResolvedValue({
        postgres: { status: 'running' },
        redis: { status: 'stopped' }
      });
      await expect(isInfraRunning()).resolves.toBe(true);
    });

    it('returns true when at least one service is healthy', async() => {
      infra.getInfraStatus.mockResolvedValue({
        postgres: { status: 'healthy' }
      });
      await expect(isInfraRunning()).resolves.toBe(true);
    });
  });

  describe('dispatchMode', () => {
    it('dispatches REINSTALL to runReinstall', async() => {
      modes.runReinstall.mockResolvedValue(undefined);
      await dispatchMode('reinstall');
      expect(modes.runReinstall).toHaveBeenCalled();
    });

    it('dispatches WIPE_DATA to runWipeData', async() => {
      modes.runWipeData.mockResolvedValue(undefined);
      await dispatchMode('wipe-data');
      expect(modes.runWipeData).toHaveBeenCalled();
    });

    it('dispatches CLEAN_FILES to runCleanInstallFiles', async() => {
      modes.runCleanInstallFiles.mockResolvedValue(undefined);
      await dispatchMode('clean-files');
      expect(modes.runCleanInstallFiles).toHaveBeenCalled();
    });

    it('dispatches UPDATE_IMAGES to runUpdateImages', async() => {
      modes.runUpdateImages.mockResolvedValue(undefined);
      await dispatchMode('update-images');
      expect(modes.runUpdateImages).toHaveBeenCalled();
    });

    it('throws on unknown mode', async() => {
      await expect(dispatchMode('bogus')).rejects.toThrow(/Unknown setup mode/);
    });
  });

  describe('handleSetup (fresh install)', () => {
    it('runs the wizard when no infra is running', async() => {
      infra.getInfraStatus.mockResolvedValue({});
      prompts.promptAdminCredentials.mockResolvedValue({
        adminEmail: 'admin@example.com',
        adminPassword: 'changeme1'
      });
      modes.runFreshInstall.mockResolvedValue(undefined);

      await handleSetup({});

      expect(prompts.promptAdminCredentials).toHaveBeenCalled();
      expect(modes.runFreshInstall).toHaveBeenCalledWith({
        adminEmail: 'admin@example.com',
        adminPassword: 'changeme1'
      });
      expect(config.setDeveloperId).not.toHaveBeenCalled();
    });

    it('pins developer id before fresh install when --developer is passed', async() => {
      infra.getInfraStatus.mockResolvedValue({});
      prompts.promptAdminCredentials.mockResolvedValue({
        adminEmail: 'admin@example.com',
        adminPassword: 'changeme1'
      });
      modes.runFreshInstall.mockResolvedValue(undefined);

      await handleSetup({ developer: '7' });

      expect(config.setDeveloperId).toHaveBeenCalledWith('7');
      expect(modes.runFreshInstall).toHaveBeenCalled();
    });

    it('ignores --developer when infra is already running', async() => {
      infra.getInfraStatus.mockResolvedValue({ postgres: { status: 'running' } });
      prompts.promptModeSelection.mockResolvedValue('clean-files');
      modes.runCleanInstallFiles.mockResolvedValue(undefined);
      await handleSetup({ developer: '7' });
      expect(config.setDeveloperId).not.toHaveBeenCalled();
    });
  });

  describe('handleSetup (existing infra)', () => {
    beforeEach(() => {
      infra.getInfraStatus.mockResolvedValue({
        postgres: { status: 'running' }
      });
    });

    it('shows the mode menu and dispatches the chosen mode', async() => {
      prompts.promptModeSelection.mockResolvedValue('clean-files');
      modes.runCleanInstallFiles.mockResolvedValue(undefined);
      await handleSetup({});
      expect(prompts.promptModeSelection).toHaveBeenCalled();
      expect(modes.runCleanInstallFiles).toHaveBeenCalled();
    });

    it('skips destructive confirmation when --yes is passed', async() => {
      prompts.promptModeSelection.mockResolvedValue('reinstall');
      prompts.confirmDestructiveMode.mockResolvedValue(true);
      modes.runReinstall.mockResolvedValue(undefined);
      await handleSetup({ yes: true });
      expect(prompts.confirmDestructiveMode).toHaveBeenCalledWith('reinstall', true);
      expect(modes.runReinstall).toHaveBeenCalled();
    });

    it('aborts when confirmDestructiveMode returns false', async() => {
      prompts.promptModeSelection.mockResolvedValue('reinstall');
      prompts.confirmDestructiveMode.mockResolvedValue(false);
      await handleSetup({});
      expect(modes.runReinstall).not.toHaveBeenCalled();
    });
  });
});
