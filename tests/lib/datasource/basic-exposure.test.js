/**
 * @fileoverview Tests for basic-exposure profile synthesis
 */

const {
  buildBasicExposureProfileArray,
  listBasicExposureAttributes
} = require('../../../lib/datasource/capability/basic-exposure');

describe('basic-exposure', () => {
  it('lists required primitives and other primitive properties', () => {
    const parsed = {
      metadataSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          meta: { type: 'object', properties: { x: { type: 'string' } } }
        }
      }
    };
    expect(listBasicExposureAttributes(parsed)).toEqual(['id', 'name']);
  });

  it('buildBasicExposureProfileArray throws when no primitives', () => {
    expect(() =>
      buildBasicExposureProfileArray({
        metadataSchema: { type: 'object', properties: { o: { type: 'object' } } }
      })
    ).toThrow(/Cannot build basic exposure/);
  });

  it('buildBasicExposureProfileArray returns sorted attribute list', () => {
    const arr = buildBasicExposureProfileArray({
      metadataSchema: {
        type: 'object',
        properties: {
          z: { type: 'string' },
          a: { type: 'number' }
        }
      }
    });
    expect(arr).toEqual(['a', 'z']);
  });
});
