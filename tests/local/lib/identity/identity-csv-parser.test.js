/**
 * Local-only: writes a temp CSV on disk; `parseUsersCsvFile` uses fs-real-sync and flakes when `fs` is mocked on the default worker.
 *
 * @fileoverview identity CSV parser
 */

'use strict';

const path = require('path');
const {
  existsSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync
} = require('../../../../lib/internal/fs-real-sync');
const {
  parseCsvLine,
  parseUsersCsvFile,
  buildApplyPlanFromRows
} = require('../../../../lib/identity/identity-csv-parser');

describe('identity-csv-parser (local)', () => {
  let tmpDir;

  beforeEach(() => {
    const root = path.join(__dirname, '../../../../.temp/id-csv-');
    mkdirSync(root, { recursive: true });
    tmpDir = mkdtempSync(root);
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      try {
        rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      } catch {
        /* best-effort */
      }
    }
  });

  it('parseCsvLine handles quoted commas', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('parseUsersCsvFile filters by prefix', () => {
    const file = path.join(tmpDir, 'users.csv');
    writeFileSync(
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
