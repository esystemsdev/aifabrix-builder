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
    security:
      method === 'bearerToken'
        ? { token: `kv://${systemKey}/token` }
        : { apiKey: `kv://${systemKey}/apiKey` }
  }))
}));

describe('repair-auth-apply', () => {
  it('allows bearerToken as repair-only auth option', () => {
    expect(isAllowedRepairAuth('bearerToken')).toBe(true);
    expect(isAllowedRepairAuth('BearerKey')).toBe(true);
  });

  it('buildAuthenticationForRepair emits bearerToken with token secret', () => {
    const auth = buildAuthenticationForRepair('hubspot-demo', 'bearerToken');
    expect(auth.method).toBe('bearerToken');
    expect(auth.security.token).toBe('kv://hubspot-demo/token');
  });

  it('appendTestEndpointWarningIfMissing warns for apikey without testEndpoint', () => {
    const warnings = [];
    appendTestEndpointWarningIfMissing(
      { method: 'apikey', variables: { baseUrl: 'https://api.hubapi.com' } },
      warnings
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/testEndpoint is missing for apikey\/bearerToken/);
  });

  it('appendTestEndpointWarningIfMissing warns for bearerToken without testEndpoint', () => {
    const warnings = [];
    appendTestEndpointWarningIfMissing(
      {
        method: 'bearerToken',
        variables: { baseUrl: 'https://api.hubapi.com', headerName: 'Authorization', prefix: 'Bearer' },
        security: { token: 'kv://hubspot-demo/token' }
      },
      warnings
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/testEndpoint is missing for apikey\/bearerToken/);
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

  it('repairAuthChangeLabel describes bearerToken preset', () => {
    expect(repairAuthChangeLabel('bearertoken')).toBe('bearerToken');
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
    expect(warnings[0]).toMatch(/testEndpoint is missing for apikey\/bearerToken/);
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
