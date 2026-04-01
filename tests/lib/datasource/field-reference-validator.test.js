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

    it('returns error for invalid primaryKey reference', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        primaryKey: ['id', 'nonexistent']
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('primaryKey[1]');
      expect(errors[0]).toContain('nonexistent');
      expect(errors[0]).toContain('fieldMappings.attributes or root dimensions');
    });

    it('accepts primaryKey that references root dimension key', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        dimensions: { region: { type: 'local', field: 'country' } },
        primaryKey: ['id', 'region']
      };
      expect(validateFieldReferences(parsed)).toEqual([]);
    });

    it('returns error for invalid exposed.profiles field reference', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {}, name: {} } },
        exposed: {
          profiles: {
            default: ['id', 'name', 'badField'],
            minimal: ['id']
          }
        }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('exposed.profiles.default[2]');
      expect(errors[0]).toContain('badField');
      expect(errors[0]).toContain('fieldMappings.attributes');
    });

    it('returns error for invalid indexing.embedding field', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {}, name: {} } },
        indexing: { embedding: ['id', 'missingField'], uniqueKey: 'id' }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('indexing.embedding[1]');
      expect(errors[0]).toContain('missingField');
      expect(errors[0]).toContain('Add the attribute or remove the reference');
    });

    it('returns error for invalid indexing.uniqueKey', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {}, name: {} } },
        indexing: { uniqueKey: 'unknownKey' }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('indexing.uniqueKey');
      expect(errors[0]).toContain('unknownKey');
      expect(errors[0]).toContain('Add the attribute or remove the reference');
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
      expect(errors[0]).toContain('validation.repeatingValues[1].field');
      expect(errors[0]).toContain('badField');
      expect(errors[0]).toContain('Add the attribute or remove the reference');
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
      expect(errors[0]).toContain('quality.rejectIf[1].field');
      expect(errors[0]).toContain('invalidField');
      expect(errors[0]).toContain('Add the attribute or remove the reference');
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
      expect(errors.some(e => e.includes('indexing.embedding[1]') && e.includes('bad1'))).toBe(true);
      expect(errors.some(e => e.includes('indexing.embedding[2]') && e.includes('bad2'))).toBe(true);
      expect(errors.some(e => e.includes('indexing.uniqueKey') && e.includes('badUnique'))).toBe(true);
      expect(errors.some(e => e.includes('validation.repeatingValues[0].field') && e.includes('badRepeating'))).toBe(true);
      expect(errors.some(e => e.includes('quality.rejectIf[0].field') && e.includes('badReject'))).toBe(true);
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
      expect(errors[0]).toContain('indexing.embedding[0]');
      expect(errors[0]).toContain('wrongFirst');
    });

    it('reports multiple invalid embedding fields only', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {} } },
        indexing: { embedding: ['bad1', 'bad2', 'bad3'], uniqueKey: 'id' }
      };
      const errors = validateFieldReferences(parsed);
      expect(errors).toHaveLength(3);
      expect(errors.some(e => e.includes('embedding[0]') && e.includes('bad1'))).toBe(true);
      expect(errors.some(e => e.includes('embedding[1]') && e.includes('bad2'))).toBe(true);
      expect(errors.some(e => e.includes('embedding[2]') && e.includes('bad3'))).toBe(true);
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
