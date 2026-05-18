/**
 * @fileoverview Tests for agent trust dev mock (plan 143).
 */

const {
  isAgentTrustMockEnabled,
  buildMockTrustRun
} = require('../../../lib/datasource/agent-trust-mock');

describe('agent-trust-mock', () => {
  const prev = process.env.AIFABRIX_AGENT_TRUST_MOCK;

  afterEach(() => {
    if (prev === undefined) delete process.env.AIFABRIX_AGENT_TRUST_MOCK;
    else process.env.AIFABRIX_AGENT_TRUST_MOCK = prev;
  });

  it('is disabled by default', () => {
    delete process.env.AIFABRIX_AGENT_TRUST_MOCK;
    expect(isAgentTrustMockEnabled()).toBe(false);
  });

  it('is enabled when env is 1', () => {
    process.env.AIFABRIX_AGENT_TRUST_MOCK = '1';
    expect(isAgentTrustMockEnabled()).toBe(true);
  });

  it('builds mock trust run shape', () => {
    const run = buildMockTrustRun('ds-a', 'sys-a');
    expect(run.datasourceKey).toBe('ds-a');
    expect(run.systemKey).toBe('sys-a');
    expect(run.mock).toBe(true);
    expect(run.trustDecision).toBe('usableWithWarnings');
  });
});
