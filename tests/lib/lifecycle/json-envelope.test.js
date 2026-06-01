/**
 * @fileoverview Tests for --json envelope builder (plan 150.0).
 */

'use strict';

const { buildJsonEnvelope } = require('../../../lib/lifecycle/json-envelope');

describe('json-envelope', () => {
  const sample = {
    systemKey: 'acme-crm',
    command: 'verify-operations',
    verdict: 'VERIFIED',
    operationalReadinessPercent: 94,
    details: { reliability: { validation: true } }
  };

  it('omits details when includeDetails is false', () => {
    const out = buildJsonEnvelope(sample, false);
    expect(out.operationalReadinessPercent).toBe(94);
    expect(out.details).toBeUndefined();
  });

  it('keeps details when includeDetails is true', () => {
    const out = buildJsonEnvelope(sample, true);
    expect(out.details).toEqual(sample.details);
  });
});
