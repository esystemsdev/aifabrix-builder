/**
 * @fileoverview Tests for audit-evidence-poll
 */

'use strict';

const {
  allEnvelopeIdsPresent,
  executionsReadyForVerify
} = require('../../../lib/datasource/audit-evidence-poll');

const captured = {
  id: 'e1',
  operation: 'insert',
  rbacAuditStatus: 'captured',
  abacAuditStatus: 'captured',
  rbacDecision: { id: 'r1' },
  abacTrace: { id: 'a1' }
};

describe('audit-evidence-poll', () => {
  it('executionsReadyForVerify waits for all envelope executionIds', () => {
    expect(
      executionsReadyForVerify([captured], 2, ['e1', 'e2'])
    ).toBe(false);
    expect(allEnvelopeIdsPresent([captured], ['e1'])).toBe(true);
    expect(
      executionsReadyForVerify([captured], 1, ['e1'])
    ).toBe(true);
    expect(
      executionsReadyForVerify(
        [captured, { ...captured, id: 'e2' }],
        2,
        ['e1', 'e2']
      )
    ).toBe(true);
  });
});
