/**
 * Regression tests for external-datasource 2.4.x / external-system optional fields.
 * Isolated project `schema-241-alignment` — real fixture reads + schema-loader; avoid jest.mock('fs') worker bleed.
 *
 * @fileoverview Schema 2.4 alignment coverage from plan 113
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
/** Real fs: `jest.mock('fs')` in other suites leaves a stubbed `fs` in the worker cache. */
const fs = jest.requireActual('node:fs');
const { validateFieldReferences } = require('../../../lib/datasource/field-reference-validator');
const { collectExternalDatasourceWarnings } = require('../../../lib/validation/datasource-warnings');

const schemaLoaderPath = require.resolve('../../../lib/utils/schema-loader');
delete require.cache[schemaLoaderPath];
const { loadExternalDataSourceSchema, loadExternalSystemSchema } = require('../../../lib/utils/schema-loader');

describe('Schema 2.4.x alignment', () => {
  const fixturePath = path.join(__dirname, '../../fixtures/external-datasource-minimal-241.json');

  it('loads minimal v2.4 fixture and passes field-reference validation', () => {
    const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    expect(validateFieldReferences(parsed)).toEqual([]);
  });

  it('loads minimal v2.4 fixture and passes AJV external-datasource schema', () => {
    const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const validate = loadExternalDataSourceSchema();
    expect(validate(parsed)).toBe(true);
  });

  it('rejects testPayload with unknown top-level key (strict contract)', () => {
    const validate = loadExternalDataSourceSchema();

    const base = {
      key: 'cip-test',
      displayName: 'CIP test',
      systemKey: 'sys',
      entityType: 'recordStorage',
      resourceType: 'record',
      primaryKey: ['id'],
      labelKey: ['id'],
      metadataSchema: {
        type: 'object',
        required: ['id', 'externalId'],
        properties: {
          id: { type: 'string', index: true },
          externalId: { type: 'string', index: true }
        }
      },
      fieldMappings: {
        attributes: {
          id: { expression: '{{raw.id}}' },
          externalId: { expression: '{{raw.externalId}}' }
        }
      },
      exposed: {
        schema: {
          id: 'metadata.id',
          externalId: 'metadata.externalId'
        }
      },
      capabilities: ['list', 'customSearch', 'get'],
      execution: {
        engine: 'cip',
        cip: {
          version: '1.0',
          operations: {
            list: {
              steps: [
                {
                  fetch: {
                    source: 'datasource',
                    datasource: 'other-ds',
                    operation: 'customSearch',
                    openapiRef: 'customSearch'
                  }
                }
              ]
            },
            customSearch: {
              steps: [
                {
                  fetch: { source: 'openapi', openapiRef: 'list' }
                }
              ]
            }
          }
        }
      },
      openapi: {
        enabled: true,
        documentKey: 'doc',
        baseUrl: 'https://api.example.com',
        operations: {
          list: { operationId: 'listOp', method: 'GET', path: '/items' },
          customSearch: { operationId: 'searchOp', method: 'GET', path: '/search' }
        }
      }
    };

    expect(validate(base)).toBe(true);

    const bad = {
      ...base,
      testPayload: {
        mode: 'mock',
        unexpectedTopLevelKey: true
      }
    };
    expect(validate(bad)).toBe(false);
  });

  it('warns when recordStorage has no dimensions', () => {
    const ds = {
      key: 'no-dim',
      entityType: 'recordStorage',
      fieldMappings: { attributes: { id: { expression: '{{raw.id}}' } } }
    };
    const w = collectExternalDatasourceWarnings(ds);
    expect(w.some(m => m.includes('dimensions missing or empty'))).toBe(true);
  });

  it('warns when fk dimension omits actor', () => {
    const ds = {
      key: 'fk-dim',
      entityType: 'recordStorage',
      dimensions: {
        org: {
          type: 'fk',
          via: [{ datasourceKey: 'x', foreignKey: 'y' }]
        }
      }
    };
    const w = collectExternalDatasourceWarnings(ds);
    expect(w.some(m => m.includes('type=fk without actor'))).toBe(true);
  });

  it('validates external-system with performance.cacheDefaults and certification', () => {
    const hubspotSystemPath = path.join(__dirname, '../../fixtures/hubspot-test-system.json');
    const base = JSON.parse(fs.readFileSync(hubspotSystemPath, 'utf8'));
    const withOpt = {
      ...base,
      performance: {
        cacheDefaults: {
          enabled: true,
          ttlSeconds: 60
        }
      },
      certification: {
        enabled: true,
        publicKey: 'test-public-key-material',
        algorithm: 'RS256',
        issuer: 'aifabrix-test',
        version: '1.0.0'
      }
    };
    const validate = loadExternalSystemSchema();
    expect(validate(withOpt)).toBe(true);
  });

  it('validates external-system certification with RS256 and publicKeyFingerprint', () => {
    const hubspotSystemPath = path.join(__dirname, '../../fixtures/hubspot-test-system.json');
    const base = JSON.parse(fs.readFileSync(hubspotSystemPath, 'utf8'));
    const withOpt = {
      ...base,
      certification: {
        enabled: true,
        publicKey:
          '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAfixture\n-----END PUBLIC KEY-----',
        publicKeyFingerprint: `sha256:${'d'.repeat(64)}`,
        algorithm: 'RS256',
        issuer: 'aifabrix-test',
        version: '1.0.0'
      }
    };
    const validate = loadExternalSystemSchema();
    expect(validate(withOpt)).toBe(true);
  });
});
