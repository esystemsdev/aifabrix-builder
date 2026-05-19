/**
 * @fileoverview Tests for lib/utils/agent-trust-wait-ui.js
 */

'use strict';

const {
  buildAgentTrustWaitSpinnerText,
  runWithAgentTrustWaitSpinner,
  shouldUseAgentTrustWaitSpinner
} = require('../../../lib/utils/agent-trust-wait-ui');

describe('agent-trust-wait-ui', () => {
  it('buildAgentTrustWaitSpinnerText includes datasource key and budget', () => {
    const deadlineMs = Date.now() + 90000;
    const t = buildAgentTrustWaitSpinnerText('hubspot-companies', deadlineMs);
    expect(t).toContain('semantic trust validation');
    expect(t).toContain('hubspot-companies');
    expect(t).toMatch(/~\d+s left/);
  });

  it('runWithAgentTrustWaitSpinner invokes work on non-TTY without ora', async() => {
    const prev = process.stdout.isTTY;
    process.stdout.isTTY = false;
    try {
      const out = await runWithAgentTrustWaitSpinner(async() => 'done', {
        datasourceKey: 'x',
        timeoutMs: 5000
      });
      expect(out).toBe('done');
      expect(shouldUseAgentTrustWaitSpinner()).toBe(false);
    } finally {
      process.stdout.isTTY = prev;
    }
  });
});
