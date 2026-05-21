/**
 * @fileoverview Pure unit tests for identity CSV parser (no disk I/O — file I/O in tests/local).
 */

'use strict';

const {
  parseCsvLine,
  buildApplyPlanFromRows
} = require('../../../lib/identity/identity-csv-parser');

describe('identity-csv-parser', () => {
  it('parseCsvLine handles quoted commas', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('buildApplyPlanFromRows dedupes users and collects memberships', () => {
    const plan = buildApplyPlanFromRows([
      { Id: 'u1', Email: 'a@x.local', GroupId: 'g1', GroupName: 'G1' },
      { Id: 'u1', Email: 'a@x.local', GroupId: 'g2', GroupName: 'G2' }
    ]);
    expect(plan.users.size).toBe(1);
    expect(plan.groups.size).toBe(2);
    expect(plan.memberships).toHaveLength(2);
  });

  it('[EDGE] skips rows without email', () => {
    const plan = buildApplyPlanFromRows([{ Id: 'u1', GroupId: 'g1' }]);
    expect(plan.users.size).toBe(0);
  });
});
