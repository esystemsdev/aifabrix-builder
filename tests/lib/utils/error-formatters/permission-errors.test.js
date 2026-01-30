/**
 * Tests for Permission Error Formatters Module
 *
 * @fileoverview Unit tests for lib/utils/error-formatters/permission-errors.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

const {
  formatPermissionError,
  getPermissionDetailLines,
  extractMissingPermissions,
  extractRequiredPermissions
} = require('../../../../lib/utils/error-formatters/permission-errors');

describe('Permission Error Formatters Module', () => {
  describe('formatPermissionError', () => {
    it('should format permission error with missingPermissions', () => {
      const errorData = {
        detail: 'Permission denied',
        missingPermissions: ['read:app', 'write:app']
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Permission Denied');
      expect(result).toContain('Permission denied');
      expect(result).toContain('Missing permissions:');
      expect(result).toContain('- read:app');
      expect(result).toContain('- write:app');
    });

    it('should format permission error with requiredPermissions', () => {
      const errorData = {
        detail: 'Permission denied',
        requiredPermissions: ['admin:app']
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Permission Denied');
      expect(result).toContain('Required permissions:');
      expect(result).toContain('- admin:app');
    });

    it('should format permission error with both missing and required permissions', () => {
      const errorData = {
        detail: 'Permission denied',
        missingPermissions: ['read:app'],
        requiredPermissions: ['admin:app']
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Missing permissions:');
      expect(result).toContain('- read:app');
      expect(result).toContain('Required permissions:');
      expect(result).toContain('- admin:app');
    });

    it('should handle nested missing permissions structure', () => {
      const errorData = {
        detail: 'Permission denied',
        missing: {
          permissions: ['read:app', 'write:app']
        }
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Missing permissions:');
      expect(result).toContain('- read:app');
      expect(result).toContain('- write:app');
    });

    it('should handle nested required permissions structure', () => {
      const errorData = {
        detail: 'Permission denied',
        required: {
          permissions: ['admin:app']
        }
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Required permissions:');
      expect(result).toContain('- admin:app');
    });

    it('should include request URL when present', () => {
      const errorData = {
        detail: 'Permission denied',
        instance: '/api/v1/applications',
        method: 'POST'
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Request: POST /api/v1/applications');
    });

    it('should use url field if instance is not present', () => {
      const errorData = {
        detail: 'Permission denied',
        url: '/api/v1/applications',
        method: 'GET'
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Request: GET /api/v1/applications');
    });

    it('should use default method when not provided', () => {
      const errorData = {
        detail: 'Permission denied',
        instance: '/api/v1/applications'
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Request: POST /api/v1/applications');
    });

    it('should include correlation ID when present', () => {
      const errorData = {
        detail: 'Permission denied',
        correlationId: 'corr-123'
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Correlation ID: corr-123');
    });

    it('should handle error without detail', () => {
      const errorData = {
        missingPermissions: ['read:app']
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Permission Denied');
      expect(result).toContain('Missing permissions:');
      expect(result).not.toContain('Permission denied'); // No detail line
    });

    it('should handle error without permissions', () => {
      const errorData = {
        detail: 'Permission denied'
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Permission Denied');
      expect(result).toContain('Permission denied');
      expect(result).not.toContain('Missing permissions:');
      expect(result).not.toContain('Required permissions:');
    });

    it('should handle empty permissions arrays', () => {
      const errorData = {
        detail: 'Permission denied',
        missingPermissions: [],
        requiredPermissions: []
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Permission Denied');
      expect(result).not.toContain('Missing permissions:');
      expect(result).not.toContain('Required permissions:');
    });

    it('should handle error with all fields', () => {
      const errorData = {
        detail: 'Permission denied for this operation',
        missingPermissions: ['read:app'],
        requiredPermissions: ['admin:app'],
        instance: '/api/v1/applications/test-app',
        method: 'DELETE',
        correlationId: 'corr-456'
      };
      const result = formatPermissionError(errorData);

      expect(result).toContain('Permission Denied');
      expect(result).toContain('Permission denied for this operation');
      expect(result).toContain('Missing permissions:');
      expect(result).toContain('- read:app');
      expect(result).toContain('Required permissions:');
      expect(result).toContain('- admin:app');
      expect(result).toContain('Request: DELETE /api/v1/applications/test-app');
      expect(result).toContain('Correlation ID: corr-456');
    });
  });

  describe('getPermissionDetailLines', () => {
    it('should return lines for missing and required permissions', () => {
      const errorData = {
        missing: { permissions: ['read:app'] },
        required: { permissions: ['admin:app'] }
      };
      const lines = getPermissionDetailLines(errorData);
      expect(lines.some(l => l.includes('Missing permissions:'))).toBe(true);
      expect(lines.some(l => l.includes('- read:app'))).toBe(true);
      expect(lines.some(l => l.includes('Required permissions:'))).toBe(true);
      expect(lines.some(l => l.includes('- admin:app'))).toBe(true);
    });

    it('should return empty array when no permission data', () => {
      expect(getPermissionDetailLines({})).toEqual([]);
      expect(getPermissionDetailLines({ detail: 'Forbidden' })).toEqual([]);
    });
  });

  describe('extractMissingPermissions', () => {
    it('should extract from data.missing.permissions', () => {
      const errorData = { data: { missing: { permissions: ['p1'] } } };
      expect(extractMissingPermissions(errorData)).toEqual(['p1']);
    });
  });

  describe('extractRequiredPermissions', () => {
    it('should extract from permissions array', () => {
      const errorData = { permissions: ['wizard:session:create'] };
      expect(extractRequiredPermissions(errorData)).toEqual(['wizard:session:create']);
    });
    it('should extract from data.required.permissions', () => {
      const errorData = { data: { required: { permissions: ['p2'] } } };
      expect(extractRequiredPermissions(errorData)).toEqual(['p2']);
    });
  });
});

