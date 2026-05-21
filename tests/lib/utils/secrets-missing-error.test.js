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
