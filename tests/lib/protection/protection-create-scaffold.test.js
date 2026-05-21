'use strict';

const { validateProtectionManifestLocal } = require('../../../lib/protection/validate-local');
const {
  buildDynamicFkProtectionManifest,
  buildPresetProtectionManifest
} = require('../../../lib/protection/protection-create-scaffold');
const { listProtectionPresetTypes } = require('../../../lib/protection/protection-preset-registry');

describe('protection-create-scaffold', () => {
  it('builds AJV-valid manifest for hubspot + country', () => {
    const m = buildDynamicFkProtectionManifest({
      datasourceKey: 'hubspot-companies',
      dimensionKey: 'country'
    });
    const { valid, errors } = validateProtectionManifestLocal(m);
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
    expect(m.spec.datasourceKey).toBe('hubspot-companies');
    expect(m.metadata.key).toBe('hubspot-companies-country-access');
    expect(m.spec.rules[0].grants[0].dimensionKey).toBe('country');
  });

  it('uses custom fkName in expressions', () => {
    const m = buildDynamicFkProtectionManifest({
      datasourceKey: 'hubspot-deals',
      dimensionKey: 'country',
      fkName: 'company'
    });
    expect(m.spec.rules[0].principal.expression).toContain('fk.company.metadata');
    expect(m.spec.rules[0].grants[0].valueExpression).toContain('fk.company.metadata');
  });

  it('lists the supported create preset types', () => {
    expect(listProtectionPresetTypes()).toEqual([
      'country-sales',
      'department-manager',
      'customer-team',
      'project-team',
      'static-region',
      'owner-direct'
    ]);
  });

  it('builds country-sales from metadata when no country FK exists', () => {
    const m = buildPresetProtectionManifest({
      datasourceKey: 'hubspot-companies',
      type: 'country-sales',
      datasource: {
        metadataSchema: { properties: { country: { type: 'string' } } },
        foreignKeys: []
      },
      dimension: { key: 'country', valueType: 'static' }
    });
    const rule = m.spec.rules[0];
    expect(rule.principal.expression).toBe('Sales {{metadata.country}} Users');
    expect(rule.grants[0].valueExpression).toBe('{{metadata.country}}');
    expect(validateProtectionManifestLocal(m).valid).toBe(true);
  });

  it('builds country-sales from FK when country FK exists', () => {
    const m = buildPresetProtectionManifest({
      datasourceKey: 'hubspot-companies',
      type: 'country-sales',
      datasource: {
        metadataSchema: { properties: {} },
        foreignKeys: [{ name: 'country', targetDatasource: 'countries' }]
      },
      dimension: { key: 'country', valueType: 'static' }
    });
    const rule = m.spec.rules[0];
    expect(rule.principal.expression).toBe('Sales {{fk.country.metadata.iso3}} Users');
    expect(rule.grants[0].valueExpression).toBe('{{fk.country.metadata.iso2}}');
    expect(validateProtectionManifestLocal(m).valid).toBe(true);
  });

  it('builds department-manager with Manager gate', () => {
    const m = buildPresetProtectionManifest({
      datasourceKey: 'hr-persons',
      type: 'department-manager',
      datasource: {
        metadataSchema: {
          properties: {
            department: { type: 'string' },
            managerEmail: { type: 'string' }
          }
        }
      },
      dimension: { key: 'department', valueType: 'dynamic' }
    });
    const rule = m.spec.rules[0];
    expect(rule.principal).toEqual({ type: 'user', field: 'metadata.managerEmail' });
    expect(rule.when.groups.requireAny).toEqual(['Manager']);
    expect(rule.grants[0].valueExpression).toBe('{{metadata.department}}');
    expect(validateProtectionManifestLocal(m).valid).toBe(true);
  });
});
