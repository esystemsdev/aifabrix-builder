/**
 * @fileoverview Tests for repair-datasource-openapi.js
 */

const { repairOpenapiSection } = require('../../../lib/commands/repair-datasource-openapi');

describe('repairOpenapiSection', () => {
  it('sets openapi.enabled=true when operations present', () => {
    const changes = [];
    const parsed = {
      key: 'k1',
      openapi: {
        enabled: false,
        operations: { list: { operationId: 'op1' } }
      }
    };

    const updated = repairOpenapiSection(parsed, changes);

    expect(updated).toBe(true);
    expect(parsed.openapi.enabled).toBe(true);
    expect(changes.join('\n')).toContain('openapi.enabled=true');
  });

  it('defaults openapi.documentKey to datasource key when missing', () => {
    const changes = [];
    const parsed = {
      key: 'test-e2e-hubspot-users',
      openapi: {
        enabled: true,
        operations: { list: { operationId: 'op1' } }
      }
    };

    const updated = repairOpenapiSection(parsed, changes);

    expect(updated).toBe(true);
    expect(parsed.openapi.documentKey).toBe('test-e2e-hubspot-users');
    expect(changes.join('\n')).toContain('openapi.documentKey=test-e2e-hubspot-users');
  });

  it('defaults openapi.autoRbac=true when enabled+operations and missing autoRbac', () => {
    const changes = [];
    const parsed = {
      key: 'k1',
      openapi: {
        enabled: true,
        operations: { list: { operationId: 'op1' } }
      }
    };

    const updated = repairOpenapiSection(parsed, changes);

    expect(updated).toBe(true);
    expect(parsed.openapi.autoRbac).toBe(true);
    expect(changes.join('\n')).toContain('openapi.autoRbac=true');
  });

  it('no-ops when openapi missing', () => {
    const changes = [];
    const parsed = { key: 'k1' };

    const updated = repairOpenapiSection(parsed, changes);

    expect(updated).toBe(false);
    expect(changes).toEqual([]);
  });
});

