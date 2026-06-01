/**
 * @fileoverview Tests for lifecycle command action (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const {
  lifecycleVerdictFromReport,
  normalizeLifecycleCliOptions
} = require('../../../lib/commands/lifecycle-command-action');
const { VERDICT } = require('../../../lib/lifecycle/product-model');

describe('lifecycle-command-action', () => {
  it('lifecycleVerdictFromReport returns VERIFIED when all pillars verified', () => {
    const verdict = lifecycleVerdictFromReport({
      operations: { verdict: VERDICT.VERIFIED },
      trust: { verdict: VERDICT.VERIFIED },
      governance: { verdict: VERDICT.VERIFIED }
    });
    expect(verdict).toBe(VERDICT.VERIFIED);
  });

  it('lifecycleVerdictFromReport returns NOT_VERIFIED when a pillar missing', () => {
    const verdict = lifecycleVerdictFromReport({
      operations: { verdict: VERDICT.VERIFIED },
      trust: { verdict: VERDICT.NOT_VERIFIED },
      governance: { verdict: VERDICT.NOT_VERIFIED }
    });
    expect(verdict).toBe(VERDICT.NOT_VERIFIED);
  });

  it('lifecycleVerdictFromReport returns FAILED when any pillar failed', () => {
    const verdict = lifecycleVerdictFromReport({
      operations: { verdict: VERDICT.FAILED },
      trust: { verdict: VERDICT.VERIFIED },
      governance: { verdict: VERDICT.VERIFIED }
    });
    expect(verdict).toBe(VERDICT.FAILED);
  });

  it('normalizeLifecycleCliOptions maps -v and --no-sync from raw argv', () => {
    const cmd = { rawArgs: ['lifecycle', 'acme', '-v', '--run', '--no-sync'] };
    const opts = normalizeLifecycleCliOptions({ env: 'dev' }, cmd);
    expect(opts.verbose).toBe(true);
    expect(opts.run).toBe(true);
    expect(opts.noSync).toBe(true);
    expect(opts.debug).toBe(false);
  });
});
