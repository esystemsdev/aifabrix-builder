/**
 * Credential display utilities – status icons and formatting for CLI output
 * Aligns with dataplane credential status lifecycle (pending, verified, failed, expired).
 *
 * @fileoverview Credential status formatter with icons and chalk colors
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

/** @type {{ verified: string, pending: string, failed: string, expired: string }} */
const STATUS_ICONS = {
  verified: ' ✔',
  pending: ' ○',
  failed: ' ✖',
  expired: ' ⊘'
};

/** @type {{ verified: string, pending: string, failed: string, expired: string }} */
const STATUS_LABELS = {
  verified: 'Valid',
  pending: 'Not tested',
  failed: 'Connection failed',
  expired: 'Token expired'
};

/**
 * Chalk color functions per status
 * @type {{ verified: Function, pending: Function, failed: Function, expired: Function }}
 */
const STATUS_CHALK = {
  verified: chalk.green,
  pending: chalk.gray,
  failed: chalk.red,
  expired: chalk.yellow
};

const VALID_STATUSES = ['verified', 'pending', 'failed', 'expired'];

/**
 * Format credential status for display (icon + optional label)
 * @param {string} [status] - Credential status (pending | verified | failed | expired)
 * @returns {{ icon: string, color: Function, label: string } | null} Status info or null when missing/invalid
 */
function formatCredentialStatus(status) {
  if (!status || typeof status !== 'string') return null;
  const s = status.toLowerCase();
  if (!VALID_STATUSES.includes(s)) return null;
  return {
    icon: STATUS_ICONS[s],
    color: STATUS_CHALK[s],
    label: STATUS_LABELS[s]
  };
}

/**
 * Format credential with status for CLI display
 * @param {Object} credential - Credential object from API
 * @param {string} [credential.key]
 * @param {string} [credential.id]
 * @param {string} [credential.credentialKey]
 * @param {string} [credential.displayName]
 * @param {string} [credential.name]
 * @param {string} [credential.status]
 * @returns {{ key: string, name: string, statusFormatted: string, statusLabel: string }}
 */
function formatCredentialWithStatus(credential) {
  const key = credential?.key ?? credential?.id ?? credential?.credentialKey ?? '-';
  const name = credential?.displayName ?? credential?.name ?? key;
  const statusInfo = formatCredentialStatus(credential?.status);
  const statusFormatted = statusInfo ? statusInfo.color(statusInfo.icon) : '';
  const statusLabel = statusInfo ? ` (${statusInfo.label})` : '';
  return { key, name, statusFormatted, statusLabel };
}

module.exports = {
  STATUS_ICONS,
  STATUS_LABELS,
  STATUS_CHALK,
  formatCredentialStatus,
  formatCredentialWithStatus
};
