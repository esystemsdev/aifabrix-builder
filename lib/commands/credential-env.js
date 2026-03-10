/**
 * Credential env command – prompts for KV_* values and writes .env.
 * Used by `aifabrix credential env <system-key>`.
 *
 * @fileoverview Credential env command – interactive credential capture to .env
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { kvEnvKeyToPath } = require('../utils/credential-secrets-env');
const { parseEnvToMap } = require('../utils/credential-secrets-env');

const KV_PREFIX = 'KV_';

/**
 * Secret var suffixes (use password prompt).
 * @type {Set<string>}
 */
const SECRET_SUFFIXES = new Set([
  'CLIENTID', 'CLIENTSECRET', 'APIKEY', 'USERNAME', 'PASSWORD', 'PARAMVALUE',
  'SIGNINGSECRET', 'BEARERTOKEN'
]);

/**
 * Validates system-key format.
 * @param {string} systemKey - System key
 * @throws {Error} If invalid
 */
function validateSystemKeyFormat(systemKey) {
  if (!systemKey || typeof systemKey !== 'string') {
    throw new Error('System key is required and must be a string');
  }
  if (!/^[a-z0-9-_]+$/.test(systemKey)) {
    throw new Error('System key must contain only lowercase letters, numbers, hyphens, and underscores');
  }
}

/**
 * Extracts KV_* variable names from env.template content.
 * @param {string} content - env.template content
 * @returns {Array<{ key: string, isSecret: boolean }>} KV_* vars to prompt
 */
function extractKvVarsFromTemplate(content) {
  if (!content || typeof content !== 'string') return [];
  const vars = [];
  const seen = new Set();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.substring(0, eq).trim();
    if (!key.toUpperCase().startsWith(KV_PREFIX)) continue;
    if (kvEnvKeyToPath(key) && !seen.has(key)) {
      seen.add(key);
      const suffix = key.slice(KV_PREFIX.length).split('_').pop() || '';
      vars.push({ key, isSecret: SECRET_SUFFIXES.has(suffix.toUpperCase()) });
    }
  }
  return vars;
}

/**
 * Prompts for KV_* values using inquirer.
 * @async
 * @param {Array<{ key: string, isSecret: boolean }>} vars - Variables to prompt
 * @param {Object} existingMap - Existing .env key-value map (for default values)
 * @returns {Promise<Object.<string, string>>} Key-value map from prompts
 */
async function promptForKvValues(vars, existingMap) {
  if (vars.length === 0) return {};
  const inquirer = require('inquirer');
  const questions = vars.map(({ key, isSecret }) => ({
    type: isSecret ? 'password' : 'input',
    name: key,
    message: key,
    default: existingMap[key] || undefined
  }));
  return await inquirer.prompt(questions);
}

/**
 * Builds .env content: template lines with KV_* values replaced/merged from prompts.
 * Preserves comments, non-KV lines, and structure; updates KV_* with prompted values.
 * @param {string} templateContent - env.template content
 * @param {Object.<string, string>} promptValues - Values from prompts
 * @returns {string} Final .env content
 */
function buildEnvContent(templateContent, promptValues) {
  if (!templateContent || typeof templateContent !== 'string') return '';
  const lines = templateContent.split(/\r?\n/);
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      result.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      result.push(line);
      continue;
    }
    const key = trimmed.substring(0, eq).trim();
    if (key.toUpperCase().startsWith(KV_PREFIX) && key in promptValues) {
      result.push(`${key}=${promptValues[key]}`);
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

/**
 * Runs credential env command: prompt for KV_* values and write .env.
 * @async
 * @param {string} systemKey - External system key (integration/<system-key>/)
 * @returns {Promise<string>} Path to written .env file
 * @throws {Error} If env.template missing or write fails
 */
function loadExistingEnvMap(envPath) {
  if (!fs.existsSync(envPath)) return {};
  return parseEnvToMap(fs.readFileSync(envPath, 'utf8'));
}

async function runCredentialEnv(systemKey) {
  validateSystemKeyFormat(systemKey);
  const appPath = getIntegrationPath(systemKey);
  const envTemplatePath = path.join(appPath, 'env.template');
  const envPath = path.join(appPath, '.env');

  if (!fs.existsSync(envTemplatePath)) {
    throw new Error(`env.template not found at ${envTemplatePath}. Create the integration first (e.g. aifabrix wizard or download).`);
  }

  const templateContent = fs.readFileSync(envTemplatePath, 'utf8');
  const vars = extractKvVarsFromTemplate(templateContent);

  if (vars.length === 0) {
    logger.log(chalk.yellow('No KV_* variables in env.template. Nothing to prompt.'));
    return envPath;
  }

  const existingMap = loadExistingEnvMap(envPath);
  logger.log(chalk.blue(`\nEnter credential values for ${systemKey} (integration/${systemKey}/):`));
  const promptValues = await promptForKvValues(vars, existingMap);
  const content = buildEnvContent(templateContent, promptValues);

  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  logger.log(chalk.green(`✓ Wrote ${envPath}`));
  return envPath;
}

module.exports = { runCredentialEnv, validateSystemKeyFormat, extractKvVarsFromTemplate, buildEnvContent };
