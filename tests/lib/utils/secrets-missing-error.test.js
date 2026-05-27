/**
 * @fileoverview Tests for secrets-missing-error
 */

'use strict';

const {
  kvRefToSecretSetKey,
  findActiveEnvLineForKvRef,
  buildMissingSecretsErrorMessage
} = require('../../../lib/utils/secrets-missing-error');

describe('secrets-missing-error', () => {
  it('kvRefToSecretSetKey strips kv:// prefix', () => {
    expect(kvRefToSecretSetKey('kv://hubspot-demo/clientSecret')).toBe('hubspot-demo/clientSecret');
  });

  it('findActiveEnvLineForKvRef ignores commented lines', () => {
    const template = [
      '# KV_HUBSPOT_DEMO_CLIENTID=kv://hubspot-demo/clientId',
      'KV_HUBSPOT_DEMO_CLIENTSECRET=kv://hubspot-demo/clientSecret',
      ''
    ].join('\n');
    expect(findActiveEnvLineForKvRef(template, 'kv://hubspot-demo/clientSecret')).toBe(
      'KV_HUBSPOT_DEMO_CLIENTSECRET=kv://hubspot-demo/clientSecret'
    );
    expect(findActiveEnvLineForKvRef(template, 'kv://hubspot-demo/clientId')).toBeNull();
  });

  it('buildMissingSecretsErrorMessage includes stale OAuth hint for oauth paths', () => {
    const msg = buildMissingSecretsErrorMessage({
      missing: ['kv://hubspot-demo/clientSecret'],
      appName: 'hubspot-demo',
      envTemplate: 'KV_HUBSPOT_DEMO_CLIENTSECRET=kv://hubspot-demo/clientSecret\n'
    });
    expect(msg).toContain('Stale-template-hint: oauth-leftover | repair hubspot-demo');
  });

  it('buildMissingSecretsErrorMessage hints when same segment exists under another namespace', () => {
    const msg = buildMissingSecretsErrorMessage({
      missing: ['kv://lab-app-e2e/clientId', 'kv://lab-app-e2e/tenantId'],
      secrets: {
        'lab-app/clientId': 'id-1',
        'lab-app/tenantId': 'tenant-1'
      },
      appName: 'lab-app-e2e'
    });
    expect(msg).toContain('Alternate-kv-hint:');
    expect(msg).toContain('kv://lab-app/clientId');
    expect(msg).toContain('kv://lab-app-e2e/clientId');
    expect(msg).toContain('repair lab-app-e2e');
  });

  it('buildMissingSecretsErrorMessage includes remediation marker', () => {
    const msg = buildMissingSecretsErrorMessage({
      missing: ['kv://hubspot-demo/clientSecret'],
      secretsFilePaths: { userPath: '/tmp/secrets.local.yaml', buildPath: null },
      appName: 'hubspot-demo',
      envTemplatePath: '/tmp/env.template',
      envTemplate: 'KV_HUBSPOT_DEMO_CLIENTSECRET=kv://hubspot-demo/clientSecret\n'
    });
    expect(msg).toContain('Missing secrets: kv://hubspot-demo/clientSecret');
    expect(msg).toContain('Remediation-hint: comment-or-delete-template-line | secret-set');
    expect(msg).toContain('Env-template-line: kv://hubspot-demo/clientSecret|');
  });
});
