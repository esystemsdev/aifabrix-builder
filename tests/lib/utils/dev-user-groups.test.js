/**
 * @fileoverview Tests for dev-user-groups
 */

const {
  ALLOWED_DEV_GROUPS,
  parseDevGroupsOption,
  validateDevGroups,
  augmentDevUserGroupsServerError
} = require('../../../lib/utils/dev-user-groups');

describe('dev-user-groups', () => {
  it('ALLOWED_DEV_GROUPS includes docker', () => {
    expect(ALLOWED_DEV_GROUPS).toContain('docker');
  });

  describe('parseDevGroupsOption', () => {
    it('parses comma-separated values and lowercases', () => {
      expect(parseDevGroupsOption('Admin, Developer,DOCKER')).toEqual(['admin', 'developer', 'docker']);
    });

    it('parses mixed commas and whitespace', () => {
      expect(parseDevGroupsOption('admin,  developer   docker')).toEqual(['admin', 'developer', 'docker']);
    });

    it('parses whitespace-separated values (e.g. PowerShell argv)', () => {
      expect(parseDevGroupsOption('admin developer docker')).toEqual(['admin', 'developer', 'docker']);
    });

    it('preserves secret-manager token', () => {
      expect(parseDevGroupsOption('SECRET-MANAGER,Developer')).toEqual(['secret-manager', 'developer']);
    });

    it('accepts array tokens from the shell/runtime', () => {
      expect(parseDevGroupsOption(['admin', 'developer', 'docker'])).toEqual(['admin', 'developer', 'docker']);
    });

    it('filters empty segments from repeated delimiters', () => {
      expect(parseDevGroupsOption('admin,,developer')).toEqual(['admin', 'developer']);
    });

    it('returns empty for empty string', () => {
      expect(parseDevGroupsOption('')).toEqual([]);
    });

    it('returns empty for null and undefined', () => {
      expect(parseDevGroupsOption(null)).toEqual([]);
      expect(parseDevGroupsOption(undefined)).toEqual([]);
    });

    it('returns empty for non-string non-array', () => {
      expect(parseDevGroupsOption(42)).toEqual([]);
      expect(parseDevGroupsOption({})).toEqual([]);
    });
  });

  describe('validateDevGroups', () => {
    it('accepts each allowed group alone', () => {
      expect(validateDevGroups(['admin'])).toEqual(['admin']);
      expect(validateDevGroups(['secret-manager'])).toEqual(['secret-manager']);
      expect(validateDevGroups(['developer'])).toEqual(['developer']);
      expect(validateDevGroups(['docker'])).toEqual(['docker']);
    });

    it('accepts docker with other groups', () => {
      expect(validateDevGroups(['admin', 'developer', 'docker'])).toEqual(['admin', 'developer', 'docker']);
    });

    it('rejects unknown group', () => {
      expect(() => validateDevGroups(['admin', 'nope'])).toThrow(/Invalid group/);
    });

    it('rejects when not an array', () => {
      expect(() => validateDevGroups('admin')).toThrow('groups must be an array');
    });
  });

  describe('augmentDevUserGroupsServerError', () => {
    it('appends hint when server enum omits docker but request included docker', () => {
      const err = new Error(
        'each value in groups must be one of the following values: admin, secret-manager, developer'
      );
      augmentDevUserGroupsServerError(err, ['admin', 'developer', 'docker']);
      expect(err.message).toContain('does not accept');
      expect(err.message).toContain('docker');
    });

    it('matches alternate class-validator wording', () => {
      const msg = 'groups: each value must be one of the following values: admin, secret-manager, developer';
      const err = new Error(msg);
      augmentDevUserGroupsServerError(err, ['docker']);
      expect(err.message.length).toBeGreaterThan(msg.length);
      expect(err.message).toContain('Builder Server');
    });

    it('does not modify when server message already mentions docker', () => {
      const msg = 'each value in groups must be one of: admin, developer, docker';
      const err = new Error(msg);
      augmentDevUserGroupsServerError(err, ['admin', 'docker']);
      expect(err.message).toBe(msg);
    });

    it('does not modify unrelated errors', () => {
      const err = new Error('network timeout');
      augmentDevUserGroupsServerError(err, ['admin', 'docker']);
      expect(err.message).toBe('network timeout');
    });

    it('does not modify when requestedGroups is undefined', () => {
      const msg = 'each value in groups must be one of the following values: admin, secret-manager, developer';
      const err = new Error(msg);
      augmentDevUserGroupsServerError(err, undefined);
      expect(err.message).toBe(msg);
    });

    it('returns safely for null error', () => {
      expect(augmentDevUserGroupsServerError(null, ['docker'])).toBeNull();
    });

    it('does not modify when docker was not requested', () => {
      const msg = 'each value in groups must be one of the following values: admin, secret-manager, developer';
      const err = new Error(msg);
      augmentDevUserGroupsServerError(err, ['admin', 'developer']);
      expect(err.message).toBe(msg);
    });
  });
});
