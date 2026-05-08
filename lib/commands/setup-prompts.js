/**
 * Inquirer prompts for `aifabrix setup`.
 *
 * Three small prompt helpers:
 *   1. {@link promptModeSelection} - Mode menu shown when infra is already up.
 *   2. {@link promptAdminCredentials} - Admin email + password (fresh install only).
 *   3. {@link promptAiTool} - AI tool provider + keys, only when the merged
 *      secret cascade (user-local + shared) does not already provide the keys.
 *
 * Reads merged secrets via `loadSecrets()` from `lib/core/secrets.js` so the
 * resolution honors both `~/.aifabrix/secrets.local.yaml` and the shared
 * `aifabrix-secrets` file (or remote API). Writes always go to the user-local
 * file via `saveLocalSecret(...)`. The shared file is never modified.
 *
 * @fileoverview Setup prompts (mode menu, admin creds, AI tool)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const logger = require('../utils/logger');
const secretsCore = require('../core/secrets');
const localSecrets = require('../utils/local-secrets');
const { formatSuccessLine, infoLine } = require('../utils/cli-test-layout-chalk');

/** Mode identifiers. Public so callers can switch on them without string typos. */
const MODE = Object.freeze({
  REINSTALL: 'reinstall',
  WIPE_DATA: 'wipe-data',
  CLEAN_FILES: 'clean-files',
  UPDATE_IMAGES: 'update-images'
});

/** AI tool key names in `secrets.local.yaml` / shared secrets. */
const AI_KEYS = Object.freeze({
  OPENAI_API_KEY: 'secrets-openaiApiKeyVault',
  AZURE_OPENAI_URL: 'azure-openaiapi-urlKeyVault',
  AZURE_OPENAI_API_KEY: 'secrets-azureOpenaiApiKeyVault'
});

/**
 * Prompt the user to choose what to do when infra is already running.
 * @async
 * @returns {Promise<string>} One of MODE.* values
 */
async function promptModeSelection() {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Infrastructure is already running. What do you want to do?',
      choices: [
        {
          name: 'Re-install (all services - all data will be lost)',
          value: MODE.REINSTALL
        },
        {
          name: 'Wipe data (drop all databases and DB users; keep volumes)',
          value: MODE.WIPE_DATA
        },
        {
          name: 'Clean installation files and re-install platform services',
          value: MODE.CLEAN_FILES
        },
        {
          name: 'Install only platform services (update all containers)',
          value: MODE.UPDATE_IMAGES
        }
      ]
    }
  ]);
  return mode;
}

/**
 * Confirm a destructive mode unless `assumeYes` is true.
 * @async
 * @param {string} mode - One of MODE.* values
 * @param {boolean} assumeYes - When true, skip the confirmation
 * @returns {Promise<boolean>} True when the user confirms (or `assumeYes`)
 */
async function confirmDestructiveMode(mode, assumeYes) {
  if (assumeYes) return true;
  if (mode !== MODE.REINSTALL && mode !== MODE.WIPE_DATA) return true;
  const message =
    mode === MODE.REINSTALL
      ? 'This will stop all services and DELETE every infra volume. Continue?'
      : 'This will DROP every database and DB user. Continue?';
  const { ok } = await inquirer.prompt([
    { type: 'confirm', name: 'ok', message, default: false }
  ]);
  return ok === true;
}

/**
 * Validate an email address (RFC 5322-lite for CLI use).
 * @param {string} input
 * @returns {true|string}
 */
function validateEmail(input) {
  const value = (input || '').trim();
  if (!value) return 'Admin email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
  return true;
}

/**
 * Validate a password (non-empty, at least 8 chars).
 * @param {string} input
 * @returns {true|string}
 */
function validatePassword(input) {
  const value = String(input ?? '');
  if (value.length === 0) return 'Admin password is required';
  if (value.length < 8) return 'Admin password must be at least 8 characters';
  return true;
}

/**
 * Prompt for admin email + password (fresh install only).
 * Asks once for the password and once for confirmation; returns trimmed email
 * and the verbatim password (never logged).
 *
 * @async
 * @returns {Promise<{ adminEmail: string, adminPassword: string }>}
 */
async function promptAdminCredentials() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'adminEmail',
      message: 'Admin email (used by Keycloak / pgAdmin):',
      validate: validateEmail
    },
    {
      type: 'password',
      name: 'adminPassword',
      message: 'Admin password (Postgres / pgAdmin / Keycloak):',
      mask: '*',
      validate: validatePassword
    },
    {
      type: 'password',
      name: 'adminPasswordConfirm',
      message: 'Confirm admin password:',
      mask: '*',
      validate(input, all) {
        if (input !== all.adminPassword) return 'Passwords do not match';
        return true;
      }
    }
  ]);
  return {
    adminEmail: String(answers.adminEmail).trim(),
    adminPassword: answers.adminPassword
  };
}

/**
 * @typedef {Object} AiToolStatus
 * @property {boolean} openAiConfigured - True when OpenAI key resolves non-empty
 * @property {boolean} azureOpenAiConfigured - True when Azure URL + key resolve non-empty
 */

/**
 * Detect whether AI tool keys are already present in the merged secret view.
 * Treats values surrounded by Handlebars-style placeholders (e.g. `{{...}}`)
 * as not configured.
 *
 * @async
 * @returns {Promise<AiToolStatus>}
 */
async function detectAiToolStatus() {
  let merged = {};
  try {
    merged = await secretsCore.loadSecrets(undefined);
  } catch {
    merged = {};
  }
  const isSet = (key) => {
    const raw = merged ? merged[key] : undefined;
    if (raw === undefined || raw === null) return false;
    const value = String(raw).trim();
    if (!value) return false;
    if (value.startsWith('{{') && value.endsWith('}}')) return false;
    return true;
  };
  return {
    openAiConfigured: isSet(AI_KEYS.OPENAI_API_KEY),
    azureOpenAiConfigured:
      isSet(AI_KEYS.AZURE_OPENAI_URL) && isSet(AI_KEYS.AZURE_OPENAI_API_KEY)
  };
}

/**
 * Ask which AI tool the user wants to configure when none is configured yet.
 * @async
 * @returns {Promise<'openai'|'azure'|'skip'>}
 */
async function askAiToolChoice() {
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'Which AI tool do you want to configure for the dataplane?',
      choices: [
        { name: 'OpenAI (api.openai.com)', value: 'openai' },
        { name: 'Azure OpenAI (your Azure resource)', value: 'azure' },
        { name: 'Skip for now (set later via aifabrix secret set)', value: 'skip' }
      ]
    }
  ]);
  return choice;
}

/**
 * Collect and persist OpenAI key.
 * @async
 * @returns {Promise<void>}
 */
async function collectAndSaveOpenAiKey() {
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'OpenAI API key:',
      mask: '*',
      validate(input) {
        return String(input || '').trim() ? true : 'API key is required';
      }
    }
  ]);
  await localSecrets.saveLocalSecret(AI_KEYS.OPENAI_API_KEY, String(apiKey).trim());
  logger.log(formatSuccessLine('OpenAI API key saved to user-local secrets'));
}

/**
 * Collect and persist Azure OpenAI URL + key.
 * @async
 * @returns {Promise<void>}
 */
async function collectAndSaveAzureOpenAi() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Azure OpenAI endpoint URL (e.g. https://my-aoai.openai.azure.com):',
      validate(input) {
        const value = String(input || '').trim();
        if (!value) return 'Endpoint URL is required';
        if (!/^https?:\/\//.test(value)) return 'URL must start with http(s)://';
        return true;
      }
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Azure OpenAI API key:',
      mask: '*',
      validate(input) {
        return String(input || '').trim() ? true : 'API key is required';
      }
    }
  ]);
  await localSecrets.saveLocalSecret(AI_KEYS.AZURE_OPENAI_URL, String(answers.url).trim());
  await localSecrets.saveLocalSecret(
    AI_KEYS.AZURE_OPENAI_API_KEY,
    String(answers.apiKey).trim()
  );
  logger.log(formatSuccessLine('Azure OpenAI endpoint and API key saved to user-local secrets'));
}

/**
 * Run the AI tool prompt sequence.
 * Skips silently when either provider is already configured (in any source).
 *
 * @async
 * @returns {Promise<void>}
 */
async function promptAiTool() {
  const status = await detectAiToolStatus();
  if (status.openAiConfigured) {
    logger.log(infoLine('OpenAI key already configured - skipping AI tool prompt.'));
    return;
  }
  if (status.azureOpenAiConfigured) {
    logger.log(infoLine('Azure OpenAI endpoint and key already configured - skipping AI tool prompt.'));
    return;
  }
  const choice = await askAiToolChoice();
  if (choice === 'openai') {
    await collectAndSaveOpenAiKey();
    return;
  }
  if (choice === 'azure') {
    await collectAndSaveAzureOpenAi();
    return;
  }
  logger.log(
    chalk.gray(
      'Skipped. Set later: aifabrix secret set ' +
        AI_KEYS.OPENAI_API_KEY +
        ' <key>  (or the two azure-openaiapi-urlKeyVault / secrets-azureOpenaiApiKeyVault keys)'
    )
  );
}

module.exports = {
  MODE,
  AI_KEYS,
  promptModeSelection,
  confirmDestructiveMode,
  promptAdminCredentials,
  promptAiTool,
  detectAiToolStatus
};
