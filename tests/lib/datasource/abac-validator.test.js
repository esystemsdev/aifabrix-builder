/**
 * Tests for ABAC Validator
 *
 * @fileoverview Unit tests for abac-validator.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  validateAbac,
  validateDimensionsObject,
  validateCrossSystemJson
} = require('../../../lib/datasource/abac-validator');

describe('abac-validator', () => {
  describe('validateAbac', () => {
    it('returns [] when config.abac is missing', () => {
      expect(validateAbac({})).toEqual([]);
      expect(validateAbac({ config: {} })).toEqual([]);
    });

    it('returns error when legacy config.abac.crossSystem is present', () => {
      const parsed = { config: { abac: { crossSystem: 'some-sql' } } };
      const errors = validateAbac(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('crossSystem is deprecated');
      expect(errors[0]).toContain('crossSystemJson');
      expect(errors[0]).toContain('crossSystemSql');
    });

    it('returns [] when config.abac has only crossSystemSql', () => {
      const parsed = { config: { abac: { crossSystemSql: 't.country = user.country' } } };
      expect(validateAbac(parsed)).toEqual([]);
    });

    it('validates config.abac.dimensions dimension keys and attribute paths', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {}, country: {} }, dimensions: {} },
        config: {
          abac: {
            dimensions: {
              validKey: 'country',
              'invalid-key': 'path',
              another: 'nonexistentAttr'
            }
          }
        }
      };
      const errors = validateAbac(parsed);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some(e => e.includes('invalid-key') && e.includes('letters, numbers, and underscores'))).toBe(true);
      expect(errors.some(e => e.includes('nonexistentAttr') && e.includes('fieldMappings.attributes'))).toBe(true);
    });

    it('does not validate legacy fieldMappings.dimensions (use root dimensions + schema)', () => {
      const parsed = {
        fieldMappings: {
          attributes: { id: {} },
          dimensions: { 'bad-key': 'id', good: 'id' }
        },
        config: { abac: {} }
      };
      expect(validateAbac(parsed)).toEqual([]);
    });

    it('returns [] for valid config.abac.dimensions', () => {
      const parsed = {
        fieldMappings: { attributes: { id: {}, country: {} } },
        config: {
          abac: {
            dimensions: { region: 'country', id: 'id' }
          }
        }
      };
      expect(validateAbac(parsed)).toEqual([]);
    });

    it('validates crossSystemJson: path format and one operator per path', () => {
      const parsed = {
        config: {
          abac: {
            crossSystemJson: {
              'valid.path': { eq: 'user.country' },
              'bad path': { eq: 'x' },
              'multi': { eq: 'a', ne: 'b' },
              'empty': {}
            }
          }
        }
      };
      const errors = validateAbac(parsed);
      expect(errors.some(e => e.includes('bad path') && e.includes('letters, numbers'))).toBe(true);
      expect(errors.some(e => e.includes('multi') && e.includes('exactly one operator'))).toBe(true);
      expect(errors.some(e => e.includes('empty') && e.includes('exactly one operator'))).toBe(true);
    });

    it('rejects unknown operator in crossSystemJson', () => {
      const parsed = {
        config: {
          abac: {
            crossSystemJson: {
              'ds.field': { unknownOp: 1 }
            }
          }
        }
      };
      const errors = validateAbac(parsed);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('unknown operator');
      expect(errors[0]).toContain('unknownOp');
    });

    it('returns [] for valid crossSystemJson', () => {
      const parsed = {
        config: {
          abac: {
            crossSystemJson: {
              'hubspot.country': { eq: 'user.country' },
              'hubspot.revenue': { gte: 1000 }
            }
          }
        }
      };
      expect(validateAbac(parsed)).toEqual([]);
    });
  });

  describe('validateDimensionsObject', () => {
    it('returns [] for null or non-object dimensions', () => {
      expect(validateDimensionsObject(null, 'test', new Set())).toEqual([]);
      expect(validateDimensionsObject([], 'test', new Set())).toEqual([]);
    });

    it('validates dimension keys and paths', () => {
      const validNames = new Set(['id', 'country']);
      const dimensions = { goodKey: 'country', 'bad-key': 'path' };
      const errors = validateDimensionsObject(dimensions, 'source', validNames);
      expect(errors.some(e => e.includes('bad-key'))).toBe(true);
      expect(errors.some(e => e.includes('source'))).toBe(true);
    });
  });

  describe('validateCrossSystemJson', () => {
    it('returns [] for null or non-object', () => {
      expect(validateCrossSystemJson(null)).toEqual([]);
      expect(validateCrossSystemJson([])).toEqual([]);
    });

    it('validates path pattern and operator count', () => {
      const errors = validateCrossSystemJson({
        'valid.path': { eq: 'x' },
        'invalid path': { eq: 'y' }
      });
      expect(errors.some(e => e.includes('invalid path'))).toBe(true);
    });
  });
});
