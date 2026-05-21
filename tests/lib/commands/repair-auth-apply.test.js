/**
 * @fileoverview Unit tests for repair-auth-apply.js
 */

const {
  buildAuthenticationForRepair,
  appendTestEndpointWarningIfMissing,
  auditRepairAuthenticationWarnings,
  isAllowedRepairAuth,
  repairAuthChangeLabel
} = require('../../../lib/commands/repair-auth-apply');

jest.mock('../../../lib/external-system/generator', () => ({
  buildAuthenticationFromMethod: jest.fn((systemKey, method) => ({
    method,
    variables: { baseUrl: 'https://api.example.com', headerName: 'X-API-Key' },
    security: { apiKey: `kv://${systemKey}/apiKey` }
  }))
}));

describe('repair-auth-apply', () => {
  it('allows bearerKey as repair-only auth option', () => {
    expect(isAllowedRepairAuth('bearerKey')).toBe(true);
    expect(isAllowedRepairAuth('BearerKey')).toBe(true);
  });

  it('buildAuthenticationForRepair maps bearerKey to apikey with Authorization Bearer', () => {
    const auth = buildAuthenticationForRepair('hubspot-demo', 'bearerKey');
    expect(auth.method).toBe('apikey');
    expect(auth.variables.headerName).toBe('Authorization');
    expect(auth.variables.prefix).toBe('Bearer');
    expect(auth.security.apiKey).toBe('kv://hubspot-demo/apiKey');
  });

  it('appendTestEndpointWarningIfMissing warns for apikey without testEndpoint', () => {
    const warnings = [];
    appendTestEndpointWarningIfMissing(
      { method: 'apikey', variables: { baseUrl: 'https://api.hubapi.com' } },
      warnings
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/testEndpoint is missing for apikey/);
  });

  it('appendTestEndpointWarningIfMissing is silent when testEndpoint is set', () => {
    const warnings = [];
    appendTestEndpointWarningIfMissing(
      {
        method: 'apikey',
        variables: {
          baseUrl: 'https://api.hubapi.com',
          testEndpoint: 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1'
        }
      },
      warnings
    );
    expect(warnings).toHaveLength(0);
  });

  it('repairAuthChangeLabel describes bearerKey preset', () => {
    expect(repairAuthChangeLabel('bearerkey')).toContain('bearerKey');
    expect(repairAuthChangeLabel('apikey')).toBe('apikey');
  });

  it('auditRepairAuthenticationWarnings warns for existing apikey without --auth rewrite', () => {
    const warnings = [];
    auditRepairAuthenticationWarnings(
      {
        key: 'hubspot-demo',
        authentication: {
          method: 'apikey',
          variables: { baseUrl: 'https://api.hubapi.com', headerName: 'X-API-Key' },
          security: { apiKey: 'kv://hubspot-demo/apiKey' }
        }
      },
      warnings
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/testEndpoint is missing for apikey/);
  });

  it('auditRepairAuthenticationWarnings does not duplicate the testEndpoint warning', () => {
    const warnings = [];
    const system = {
      authentication: { method: 'apikey', variables: { baseUrl: 'https://api.hubapi.com' } }
    };
    auditRepairAuthenticationWarnings(system, warnings);
    auditRepairAuthenticationWarnings(system, warnings);
    expect(warnings).toHaveLength(1);
  });
});
