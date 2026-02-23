/**
 * Tests for Field Reference Validator
 *
 * @fileoverview Unit tests for field-reference-validator.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { validateFieldReferences } = require('../../../lib/datasource/field-reference-validator');

describe('field-reference-validator', () => {
  describe('validateFieldReferences', () => {
    it('returns [] when fieldMappings.attributes is missing', () => {
      const parsed = {
        key: 'test',
        indexing: { embedding: ['x'], uniqueKey: 'y' }
      };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('returns [] when fieldMappings.attributes is empty', () => {
      const parsed = {
        key: 'test',
        fieldMappings: { attributes: {} },
        indexing: { embedding: ['x'], uniqueKey: 'y' }
      };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('returns error for invalid indexing.embedding field', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {}, name: {} } },
        indexing: { embedding: ['id', 'missingField'], uniqueKey: 'id' }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(
        'indexing.embedding[1]: field \'missingField\' does not exist in fieldMappings.attributes'
      );
    });

    it('returns error for invalid indexing.uniqueKey', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {}, name: {} } },
        indexing: { uniqueKey: 'unknownKey' }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(
        'indexing.uniqueKey: field \'unknownKey\' does not exist in fieldMappings.attributes'
      );
    });

    it('returns error for invalid validation.repeatingValues[].field', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        validation: {
          repeatingValues: [
            { field: 'id', scope: [], strategy: 'first' },
            { field: 'badField', scope: [], strategy: 'first' }
          ]
        }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(
        'validation.repeatingValues[1].field: field \'badField\' does not exist in fieldMappings.attributes'
      );
    });

    it('returns error for invalid quality.rejectIf[].field', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        quality: {
          rejectIf: [
            { field: 'id', operator: 'empty' },
            { field: 'invalidField', operator: 'empty' }
          ]
        }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(
        'quality.rejectIf[1].field: field \'invalidField\' does not exist in fieldMappings.attributes'
      );
    });

    it('returns [] when all references are valid', () => {
      const parsed = {
        fieldMappings: {
          attributes: { id: {}, name: {}, body: {} }
        },
        indexing: {
          embedding: ['name', 'body'],
          uniqueKey: 'id'
        },
        validation: {
          repeatingValues: [{ field: 'name', scope: [], strategy: 'first' }]
        },
        quality: {
          rejectIf: [{ field: 'id', operator: 'empty' }]
        }
      };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('reports multiple invalid references in one config', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        indexing: {
          embedding: ['id', 'bad1', 'bad2'],
          uniqueKey: 'badUnique'
        },
        validation: {
          repeatingValues: [{ field: 'badRepeating', scope: [], strategy: 'first' }]
        },
        quality: {
          rejectIf: [{ field: 'badReject', operator: 'empty' }]
        }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(5);
      expect(errors).toContain(
        'indexing.embedding[1]: field \'bad1\' does not exist in fieldMappings.attributes'
      );
      expect(errors).toContain(
        'indexing.embedding[2]: field \'bad2\' does not exist in fieldMappings.attributes'
      );
      expect(errors).toContain(
        'indexing.uniqueKey: field \'badUnique\' does not exist in fieldMappings.attributes'
      );
      expect(errors).toContain(
        'validation.repeatingValues[0].field: field \'badRepeating\' does not exist in fieldMappings.attributes'
      );
      expect(errors).toContain(
        'quality.rejectIf[0].field: field \'badReject\' does not exist in fieldMappings.attributes'
      );
    });

    it('ignores non-string embedding elements', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        indexing: { embedding: [123, null, 'id'] }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toEqual([]);
    });

    it('ignores empty uniqueKey', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        indexing: { uniqueKey: '' }
      };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('handles missing indexing, validation, quality gracefully', () => {
      const parsed = { fieldMappings: { attributes: { a: {} } } };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('reports invalid field at embedding index 0', () => {
      const parsed = {
        fieldMappings: { attributes: { name: {} } },
        indexing: { embedding: ['wrongFirst', 'name'], uniqueKey: 'name' }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(
        'indexing.embedding[0]: field \'wrongFirst\' does not exist in fieldMappings.attributes'
      );
    });

    it('reports multiple invalid embedding fields only', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        indexing: { embedding: ['bad1', 'bad2', 'bad3'], uniqueKey: 'id' }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(3);
      expect(errors).toContain(
        'indexing.embedding[0]: field \'bad1\' does not exist in fieldMappings.attributes'
      );
      expect(errors).toContain(
        'indexing.embedding[1]: field \'bad2\' does not exist in fieldMappings.attributes'
      );
      expect(errors).toContain(
        'indexing.embedding[2]: field \'bad3\' does not exist in fieldMappings.attributes'
      );
    });

    it('skips repeatingValues items without string field', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        validation: {
          repeatingValues: [
            { scope: [], strategy: 'first' },
            { field: 123, scope: [], strategy: 'first' },
            { field: 'id', scope: [], strategy: 'first' }
          ]
        }
      };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('skips rejectIf items without string field', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        quality: {
          rejectIf: [
            { operator: 'empty' },
            { field: 456, operator: 'empty' },
            { field: 'id', operator: 'empty' }
          ]
        }
      };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('returns [] for null parsed (defensive)', () => {
      expect(validateFieldReferences(null)).toEqual([]);
    });

    it('returns [] for undefined parsed (defensive)', () => {
      expect(validateFieldReferences(undefined)).toEqual([]);
    });

    it('returns [] when fieldMappings is null', () => {
      const parsed = { fieldMappings: null, indexing: { embedding: ['x'] } };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });
  });
});
