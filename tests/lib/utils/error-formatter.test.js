/**
 * Tests for Error Formatter Module
 *
 * @fileoverview Unit tests for lib/utils/error-formatter.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  formatSingleError,
  formatValidationErrors
} = require('../../../lib/utils/error-formatter');

describe('Error Formatter Module', () => {
  describe('formatSingleError', () => {
    it('should format required property error', () => {
      const error = {
        instancePath: '/app',
        keyword: 'required',
        params: { missingProperty: 'displayName' },
        message: 'Missing required property'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "app": Missing required property "displayName"');
    });

    it('should format type error', () => {
      const error = {
        instancePath: '/port',
        keyword: 'type',
        params: { type: 'number' },
        data: '3000',
        message: 'Expected number'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "port": Expected number, got string');
    });

    it('should format minimum value error', () => {
      const error = {
        instancePath: '/port',
        keyword: 'minimum',
        params: { limit: 1 },
        message: 'Value too small'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "port": Value must be at least 1');
    });

    it('should format maximum value error', () => {
      const error = {
        instancePath: '/port',
        keyword: 'maximum',
        params: { limit: 65535 },
        message: 'Value too large'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "port": Value must be at most 65535');
    });

    it('should format minLength error', () => {
      const error = {
        instancePath: '/name',
        keyword: 'minLength',
        params: { limit: 3 },
        message: 'String too short'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "name": Must be at least 3 characters');
    });

    it('should format maxLength error', () => {
      const error = {
        instancePath: '/name',
        keyword: 'maxLength',
        params: { limit: 50 },
        message: 'String too long'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "name": Must be at most 50 characters');
    });

    it('should format pattern error with value and pattern description', () => {
      const error = {
        instancePath: '/permissions/0/name',
        keyword: 'pattern',
        params: { pattern: '^[a-z0-9-:]+$' },
        data: 'invalid.value',
        message: 'Invalid format'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "permissions/0/name": Invalid value "invalid.value" - lowercase letters, numbers, hyphens, and colons only (e.g., "entity:action")');
    });

    it('should format pattern error with unknown pattern', () => {
      const error = {
        instancePath: '/email',
        keyword: 'pattern',
        params: { pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
        data: 'bad-email',
        message: 'Invalid format'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "email": Invalid value "bad-email" - must match pattern: ^[a-z]+@[a-z]+\\.[a-z]+$');
    });

    it('should format pattern error without data value when no root is passed', () => {
      const error = {
        instancePath: '/key',
        keyword: 'pattern',
        params: { pattern: '^[a-z0-9-]+$' },
        message: 'Invalid format'
      };

      const result = formatSingleError(error);

      expect(result).toContain('Field "key"');
      expect(result).toContain('(unavailable');
      expect(result).toContain('lowercase letters, numbers, and hyphens only');
    });

    it('should format pattern error using rootData when AJV omits data', () => {
      const error = {
        instancePath: '/roles/0/value',
        keyword: 'pattern',
        params: { pattern: '^[a-z0-9-]+$' },
        message: 'Invalid format'
      };
      const rootData = { roles: [{ value: 'test-e2e-hubspot-admin' }] };

      const result = formatSingleError(error, { rootData });

      expect(result).toContain('"test-e2e-hubspot-admin"');
      expect(result).toContain('lowercase letters, numbers, and hyphens only');
    });

    it('should format enum error', () => {
      const error = {
        instancePath: '/type',
        keyword: 'enum',
        params: { allowedValues: ['webapp', 'api', 'worker'] },
        message: 'Invalid enum value'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "type": Must be one of: webapp, api, worker');
    });

    it('should format enum error without allowedValues', () => {
      const error = {
        instancePath: '/type',
        keyword: 'enum',
        params: {},
        message: 'Invalid enum value'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "type": Must be one of: unknown');
    });

    it('should use root path when instancePath is empty', () => {
      const error = {
        instancePath: '',
        keyword: 'required',
        params: { missingProperty: 'app' },
        message: 'Missing required property'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Configuration: Missing required property "app"');
    });

    it('should use root when instancePath is missing', () => {
      const error = {
        keyword: 'required',
        params: { missingProperty: 'app' },
        message: 'Missing required property'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Configuration: Missing required property "app"');
    });

    it('should handle unknown error keyword', () => {
      const error = {
        instancePath: '/custom',
        keyword: 'customError',
        message: 'Custom error message'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "custom": Custom error message');
    });

    it('should handle nested paths', () => {
      const error = {
        instancePath: '/app/image/name',
        keyword: 'required',
        params: { missingProperty: 'registry' },
        message: 'Missing required property'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "app/image/name": Missing required property "registry"');
    });

    it('should format oneOf error for capabilities with actionable message', () => {
      const error = {
        instancePath: '/capabilities',
        keyword: 'oneOf',
        message: 'must match exactly one schema'
      };

      const result = formatSingleError(error);

      expect(result).toContain('array of operation names');
      expect(result).toContain('object with boolean flags');
    });

    it('should format oneOf error for other paths generically', () => {
      const error = {
        instancePath: '/otherField',
        keyword: 'oneOf',
        message: 'must match exactly one schema'
      };

      const result = formatSingleError(error);

      expect(result).toContain('does not match any allowed shape');
    });

    it('should format anyOf error', () => {
      const error = {
        instancePath: '/config',
        keyword: 'anyOf',
        message: 'must match a schema'
      };

      const result = formatSingleError(error);

      expect(result).toContain('does not match any allowed shape');
    });

    it('should format const error with allowed value', () => {
      const error = {
        instancePath: '/type',
        keyword: 'const',
        params: { allowedValue: 'external' },
        message: 'must be equal to constant'
      };

      const result = formatSingleError(error);

      expect(result).toBe('Field "type": must be exactly "external"');
    });

    it('should format const error without params', () => {
      const error = {
        instancePath: '/field',
        keyword: 'const',
        message: 'constraint violation'
      };

      const result = formatSingleError(error);

      expect(result).toContain('invalid value (constraint violation)');
    });

    it('should use new pattern descriptions for dimension/attribute patterns', () => {
      const error = {
        instancePath: '/dimKey',
        keyword: 'pattern',
        params: { pattern: '^[a-zA-Z0-9_]+$' },
        data: 'bad-key',
        message: 'Invalid format'
      };

      const result = formatSingleError(error);

      expect(result).toContain('letters, numbers, and underscores only');
      const error2 = {
        instancePath: '/path',
        keyword: 'pattern',
        params: { pattern: '^[a-zA-Z0-9_.]+$' },
        data: 'x',
        message: 'Invalid'
      };
      const result2 = formatSingleError(error2);
      expect(result2).toContain('letters, numbers, underscores, and dots only');
    });
  });

  describe('formatValidationErrors', () => {
    it('should format array of errors', () => {
      const errors = [
        {
          instancePath: '/port',
          keyword: 'type',
          params: { type: 'number' },
          data: '3000',
          message: 'Expected number'
        },
        {
          instancePath: '/app',
          keyword: 'required',
          params: { missingProperty: 'displayName' },
          message: 'Missing required property'
        }
      ];

      const result = formatValidationErrors(errors);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('Field "port": Expected number, got string');
      expect(result[1]).toBe('Field "app": Missing required property "displayName"');
    });

    it('should return single error message for non-array input', () => {
      const errors = null;

      const result = formatValidationErrors(errors);

      expect(result).toEqual(['Unknown validation error']);
    });

    it('should return single error message for non-array object', () => {
      const errors = { error: 'test' };

      const result = formatValidationErrors(errors);

      expect(result).toEqual(['Unknown validation error']);
    });

    it('should return single error message for string input', () => {
      const errors = 'error string';

      const result = formatValidationErrors(errors);

      expect(result).toEqual(['Unknown validation error']);
    });

    it('should handle empty array', () => {
      const errors = [];

      const result = formatValidationErrors(errors);

      expect(result).toEqual([]);
    });

    it('should format multiple errors of same type', () => {
      const errors = [
        {
          instancePath: '/app',
          keyword: 'required',
          params: { missingProperty: 'displayName' },
          message: 'Missing required property'
        },
        {
          instancePath: '/app',
          keyword: 'required',
          params: { missingProperty: 'key' },
          message: 'Missing required property'
        }
      ];

      const result = formatValidationErrors(errors);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('displayName');
      expect(result[1]).toContain('key');
    });

    it('should explain empty permissions[].roles (RBAC) with permission name when manifest passed', () => {
      const errors = [
        {
          instancePath: '/permissions/57/roles',
          keyword: 'minItems',
          params: { limit: 1 },
          data: [],
          message: 'must NOT have fewer than 1 items'
        }
      ];
      const deploymentManifest = {
        permissions: Array.from({ length: 58 }, (_, i) =>
          i === 57
            ? { name: 'dataplane:pipelines:write', roles: [], description: 'x' }
            : { name: `p${i}`, roles: ['admin'], description: 'd' }
        )
      };

      const result = formatValidationErrors(errors, { deploymentManifest });

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('RBAC:');
      expect(result[0]).toContain('dataplane:pipelines:write');
      expect(result[0]).toContain('empty "roles"');
      expect(result[0]).toContain('rbac.yaml');
    });

    it('should explain empty permissions[].roles using index when no manifest', () => {
      const errors = [
        {
          instancePath: '/permissions/3/roles',
          keyword: 'minItems',
          params: { limit: 1 },
          data: [],
          message: 'must NOT have fewer than 1 items'
        }
      ];

      const result = formatValidationErrors(errors);

      expect(result[0]).toContain('permissions[3]');
      expect(result[0]).toContain('RBAC:');
    });

    it('should handle errors with different keywords', () => {
      const errors = [
        {
          instancePath: '/port',
          keyword: 'minimum',
          params: { limit: 1 },
          message: 'Value too small'
        },
        {
          instancePath: '/port',
          keyword: 'maximum',
          params: { limit: 65535 },
          message: 'Value too large'
        },
        {
          instancePath: '/name',
          keyword: 'minLength',
          params: { limit: 3 },
          message: 'String too short'
        }
      ];

      const result = formatValidationErrors(errors);

      expect(result).toHaveLength(3);
      expect(result[0]).toContain('at least 1');
      expect(result[1]).toContain('at most 65535');
      expect(result[2]).toContain('at least 3 characters');
    });
  });
});

