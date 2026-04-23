/**
 * @fileoverview Tests for lib/utils/validation-run-request.js
 */

const {
  includeDebugForRequest,
  buildExternalDataSourceValidationRequest,
  buildE2eOptionsFromCli
} = require('../../../lib/utils/validation-run-request');

describe('validation-run-request', () => {
  it('includeDebugForRequest is true for flag boolean and display levels', () => {
    expect(includeDebugForRequest(undefined)).toBe(false);
    expect(includeDebugForRequest(false)).toBe(false);
    expect(includeDebugForRequest(null)).toBe(false);
    expect(includeDebugForRequest('')).toBe(false);
    expect(includeDebugForRequest(true)).toBe(true);
    expect(includeDebugForRequest('summary')).toBe(true);
    expect(includeDebugForRequest('full')).toBe(true);
  });

  it('buildExternalDataSourceValidationRequest sets scope and ids', () => {
    const b = buildExternalDataSourceValidationRequest({
      systemKey: 'hubspot',
      datasourceKey: 'hubspot.deals',
      runType: 'integration',
      payloadTemplate: { x: 1 },
      includeDebug: true
    });
    expect(b).toMatchObject({
      validationScope: 'externalDataSource',
      systemIdOrKey: 'hubspot',
      datasourceKey: 'hubspot.deals',
      runType: 'integration',
      payloadTemplate: { x: 1 },
      includeDebug: true
    });
  });

  it('buildExternalDataSourceValidationRequest throws without keys', () => {
    expect(() =>
      buildExternalDataSourceValidationRequest({
        systemKey: '',
        datasourceKey: 'k',
        runType: 'test'
      })
    ).toThrow();
  });

  it('buildE2eOptionsFromCli merges e2eOptionsExtra', () => {
    const e = buildE2eOptionsFromCli({
      debug: true,
      testCrud: true,
      e2eOptionsExtra: { customFlag: true }
    });
    expect(e.includeDebug).toBe(true);
    expect(e.testCrud).toBe(true);
    expect(e.customFlag).toBe(true);
  });

  it('buildE2eOptionsFromCli maps numeric E2E assertions', () => {
    const e = buildE2eOptionsFromCli({
      minVectorHits: 7,
      minProcessed: 3,
      minRecordCount: 10
    });
    expect(e.minVectorHits).toBe(7);
    expect(e.minProcessed).toBe(3);
    expect(e.minRecordCount).toBe(10);
  });

  it('buildE2eOptionsFromCli ignores invalid assertion numbers', () => {
    expect(buildE2eOptionsFromCli({ minVectorHits: 'x' })).toEqual({});
    expect(buildE2eOptionsFromCli({ minVectorHits: -1 })).toEqual({});
  });
});
