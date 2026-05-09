/**
 * @fileoverview Missing-secrets CLI error lines (layout colors via cli-layout-chalk).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const { metadata, sectionTitle } = require('./cli-layout-chalk');

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
      return;
    }
    if (parts.length === 1) {
      messages.push(`   ${sectionTitle('Missing secrets:')} ${chalk.white(parts[0])}`);
      return;
    }
    messages.push(`   ${sectionTitle('Missing secrets:')}`);
    return;
  }
  messages.push(`   ${chalk.white('Missing secrets in secrets file.')}`);
}

/**
 * @param {string[]} messages - Output lines
 * @param {RegExpMatchArray|null} fileInfoMatch - File location capture
 * @param {RegExpMatchArray|null} resolveMatch - Resolve command capture
 */
function pushSecretsResolutionHintLines(messages, fileInfoMatch, resolveMatch) {
  if (fileInfoMatch) {
    messages.push(`   ${metadata('Secrets file location:')} ${chalk.white(fileInfoMatch[1])}`);
  }
  if (resolveMatch) {
    messages.push(
      `   ${metadata('Run:')} ${chalk.yellow(`aifabrix resolve ${resolveMatch[1]} to generate missing secrets.`)}`
    );
    return;
  }
  messages.push(`   ${metadata('Run:')} ${chalk.yellow('aifabrix resolve <app-name> to generate missing secrets.')}`);
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
  pushMissingSecretsBodyLines(messages, errorMsg.match(/Missing secrets: ([^\n]+)/));
  pushSecretsResolutionHintLines(
    messages,
    errorMsg.match(/Secrets file location: ([^\n]+)/),
    errorMsg.match(/Run "aifabrix resolve ([^"]+)"/)
  );
  return messages;
}

module.exports = { formatSecretsError };
