/**
 * @fileoverview applyCapabilityCreate — from / openapi-operation / template
 */

// Other suites in the same worker may `jest.mock('fs')`; ensure real disk for template fixtures.
jest.unmock('fs');
jest.unmock('node:fs');

const fs = require('node:fs');
const path = require('path');
const {
  applyCapabilityCreate,
  findOpenapiKeysByOperationId
} = require('../../../lib/datasource/capability/create-operations');

describe('create-operations', () => {
  function baseDoc() {
    return {
      key: 'ds-a',
      systemKey: 'sys',
      entityType: 'recordStorage',
      resourceType: 'customer',
      capabilities: ['list'],
      openapi: {
        operations: {
          list: {
            operationId: 'get-list-things',
            method: 'GET',
            path: '/things'
          }
        }
      },
      execution: {
        engine: 'cip',
        cip: {
          version: '1.0',
          operations: {
            list: {
              enabled: true,
              steps: [{ fetch: { source: 'openapi', openapiRef: 'list' } }]
            }
          }
        }
      },
      metadataSchema: {
        type: 'object',
        properties: {
          externalId: { type: 'string', index: true },
          companyId: { type: 'string', index: true }
        }
      },
      fieldMappings: {
        attributes: {
          externalId: { expression: '{{raw.id}}' },
          companyId: { expression: '{{raw.companyId}}' }
        }
      },
      exposed: { profiles: { list: ['externalId'] }, schema: {} },
      sync: { mode: 'pull', schedule: '0 * * * *', batchSize: 10 },
      quality: {},
      context: {},
      validation: {}
    };
  }

  it('findOpenapiKeysByOperationId returns matching keys', () => {
    const doc = baseDoc();
    expect(findOpenapiKeysByOperationId(doc, 'get-list-things')).toEqual(['list']);
    expect(findOpenapiKeysByOperationId(doc, 'GET-LIST-THINGS')).toEqual(['list']);
    expect(findOpenapiKeysByOperationId(doc, 'missing')).toEqual([]);
  });

  it('applyCapabilityCreate requires exactly one source', () => {
    expect(() =>
      applyCapabilityCreate(baseDoc(), { to: 'x', from: 'list', openApiOperationId: 'get-list-things' })
    ).toThrow(/exactly one of/);
  });

  it('applyCapabilityCreate from openapi-operation throws when operationId is not found', () => {
    expect(() =>
      applyCapabilityCreate(baseDoc(), {
        to: 'derived',
        openApiOperationId: 'missing-op',
        overwrite: false,
        basicExposure: false,
        includeTestPayload: false
      })
    ).toThrow(/No openapi\.operations entry/);
  });

  it('applyCapabilityCreate from openapi-operation throws when operationId is ambiguous', () => {
    const doc = baseDoc();
    doc.openapi.operations.listAlt = {
      operationId: 'get-list-things',
      method: 'GET',
      path: '/things-alt'
    };
    expect(() =>
      applyCapabilityCreate(doc, {
        to: 'derived',
        openApiOperationId: 'get-list-things',
        overwrite: false,
        basicExposure: false,
        includeTestPayload: false
      })
    ).toThrow(/Ambiguous operationId/);
  });

  it('applyCapabilityCreate from template throws when template does not exist', () => {
    expect(() =>
      applyCapabilityCreate(baseDoc(), {
        to: 'fromTpl',
        template: 'not-a-real-template',
        overwrite: false,
        basicExposure: false,
        includeTestPayload: false
      })
    ).toThrow(/Unknown template/);
  });

  it('applyCapabilityCreate delegates to copy when --from', () => {
    const doc = baseDoc();
    const out = applyCapabilityCreate(doc, {
      from: 'list',
      to: 'listCopy',
      overwrite: false,
      basicExposure: false,
      includeTestPayload: false
    });
    expect(out.doc.capabilities).toContain('listCopy');
    expect(out.doc.openapi.operations.listcopy).toBeDefined();
  });

  it('applyCapabilityCreate from openapi-operation clones op + minimal CIP', () => {
    const doc = baseDoc();
    const out = applyCapabilityCreate(doc, {
      to: 'derived',
      openApiOperationId: 'get-list-things',
      overwrite: false,
      basicExposure: false,
      includeTestPayload: false
    });
    expect(out.doc.capabilities).toContain('derived');
    expect(out.doc.execution.cip.operations.derived.enabled).toBe(true);
    expect(out.doc.execution.cip.operations.derived.steps[0].fetch.openapiRef).toBe('derived');
  });

  it('applyCapabilityCreate loads minimal-fetch template', () => {
    const doc = baseDoc();
    const tplPath = path.join(
      __dirname,
      '../../../lib/datasource/capability/templates/minimal-fetch.json'
    );
    expect(fs.existsSync(tplPath)).toBe(true);
    const out = applyCapabilityCreate(doc, {
      to: 'fromTpl',
      template: 'minimal-fetch',
      overwrite: false,
      basicExposure: false,
      includeTestPayload: false
    });
    expect(out.doc.capabilities).toContain('fromTpl');
    expect(out.doc.openapi.operations.fromtpl.operationId).toBe('minimal-fetch-placeholder');
  });
});
