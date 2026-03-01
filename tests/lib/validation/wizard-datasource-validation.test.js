/**
 * Tests for wizard datasource validation helpers
 * @fileoverview Tests for lib/validation/wizard-datasource-validation.js
 */

const {
  validateDatasourceKeysForPlatform,
  validateEntityNameForOpenApi
} = require('../../../lib/validation/wizard-datasource-validation');

describe('wizard-datasource-validation', () => {
  describe('validateDatasourceKeysForPlatform', () => {
    const availableDatasources = [
      { key: 'hubspot-companies', displayName: 'Companies', entity: 'Company' },
      { key: 'hubspot-contacts', displayName: 'Contacts', entity: 'Contact' },
      { key: 'hubspot-deals', displayName: 'Deals', entity: 'Deal' }
    ];

    it('should return valid when all keys exist', () => {
      const result = validateDatasourceKeysForPlatform(
        ['hubspot-contacts', 'hubspot-deals'],
        availableDatasources
      );
      expect(result.valid).toBe(true);
      expect(result.invalidKeys).toEqual([]);
    });

    it('should return invalid when some keys do not exist', () => {
      const result = validateDatasourceKeysForPlatform(
        ['hubspot-contacts', 'hubspot-invalid', 'hubspot-fake'],
        availableDatasources
      );
      expect(result.valid).toBe(false);
      expect(result.invalidKeys).toEqual(['hubspot-invalid', 'hubspot-fake']);
    });

    it('should return invalid when all keys are invalid', () => {
      const result = validateDatasourceKeysForPlatform(
        ['foo', 'bar'],
        availableDatasources
      );
      expect(result.valid).toBe(false);
      expect(result.invalidKeys).toEqual(['foo', 'bar']);
    });

    it('should return valid when datasourceKeys is empty', () => {
      const result = validateDatasourceKeysForPlatform([], availableDatasources);
      expect(result.valid).toBe(true);
      expect(result.invalidKeys).toEqual([]);
    });

    it('should return valid when datasourceKeys is not an array', () => {
      const result = validateDatasourceKeysForPlatform(null, availableDatasources);
      expect(result.valid).toBe(true);
      expect(result.invalidKeys).toEqual([]);
    });

    it('should handle empty availableDatasources', () => {
      const result = validateDatasourceKeysForPlatform(['hubspot-contacts'], []);
      expect(result.valid).toBe(false);
      expect(result.invalidKeys).toEqual(['hubspot-contacts']);
    });

    it('should handle null/undefined availableDatasources', () => {
      const result = validateDatasourceKeysForPlatform(['hubspot-contacts'], null);
      expect(result.valid).toBe(false);
      expect(result.invalidKeys).toEqual(['hubspot-contacts']);
    });
  });

  describe('validateEntityNameForOpenApi', () => {
    const entities = [
      { name: 'companies', pathCount: 5 },
      { name: 'contacts', pathCount: 3 },
      { name: 'deals', pathCount: 2 }
    ];

    it('should return valid when entityName exists', () => {
      const result = validateEntityNameForOpenApi('contacts', entities);
      expect(result.valid).toBe(true);
    });

    it('should return invalid when entityName does not exist', () => {
      const result = validateEntityNameForOpenApi('products', entities);
      expect(result.valid).toBe(false);
    });

    it('should return valid when entityName is empty', () => {
      const result = validateEntityNameForOpenApi('', entities);
      expect(result.valid).toBe(true);
    });

    it('should return valid when entityName is null/undefined', () => {
      expect(validateEntityNameForOpenApi(null, entities).valid).toBe(true);
      expect(validateEntityNameForOpenApi(undefined, entities).valid).toBe(true);
    });

    it('should handle empty entities list', () => {
      const result = validateEntityNameForOpenApi('companies', []);
      expect(result.valid).toBe(false);
    });

    it('should handle null entities', () => {
      const result = validateEntityNameForOpenApi('companies', null);
      expect(result.valid).toBe(false);
    });
  });
});
