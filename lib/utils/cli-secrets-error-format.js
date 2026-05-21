/**
 * @fileoverview Missing-secrets CLI error lines (layout colors via cli-layout-chalk).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const { metadata, sectionTitle } = require('./cli-layout-chalk');
const { kvRefToSecretSetKey } = require('./secrets-missing-error');

/**
 * @param {string[]} messages - Output lines
 * @param {RegExpMatchArray|null} missingSecretsMatch - Missing secrets capture
 */
function pushMissingSecretsBodyLines(messages, missingSecretsMatch) {
  if (missingSecretsMatch) {
    const parts = missingSecretsMatch[1]
      .trim()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      messages.push(`   ${sectionTitle('Missing secrets:')}`);
      for (const ref of parts) {
        messages.push(`   ${chalk.cyan('-')} ${chalk.white(ref)}`);
      }
      return parts;
    }
    if (parts.length === 1) {
      messages.push(`   ${sectionTitle('Missing secrets:')} ${chalk.white(parts[0])}`);
      return parts;
    }
    messages.push(`   ${sectionTitle('Missing secrets:')}`);
    return [];
  }
  messages.push(`   ${chalk.white('Missing secrets in secrets file.')}`);
  return [];
}

/**
 * @param {string} errorMsg
 * @returns {Map<string, string>}
 */
function parseEnvTemplateLineHints(errorMsg) {
  const map = new Map();
  const re = /^Env-template-line: (kv:\/\/[^\s|]+)\|(.+)$/gm;
  let m;
  while ((m = re.exec(errorMsg)) !== null) {
    map.set(m[1].trim(), m[2].trim());
  }
  return map;
}

/**
 * @param {string[]} messages
 * @param {string[]} missingRefs
 * @param {Map<string, string>} templateLinesByRef
 * @param {string|null} envTemplatePath
 */
function pushRemediationHintLines(messages, missingRefs, templateLinesByRef, envTemplatePath) {
  messages.push(`   ${sectionTitle('You can fix this two ways:')}`);
  messages.push(
    `   ${chalk.cyan('1.')} ${chalk.white('Not used by your external system?')} Comment out or delete the line in env.template.`
  );
  if (envTemplatePath) {
    messages.push(`   ${metadata('env.template:')} ${chalk.white(envTemplatePath)}`);
  }
  for (const ref of missingRefs) {
    const line = templateLinesByRef.get(ref);
    if (line) {
      messages.push(`   ${metadata('Comment or delete:')} ${chalk.gray(line)}`);
    }
  }
  messages.push(
    `   ${chalk.cyan('2.')} ${chalk.white('Store the value:')} ${metadata('aifabrix secret set')} ${chalk.yellow('<key>')} ${chalk.gray('"<your-value>"')}`
  );
  for (const ref of missingRefs) {
    const key = kvRefToSecretSetKey(ref);
    if (key) {
      messages.push(`   ${metadata('Example:')} ${chalk.yellow(`aifabrix secret set ${key} "<your-value>"`)}`);
    }
  }
}

/**
 * @param {string[]} messages
 * @param {RegExpMatchArray|null} fileInfoMatch
 */
function pushSecretsFileLocationLine(messages, fileInfoMatch) {
  if (fileInfoMatch) {
    messages.push(`   ${metadata('Secrets file location:')} ${chalk.white(fileInfoMatch[1])}`);
  }
}

/**
 * Format secrets-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a secrets error
 */
function formatSecretsError(errorMsg) {
  if (!errorMsg.includes('Missing secrets')) {
    return null;
  }

  const messages = [];
  const missingRefs = pushMissingSecretsBodyLines(messages, errorMsg.match(/Missing secrets: ([^\n]+)/));
  pushSecretsFileLocationLine(messages, errorMsg.match(/Secrets file location: ([^\n]+)/));
  const envTemplatePathMatch = errorMsg.match(/Env-template-path: ([^\n]+)/);
  const envTemplatePath = envTemplatePathMatch ? envTemplatePathMatch[1].trim() : null;
  const templateLinesByRef = parseEnvTemplateLineHints(errorMsg);
  const refs =
    missingRefs.length > 0
      ? missingRefs
      : [...templateLinesByRef.keys()];
  if (refs.length > 0) {
    pushRemediationHintLines(messages, refs, templateLinesByRef, envTemplatePath);
  }
  return messages;
}

/**
 * @param {string} errorMsg
 * @returns {boolean}
 */
function isMissingSecretsErrorMessage(errorMsg) {
  return typeof errorMsg === 'string' && errorMsg.includes('Missing secrets');
}

module.exports = { formatSecretsError, isMissingSecretsErrorMessage };
