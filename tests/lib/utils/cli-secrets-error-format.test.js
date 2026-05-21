/**
 * @fileoverview Tests for cli-secrets-error-format
 */

'use strict';

const { formatSecretsError } = require('../../../lib/utils/cli-secrets-error-format');

// eslint-disable-next-line no-control-regex -- strip ANSI for assertions
const ANSI_CODE_RE = /\x1b\[[\d;]*m/g;
function stripAnsi(str) {
  return String(str).replace(ANSI_CODE_RE, '');
}

describe('cli-secrets-error-format', () => {
  it('formats remediation hints and stale OAuth repair hint', () => {
    const msg =
      'Missing secrets: kv://hubspot-demo/clientSecret\n' +
      'Secrets file location: /tmp/secrets.local.yaml\n' +
      'Env-template-path: /workspace/integration/hubspot-demo/env.template\n' +
      'Env-template-line: kv://hubspot-demo/clientSecret|KV_HUBSPOT_DEMO_CLIENTSECRET=kv://hubspot-demo/clientSecret\n' +
      'App-name: hubspot-demo\n' +
      'Stale-template-hint: oauth-leftover | repair hubspot-demo\n' +
      'Remediation-hint: comment-or-delete-template-line | secret-set\n';

    const lines = formatSecretsError(msg);
    expect(lines).not.toBeNull();
    const plain = lines.map(stripAnsi).join('\n');
    expect(plain).toContain('aifabrix secret set hubspot-demo/clientSecret');
    expect(plain).toContain('aifabrix repair hubspot-demo');
    expect(plain).not.toContain('aifabrix resolve hubspot-demo to generate');
  });
});
