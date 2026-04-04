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
});
