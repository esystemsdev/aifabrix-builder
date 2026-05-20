/**
 * @fileoverview Tests for identity CSV parser
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  parseCsvLine,
  parseUsersCsvFile,
  buildApplyPlanFromRows
} = require('../../../lib/identity/identity-csv-parser');

describe('identity-csv-parser', () => {
  it('parseCsvLine handles quoted commas', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('parseUsersCsvFile filters by prefix', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'id-csv-'));
    const file = path.join(dir, 'users.csv');
    fs.writeFileSync(
      file,
      'Id,Email,GroupId,GroupName\n' +
        'test-protection-u1,a@x.local,g1,G1\n' +
        'other-u2,b@x.local,g2,G2\n',
      'utf8'
    );
    const { rows } = parseUsersCsvFile(file, 'test-protection');
    expect(rows).toHaveLength(1);
    expect(rows[0].Id).toBe('test-protection-u1');
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
