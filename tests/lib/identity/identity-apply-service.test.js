/**
 * @fileoverview Tests for identity apply service
 */

jest.mock('../../../lib/identity/identity-csv-parser', () => ({
  parseUsersCsvFile: jest.fn(),
  buildApplyPlanFromRows: jest.fn()
}));
jest.mock('../../../lib/api/groups.api');
jest.mock('../../../lib/api/users.api');
jest.mock('../../../lib/api/user-groups.api');
jest.mock('../../../lib/api/auth-cache.api');
jest.mock('../../../lib/api/dataplane-sync.api');

const { parseUsersCsvFile, buildApplyPlanFromRows } = require('../../../lib/identity/identity-csv-parser');
const groupsApi = require('../../../lib/api/groups.api');
const usersApi = require('../../../lib/api/users.api');
const userGroupsApi = require('../../../lib/api/user-groups.api');
const { runIdentityApply } = require('../../../lib/identity/identity-apply-service');

const CTX = ['http://c', { token: 't' }];

describe('identity-apply-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    parseUsersCsvFile.mockReturnValue({
      headers: ['Id', 'Email', 'GroupId'],
      rows: [{ Id: 'u1', Email: 'a@x.local', GroupId: 'g1', GroupName: 'G1' }]
    });
    const groups = new Map([['g1', { name: 'g1', displayName: 'G1' }]]);
    const users = new Map([
      [
        'u1',
        { csvId: 'u1', email: 'a@x.local', firstName: 'A', lastName: 'B', displayName: 'AB' }
      ]
    ]);
    buildApplyPlanFromRows.mockReturnValue({
      groups,
      users,
      memberships: [{ userKey: 'u1', groupName: 'g1' }]
    });
    groupsApi.getGroup.mockResolvedValue({ success: false });
    groupsApi.createGroup.mockResolvedValue({
      success: true,
      data: { data: { id: 'gid-1', name: 'g1' } }
    });
    usersApi.getUser.mockResolvedValue({ success: false });
    usersApi.listUsers.mockResolvedValue({ success: true, data: { data: [] } });
    usersApi.createUser.mockResolvedValue({
      success: true,
      data: { data: { id: 'uid-1', email: 'a@x.local' } }
    });
    userGroupsApi.addUserToGroup.mockResolvedValue({ success: true });
  });

  it('dry-run does not call create APIs', async() => {
    const summary = await runIdentityApply(CTX[0], CTX[1], {
      filePath: '/tmp/x.csv',
      dryRun: true
    });
    expect(groupsApi.createGroup).not.toHaveBeenCalled();
    expect(usersApi.createUser).not.toHaveBeenCalled();
    expect(userGroupsApi.addUserToGroup).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
    expect(summary.groupsCreated).toBe(1);
  });

  it('creates group, user, and membership on apply', async() => {
    const summary = await runIdentityApply(CTX[0], CTX[1], {
      filePath: '/tmp/x.csv'
    });
    expect(groupsApi.createGroup).toHaveBeenCalled();
    expect(usersApi.createUser).toHaveBeenCalled();
    expect(userGroupsApi.addUserToGroup).toHaveBeenCalledWith(
      'http://c',
      expect.any(Object),
      'uid-1',
      'gid-1',
      {}
    );
    expect(summary.membershipsCreated).toBe(1);
  });

  it('[EDGE] skips duplicate membership errors', async() => {
    userGroupsApi.addUserToGroup.mockResolvedValue({
      success: false,
      error: 'User is already a member of this group'
    });
    const summary = await runIdentityApply(CTX[0], CTX[1], { filePath: '/tmp/x.csv' });
    expect(summary.membershipsSkipped).toBe(1);
  });
});
