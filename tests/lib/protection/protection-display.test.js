'use strict';

const {
  formatProtectionValidateTTY,
  formatProtectionListTTY,
  formatProtectionShowTTY,
  formatDeployProtectionNotImplementedTTY
} = require('../../../lib/protection/protection-display');

describe('protection-display', () => {
  it('formats FAIL validation report with issue rows', () => {
    const text = formatProtectionValidateTTY({
      metadata: { protectionKey: 'p1', datasourceKey: 'hubspot-companies' },
      summary: { fail: 1, warn: 0, pass: 2 },
      results: [
        {
          taskId: 'prot-fk',
          status: 'FAIL',
          errorCode: 'DP-PROT-011',
          message: 'Unknown FK in expression',
          hint: 'register foreign key',
          schemaPath: 'spec.rules[0].grants[0].valueExpression'
        }
      ]
    });
    expect(text).toContain('DP-PROT-011');
    expect(text).toContain('Validation issues:');
    expect(text).toContain('Failed');
  });

  it('formatProtectionListTTY shows empty state when no items', () => {
    const text = formatProtectionListTTY({
      environment: 'dev',
      dataplaneUrl: 'http://localhost:3201',
      items: [],
      meta: { totalItems: 0, currentPage: 1, pageSize: 20 }
    });
    expect(text).toContain('No protection manifests found');
    expect(text).not.toContain('Showing');
  });

  it('formatProtectionListTTY renders table columns', () => {
    const text = formatProtectionListTTY({
      environment: 'dev',
      dataplaneUrl: 'http://localhost:3201',
      items: [
        {
          key: 'hubspot-companies-prot',
          datasourceKey: 'hubspot-companies',
          displayName: 'HubSpot companies',
          enabled: true,
          currentRevision: 3
        }
      ],
      meta: { totalItems: 1, currentPage: 1, pageSize: 20 }
    });
    expect(text).toContain('Key');
    expect(text).toContain('Datasource');
    expect(text).toContain('hubspot-companies');
    expect(text).toContain('yes');
    expect(text).toContain('3');
    expect(text).toContain('Showing 1 of 1');
  });

  it('formatProtectionShowTTY includes effective value types', () => {
    const text = formatProtectionShowTTY({
      environment: 'dev',
      dataplaneUrl: 'http://localhost:3201',
      manifest: {
        key: 'p1',
        datasourceKey: 'hubspot-companies',
        enabled: true,
        spec: { rules: [{ key: 'r1' }] }
      },
      status: {
        protectionKey: 'p1',
        datasourceKey: 'hubspot-companies',
        grantCount: 2,
        dynamicValueCount: 1,
        grants: [
          { projectionRuleKey: 'r1', dimensionKey: 'country', effectiveValueType: 'dynamic' },
          { projectionRuleKey: 'r1', dimensionKey: 'region', effectiveValueType: 'static' }
        ]
      }
    }, { verbose: true });
    expect(text).toContain('dynamic');
    expect(text).toContain('static');
  });

  it('deploy not implemented message mentions upload .protection', () => {
    const text = formatDeployProtectionNotImplementedTTY();
    expect(text).toContain('upload .protection');
  });
});
