/**
 * @fileoverview Tests for pro admin password generator
 */

'use strict';

const {
  generateRandomAdminPassword,
  generateProAdminPasswords
} = require('../../../lib/core/admin-password-generator');

describe('lib/core/admin-password-generator', () => {
  it('generateRandomAdminPassword returns non-empty string', () => {
    const p = generateRandomAdminPassword();
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThanOrEqual(16);
  });

  it('generateProAdminPasswords returns three distinct values', () => {
    const parts = generateProAdminPasswords();
    expect(parts.infra).toBeTruthy();
    expect(parts.keycloak).toBeTruthy();
    expect(parts.platform).toBeTruthy();
    const set = new Set([parts.infra, parts.keycloak, parts.platform]);
    expect(set.size).toBe(3);
  });
});
