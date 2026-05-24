/**
 * @fileoverview Tests for setup admin credential prompts (dev / pro)
 */

'use strict';

jest.mock('inquirer');
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({
  getAdminEmail: jest.fn().mockResolvedValue(''),
  getSetupInstallationProfile: jest.fn().mockResolvedValue('dev'),
  setSetupInstallationProfile: jest.fn().mockResolvedValue('dev')
}));

const inquirer = require('inquirer');
const config = require('../../../lib/core/config');
const {
  promptAdminCredentialsWithProfile,
  displayProPasswordsOnce,
  resolveInstallationProfileFromOptions
} = require('../../../lib/commands/setup-prompts-admin');

describe('lib/commands/setup-prompts-admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getAdminEmail.mockResolvedValue('');
    config.setSetupInstallationProfile.mockResolvedValue('dev');
  });

  describe('resolveInstallationProfileFromOptions', () => {
    it('uses CLI installation flag', async() => {
      await expect(resolveInstallationProfileFromOptions({ installation: 'pro' })).resolves.toBe('pro');
    });
  });

  describe('displayProPasswordsOnce', () => {
    it('prints all three password labels', () => {
      const logger = require('../../../lib/utils/logger');
      displayProPasswordsOnce({ infra: 'i', keycloak: 'k', platform: 'p' });
      const text = logger.log.mock.calls.map((c) => c[0]).join('\n');
      expect(text).toContain('i');
      expect(text).toContain('k');
      expect(text).toContain('p');
      expect(text).toMatch(/not be shown again/i);
    });
  });

  describe('promptAdminCredentialsWithProfile', () => {
    it('returns dev single-password bundle from wizard', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ profile: 'dev' })
        .mockResolvedValueOnce({ adminEmail: 'dev@example.com' })
        .mockResolvedValueOnce({
          adminPassword: 'password1',
          adminPasswordConfirm: 'password1'
        });
      const result = await promptAdminCredentialsWithProfile({});
      expect(result.profile).toBe('dev');
      expect(result.adminEmail).toBe('dev@example.com');
      expect(result.passwordBundle).toEqual({ mode: 'single', password: 'password1' });
      expect(config.setSetupInstallationProfile).toHaveBeenCalledWith('dev');
    });

    it('pro autogen via CLI skips profile and password inquirer steps', async() => {
      const result = await promptAdminCredentialsWithProfile({
        installation: 'pro',
        proPasswordMode: 'autogen',
        adminEmail: 'pro@example.com'
      });
      expect(result.profile).toBe('pro');
      expect(result.passwordBundle.mode).toBe('split');
      expect(result.passwordBundle.infra).toBeTruthy();
      expect(result.passwordBundle.keycloak).toBeTruthy();
      expect(result.passwordBundle.platform).toBeTruthy();
      expect(new Set(inquirer.prompt.mock.calls).size).toBe(0);
    });
  });
});
