/**
 * Tests for dev CLI handlers (list, add, update, pin, delete).
 * @fileoverview Unit tests for lib/commands/dev-cli-handlers.js
 */

jest.mock('chalk', () => {
  const m = (s) => s;
  m.yellow = (s) => s;
  m.blue = (s) => s;
  m.green = (s) => s;
  m.cyan = (s) => s;
  m.gray = (s) => s;
  m.bold = (s) => s;
  return m;
});
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ getDeveloperId: jest.fn().mockResolvedValue('01') }));
jest.mock('../../../lib/utils/remote-dev-auth', () => ({ getRemoteDevAuth: jest.fn() }));
jest.mock('../../../lib/api/dev.api');

const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const { getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const {
  handleDevList,
  handleDevAdd,
  handleDevUpdate,
  handleDevPin,
  handleDevDelete
} = require('../../../lib/commands/dev-cli-handlers');

describe('dev-cli-handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    config.getDeveloperId.mockResolvedValue('01');
  });

  describe('handleDevList', () => {
    it('logs message when remote not configured', async() => {
      getRemoteDevAuth.mockResolvedValue(null);
      await handleDevList();
      expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('Remote server is not configured'));
    });

    it('lists users from API in table format sorted by name', async() => {
      devApi.listUsers.mockResolvedValue([
        { id: '02', name: 'Alice', email: 'a@example.com', certificateIssued: false, groups: ['developer'] },
        { id: '01', name: 'Bob', email: 'b@example.com', certificateIssued: true, certificateValidNotAfter: '2026-01-01', groups: ['admin'] }
      ]);
      await handleDevList();
      expect(devApi.listUsers).toHaveBeenCalledWith('https://dev.example.com', 'pem');
      const logger = require('../../../lib/utils/logger').log;
      expect(logger).toHaveBeenCalledWith(expect.stringContaining('Developers:'));
      expect(logger).toHaveBeenCalledWith(expect.stringMatching(/^ID\s+Name\s+Email\s+Cert\s+Groups$/));
      // Sorted by name: Alice then Bob
      const calls = logger.mock.calls.map(c => c[0]);
      const aliceRow = calls.find(s => typeof s === 'string' && s.includes('Alice') && s.includes('a@example.com'));
      const bobRow = calls.find(s => typeof s === 'string' && s.includes('Bob') && s.includes('b@example.com'));
      expect(aliceRow).toBeDefined();
      expect(bobRow).toBeDefined();
      expect(calls.indexOf(aliceRow)).toBeLessThan(calls.indexOf(bobRow));
    });
  });

  describe('handleDevAdd', () => {
    it('throws when remote not configured', async() => {
      getRemoteDevAuth.mockResolvedValue(null);
      await expect(handleDevAdd({ developerId: '02', name: 'Two', email: 't@e.com' })).rejects.toThrow('Remote server is not configured. Set remote-server and run "aifabrix dev init" first.');
    });

    it('creates user and logs success', async() => {
      devApi.createUser.mockResolvedValue({ id: '02' });
      await handleDevAdd({ developerId: '02', name: 'Two', email: 't@e.com' });
      expect(devApi.createUser).toHaveBeenCalledWith('https://dev.example.com', 'pem', expect.objectContaining({ developerId: '02', name: 'Two', email: 't@e.com' }));
    });
  });

  describe('handleDevUpdate', () => {
    it('throws when remote not configured', async() => {
      getRemoteDevAuth.mockResolvedValue(null);
      await expect(handleDevUpdate('01', { name: 'New' })).rejects.toThrow('Remote server is not configured. Set remote-server and run "aifabrix dev init" first.');
    });

    it('throws when no name/email/groups provided', async() => {
      await expect(handleDevUpdate('01', {})).rejects.toThrow('at least one of');
    });

    it('throws when no developer ID (positional or --developer-id)', async() => {
      await expect(handleDevUpdate(undefined, { name: 'New' })).rejects.toThrow('Developer ID is required');
    });

    it('calls updateUser with body (positional id)', async() => {
      devApi.updateUser.mockResolvedValue(undefined);
      await handleDevUpdate('01', { name: 'New Name' });
      expect(devApi.updateUser).toHaveBeenCalledWith('https://dev.example.com', 'pem', '01', { name: 'New Name' });
    });

    it('calls updateUser with --developer-id when provided', async() => {
      devApi.updateUser.mockResolvedValue(undefined);
      await handleDevUpdate(undefined, { developerId: '02', name: 'New Name' });
      expect(devApi.updateUser).toHaveBeenCalledWith('https://dev.example.com', 'pem', '02', { name: 'New Name' });
    });
  });

  describe('handleDevPin', () => {
    it('throws when remote not configured', async() => {
      getRemoteDevAuth.mockResolvedValue(null);
      await expect(handleDevPin()).rejects.toThrow('Remote server is not configured. Set remote-server and run "aifabrix dev init" first.');
    });

    it('uses config developerId when no arg', async() => {
      devApi.createPin.mockResolvedValue({ pin: '123456', expiresAt: '2026-01-01' });
      await handleDevPin();
      expect(devApi.createPin).toHaveBeenCalledWith('https://dev.example.com', 'pem', '01');
    });

    it('uses arg developerId when provided', async() => {
      devApi.createPin.mockResolvedValue({ pin: '654321', expiresAt: '2026-01-01' });
      await handleDevPin('02');
      expect(devApi.createPin).toHaveBeenCalledWith('https://dev.example.com', 'pem', '02');
    });
  });

  describe('handleDevDelete', () => {
    it('throws when remote not configured', async() => {
      getRemoteDevAuth.mockResolvedValue(null);
      await expect(handleDevDelete('02')).rejects.toThrow('Remote server is not configured. Set remote-server and run "aifabrix dev init" first.');
    });

    it('calls deleteUser and logs', async() => {
      devApi.deleteUser.mockResolvedValue(undefined);
      await handleDevDelete('02');
      expect(devApi.deleteUser).toHaveBeenCalledWith('https://dev.example.com', 'pem', '02');
    });
  });
});
