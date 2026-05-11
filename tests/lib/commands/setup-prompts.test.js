/**
 * Tests for `lib/commands/setup-prompts.js`.
 *
 * @fileoverview Unit tests for setup prompt helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

jest.mock('inquirer');
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/core/secrets');
jest.mock('../../../lib/core/secrets-ensure', () => ({
  setSecretInStore: jest.fn().mockResolvedValue(undefined)
}));

const inquirer = require('inquirer');
const logger = require('../../../lib/utils/logger');
const secretsCore = require('../../../lib/core/secrets');
const secretsEnsure = require('../../../lib/core/secrets-ensure');

const {
  MODE,
  AI_KEYS,
  promptModeSelection,
  confirmDestructiveMode,
  promptAdminCredentials,
  promptAiTool,
  detectAiToolStatus
} = require('../../../lib/commands/setup-prompts');

describe('lib/commands/setup-prompts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    logger.log.mockImplementation(() => {});
    inquirer.prompt.mockReset();
    secretsCore.loadSecrets.mockResolvedValue({});
    secretsEnsure.setSecretInStore.mockResolvedValue(undefined);
  });

  describe('MODE / AI_KEYS', () => {
    it('exposes stable mode identifiers', () => {
      expect(MODE.REINSTALL).toBe('reinstall');
      expect(MODE.WIPE_DATA).toBe('wipe-data');
      expect(MODE.CLEAN_FILES).toBe('clean-files');
      expect(MODE.UPDATE_IMAGES).toBe('update-images');
    });

    it('exposes the canonical AI key names', () => {
      expect(AI_KEYS.OPENAI_API_KEY).toBe('secrets-openaiApiKeyVault');
      expect(AI_KEYS.AZURE_OPENAI_URL).toBe('azure-openaiapi-urlKeyVault');
      expect(AI_KEYS.AZURE_OPENAI_API_KEY).toBe('secrets-azureOpenaiApiKeyVault');
    });
  });

  describe('promptModeSelection', () => {
    it('returns the selected mode value', async() => {
      inquirer.prompt.mockResolvedValue({ mode: 'wipe-data' });
      await expect(promptModeSelection()).resolves.toBe('wipe-data');
    });
  });

  describe('confirmDestructiveMode', () => {
    it('returns true immediately when assumeYes is true', async() => {
      await expect(confirmDestructiveMode('reinstall', true)).resolves.toBe(true);
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('returns true without prompting for non-destructive modes', async() => {
      await expect(confirmDestructiveMode('clean-files', false)).resolves.toBe(true);
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('prompts for reinstall and returns user answer', async() => {
      inquirer.prompt.mockResolvedValue({ ok: true });
      await expect(confirmDestructiveMode('reinstall', false)).resolves.toBe(true);
    });

    it('prompts for wipe-data and returns false on decline', async() => {
      inquirer.prompt.mockResolvedValue({ ok: false });
      await expect(confirmDestructiveMode('wipe-data', false)).resolves.toBe(false);
    });
  });

  describe('promptAdminCredentials', () => {
    it('returns trimmed email and verbatim password', async() => {
      inquirer.prompt.mockResolvedValue({
        adminEmail: '  admin@example.com ',
        adminPassword: 'changeme1',
        adminPasswordConfirm: 'changeme1'
      });
      const result = await promptAdminCredentials();
      expect(result).toEqual({
        adminEmail: 'admin@example.com',
        adminPassword: 'changeme1'
      });
    });

    it('rejects empty / malformed email and short / mismatched password through inquirer validators', async() => {
      let captured;
      inquirer.prompt.mockImplementation(async(questions) => {
        captured = questions;
        return {
          adminEmail: 'admin@example.com',
          adminPassword: 'changeme1',
          adminPasswordConfirm: 'changeme1'
        };
      });
      await promptAdminCredentials();

      const [emailQ, pwQ, confirmQ] = captured;
      expect(emailQ.validate('')).toMatch(/required/);
      expect(emailQ.validate('not-an-email')).toMatch(/valid email/);
      expect(emailQ.validate('a@b.c')).toBe(true);

      expect(pwQ.validate('')).toMatch(/required/);
      expect(pwQ.validate('short')).toMatch(/at least 8/);
      expect(pwQ.validate('longenough')).toBe(true);

      expect(confirmQ.validate('a', { adminPassword: 'b' })).toMatch(/do not match/);
      expect(confirmQ.validate('same', { adminPassword: 'same' })).toBe(true);
    });
  });

  describe('detectAiToolStatus', () => {
    it('reports openai configured when key has a real value', async() => {
      secretsCore.loadSecrets.mockResolvedValue({
        'secrets-openaiApiKeyVault': 'sk-real-key'
      });
      await expect(detectAiToolStatus()).resolves.toEqual({
        openAiConfigured: true,
        azureOpenAiConfigured: false
      });
    });

    it('treats placeholder {{...}} values as not configured', async() => {
      secretsCore.loadSecrets.mockResolvedValue({
        'secrets-openaiApiKeyVault': '{{openai-key}}'
      });
      await expect(detectAiToolStatus()).resolves.toEqual({
        openAiConfigured: false,
        azureOpenAiConfigured: false
      });
    });

    it('requires both Azure URL and key to count as configured', async() => {
      secretsCore.loadSecrets.mockResolvedValue({
        'azure-openaiapi-urlKeyVault': 'https://x.openai.azure.com'
      });
      await expect(detectAiToolStatus()).resolves.toEqual({
        openAiConfigured: false,
        azureOpenAiConfigured: false
      });
    });

    it('reports azure configured when both URL and key resolve', async() => {
      secretsCore.loadSecrets.mockResolvedValue({
        'azure-openaiapi-urlKeyVault': 'https://x.openai.azure.com',
        'secrets-azureOpenaiApiKeyVault': 'real-key'
      });
      await expect(detectAiToolStatus()).resolves.toEqual({
        openAiConfigured: false,
        azureOpenAiConfigured: true
      });
    });

    it('returns all-false when loadSecrets throws', async() => {
      secretsCore.loadSecrets.mockRejectedValue(new Error('read failed'));
      await expect(detectAiToolStatus()).resolves.toEqual({
        openAiConfigured: false,
        azureOpenAiConfigured: false
      });
    });
  });

  describe('promptAiTool', () => {
    it('skips silently when openai is already configured', async() => {
      secretsCore.loadSecrets.mockResolvedValue({
        'secrets-openaiApiKeyVault': 'sk-real'
      });
      await promptAiTool();
      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(secretsEnsure.setSecretInStore).not.toHaveBeenCalled();
    });

    it('skips silently when azure is already configured', async() => {
      secretsCore.loadSecrets.mockResolvedValue({
        'azure-openaiapi-urlKeyVault': 'https://x.openai.azure.com',
        'secrets-azureOpenaiApiKeyVault': 'real-key'
      });
      await promptAiTool();
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('saves OpenAI key when user selects openai', async() => {
      secretsCore.loadSecrets.mockResolvedValue({});
      inquirer.prompt
        .mockResolvedValueOnce({ choice: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test' });
      await promptAiTool();
      expect(secretsEnsure.setSecretInStore).toHaveBeenCalledWith(
        'secrets-openaiApiKeyVault',
        'sk-test'
      );
    });

    it('saves Azure URL + key when user selects azure', async() => {
      secretsCore.loadSecrets.mockResolvedValue({});
      inquirer.prompt
        .mockResolvedValueOnce({ choice: 'azure' })
        .mockResolvedValueOnce({
          url: 'https://x.openai.azure.com',
          apiKey: 'azure-key'
        });
      await promptAiTool();
      expect(secretsEnsure.setSecretInStore).toHaveBeenCalledWith(
        'azure-openaiapi-urlKeyVault',
        'https://x.openai.azure.com'
      );
      expect(secretsEnsure.setSecretInStore).toHaveBeenCalledWith(
        'secrets-azureOpenaiApiKeyVault',
        'azure-key'
      );
    });

    it('does not save anything when user selects skip', async() => {
      secretsCore.loadSecrets.mockResolvedValue({});
      inquirer.prompt.mockResolvedValueOnce({ choice: 'skip' });
      await promptAiTool();
      expect(secretsEnsure.setSecretInStore).not.toHaveBeenCalled();
    });

    it('uses validators that reject empty OpenAI API key', async() => {
      secretsCore.loadSecrets.mockResolvedValue({});
      let capturedKeyQuestion;
      inquirer.prompt
        .mockImplementationOnce(async() => ({ choice: 'openai' }))
        .mockImplementationOnce(async(questions) => {
          capturedKeyQuestion = questions[0];
          return { apiKey: 'sk-test' };
        });
      await promptAiTool();
      expect(capturedKeyQuestion.validate('')).toMatch(/required/);
      expect(capturedKeyQuestion.validate('   ')).toMatch(/required/);
      expect(capturedKeyQuestion.validate('sk-test')).toBe(true);
    });

    it('uses validators that require https URL for Azure', async() => {
      secretsCore.loadSecrets.mockResolvedValue({});
      let capturedAzureQuestions;
      inquirer.prompt
        .mockImplementationOnce(async() => ({ choice: 'azure' }))
        .mockImplementationOnce(async(questions) => {
          capturedAzureQuestions = questions;
          return {
            url: 'https://x.openai.azure.com',
            apiKey: 'k'
          };
        });
      await promptAiTool();
      const [urlQ, keyQ] = capturedAzureQuestions;
      expect(urlQ.validate('')).toMatch(/required/);
      expect(urlQ.validate('not-a-url')).toMatch(/http/);
      expect(urlQ.validate('https://x.com')).toBe(true);
      expect(keyQ.validate('')).toMatch(/required/);
      expect(keyQ.validate('k')).toBe(true);
    });
  });
});
