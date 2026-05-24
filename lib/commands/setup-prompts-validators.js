/**
 * Shared validators for setup prompts.
 *
 * @fileoverview Email/password validation for setup wizard
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
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
 * @param {string} input
 * @returns {true|string}
 */
function validatePassword(input) {
  const value = String(input ?? '');
  if (value.length === 0) return 'Admin password is required';
  if (value.length < 8) return 'Admin password must be at least 8 characters';
  return true;
}

module.exports = {
  validateEmail,
  validatePassword
};
