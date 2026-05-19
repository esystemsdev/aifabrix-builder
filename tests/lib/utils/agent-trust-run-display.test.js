/**
 * @fileoverview Tests for agent trust TTY display (plan 143).
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const logger = require('../../../lib/utils/logger');
const {
  displayAgentTrustRunTTY,
  displaySystemTrustRollupTTY
} = require('../../../lib/utils/agent-trust-run-display');

describe('agent-trust-run-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prints semantic trust header and decision', () => {
    displayAgentTrustRunTTY(
      {
        datasourceKey: 'hubspot-companies',
        systemKey: 'hubspot',
        trustDecision: 'usableWithWarnings',
        validationStatus: 'passed',
        confidence: 0.8,
        summary: 'Review filters',
        highLevelWarnings: ['Broad list filter']
      },
      { environment: 'dev', strict: false }
    );
    const text = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(text).toContain('Semantic trust');
    expect(text).toContain('usableWithWarnings');
    expect(text).toContain('Broad list filter');
    expect(text).toContain('test-e2e');
  });

  it('skips output for --json', () => {
    displayAgentTrustRunTTY({ datasourceKey: 'x', trustDecision: 'trusted' }, { json: true });
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('verbose shows findings only once (not duplicated in high-level warnings)', () => {
    const finding = {
      severity: 'warning',
      code: '4041-OP-SEMANTICS-UNKNOWN',
      message: 'Operation updateAddress needs shape (R7).'
    };
    displayAgentTrustRunTTY(
      {
        datasourceKey: 'hubspot-companies',
        systemKey: 'hubspot',
        trustDecision: 'usableWithWarnings',
        validationStatus: 'passed',
        confidence: 0.89,
        summary: 'Review semantics',
        highLevelWarnings: ['4041-OP-SEMANTICS-UNKNOWN — Operation updateAddress needs shape (R7).'],
        findings: [finding]
      },
      { environment: 'dev', verbose: true }
    );
    const text = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(text).not.toContain('Warnings (high level)');
    expect(text).toContain('Findings (verbose, max 10)');
    expect(text).toContain('4041-OP-SEMANTICS-UNKNOWN');
    expect((text.match(/4041-OP-SEMANTICS-UNKNOWN/g) || []).length).toBe(1);
    expect(text).not.toContain('undefined');
  });

  it('prints system rollup table', () => {
    displaySystemTrustRollupTTY('hubspot', [
      {
        key: 'hubspot-companies',
        success: true,
        trustRun: {
          trustDecision: 'trusted',
          validationStatus: 'passed',
          confidence: 1
        }
      }
    ]);
    const text = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(text).toContain('hubspot-companies');
    expect(text).toContain('worst-of rollup');
  });
});
