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

  it('formatProtectionListTTY renders one card per manifest with labeled fields', () => {
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
    expect(text).toContain('hubspot-companies');
    expect(text).toContain('Protection key:');
    expect(text).toContain('hubspot-companies-prot');
    expect(text).toContain('Display name:');
    expect(text).toContain('HubSpot companies');
    expect(text).toContain('Enabled:');
    expect(text).toContain('yes');
    expect(text).toContain('Revision:');
    expect(text).toContain('3');
    expect(text).toContain('Showing 1 of 1');
    expect(text).not.toMatch(/RevisionEnabled/);
  });

  it('formatProtectionListTTY keeps long keys readable (no column bleed)', () => {
    const longKey = 'test-e2e-hubspot-companies';
    const text = formatProtectionListTTY({
      environment: 'dev',
      dataplaneUrl: 'http://localhost:3611',
      items: [
        {
          key: longKey,
          datasourceKey: longKey,
          displayName: longKey,
          enabled: true,
          currentRevision: 1
        }
      ],
      meta: { totalItems: 1, currentPage: 1, pageSize: 20 }
    });
    expect(text).toContain(`Protection key: ${longKey}`);
    expect(text).not.toMatch(new RegExp(`${longKey}yes`));
  });

  it('formatProtectionShowTTY uses sections and stacked fields for long keys', () => {
    const longKey = 'test-e2e-hubspot-companies-country-country-sales-access';
    const hash = 'ecaf60260f2aba12741fdb52380be9fa9b232ae066b33917da735d321dba3439';
    const text = formatProtectionShowTTY({
      environment: 'dev',
      dataplaneUrl: 'http://localhost:3611',
      manifest: {
        key: longKey,
        datasourceKey: 'test-e2e-hubspot-companies',
        enabled: true,
        currentRevision: 1,
        configHash: hash,
        lastDeployedAt: '2026-05-19T17:00:26.468265Z',
        spec: { rules: [{ key: 'r1' }] }
      },
      status: {
        protectionKey: longKey,
        datasourceKey: 'test-e2e-hubspot-companies',
        grantCount: 0,
        dynamicValueCount: 0,
        grants: []
      }
    });
    expect(text).toContain('test-e2e-hubspot-companies\n');
    expect(text).toContain('Manifest');
    expect(text).toContain('Deployment');
    expect(text).toContain('Projection cache');
    expect(text).toContain('Protection key');
    expect(text).toContain(`  ${longKey}`);
    expect(text).toContain('ecaf6026…ba3439');
    expect(text).toContain('2026-05-19 17:00:26 UTC');
    expect(text).toContain('Environment: dev · Dataplane: http://localhost:3611');
    expect(text.indexOf('Manifest')).toBeLessThan(text.indexOf('Deployment'));
    expect(text.indexOf('Deployment')).toBeLessThan(text.indexOf('Projection cache'));
  });

  it('formatProtectionShowTTY includes effective value types when verbose', () => {
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
    expect(text).toContain('Grants by rule');
    expect(text).toContain('dynamic');
    expect(text).toContain('static');
  });

  it('deploy not implemented message mentions upload .protection', () => {
    const text = formatDeployProtectionNotImplementedTTY();
    expect(text).toContain('upload .protection');
  });
});
