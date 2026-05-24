/**
 * Cryptographically strong passwords for pro setup autogenerate.
 *
 * @fileoverview Pro installation password generation (show-once in setup wizard)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const crypto = require('crypto');

const PRO_PASSWORD_BYTE_LENGTH = 18;

/**
 * One random password suitable for admin roles (URL-safe, no quotes).
 * @returns {string}
 */
function generateRandomAdminPassword() {
  return crypto.randomBytes(PRO_PASSWORD_BYTE_LENGTH).toString('base64url');
}

/**
 * Distinct passwords for infra, Keycloak install, and platform UI login.
 * @returns {{ infra: string, keycloak: string, platform: string }}
 */
function generateProAdminPasswords() {
  return {
    infra: generateRandomAdminPassword(),
    keycloak: generateRandomAdminPassword(),
    platform: generateRandomAdminPassword()
  };
}

module.exports = {
  generateRandomAdminPassword,
  generateProAdminPasswords
};
