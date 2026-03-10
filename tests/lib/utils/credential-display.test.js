/**
 * Tests for credential display utility
 *
 * @fileoverview Unit tests for lib/utils/credential-display.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = (t) => `\u001b[32m${t}\u001b[39m`;
  mockChalk.gray = (t) => `\u001b[90m${t}\u001b[39m`;
  mockChalk.red = (t) => `\u001b[31m${t}\u001b[39m`;
  mockChalk.yellow = (t) => `\u001b[33m${t}\u001b[39m`;
  return mockChalk;
});

const {
  STATUS_ICONS,
  STATUS_LABELS,
  formatCredentialStatus,
  formatCredentialWithStatus
} = require('../../../lib/utils/credential-display');

describe('credential-display', () => {
  describe('STATUS_ICONS', () => {
    it('should have icons for all statuses', () => {
      expect(STATUS_ICONS.verified).toBe(' ✓');
      expect(STATUS_ICONS.pending).toBe(' ○');
      expect(STATUS_ICONS.failed).toBe(' ✗');
      expect(STATUS_ICONS.expired).toBe(' ⊘');
    });
  });

  describe('formatCredentialStatus', () => {
    it('should return status info for verified', () => {
      const result = formatCredentialStatus('verified');
      expect(result).toEqual({
        icon: ' ✓',
        color: expect.any(Function),
        label: 'Valid'
      });
    });

    it('should return status info for pending', () => {
      const result = formatCredentialStatus('pending');
      expect(result).toEqual({
        icon: ' ○',
        color: expect.any(Function),
        label: 'Not tested'
      });
    });

    it('should return status info for failed', () => {
      const result = formatCredentialStatus('failed');
      expect(result).toEqual({
        icon: ' ✗',
        color: expect.any(Function),
        label: 'Connection failed'
      });
    });

    it('should return status info for expired', () => {
      const result = formatCredentialStatus('expired');
      expect(result).toEqual({
        icon: ' ⊘',
        color: expect.any(Function),
        label: 'Token expired'
      });
    });

    it('should accept uppercase status', () => {
      const result = formatCredentialStatus('VERIFIED');
      expect(result).toBeTruthy();
      expect(result.icon).toBe(' ✓');
    });

    it('should return null for missing status', () => {
      expect(formatCredentialStatus()).toBeNull();
      expect(formatCredentialStatus(undefined)).toBeNull();
    });

    it('should return null for invalid status', () => {
      expect(formatCredentialStatus('unknown')).toBeNull();
      expect(formatCredentialStatus('')).toBeNull();
    });

    it('should return null for non-string', () => {
      expect(formatCredentialStatus(123)).toBeNull();
      expect(formatCredentialStatus(null)).toBeNull();
    });
  });

  describe('formatCredentialWithStatus', () => {
    it('should return key, name, statusFormatted, and statusLabel for credential with status', () => {
      const cred = { key: 'hubspot-cred', displayName: 'HubSpot API Key', status: 'verified' };
      const result = formatCredentialWithStatus(cred);
      expect(result.key).toBe('hubspot-cred');
      expect(result.name).toBe('HubSpot API Key');
      expect(result.statusFormatted).toContain(' ✓');
      expect(result.statusLabel).toBe(' (Valid)');
    });

    it('should return empty statusFormatted and statusLabel when status is missing', () => {
      const cred = { key: 'cred-1', displayName: 'My Credential' };
      const result = formatCredentialWithStatus(cred);
      expect(result.key).toBe('cred-1');
      expect(result.name).toBe('My Credential');
      expect(result.statusFormatted).toBe('');
      expect(result.statusLabel).toBe('');
    });

    it('should handle alternative field names (id, credentialKey, name)', () => {
      const cred = { id: 'by-id', name: 'ByName', status: 'failed' };
      const result = formatCredentialWithStatus(cred);
      expect(result.key).toBe('by-id');
      expect(result.name).toBe('ByName');
      expect(result.statusFormatted).toContain(' ✗');
    });

    it('should handle status pending with gray', () => {
      const cred = { key: 'p', displayName: 'Pending', status: 'pending' };
      const result = formatCredentialWithStatus(cred);
      expect(result.statusFormatted).toContain(' ○');
    });

    it('should handle empty credential gracefully', () => {
      const result = formatCredentialWithStatus({});
      expect(result.key).toBe('-');
      expect(result.name).toBe('-');
      expect(result.statusFormatted).toBe('');
      expect(result.statusLabel).toBe('');
    });
  });
});
